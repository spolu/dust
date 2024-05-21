import { ConnectorsAPI, removeNulls } from "@dust-tt/types";
import { chunk } from "lodash";
import _ from "lodash";

import {
  archiveAgentConfiguration,
  getAgentConfigurations,
} from "@app/lib/api/assistant/configuration";
import { isGlobalAgentId } from "@app/lib/api/assistant/global_agents";
import { deleteDataSource, getDataSources } from "@app/lib/api/data_sources";
import { renderUserType } from "@app/lib/api/user";
import { getMembers } from "@app/lib/api/workspace";
import { Authenticator, subscriptionForWorkspaces } from "@app/lib/auth";
import { destroyConversation } from "@app/lib/conversation";
import { sendAdminDataDeletionEmail } from "@app/lib/email";
import { Conversation } from "@app/lib/models/assistant/conversation";
import { User } from "@app/lib/models/user";
import { Workspace } from "@app/lib/models/workspace";
import { FREE_TEST_PLAN_CODE } from "@app/lib/plans/plan_codes";
import { MembershipResource } from "@app/lib/resources/membership_resource";
import { CustomerioServerSideTracking } from "@app/lib/tracking/customerio/server";
import { renderLightWorkspaceType } from "@app/lib/workspace";
import logger from "@app/logger/logger";

export async function sendDataDeletionEmail({
  remainingDays,
  workspaceId,
  isLast,
}: {
  remainingDays: number;
  workspaceId: string;
  isLast: boolean;
}) {
  try {
    const auth = await Authenticator.internalAdminForWorkspace(workspaceId);
    const ws = auth.workspace();
    if (!ws) {
      throw new Error("No workspace found");
    }
    const admins = await getMembers(auth, { roles: ["admin"] });
    for (const a of admins) {
      await sendAdminDataDeletionEmail({
        email: a.email,
        firstName: a.firstName,
        workspaceName: ws.name,
        remainingDays,
        isLast,
      });
    }
  } catch (e) {
    logger.error(
      { panic: true, error: e },
      "Failed to send data deletion email"
    );
    throw e;
  }
}

export async function shouldStillScrubData({
  workspaceId,
}: {
  workspaceId: string;
}): Promise<boolean> {
  return !(
    await Authenticator.internalAdminForWorkspace(workspaceId)
  ).isUpgraded();
}

export async function scrubWorkspaceData({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const auth = await Authenticator.internalAdminForWorkspace(workspaceId);
  await deleteAllConversations(auth);
  await archiveAssistants(auth);
  await deleteDatasources(auth);
  await cleanupCustomerio(auth);
}

export async function pauseAllConnectors({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const auth = await Authenticator.internalAdminForWorkspace(workspaceId);
  const dataSources = await getDataSources(auth);
  const connectorsApi = new ConnectorsAPI(logger);
  for (const ds of dataSources) {
    if (!ds.connectorId) {
      continue;
    }
    await connectorsApi.pauseConnector(ds.connectorId);
  }
}

async function deleteAllConversations(auth: Authenticator) {
  const workspace = auth.workspace();
  if (!workspace) {
    throw new Error("No workspace found");
  }
  const conversations = await Conversation.findAll({
    where: { workspaceId: workspace.id },
  });
  logger.info(
    { workspaceId: workspace.sId, conversationsCount: conversations.length },
    "Deleting all conversations for workspace."
  );

  const conversationChunks = chunk(conversations, 4);
  for (const conversationChunk of conversationChunks) {
    await Promise.all(
      conversationChunk.map(async (c) => {
        await destroyConversation(workspace, c);
      })
    );
  }
}

async function archiveAssistants(auth: Authenticator) {
  const agentConfigurations = await getAgentConfigurations({
    auth,
    agentsGetView: "admin_internal",
    variant: "light",
  });

  const agentConfigurationsToArchive = agentConfigurations.filter(
    (ac) => !isGlobalAgentId(ac.sId)
  );
  for (const agentConfiguration of agentConfigurationsToArchive) {
    await archiveAgentConfiguration(auth, agentConfiguration.sId);
  }
}

async function deleteDatasources(auth: Authenticator) {
  const dataSources = await getDataSources(auth);
  for (const dataSource of dataSources) {
    const r = await deleteDataSource(auth, dataSource.name);
    if (r.isErr()) {
      throw new Error(`Failed to delete data source: ${r.error.message}`);
    }
  }
}

async function cleanupCustomerio(auth: Authenticator) {
  const w = auth.workspace();

  if (!w) {
    throw new Error("No workspace found");
  }

  // Fetch all the memberships for the workspace.
  const workspaceMemberships = await MembershipResource.getLatestMemberships({
    workspace: w,
  });

  // Fetch all the users in the workspace.
  const userIds = workspaceMemberships.map((m) => m.userId);
  const users = (
    userIds.length
      ? await User.findAll({
          where: {
            id: userIds,
          },
        })
      : []
  ).map(renderUserType);

  // For each user, fetch all their memberships.
  const allMembershipsByUserId = _.groupBy(
    userIds.length
      ? await MembershipResource.getLatestMemberships({
          users,
        })
      : [],
    (m) => m.userId.toString()
  );

  // For every membership, fetch the workspace.
  const workspaceIds = Object.values(allMembershipsByUserId)
    .flat()
    .map((m) => m.workspaceId);
  const workspaceById = _.keyBy(
    workspaceIds.length
      ? await Workspace.findAll({
          where: {
            id: workspaceIds,
          },
        })
      : [],
    (w) => w.id.toString()
  );

  // Finally, fetch all the subscriptions for the workspaces.
  const workspaceSids = Object.values(workspaceById).map((ws) => ws.sId);
  const subscriptionsByWorkspaceSid = workspaceSids.length
    ? await subscriptionForWorkspaces(workspaceSids)
    : {};

  // Process the workspace users in chunks of 16.
  const chunks = chunk(users, 16);

  for (const c of chunks) {
    await Promise.all(
      c.map((u) => {
        // Get all the memberships of the user.
        const allMembershipsOfUser =
          allMembershipsByUserId[u.id.toString()] ?? [];
        // Get all the workspaces of the user.
        const workspacesOfUser = removeNulls(
          allMembershipsOfUser.map(
            (m) => workspaceById[m.workspaceId.toString()]
          )
        );
        if (
          workspacesOfUser.some((w) => {
            const subscription = subscriptionsByWorkspaceSid[w.sId];
            return (
              subscription && subscription.plan.code !== FREE_TEST_PLAN_CODE
            );
          })
        ) {
          // If any of the workspaces has a real subscription, do not delete the user.
          return;
        }

        // Delete the user from Customer.io.
        logger.info(
          { userId: u.sId },
          "User is not tied to a workspace with a real subscription anymore, deleting from Customer.io."
        );

        return CustomerioServerSideTracking.deleteUser({
          user: u,
        }).catch((err) => {
          logger.error(
            { userId: u.sId, err },
            "Failed to delete user on Customer.io"
          );
        });
      })
    );
  }

  await CustomerioServerSideTracking.deleteWorkspace({
    workspace: renderLightWorkspaceType({ workspace: w }),
  }).catch((err) => {
    logger.error(
      { workspaceId: w.sId, err },
      "Failed to delete workspace on Customer.io"
    );
  });
}

import { CoreAPI } from "@dust-tt/types";
import { Storage } from "@google-cloud/storage";
import { Op } from "sequelize";

import { Authenticator } from "@app/lib/auth";
import { front_sequelize } from "@app/lib/databases";
import {
  AgentConfiguration,
  AgentDataSourceConfiguration,
  AgentDustAppRunAction,
  AgentDustAppRunConfiguration,
  AgentGenerationConfiguration,
  AgentMessage,
  AgentRetrievalAction,
  AgentRetrievalConfiguration,
  App,
  Clone,
  Conversation,
  Dataset,
  DataSource,
  Key,
  Membership,
  MembershipInvitation,
  Message,
  Provider,
  RetrievalDocument,
  RetrievalDocumentChunk,
  Run,
  Subscription,
  User,
  UserMessage,
  UserMetadata,
  Workspace,
} from "@app/lib/models";
import {
  AgentUserRelation,
  GlobalAgentSettings,
} from "@app/lib/models/assistant/agent";
import {
  ContentFragment,
  ConversationParticipant,
  Mention,
  MessageReaction,
} from "@app/lib/models/assistant/conversation";
import { PlanInvitation } from "@app/lib/models/plan";
import logger from "@app/logger/logger";

const { DUST_DATA_SOURCES_BUCKET, SERVICE_ACCOUNT } = process.env;

export async function scrubDataSourceActivity({
  dustAPIProjectId,
}: {
  dustAPIProjectId: string;
}) {
  if (!SERVICE_ACCOUNT) {
    throw new Error("SERVICE_ACCOUNT is not set.");
  }
  if (!DUST_DATA_SOURCES_BUCKET) {
    throw new Error("DUST_DATA_SOURCES_BUCKET is not set.");
  }

  const storage = new Storage({ keyFilename: SERVICE_ACCOUNT });

  const [files] = await storage
    .bucket(DUST_DATA_SOURCES_BUCKET)
    .getFiles({ prefix: dustAPIProjectId });

  const chunkSize = 32;
  const chunks = [];
  for (let i = 0; i < files.length; i += chunkSize) {
    chunks.push(files.slice(i, i + chunkSize));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) {
      continue;
    }
    await Promise.all(
      chunk.map((f) => {
        return (async () => {
          await f.delete();
        })();
      })
    );
  }
}

export async function isWorkflowDeletableActivity({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const auth = await Authenticator.internalBuilderForWorkspace(workspaceId);
  const workspace = auth.workspace();
  if (!workspace) {
    return false;
  }

  // Workspace must have no data sources.
  const dataSources = await DataSource.findAll({
    where: {
      workspaceId: workspace.id,
      visibility: {
        [Op.or]: ["public", "private", "unlisted"],
      },
    },
    limit: 1,
  });
  if (dataSources.length > 0) {
    return false;
  }

  // For now we don't support deleting workspaces who had a paid subscription at some point.
  const subscriptions = await Subscription.findAll({
    where: {
      workspaceId: workspace.id,
      stripeSubscriptionId: {
        [Op.not]: null,
      },
    },
  });
  return subscriptions.length === 0;
}

export async function deleteConversationsActivity({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const auth = await Authenticator.internalBuilderForWorkspace(workspaceId);
  const workspace = auth.workspace();

  if (!workspace) {
    throw new Error("Could not find the workspace.");
  }

  const conversations = await Conversation.findAll({
    where: {
      workspaceId: workspace.id,
    },
  });
  await front_sequelize.transaction(async (t) => {
    const chunkSize = 8;
    const chunks = [];
    for (let i = 0; i < conversations.length; i += chunkSize) {
      chunks.push(conversations.slice(i, i + chunkSize));
    }
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) {
        continue;
      }
      await Promise.all(
        chunk.map((c) => {
          return (async () => {
            const messages = await Message.findAll({
              where: { conversationId: c.id },
              transaction: t,
            });
            for (const msg of messages) {
              if (msg.userMessageId) {
                await UserMessage.destroy({
                  where: { id: msg.userMessageId },
                  transaction: t,
                });
              }
              if (msg.agentMessageId) {
                const agentMessage = await AgentMessage.findOne({
                  where: { id: msg.agentMessageId },
                  transaction: t,
                });
                if (agentMessage) {
                  if (agentMessage.agentRetrievalActionId) {
                    const retrievalDocuments = await RetrievalDocument.findAll({
                      where: {
                        retrievalActionId: agentMessage.agentRetrievalActionId,
                      },
                      transaction: t,
                    });
                    for (const retrievalDocument of retrievalDocuments) {
                      await RetrievalDocumentChunk.destroy({
                        where: {
                          retrievalDocumentId: retrievalDocument.id,
                        },
                        transaction: t,
                      });
                      await retrievalDocument.destroy({ transaction: t });
                    }
                    await AgentRetrievalAction.destroy({
                      where: { id: agentMessage.agentRetrievalActionId },
                      transaction: t,
                    });
                  }
                  await agentMessage.destroy({ transaction: t });
                }
              }
              if (msg.contentFragmentId) {
                await ContentFragment.destroy({
                  where: { id: msg.contentFragmentId },
                  transaction: t,
                });
              }
              await MessageReaction.destroy({
                where: { messageId: msg.id },
                transaction: t,
              });
              await Mention.destroy({
                where: { messageId: msg.id },
                transaction: t,
              });
              await msg.destroy({ transaction: t });
            }
            await ConversationParticipant.destroy({
              where: { conversationId: c.id },
              transaction: t,
            });
            await c.destroy({ transaction: t });
          })();
        })
      );
    }
  });
}

export async function deleteAgentsActivity({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const auth = await Authenticator.internalBuilderForWorkspace(workspaceId);
  const workspace = auth.workspace();

  if (!workspace) {
    throw new Error("Could not find the workspace.");
  }

  const agents = await AgentConfiguration.findAll({
    where: {
      workspaceId: workspace.id,
    },
  });
  await front_sequelize.transaction(async (t) => {
    for (const agent of agents) {
      if (agent.generationConfigurationId) {
        await AgentGenerationConfiguration.destroy({
          where: {
            id: agent.generationConfigurationId,
          },
          transaction: t,
        });
      } else if (agent.retrievalConfigurationId) {
        await AgentDataSourceConfiguration.destroy({
          where: {
            retrievalConfigurationId: agent.retrievalConfigurationId,
          },
          transaction: t,
        });
        await AgentRetrievalConfiguration.destroy({
          where: {
            id: agent.retrievalConfigurationId,
          },
          transaction: t,
        });
      } else if (agent.dustAppRunConfigurationId) {
        await AgentDustAppRunAction.destroy({
          where: {
            dustAppRunConfigurationId: agent.dustAppRunConfigurationId,
          },
          transaction: t,
        });
        await AgentDustAppRunConfiguration.destroy({
          where: {
            id: agent.dustAppRunConfigurationId,
          },
          transaction: t,
        });
      }
      await AgentUserRelation.destroy({
        where: {
          agentConfigurationId: agent.id,
        },
        transaction: t,
      });
      await agent.destroy({ transaction: t });
    }
    await GlobalAgentSettings.destroy({
      where: {
        workspaceId: workspace.id,
      },
      transaction: t,
    });
  });
}

export async function deleteAppsActivity({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const coreAPI = new CoreAPI(logger);
  const auth = await Authenticator.internalBuilderForWorkspace(workspaceId);
  const workspace = auth.workspace();

  if (!workspace) {
    throw new Error("Could not find the workspace.");
  }

  const apps = await App.findAll({
    where: { workspaceId: workspace.id },
  });

  await front_sequelize.transaction(async (t) => {
    for (const app of apps) {
      await coreAPI.deleteProject({ projectId: app.dustAPIProjectId });
      await Run.destroy({
        where: {
          appId: app.id,
        },
        transaction: t,
      });
      await Clone.destroy({
        where: {
          [Op.or]: [{ fromId: app.id }, { toId: app.id }],
        },
        transaction: t,
      });
      await Dataset.destroy({
        where: {
          appId: app.id,
        },
        transaction: t,
      });
      await app.destroy({ transaction: t });
    }
    await Key.destroy({
      where: {
        workspaceId: workspace.id,
      },
      transaction: t,
    });
    await Provider.destroy({
      where: {
        workspaceId: workspace.id,
      },
      transaction: t,
    });
  });
}

export async function deleteRunOnDustAppsActivity({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const coreAPI = new CoreAPI(logger);
  const auth = await Authenticator.internalBuilderForWorkspace(workspaceId);
  const workspace = auth.workspace();

  if (!workspace) {
    throw new Error("Could not find the workspace.");
  }

  await front_sequelize.transaction(async (t) => {
    const runs = await Run.findAll({
      where: {
        workspaceId: workspace.id,
      },
      include: [
        {
          model: App,
          as: "app",
          required: true,
        },
      ],
    });

    for (const run of runs) {
      await coreAPI.deleteRun({
        projectId: run.app.dustAPIProjectId,
        runId: run.dustRunId,
      });
      await Run.destroy({
        where: {
          id: run.id,
        },
        transaction: t,
      });
    }
  });
}

export async function deleteMembersActivity({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const auth = await Authenticator.internalBuilderForWorkspace(workspaceId);
  const workspace = auth.workspace();

  if (!workspace) {
    throw new Error("Could not find the workspace.");
  }

  await front_sequelize.transaction(async (t) => {
    await MembershipInvitation.destroy({
      where: {
        workspaceId: workspace.id,
      },
      transaction: t,
    });

    const memberships = await Membership.findAll({
      where: {
        workspaceId: workspace.id,
      },
    });

    if (memberships.length === 1) {
      // We also delete the user if it has no other workspace.
      const membership = memberships[0];
      const membershipsOfUser = await Membership.findAll({
        where: {
          userId: membership.userId,
        },
      });
      if (membershipsOfUser.length === 1) {
        const user = await User.findOne({
          where: {
            id: membership.userId,
          },
        });
        if (user) {
          await UserMetadata.destroy({
            where: {
              userId: user.id,
            },
            transaction: t,
          });
          await membership.destroy({ transaction: t });
          await user.destroy({ transaction: t });
        }
      }
    }

    for (const membership of memberships) {
      await membership.destroy({ transaction: t });
    }
  });
}

export async function deleteWorkspaceActivity({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const auth = await Authenticator.internalBuilderForWorkspace(workspaceId);
  const workspace = auth.workspace();

  if (!workspace) {
    throw new Error("Could not find the workspace.");
  }

  await front_sequelize.transaction(async (t) => {
    await Subscription.destroy({
      where: {
        workspaceId: workspace.id,
      },
      transaction: t,
    });
    await PlanInvitation.destroy({
      where: {
        workspaceId: workspace.id,
      },
      transaction: t,
    });
    await Workspace.destroy({
      where: {
        id: workspace.id,
      },
      transaction: t,
    });
  });
}

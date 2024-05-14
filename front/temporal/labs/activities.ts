import type { AgentMessageType, ModelId } from "@dust-tt/types";
import { DustAPI } from "@dust-tt/types";
import { Err } from "@dust-tt/types";
import * as googleapis from "googleapis";
import marked from "marked";
import sanitizeHtml from "sanitize-html";

import { prodAPICredentialsForOwner } from "@app/lib/auth";
import { Authenticator } from "@app/lib/auth";
import { sendEmail } from "@app/lib/email";
import { getGoogleAuthFromUserTranscriptsConfiguration } from "@app/lib/labs/transcripts/utils/helpers";
import { User } from "@app/lib/models/user";
import { Workspace } from "@app/lib/models/workspace";
import { LabsTranscriptsConfigurationResource } from "@app/lib/resources/labs_transcripts_resource";
import { renderLightWorkspaceType } from "@app/lib/workspace";
import type { Logger } from "@app/logger/logger";
import mainLogger from "@app/logger/logger";
async function retrieveRecentTranscripts(
  {
    auth,
    userId,
  }: {
    auth: Authenticator;
    userId: ModelId;
  },
  logger: Logger
) {
  const googleAuth = await getGoogleAuthFromUserTranscriptsConfiguration(
    auth,
    userId
  );

  if (!googleAuth) {
    logger.error(
      {},
      "[retrieveRecentTranscripts] No Google auth found. Stopping."
    );
    return [];
  }

  // Only pull transcripts from last day.
  // We could do from the last 15 minutes
  // but we want to avoid missing any if the workflow is down or slow.
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 1);

  const files = await googleapis.google
    .drive({ version: "v3", auth: googleAuth })
    .files.list({
      q:
        "name contains '- Transcript' and createdTime > '" +
        cutoffDate.toISOString() +
        "'",
      fields: "files(id, name)",
    });

  const { files: filesData } = files.data;
  if (!filesData || filesData.length === 0) {
    logger.info({}, "[retrieveRecentTranscripts] No new files found.");
    return [];
  }

  return filesData;
}

export async function retrieveNewTranscriptsActivity(
  transcriptsConfigurationId: ModelId
): Promise<string[]> {
  const localLogger = mainLogger.child({
    transcriptsConfigurationId,
  });

  const transcriptsConfiguration =
    await LabsTranscriptsConfigurationResource.fetchById(
      transcriptsConfigurationId
    );

  if (!transcriptsConfiguration) {
    localLogger.error(
      {},
      "[retrieveNewTranscripts] Transcript configuration not found. Skipping."
    );
    return [];
  }

  const workspace = await Workspace.findOne({
    where: {
      id: transcriptsConfiguration.workspaceId,
    },
  });

  if (!workspace) {
    throw new Error(
      `Could not find workspace for user (workspaceId: ${transcriptsConfiguration.workspaceId}).`
    );
  }

  const auth = await Authenticator.internalBuilderForWorkspace(workspace.sId);

  if (!auth.workspace()) {
    localLogger.error(
      {},
      "[retrieveNewTranscripts] Workspace not found. Stopping."
    );
    return [];
  }

  const fileIdsToProcess: string[] = [];

  if (transcriptsConfiguration.provider == "google_drive") {
    const recentTranscriptFiles = await retrieveRecentGoogleTranscripts(
      {
        auth,
        userId: transcriptsConfiguration.userId,
      },
      localLogger
    );

    for (const recentTranscriptFile of recentTranscriptFiles) {
      const { id: fileId } = recentTranscriptFile;
      if (!fileId) {
        localLogger.error(
          {},
          "[retrieveNewTranscripts] File does not have an id. Skipping."
        );
        continue;
      }

      const history = await transcriptsConfiguration.fetchHistoryForFileId(
        fileId
      );
      if (history) {
        localLogger.info(
          { fileId },
          "[retrieveNewTranscripts] File already processed. Skipping."
        );
        continue;
      }

      fileIdsToProcess.push(fileId);
    }
  }

  if (transcriptsConfiguration.provider == "gong") {
    // Retrieve recent transcripts from Gong
    // const fromDateTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const fromDateTime = new Date(Date.now() - 2400 * 60 * 60 * 1000).toISOString(); // DEBUG A LOT OF TIME
    const newTranscripts = await fetch(`https://api.gong.io/v2/calls?fromDateTime=${fromDateTime}`, {
      headers: {
        Authorization: `Basic ${transcriptsConfiguration.gongApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!newTranscripts.ok) {
      localLogger.error(
        {},
        "[retrieveNewTranscripts] Error fetching new transcripts from Gong. Skipping."
      );
      console.log('ERROR', await newTranscripts.json())
      return [];
    }

    const newTranscriptsData = await newTranscripts.json();

    if (!newTranscriptsData || newTranscriptsData.length === 0) {
      localLogger.info(
        {},
        "[retrieveNewTranscripts] No new transcripts found from Gong."
      );
      return [];
    }

    for (const call of newTranscriptsData.calls) {
      const { id: fileId } = call;
      if (!fileId) {
        localLogger.error(
          {},
          "[retrieveNewTranscripts] call does not have an id. Skipping."
        );
        continue;
      }

      const history = await transcriptsConfiguration.fetchHistoryForFileId(
        fileId
      );
      if (history) {
        localLogger.info(
          { fileId },
          "[retrieveNewTranscripts] call already processed. Skipping."
        );
        continue;
      }

      fileIdsToProcess.push(fileId);
    }
  } 

  return fileIdsToProcess;
}

export async function processTranscriptActivity(
  transcriptsConfigurationId: ModelId,
  fileId: string
) {
  const transcriptsConfiguration =
    await LabsTranscriptsConfigurationResource.fetchById(
      transcriptsConfigurationId
    );

  if (!transcriptsConfiguration) {
    throw new Error(
      `Could not find transcript configuration for id ${transcriptsConfigurationId}.`
    );
  }

  const workspace = await Workspace.findOne({
    where: {
      id: transcriptsConfiguration.workspaceId,
    },
  });

  if (!workspace) {
    throw new Error(
      `Could not find workspace for user (workspaceId: ${transcriptsConfiguration.workspaceId}).`
    );
  }

  const auth = await Authenticator.internalBuilderForWorkspace(workspace.sId);

  if (!auth.workspace()) {
    throw new Error(
      `Could not find workspace for user (workspaceId: ${transcriptsConfiguration.workspaceId}).`
    );
  }

  const localLogger = mainLogger.child({
    fileId,
    transcriptsConfigurationId,
  });

  const user = await User.findByPk(transcriptsConfiguration.userId);
  if (!user) {
    localLogger.error(
      {},
      "[processTranscriptActivity] User not found. Stopping."
    );
    return;
  }

  localLogger.info(
    {},
    "[processTranscriptActivity] Starting processing of file "
  );

  const hasExistingHistory =
    await transcriptsConfiguration.fetchHistoryForFileId(fileId);
  if (hasExistingHistory) {
    localLogger.info(
      "[processTranscriptActivity] History record already exists. Stopping."
    );
    return;
  }

  const googleAuth = await getGoogleAuthFromUserTranscriptsConfiguration(
    auth,
    transcriptsConfiguration.userId
  );
  const drive = googleapis.google.drive({ version: "v3", auth: googleAuth });

  const metadataRes = await drive.files.get({
    fileId: fileId,
    fields: "name",
  });

  const contentRes = await drive.files.export({
    fileId: fileId,
    mimeType: "text/plain",
  });

  if (contentRes.status !== 200) {
    localLogger.error(
      { error: contentRes.statusText },
      "Error exporting Google document."
    );

    throw new Error(
      `Error exporting Google document. status_code: ${contentRes.status}. status_text: ${contentRes.statusText}`
    );
  }

  const transcriptTitle = metadataRes.data.name || "Untitled";
  const transcriptContent = contentRes.data;
  if (!transcriptContent) {
    localLogger.error(
      "[processGoogleDriveTranscriptActivity] No content found. Stopping."
    );
    return;
  }

  const owner = auth.workspace();

  if (!owner) {
    localLogger.error(
      "[processTranscriptActivity] No owner found. Stopping."
    );
    return;
  }

  const prodCredentials = await prodAPICredentialsForOwner(
    renderLightWorkspaceType({ workspace: owner }),
    { useLocalInDev: true }
  );
  const dustAPI = new DustAPI(prodCredentials, localLogger, {
    useLocalInDev: true,
  });

  const { agentConfigurationId } = transcriptsConfiguration;

  if (!agentConfigurationId) {
    localLogger.error(
      "[processTranscriptActivity] No agent configuration id found. Stopping."
    );
    return;
  }

  const agentConfigurationsRes = await dustAPI.getAgentConfigurations();
  if (agentConfigurationsRes.isErr()) {
    return new Err(new Error(agentConfigurationsRes.error.message));
  }
  const agentConfigurations = agentConfigurationsRes.value;
  const agent = agentConfigurations.find(
    (agent) => agent.sId === agentConfigurationId
  );

  if (!agent) {
    localLogger.error(
      "[processTranscriptActivity] No agent found. Stopping."
    );
    return;
  }

  const convRes = await dustAPI.createConversation({
    title: transcriptTitle,
    visibility: "unlisted",
    message: {
      content: `:mention[${agent.name}]{sId=${agentConfigurationId}}`,
      mentions: [{ configurationId: agentConfigurationId }],
      context: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
        username: user.username,
        fullName: user.name,
        email: user.email,
        profilePictureUrl: user.imageUrl,
      },
    },
    contentFragment: {
      title: transcriptTitle,
      content: transcriptContent.toString(),
      url: null,
      contentType: "file_attachment",
      context: {
        username: user.username,
        fullName: user.name,
        email: user.email,
        profilePictureUrl: user.imageUrl,
      },
    },
    blocking: true,
  });

  if (convRes.isErr()) {
    localLogger.error(
      { error: convRes.error },
      "[processTranscriptActivity] Error creating conversation."
    );
    return new Err(new Error(convRes.error.message));
  }

  const { conversation } = convRes.value;
  if (!conversation) {
    localLogger.error(
      "[processTranscriptActivity] No conversation found. Stopping."
    );
    return;
  }

  localLogger.info(
    {
      conversation: {
        sId: conversation.sId,
      },
    },
    "[processTranscriptActivity] Created conversation."
  );

  // Get first from array with type='agent_message' in conversation.content;
  const agentMessage = <AgentMessageType[]>conversation.content.find(
    (innerArray) => {
      return innerArray.find((item) => item.type === "agent_message");
    }
  );
  const markDownAnswer =
    agentMessage && agentMessage[0].content ? agentMessage[0].content : "";
  const htmlAnswer = sanitizeHtml(await marked.parse(markDownAnswer), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]), // Allow images on top of all defaults from https://www.npmjs.com/package/sanitize-html
  });

  await transcriptsConfiguration.recordHistory({
    configurationId: transcriptsConfiguration.id,
    fileId,
    fileName: transcriptTitle,
    conversationId: conversation.sId,
  });

  const msg = {
    from: {
      name: "Dust team",
      email: "team@dust.tt",
    },
    subject: `[DUST] Meeting summary - ${transcriptTitle}`,
    html: `<a href="https://dust.tt/w/${owner.sId}/assistant/${conversation.sId}">Open this conversation in Dust</a><br /><br /> ${htmlAnswer}<br /><br />The team at <a href="https://dust.tt">Dust.tt</a>`,
  };

  await sendEmail(user.email, msg);
}

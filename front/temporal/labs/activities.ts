import type {
  AgentMessageType,
  ConversationType,
  ModelId,
  UserMessageType,
} from "@dust-tt/types";
import { DustAPI } from "@dust-tt/types";
import { Err } from "@dust-tt/types";
import sgMail from "@sendgrid/mail";
import * as googleapis from "googleapis";

import apiConfig from "@app/lib/api/config";
import config from "@app/lib/labs/config";
import { getGoogleAuthFromUserTranscriptConfiguration } from "@app/lib/labs/transcripts/utils/helpers";
import type { LabsTranscriptsProviderType } from "@app/lib/labs/transcripts/utils/types";
import { User } from "@app/lib/models";
import { LabsTranscriptsConfigurationResource } from "@app/lib/resources/labs_transcripts_configuration_resource";
import { LabsTranscriptsHistoryResource } from "@app/lib/resources/labs_transcripts_history_resource";
import mainLogger from "@app/logger/logger";
import { launchProcessTranscriptWorkflow } from "@app/temporal/labs/client";

sgMail.setApiKey(apiConfig.getSendgridApiKey());

export async function retrieveNewTranscriptsActivity(
  userId: ModelId,
  providerId: LabsTranscriptsProviderType
) {
  const logger = mainLogger.child({ userId });

  if (providerId == "google_drive") {
    const auth = await getGoogleAuthFromUserTranscriptConfiguration(userId);

    if (!auth) {
      logger.error("[retrieveNewTranscripts] No Google auth found. Stopping.");
      return;
    }

    // Only pull transcripts from last day
    // We could do from the last 15 minutes
    // but we want to avoid missing any if the workflow is down
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 1);

    const files = await googleapis.google
      .drive({ version: "v3", auth })
      .files.list({
        q:
          "name contains '- Transcript' and createdTime > '" +
          cutoffDate.toISOString() +
          "'",
        fields: "files(id, name)",
      });

    if (!files.data.files) {
      logger.info("[retrieveNewTranscripts] No new files found");
      return;
    }

    const transcriptsWorkflowPromises = files.data.files.map(
      async (file) => {
        const fileId = file.id as string;
        return LabsTranscriptsHistoryResource.findByFileId({ fileId }).then(
          (history) => {
            if (history) {
              logger.info(
                "[retrieveNewTranscripts] File already processed. Skipping.",
                { fileId }
              );
              return;
            }

            return launchProcessTranscriptWorkflow({ userId, fileId });
          }
        );
      }
    );

    await Promise.all(transcriptsWorkflowPromises);
  } else {
    // throw error
    logger.error("[retrieveNewTranscripts] Provider not supported. Stopping.", {
      providerId,
    });
  }
}

export async function processGoogleDriveTranscriptActivity(
  userId: ModelId,
  fileId: string
) {
  const logger = mainLogger.child({ userId });
  const providerId = "google_drive";

  const user = await User.findByPk(userId);
  if (!user) {
    logger.error(
      "[processGoogleDriveTranscriptActivity] User not found. Stopping."
    );
    return;
  }

  logger.info(
    "[processGoogleDriveTranscriptActivity] Starting processing of file ",
    fileId
  );

  const transcriptsConfiguration =
    await LabsTranscriptsConfigurationResource.findByUserIdAndProvider({
      userId: userId,
      provider: providerId,
    });

  if (!transcriptsConfiguration) {
    logger.info(
      {},
      "[processGoogleDriveTranscriptActivity] No configuration found. Stopping."
    );
    return;
  }

  const googleAuth = await getGoogleAuthFromUserTranscriptConfiguration(userId);
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
    logger.error({}, "Error exporting Google document");
    throw new Error(
      `Error exporting Google document. status_code: ${contentRes.status}. status_text: ${contentRes.statusText}`
    );
  }

  const transcriptTitle = metadataRes.data.name || "Untitled";
  const transcriptContent = contentRes.data;
  const extraInstructions = "IMPORTANT: Answer in HTML format and NOT IN MARKDOWN."

  const dust = new DustAPI(
    {
      workspaceId: config.getLabsWorkspaceId(),
      apiKey: config.getLabsApiKey(),
    },
    logger
  );

  let conversation: ConversationType;

  const configurationId = config.getLabsTranscriptsAssistantId()
      ? config.getLabsTranscriptsAssistantId()
      : transcriptsConfiguration.agentConfigurationId;

  if (!configurationId) {
    logger.error(
      "[processGoogleDriveTranscriptActivity] No agent configuration id found. Stopping."
    );
    return;
  }

  const convRes = await dust.createConversation({
    title: null,
    visibility: "unlisted",
    message: {
      content: transcriptContent + extraInstructions,
      mentions: [{ configurationId }],
      context: {
        timezone: "Europe/Paris",
        username: "labs-transcript-processor",
        fullName: null,
        email: null,
        profilePictureUrl: null,
      },
    },
    contentFragment: undefined,
    blocking: true,
  });

  if (convRes.isErr()) {
    logger.error(
      "[processGoogleDriveTranscriptActivity] Error creating conversation",
      convRes.error
    );
    return new Err(new Error(convRes.error.message));
  } else {
    conversation = convRes.value.conversation;
    logger.info(
      "[processGoogleDriveTranscriptActivity] Created conversation " +
        conversation.sId
    );
  }

  if (!conversation) {
    logger.error(
      "[processGoogleDriveTranscriptActivity] No conversation found. Stopping."
    );
    return;
  }

  //Get first from array with type='agent_message' in conversation.content;
  const agentMessage = <AgentMessageType[]>conversation.content.find(innerArray => {
    return innerArray.find(item => item.type === 'agent_message');
});
  const fullAnswer = agentMessage ? agentMessage[0].content : '';

  // SEND EMAIL WITH SUMMARY
  const msg = {
    to: transcriptsConfiguration.emailToNotify || user.email,
    from: "team@dust.tt",
    subject: `[DUST] Meeting summary - ${transcriptTitle}`,
    html: `${fullAnswer}<br>` + `The Dust team`,
  };
  void sgMail.send(msg).then(() => {
    logger.info(
      "[processGoogleDriveTranscriptActivity] Email sent with summary"
    );
  });

  // CREATE HISTORY RECORD
  LabsTranscriptsHistoryResource.makeNew({
    configurationId: transcriptsConfiguration.id,
    fileId,
    fileName: transcriptTitle,
  }).catch((err) => {
    logger.error(
      "[processGoogleDriveTranscriptActivity] Error creating history record",
      err
    );
  });
}

export async function checkIsActiveActivity({
  userId,
  providerId,
}: {
  userId: ModelId;
  providerId: LabsTranscriptsProviderType;
}) {
  const isActive = await LabsTranscriptsConfigurationResource.getIsActive({
    userId,
    provider: providerId,
  });
  return isActive;
}

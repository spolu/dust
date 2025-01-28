import type { LightWorkspaceType } from "@dust-tt/types";
import { isSupportedFileContentType } from "@dust-tt/types";
import { Op } from "sequelize";

import { Authenticator } from "@app/lib/auth";
import { getPublicUploadBucket } from "@app/lib/file_storage";
import { AgentConfiguration } from "@app/lib/models/assistant/agent";
import { FileResource } from "@app/lib/resources/file_resource";
import type { Logger } from "@app/logger/logger";
import { makeScript } from "@app/scripts/helpers";
import { runOnAllWorkspaces } from "@app/scripts/workspace_helpers";

async function backfillAvatars(
  workspace: LightWorkspaceType,
  {
    execute,
    deleteOldFile,
    logger,
  }: {
    execute: boolean;
    deleteOldFile: boolean;
    logger: Logger;
  }
) {
  logger.info(
    { workspaceId: workspace.sId, execute },
    "Starting avatar backfill"
  );
  const auth = await Authenticator.internalAdminForWorkspace(workspace.sId);
  const baseUrl = `https://storage.googleapis.com/${getPublicUploadBucket().name}/`;

  // Get all agent with legacy avatars
  const agentConfigurations = await AgentConfiguration.findAll({
    where: {
      workspaceId: workspace.id,
      pictureUrl: {
        [Op.and]: [
          {
            [Op.like]: `${baseUrl}%`,
          },
          {
            [Op.notLike]: `${baseUrl}files/%`,
          },
        ],
      },
    },
  });

  for (const agentConfiguration of agentConfigurations) {
    const { pictureUrl } = agentConfiguration;

    const oldPath = pictureUrl.replace(baseUrl, "");

    const [metadata] = await getPublicUploadBucket()
      .file(oldPath)
      .getMetadata();

    const contentType = metadata.contentType;

    if (!contentType || !isSupportedFileContentType(contentType)) {
      logger.error({ contentType, pictureUrl }, "Invalid node type for file");
      continue;
    }

    const fileBlob = {
      contentType,
      fileName: "avatar.jpeg",
      fileSize: metadata.size ? Number(metadata.size) : 0,
      userId: agentConfiguration.authorId,
      workspaceId: workspace.id,
      useCase: "avatar" as const,
      useCaseMetadata: null,
    };

    if (execute) {
      const file = await FileResource.makeNew(fileBlob);
      const newPath = file.getCloudStoragePath(auth, "public");

      logger.info(
        {
          workspaceId: workspace.sId,
          agentId: agentConfiguration.sId,
          oldPath,
          newPath,
        },
        "Processing agent avatar"
      );

      logger.info({ oldPath, newPath }, "moving gcs resource");
      if (execute) {
        await getPublicUploadBucket()
          .file(oldPath)
          .copy(getPublicUploadBucket().file(newPath));
      }

      if (file) {
        await file.markAsReady();
      }

      const newPictureUrl = `${baseUrl}${newPath}`;

      logger.info({ pictureUrl, newPictureUrl }, "updating agent");

      if (execute) {
        await agentConfiguration.update(
          {
            pictureUrl: newPictureUrl,
          },
          {
            hooks: false,
            silent: true,
          }
        );
      }

      if (deleteOldFile) {
        await getPublicUploadBucket().file(oldPath).delete();
      }
    }
  }
}

makeScript(
  {
    deleteOldFile: {
      type: "boolean",
      describe: "Whether to delete the old file",
      default: false,
    },
  },
  async ({ execute, deleteOldFile }, logger) => {
    return runOnAllWorkspaces(
      async (workspace) =>
        backfillAvatars(workspace, { execute, logger, deleteOldFile }),
      { concurrency: 10 }
    );
  }
);

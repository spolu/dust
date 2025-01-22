import {
  concurrentExecutor,
  getGoogleSheetTableId,
  MIME_TYPES,
} from "@dust-tt/types";
import _ from "lodash";
import type { LoggerOptions } from "pino";
import type pino from "pino";
import { makeScript } from "scripts/helpers";

import { getSourceUrlForGoogleDriveFiles } from "@connectors/connectors/google_drive";
import { getLocalParents } from "@connectors/connectors/google_drive/lib";
import { dataSourceConfigFromConnector } from "@connectors/lib/api/data_source_config";
import {
  updateDataSourceDocumentParents,
  updateDataSourceTableParents,
  upsertDataSourceFolder,
} from "@connectors/lib/data_sources";
import {
  GoogleDriveFiles,
  GoogleDriveSheet,
} from "@connectors/lib/models/google_drive";
import { ConnectorResource } from "@connectors/resources/connector_resource";
import type { DataSourceConfig } from "@connectors/types/data_source_config";

async function migrateConnector(
  connector: ConnectorResource,
  execute: boolean,
  parentLogger: pino.Logger<LoggerOptions & pino.ChildLoggerOptions>
) {
  const logger = parentLogger.child({ connectorId: connector.id });
  logger.info("Starting migration");

  const files = await GoogleDriveFiles.findAll({
    where: {
      connectorId: connector.id,
    },
  });

  logger.info({ numberOfFiles: files.length }, "Found files");

  const dataSourceConfig = dataSourceConfigFromConnector(connector);
  const startTimeTs = new Date().getTime();

  const chunks = _.chunk(files, 1024);

  for (const chunk of chunks) {
    await processBatch({
      connector,
      dataSourceConfig,
      files: chunk,
      logger,
      execute,
      startTimeTs,
    });
    logger.info({ numberOfFiles: chunk.length }, "Processed batch");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function processBatch({
  connector,
  dataSourceConfig,
  files,
  logger,
  execute,
  startTimeTs,
}: {
  connector: ConnectorResource;
  dataSourceConfig: DataSourceConfig;
  files: GoogleDriveFiles[];
  logger: pino.Logger<LoggerOptions & pino.ChildLoggerOptions>;
  execute: boolean;
  startTimeTs: number;
}) {
  // update using front API to update both elasticsearch and postgres
  await concurrentExecutor(
    files,
    async (file) => {
      const parents = await getLocalParents(
        connector.id,
        file.dustFileId,
        `${connector.id}:${startTimeTs}:migrate_parents`
      );
      if (execute) {
        // check if file is a folder
        if (
          file.mimeType === "application/vnd.google-apps.folder" ||
          file.mimeType === "application/vnd.google-apps.spreadsheet"
        ) {
          await upsertDataSourceFolder({
            dataSourceConfig,
            folderId: file.dustFileId,
            parents,
            parentId: parents[1] || null,
            title: file.name,
            mimeType:
              file.mimeType === "application/vnd.google-apps.folder"
                ? MIME_TYPES.GOOGLE_DRIVE.FOLDER
                : MIME_TYPES.GOOGLE_DRIVE.SPREADSHEET,
            sourceUrl: getSourceUrlForGoogleDriveFiles(file),
          });
        } else {
          await updateDataSourceDocumentParents({
            dataSourceConfig,
            documentId: file.dustFileId,
            parents,
            parentId: parents[1] || null,
          });
        }
      }
    },
    { concurrency: 16 }
  );

  if (execute) {
    logger.info({ numberOfFiles: files.length }, "Migrated files");
  } else {
    logger.info({ numberOfFiles: files.length }, "Migrated files (dry run)");
  }

  const sheets = await GoogleDriveSheet.findAll({
    where: {
      connectorId: connector.id,
    },
  });

  await concurrentExecutor(
    sheets,
    async (sheet) => {
      const parents = await getLocalParents(
        connector.id,
        getGoogleSheetTableId(sheet.driveFileId, sheet.driveSheetId),
        `${connector.id}:${startTimeTs}:migrate_parents`
      );
      if (execute) {
        await updateDataSourceTableParents({
          dataSourceConfig,
          tableId: getGoogleSheetTableId(sheet.driveFileId, sheet.driveSheetId),
          parents,
          parentId: parents[1] || null,
        });
      }
    },
    { concurrency: 16 }
  );

  if (execute) {
    logger.info({ numberOfSheets: sheets.length }, "Migrated sheets");
  } else {
    logger.info({ numberOfSheets: sheets.length }, "Migrated sheets (dry run)");
  }
}

makeScript(
  {
    startId: { type: "number", demandOption: false },
  },
  async ({ execute, startId }, logger) => {
    logger.info("Starting backfill");
    const connectors = await ConnectorResource.listByType("google_drive", {});
    // sort connectors by id
    connectors.sort((a, b) => a.id - b.id);
    // start from startId if provided
    const startIndex = startId
      ? connectors.findIndex((c) => c.id === startId)
      : -1;
    if (startIndex === -1) {
      throw new Error(`Connector with id ${startId} not found`);
    }
    const slicedConnectors = connectors.slice(startIndex);
    for (const connector of slicedConnectors) {
      await migrateConnector(connector, execute, logger);
    }
  }
);

import { makeScript } from "scripts/helpers";

import { getNotionUnknownFolderId } from "@connectors/connectors/notion";
import { dataSourceConfigFromConnector } from "@connectors/lib/api/data_source_config";
import { concurrentExecutor } from "@connectors/lib/async_utils";
import { upsertDataSourceFolder } from "@connectors/lib/data_sources";
import { ConnectorResource } from "@connectors/resources/connector_resource";

makeScript({}, async ({ execute }, logger) => {
  const connectors = await ConnectorResource.listByType("notion", {});

  await concurrentExecutor(
    connectors,
    async (connector) => {
      // this is a strict copy-paste of upsertSharedWithMeFolder, I don't want to export it for a migration script and want the folderId for logging purposes
      const dataSourceConfig = dataSourceConfigFromConnector(connector);
      const folderId = getNotionUnknownFolderId(connector.id);

      if (execute) {
        await upsertDataSourceFolder({
          dataSourceConfig,
          folderId,
          parents: [folderId],
          parentId: null,
          title: "Orphaned Resources",
          mimeType: "application/vnd.dust.notion.folder", // TODO: choose what we do here, this doesn't work since mimeType is not supported
        });
        logger.info(
          `Upserted folder ${folderId} for connector ${connector.id}`
        );
      } else {
        logger.info(
          `Would upsert folder ${folderId} for connector ${connector.id}`
        );
      }
    },
    { concurrency: 10 }
  );
});

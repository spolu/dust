import { isConnectorProvider } from "@dust-tt/types";
import type { Sequelize } from "sequelize";
import { Op, QueryTypes } from "sequelize";

import { getCorePrimaryDbConnection } from "@app/lib/production_checks/utils";
import { DataSourceModel } from "@app/lib/resources/storage/models/data_source";
import type Logger from "@app/logger/logger";
import { makeScript } from "@app/scripts/helpers";

const SELECT_BATCH_SIZE = 256;

type Node = {
  node_id: string;
  tags_array: Record<string, string>;
  timestamp: number;
  title: string;
};

async function getCoreDataSourceId(
  frontDataSource: DataSourceModel,
  coreSequelize: Sequelize
): Promise<number | null> {
  const { dustAPIProjectId, dustAPIDataSourceId } = frontDataSource;
  const coreDataSource: any = (
    await coreSequelize.query(
      `SELECT id
       FROM data_sources
       WHERE project = :dustAPIProjectId
         AND data_source_id = :dustAPIDataSourceId
       LIMIT 1`,
      {
        replacements: { dustAPIProjectId, dustAPIDataSourceId },
        type: QueryTypes.SELECT,
      }
    )
  )[0];
  return coreDataSource?.id || null;
}

function logInconsistencies(nodes: Node[], logger: typeof Logger) {
  const diff = Object.fromEntries(
    nodes
      .filter(
        (n) =>
          n.tags_array.title &&
          n.title !== n.tags_array.title.split(":")[0] &&
          n.title !== n.tags_array.title
      )
      .map((n) => [
        n.node_id,
        { tagTitle: n.tags_array.title, nodeTitle: n.title },
      ])
  );
  if (Object.keys(diff).length > 0) {
    logger.info({ diff }, "Title inconsistencies.");
  }
}

async function processNodes({
  allNodes,
  coreDataSourceId,
  coreSequelize,
  logger,
}: {
  allNodes: Node[];
  coreDataSourceId: number;
  coreSequelize: Sequelize;
  logger: typeof Logger;
}) {
  const nodes = allNodes.filter(
    (n) => n.tags_array.title && n.title === n.tags_array.title.split(":")[0]
  );
  logger.info(`Found ${nodes.length} nodes to process.`);
  if (nodes.length === 0) {
    return;
  }
  // Replacing the titles with the ones in the tags.
  const titles = nodes.map((n) => n.tags_array.title);

  await coreSequelize.query(
    `UPDATE data_sources_nodes dsn
     SET title = unnested.title
     FROM (
              SELECT UNNEST(ARRAY [:nodeIds]::text[]) AS node_id,
                     UNNEST(ARRAY [:titles]::text[])  AS title
          ) unnested
     WHERE dsn.data_source = :coreDataSourceId
       AND dsn.node_id = unnested.node_id;`,
    {
      replacements: {
        nodeIds: nodes.map((n) => n.node_id),
        titles,
        coreDataSourceId,
      },
    }
  );
}

async function migrateDocuments({
  coreDataSourceId,
  coreSequelize,
  execute,
  logger,
}: {
  coreDataSourceId: number;
  coreSequelize: Sequelize;
  execute: boolean;
  logger: typeof Logger;
}) {
  let nextId = "";
  let nodes: Node[];

  do {
    nodes = (await coreSequelize.query(
      `SELECT dsn.node_id, dsn.timestamp, dsn.title, dsd.tags_array
       FROM data_sources_nodes dsn
            JOIN data_sources_documents dsd ON dsd.id = dsn.document
       WHERE dsn.data_source = :coreDataSourceId
         AND dsn.node_id > :nextId
       LIMIT :batchSize`,
      {
        replacements: {
          coreDataSourceId,
          batchSize: SELECT_BATCH_SIZE,
          nextId,
        },
        type: QueryTypes.SELECT,
      }
    )) as Node[];

    logInconsistencies(nodes, logger);

    if (execute) {
      await processNodes({
        allNodes: nodes,
        coreSequelize,
        coreDataSourceId,
        logger,
      });
    }
    nextId = nodes[nodes.length - 1]?.node_id;
  } while (nodes.length === SELECT_BATCH_SIZE);
}

async function migrateTables({
  coreDataSourceId,
  coreSequelize,
  execute,
  logger,
}: {
  coreDataSourceId: number;
  coreSequelize: Sequelize;
  execute: boolean;
  logger: typeof Logger;
}) {
  let nextId = "";
  let nodes: Node[];

  do {
    nodes = (await coreSequelize.query(
      `SELECT dsn.node_id, dsn.timestamp, dsn.title, t.tags_array
       FROM data_sources_nodes dsn
            JOIN tables t ON t.id = dsn.table
       WHERE dsn.data_source = :coreDataSourceId
         AND dsn.node_id > :nextId
       LIMIT :batchSize`,
      {
        replacements: {
          coreDataSourceId,
          batchSize: SELECT_BATCH_SIZE,
          nextId,
        },
        type: QueryTypes.SELECT,
      }
    )) as Node[];

    logInconsistencies(nodes, logger);

    if (execute) {
      await processNodes({
        allNodes: nodes,
        coreSequelize,
        coreDataSourceId,
        logger,
      });
    }
    nextId = nodes[nodes.length - 1]?.node_id;
  } while (nodes.length === SELECT_BATCH_SIZE);
}

async function migrateDataSource(
  frontDataSource: DataSourceModel,
  coreSequelize: Sequelize,
  execute: boolean,
  parentLogger: typeof Logger
) {
  const logger = parentLogger.child({
    project: frontDataSource.dustAPIProjectId,
    dataSourceId: frontDataSource.dustAPIDataSourceId,
  });
  logger.info("MIGRATE");

  const coreDataSourceId = await getCoreDataSourceId(
    frontDataSource,
    coreSequelize
  );
  if (!coreDataSourceId) {
    logger.error("No core datasource found.");
    return;
  }

  await migrateDocuments({ coreDataSourceId, coreSequelize, execute, logger });
  await migrateTables({ coreDataSourceId, coreSequelize, execute, logger });
}

makeScript(
  {
    nextDataSourceId: { type: "number", default: 0 },
    provider: { type: "string" },
  },
  async ({ nextDataSourceId, provider, execute }, logger) => {
    if (!isConnectorProvider(provider)) {
      logger.error(`Invalid provider ${provider}`);
      return;
    }
    const coreSequelize = getCorePrimaryDbConnection();
    const staticDataSources = await DataSourceModel.findAll({
      where: {
        connectorProvider: provider,
        id: { [Op.gt]: nextDataSourceId },
      },
      order: [["id", "ASC"]],
    });

    for (const dataSource of staticDataSources) {
      await migrateDataSource(dataSource, coreSequelize, execute, logger);
    }
  }
);

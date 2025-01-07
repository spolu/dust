import { Op, QueryTypes } from "sequelize";

import { getCoreReplicaDbConnection } from "@app/lib/production_checks/utils";
import { DataSourceModel } from "@app/lib/resources/storage/models/data_source";
import type Logger from "@app/logger/logger";
import { makeScript } from "@app/scripts/helpers";

const coreSequelize = getCoreReplicaDbConnection();
const DATASOURCE_BATCH_SIZE = 25;

function checkDocument(document: any, logger: typeof Logger) {
  if (document.parents.length === 0) {
    logger.warn("Document has no parents.");
  } else if (document.parents.length >= 2) {
    logger.warn("Document has 2 parents or more.");
  } else if (document.parents[0] !== document.document_id) {
    logger.warn("Document has incorrect parents: parents[0] !== document_id.");
  }
}

function checkTable(table: any, logger: typeof Logger) {
  if (table.parents.length === 0) {
    logger.warn("Table has no parents.");
  } else if (table.parents.length >= 2) {
    logger.warn("Table has 2 parents or more.");
  } else if (table.parents[0] !== table.table_id) {
    logger.warn("Table has incorrect parents: parents[0] !== table_id.");
  }
}

async function checkStaticDataSourceParents(
  frontDataSource: DataSourceModel,
  logger: typeof Logger
) {
  const { dustAPIProjectId, dustAPIDataSourceId } = frontDataSource;
  const coreDataSource: any = (
    await coreSequelize.query(
      `SELECT id FROM data_sources WHERE project=:p AND data_source_id=:d LIMIT 1`,
      {
        replacements: { p: dustAPIProjectId, d: dustAPIDataSourceId },
        type: QueryTypes.SELECT,
      }
    )
  )[0];
  if (!coreDataSource) {
    logger.warn(
      { project: dustAPIProjectId, dataSourceId: dustAPIDataSourceId },
      "No core data source found for static data source."
    );
    return;
  }

  const documents: any[] = await coreSequelize.query(
    `SELECT id FROM data_sources_documents WHERE data_source=:c AND status='latest'`,
    { replacements: { c: coreDataSource.id }, type: QueryTypes.SELECT }
  );
  documents.forEach((doc) => {
    checkDocument(
      doc,
      logger.child({ documentId: doc.document_id, parents: doc.parents })
    );
  });

  const tables: any[] = await coreSequelize.query(
    `SELECT id FROM tables WHERE data_source=:c`,
    { replacements: { c: coreDataSource.id }, type: QueryTypes.SELECT }
  );
  tables.forEach((table) => {
    checkTable(
      table,
      logger.child({ tableId: table.table_id, parents: table.parents })
    );
  });
}

async function checkStaticDataSourcesParents(
  nextDataSourceId: number,
  logger: typeof Logger
) {
  const startId = nextDataSourceId;

  let staticDataSources;
  do {
    staticDataSources = await DataSourceModel.findAll({
      where: { connectorProvider: null, id: { [Op.gte]: startId } },
      limit: DATASOURCE_BATCH_SIZE,
    });

    for (const dataSource of staticDataSources) {
      logger.info({ dataSource }, "CHECK");
      await checkStaticDataSourceParents(dataSource, logger);
    }
  } while (staticDataSources.length === DATASOURCE_BATCH_SIZE);
}

makeScript(
  { nextDataSourceId: { type: "number", default: 0 } },
  async ({ nextDataSourceId }, logger) => {
    await checkStaticDataSourcesParents(nextDataSourceId, logger);
  }
);

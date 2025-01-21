import type { ModelId } from "@dust-tt/types";
import { isSnowflakeCredentials, MIME_TYPES } from "@dust-tt/types";

import {
  connectToSnowflake,
  fetchTables,
  isConnectionReadonly,
} from "@connectors/connectors/snowflake/lib/snowflake_api";
import { getConnectorAndCredentials } from "@connectors/connectors/snowflake/lib/utils";
import { dataSourceConfigFromConnector } from "@connectors/lib/api/data_source_config";
import {
  deleteDataSourceTable,
  upsertDataSourceFolder,
  upsertDataSourceRemoteTable,
} from "@connectors/lib/data_sources";
import {
  RemoteDatabaseModel,
  RemoteSchemaModel,
  RemoteTableModel,
} from "@connectors/lib/models/remote_databases";
import {
  syncFailed,
  syncStarted,
  syncSucceeded,
} from "@connectors/lib/sync_status";
import logger from "@connectors/logger/logger";

export async function syncSnowflakeConnection(connectorId: ModelId) {
  const getConnectorAndCredentialsRes = await getConnectorAndCredentials({
    connectorId,
    logger,
  });
  if (getConnectorAndCredentialsRes.isErr()) {
    throw getConnectorAndCredentialsRes.error;
  }

  await syncStarted(connectorId);

  const { credentials, connector } = getConnectorAndCredentialsRes.value;

  if (!isSnowflakeCredentials(credentials)) {
    throw new Error(
      "Invalid credentials type - expected snowflake credentials"
    );
  }

  const dataSourceConfig = dataSourceConfigFromConnector(connector);

  const connectionRes = await connectToSnowflake(credentials);
  if (connectionRes.isErr()) {
    throw connectionRes.error;
  }
  const connection = connectionRes.value;

  const [allDatabases, allSchemas, allTables] = await Promise.all([
    RemoteDatabaseModel.findAll({
      where: {
        connectorId,
      },
    }),
    RemoteSchemaModel.findAll({
      where: {
        connectorId,
      },
    }),
    RemoteTableModel.findAll({
      where: {
        connectorId,
      },
    }),
  ]);

  const readonlyConnectionCheck = await isConnectionReadonly({
    credentials,
    connection,
  });
  if (readonlyConnectionCheck.isErr()) {
    if (readonlyConnectionCheck.error.code !== "NOT_READONLY") {
      // Any other error here is "unexpected".
      throw readonlyConnectionCheck.error;
    }
    // The connection is not read-only.
    // We mark the connector as errored, and garbage collect all the tables that were synced.
    await syncFailed(connectorId, "remote_database_connection_not_readonly");

    for (const t of allTables) {
      await deleteDataSourceTable({
        dataSourceConfig: dataSourceConfigFromConnector(connector),
        tableId: t.internalId,
      });
      if (t.permission === "inherited") {
        await t.destroy();
      } else {
        await t.update({
          lastUpsertedAt: null,
        });
      }
    }
    return;
  }

  const tablesOnSnowflakeRes = await fetchTables({ credentials, connection });
  if (tablesOnSnowflakeRes.isErr()) {
    throw tablesOnSnowflakeRes.error;
  }
  const tablesOnSnowflake = tablesOnSnowflakeRes.value;
  const internalIdsOnSnowflake = new Set(
    tablesOnSnowflake.map(
      (t) => `${t.database_name}.${t.schema_name}.${t.name}`
    )
  );

  const readGrantedInternalIds = new Set([
    ...allDatabases.map((db) => db.internalId),
    ...allSchemas.map((s) => s.internalId),
    ...allTables
      .filter((t) => t.permission === "selected")
      .map((t) => t.internalId),
  ]);
  const tableByInternalId = Object.fromEntries(
    allTables.map((table) => [table.internalId, table])
  );

  const parseTableInternalId = (
    tableInternalId: string
  ): [string, string, string] => {
    const [dbName, schemaName, tableName] = tableInternalId.split(".");
    if (!dbName || !schemaName || !tableName) {
      throw new Error(`Invalid table internalId: ${tableInternalId}`);
    }

    return [dbName, schemaName, tableName];
  };

  const isTableReadGranted = (tableInternalId: string) => {
    const [dbName, schemaName] = parseTableInternalId(tableInternalId);

    const schemaInternalId = [dbName, schemaName].join(".");

    return (
      readGrantedInternalIds.has(dbName) ||
      readGrantedInternalIds.has(schemaInternalId) ||
      readGrantedInternalIds.has(tableInternalId)
    );
  };

  for (const internalId of internalIdsOnSnowflake) {
    const [dbName, schemaName, tableName] = parseTableInternalId(internalId);
    const schemaInternalId = [dbName, schemaName].join(".");

    let tableShouldBeSynced = false;
    let parents = [internalId];

    if (readGrantedInternalIds.has(dbName)) {
      tableShouldBeSynced = true;
      parents = [internalId, schemaInternalId, dbName];

      // upserting a data_sources_folder for the database
      await upsertDataSourceFolder({
        dataSourceConfig,
        folderId: dbName,
        title: dbName,
        parents: [dbName],
        parentId: null,
        mimeType: MIME_TYPES.SNOWFLAKE.DATABASE,
      });
      // upserting a data_sources_folder for the database schema with the database as parent
      await upsertDataSourceFolder({
        dataSourceConfig,
        folderId: schemaInternalId,
        title: schemaName,
        parents: [schemaInternalId, dbName],
        parentId: dbName,
        mimeType: MIME_TYPES.SNOWFLAKE.SCHEMA,
      });
    } else if (readGrantedInternalIds.has(schemaInternalId)) {
      tableShouldBeSynced = true;
      parents = [internalId, schemaInternalId];

      // upserting a data_sources_folder for the database schema without a parent (root)
      await upsertDataSourceFolder({
        dataSourceConfig,
        folderId: schemaInternalId,
        title: schemaName,
        parents: [schemaInternalId],
        parentId: null,
        mimeType: MIME_TYPES.SNOWFLAKE.SCHEMA,
      });
    } else if (readGrantedInternalIds.has(internalId)) {
      tableShouldBeSynced = true;
      parents = [internalId];
    }

    if (tableShouldBeSynced) {
      let table = tableByInternalId[internalId];
      if (!table || !table.lastUpsertedAt) {
        if (!table) {
          table = await RemoteTableModel.create({
            connectorId,
            internalId,
            permission: "inherited",
            name: tableName,
            schemaName,
            databaseName: dbName,
          });
        }

        await upsertDataSourceRemoteTable({
          dataSourceConfig,
          tableId: internalId,
          tableName: internalId,
          remoteDatabaseTableId: internalId,
          remoteDatabaseSecretId: connector.connectionId,
          tableDescription: "",
          parents,
          parentId: parents[1] || null,
          title: table.name,
          mimeType: MIME_TYPES.SNOWFLAKE.TABLE,
        });
        await table.update({
          lastUpsertedAt: new Date(),
        });
      }
    }
  }

  for (const t of Object.values(tableByInternalId)) {
    if (
      !isTableReadGranted(t.internalId) ||
      !internalIdsOnSnowflake.has(t.internalId)
    ) {
      if (t.lastUpsertedAt) {
        await deleteDataSourceTable({
          dataSourceConfig: dataSourceConfigFromConnector(connector),
          tableId: t.internalId,
        });
      }
      await t.destroy();
    }
  }

  await syncSucceeded(connectorId);
}

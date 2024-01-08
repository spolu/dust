import { ConnectorPermission, ConnectorResource, ModelId } from "@dust-tt/types";

import { getConfluenceCloudInformation, listConfluenceSpaces } from "@connectors/connectors/confluence/lib/confluence_api";
import { ConnectorPermissionRetriever } from "@connectors/connectors/interface";
import { Connector, sequelize_conn } from "@connectors/lib/models";
import { ConfluenceConnectorState, ConfluenceSpaces } from "@connectors/lib/models/confluence";
import { getAccessTokenFromNango, getConnectionFromNango } from "@connectors/lib/nango_helpers";
import { Err, Ok, Result } from "@connectors/lib/result";
import logger from "@connectors/logger/logger";
import { DataSourceConfig } from "@connectors/types/data_source_config";
import { NangoConnectionId } from "@connectors/types/nango_connection_id";

const { NANGO_CONFLUENCE_CONNECTOR_ID } = process.env;

export async function createConfluenceConnector(
  dataSourceConfig: DataSourceConfig,
  connectionId: NangoConnectionId
): Promise<Result<string, Error>> {
  if (!NANGO_CONFLUENCE_CONNECTOR_ID) {
    throw new Error("NANGO_CONFLUENCE_CONNECTOR_ID not set");
  }

  const nangoConnectionId = connectionId;
  const confluenceAccessToken = await getAccessTokenFromNango({
    connectionId: nangoConnectionId,
    integrationId: NANGO_CONFLUENCE_CONNECTOR_ID,
    useCache: false,
  });

  console.log('>> confluenceAccessToken:', confluenceAccessToken);

  const confluenceCloudInformation = await getConfluenceCloudInformation(confluenceAccessToken);
  const {id: cloudId, url: cloudUrl} = confluenceCloudInformation;
  if (!cloudId || !cloudUrl) {
    return new Err(new Error("Confluence access token is invalid"));
  }

  console.log('>> confluenceCloudInformation:', confluenceCloudInformation);

  try {
    const connector = await sequelize_conn.transaction(async (transaction) => {
      const connector = await Connector.create(
        {
          type: "confluence",
          connectionId: nangoConnectionId,
          workspaceAPIKey: dataSourceConfig.workspaceAPIKey,
          workspaceId: dataSourceConfig.workspaceId,
          dataSourceName: dataSourceConfig.dataSourceName,
        },
        { transaction }
      );
      await ConfluenceConnectorState.create(
        {
          cloudId,
          connectorId: connector.id,
          url: cloudUrl,
        },
        { transaction }
      );

      return connector;
    });
    // await launchNotionSyncWorkflow(connector.id);
    return new Ok(connector.id.toString());
  } catch (e) {
    logger.error({ error: e }, "Error creating confluence connector.");
    return new Err(e as Error);
  }
}

export async function updateConfluenceConnector(connectorId: ModelId,
  {
    connectionId,
  }: {
    connectionId?: NangoConnectionId | null;
  }
) {
  if (!NANGO_CONFLUENCE_CONNECTOR_ID) {
    throw new Error("NANGO_CONFLUENCE_CONNECTOR_ID not set");
  }

  // TODO:
}

export async function retrieveConfluenceConnectorPermissions({
  connectorId,
  parentInternalId,
  filterPermission,
}: Parameters<ConnectorPermissionRetriever>[0]): Promise<
  Result<ConnectorResource[], Error>
> {
  if (!NANGO_CONFLUENCE_CONNECTOR_ID) {
    throw new Error("NANGO_CONFLUENCE_CONNECTOR_ID not set");
  }

  if (parentInternalId) {
    return new Err(
      new Error(
        "Confluence connector does not support permission retrieval with `parentInternalId`"
      )
    );
  }

  const c = await Connector.findOne({
    where: {
      id: connectorId,
    },
  });
  if (!c) {
    logger.error({ connectorId }, "Connector not found");
    return new Err(new Error("Connector not found"));
  }

  // TODO: Maybe rename.
  const confluenceState = await ConfluenceConnectorState.findOne({
    where: {
      connectorId: connectorId,
    },
  });
  if (!confluenceState) {
    logger.error({ connectorId }, "Confluence configuration not found");
    return new Err(new Error("Confluence configuration not found"));
  }

  const confluenceConnection  = await getConnectionFromNango({
    connectionId: c.connectionId,
    integrationId: NANGO_CONFLUENCE_CONNECTOR_ID,
    useCache: false,
  });

  const {access_token: confluenceAccessToken} = confluenceConnection.credentials;

  const spaces = await listConfluenceSpaces(confluenceAccessToken, confluenceState.cloudId);

  const syncedSpaces = await ConfluenceSpaces.findAll({
    where: {
      connectorId: connectorId,
    },
  });

  const allSpaces = spaces.map((s) => {
    const isSynced = syncedSpaces.some((ss) => ss.spaceId === s.id);

    return {
      provider: "confluence",
      internalId: s.id,
      parentInternalId: null,
      type: "folder",
      title: `${s.name}`,
      sourceUrl: `${confluenceState.url}/wiki${s._links.webui}`,
      expandable: false,
      permission: isSynced ? "read" : "none",
      dustDocumentId: null,
      lastUpdatedAt: null,
    };
  });

  // List synced spaces.
  if (filterPermission === 'read') {
    return new Ok(allSpaces.filter((s) => s.permission === 'read'));
  }

  return new Ok(allSpaces);
}

export async function setConfluenceConnectorPermissions(
  connectorId: ModelId,
  permissions: Record<string, ConnectorPermission>
): Promise<Result<void, Error>> {
  const connector = await Connector.findByPk(connectorId);
  if (!connector) {
    return new Err(new Error(`Connector not found with id ${connectorId}`));
  }

  let shouldFullSync = false;
  for (const [id, permission] of Object.entries(permissions)) {
    shouldFullSync = true;
    if (permission === "none") {
      await ConfluenceSpaces.destroy({
        where: {
          connectorId: connectorId,
          spaceId: id,
        },
      });
    } else if (permission === "read") {
      await ConfluenceSpaces.upsert({
        connectorId: connectorId,
        spaceId: id,
      });
    } else {
      return new Err(
        new Error(`Invalid permission ${permission} for resource ${id}`)
      );
    }
  }

  if (shouldFullSync) {
    // TODO:
    // await launchGoogleDriveFullSyncWorkflow(connectorId.toString(), null);
  }

  return new Ok(undefined);
}
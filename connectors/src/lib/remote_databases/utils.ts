import type { ConnectionCredentials, ModelId, Result } from "@dust-tt/types";
import { Err, getConnectionCredentials, Ok } from "@dust-tt/types";
import * as t from "io-ts";

import { apiConfig } from "@connectors/lib/api/config";
import type { Logger } from "@connectors/logger/logger";
import { ConnectorResource } from "@connectors/resources/connector_resource";

export const remoteDBDatabaseCodec = t.type({
  name: t.string,
});
export type RemoteDBDatabase = t.TypeOf<typeof remoteDBDatabaseCodec>;

export const remoteDBSchemaCodec = t.type({
  name: t.string,
  database_name: t.string,
});
export type RemoteDBSchema = t.TypeOf<typeof remoteDBSchemaCodec>;

export const remoteDBTableCodec = t.type({
  name: t.string,
  database_name: t.string,
  schema_name: t.string,
});
export type RemoteDBTable = t.TypeOf<typeof remoteDBTableCodec>;

export const parseSchemaInternalId = (
  schemaInternalId: string
): RemoteDBSchema => {
  const [dbName, schemaName] = schemaInternalId.split(".");
  if (!dbName || !schemaName) {
    throw new Error(`Invalid schema internalId: ${schemaInternalId}`);
  }

  return {
    name: schemaName,
    database_name: dbName,
  };
};

// Helper functions to get connector and credentials
export const getConnector = async ({
  connectorId,
  logger,
}: {
  connectorId: ModelId;
  logger: Logger;
}): Promise<
  Result<
    {
      connector: ConnectorResource;
    },
    Error
  >
> => {
  const connector = await ConnectorResource.fetchById(connectorId);
  if (!connector) {
    logger.error({ connectorId }, "Connector not found");
    return new Err(new Error("Connector not found"));
  }
  return new Ok({ connector });
};

export const getCredentials = async <T extends ConnectionCredentials>({
  credentialsId,
  isTypeGuard,
  logger,
}: {
  credentialsId: string;
  isTypeGuard: (credentials: ConnectionCredentials) => credentials is T;
  logger: Logger;
}): Promise<
  Result<
    {
      credentials: T;
    },
    Error
  >
> => {
  const credentialsRes = await getConnectionCredentials({
    config: apiConfig.getOAuthAPIConfig(),
    logger,
    credentialsId,
  });
  if (credentialsRes.isErr()) {
    logger.error({ credentialsId }, "Failed to retrieve credentials");
    return new Err(Error("Failed to retrieve credentials"));
  }
  // Narrow the type of credentials to just the username/password variant
  const credentials = credentialsRes.value.credential.content;
  if (!isTypeGuard(credentials)) {
    throw new Error(
      `Invalid credentials types, type guard: ${isTypeGuard.name}`
    );
  }
  return new Ok({
    credentials,
  });
};

export const getConnectorAndCredentials = async <
  T extends ConnectionCredentials,
>({
  connectorId,
  isTypeGuard,
  logger,
}: {
  connectorId: ModelId;
  isTypeGuard: (credentials: ConnectionCredentials) => credentials is T;
  logger: Logger;
}): Promise<
  Result<
    {
      connector: ConnectorResource;
      credentials: T;
    },
    { code: "connector_not_found" | "invalid_credentials"; error: Error }
  >
> => {
  const connectorRes = await getConnector({ connectorId, logger });
  if (connectorRes.isErr()) {
    return new Err({
      code: "connector_not_found",
      error: connectorRes.error,
    });
  }
  const connector = connectorRes.value.connector;

  const credentialsRes = await getConnectionCredentials({
    config: apiConfig.getOAuthAPIConfig(),
    logger,
    credentialsId: connector.connectionId,
  });
  if (credentialsRes.isErr()) {
    logger.error({ connectorId }, "Failed to retrieve credentials");
    return new Err({
      code: "invalid_credentials",
      error: Error("Failed to retrieve credentials"),
    });
  }
  // Narrow the type of credentials to just the username/password variant
  const credentials = credentialsRes.value.credential.content;
  if (!isTypeGuard(credentials)) {
    throw new Error(
      `Invalid credentials types, type guard: ${isTypeGuard.name}`
    );
  }
  return new Ok({
    connector,
    credentials,
  });
};

import type {
  ConnectorErrorType,
  ConnectorSyncStatus,
  ModelId,
} from "@dust-tt/types";

import type { Result } from "@connectors/lib/result";
import { Err, Ok } from "@connectors/lib/result";
import { ConnectorResource } from "@connectors/resources/connector_res";
import { ConnectorModel } from "@connectors/resources/storage/models/connector_model";

async function syncFinished({
  connectorId,
  status,
  finishedAt,
  errorType,
}: {
  connectorId: ModelId;
  status: ConnectorSyncStatus;
  finishedAt: Date;
  errorType: ConnectorErrorType | null;
}): Promise<Result<void, Error>> {
  const connector = await ConnectorResource.fetchById(connectorId);
  if (!connector) {
    return new Err(new Error("Connector not found"));
  }
  connector.lastSyncStatus = status;
  connector.lastSyncFinishTime = finishedAt;
  connector.errorType = errorType;
  if (status === "succeeded") {
    if (!connector.firstSuccessfulSyncTime) {
      connector.firstSuccessfulSyncTime = finishedAt;
    }
    connector.lastSyncSuccessfulTime = finishedAt;
  }

  await connector.update(connector);

  return new Ok(undefined);
}

export async function reportInitialSyncProgress(
  connectorId: ModelId,
  progress: string
) {
  const connector = await ConnectorResource.fetchById(connectorId);
  if (!connector) {
    return new Err(new Error("Connector not found"));
  }
  connector.firstSyncProgress = progress;
  connector.lastSyncSuccessfulTime = null;

  await connector.update(connector);

  return new Ok(undefined);
}

/**
 * Signal that a sync has succeeded.
 * This function can be used by the sync worker itself or by the supervisor.
 */
export async function syncSucceeded(connectorId: ModelId, at?: Date) {
  if (!at) {
    at = new Date();
  }

  return syncFinished({
    connectorId: connectorId,
    status: "succeeded",
    finishedAt: at,
    errorType: null,
  });
}

/**
 * Signal that a sync has failed.
 * This function can be used by the sync worker itself or by the supervisor.
 */
export async function syncFailed(
  connectorId: ModelId,
  errorType: ConnectorErrorType,
  at?: Date
) {
  if (!at) {
    at = new Date();
  }
  return syncFinished({
    connectorId,
    status: "failed",
    finishedAt: new Date(),
    errorType,
  });
}

/**
 * Signal that a sync has started.
 * This function can be used by the sync worker itself or by the supervisor.
 */
export async function syncStarted(connectorId: ModelId, startedAt?: Date) {
  if (!startedAt) {
    startedAt = new Date();
  }
  const connector = await ConnectorResource.fetchById(connectorId);
  if (!connector) {
    return new Err(new Error("Connector not found"));
  }
  connector.lastSyncStartTime = startedAt;
  await connector.update(connector);

  return new Ok(undefined);
}

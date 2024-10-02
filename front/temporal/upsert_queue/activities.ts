import { CoreAPI, dustManagedCredentials } from "@dust-tt/types";
import { Storage } from "@google-cloud/storage";
import { isLeft } from "fp-ts/lib/Either";
import * as reporter from "io-ts-reporters";

import config from "@app/lib/api/config";
import { upsertTableFromCsv } from "@app/lib/api/tables";
import { Authenticator } from "@app/lib/auth";
import { DataSourceResource } from "@app/lib/resources/data_source_resource";
import type { WorkflowError } from "@app/lib/temporal_monitoring";
import {
  EnqueueUpsertDocument,
  EnqueueUpsertTable,
  enqueueUpsertTable,
  runPostUpsertHooks,
} from "@app/lib/upsert_queue";
import mainLogger from "@app/logger/logger";
import { statsDClient } from "@app/logger/withlogging";
import { launchUpsertTableWorkflow } from "@app/temporal/upsert_tables/client";

const { DUST_UPSERT_QUEUE_BUCKET, SERVICE_ACCOUNT } = process.env;

export async function upsertDocumentActivity(
  upsertQueueId: string,
  enqueueTimestamp: number
) {
  if (!DUST_UPSERT_QUEUE_BUCKET) {
    throw new Error("DUST_UPSERT_QUEUE_BUCKET is not set");
  }
  if (!SERVICE_ACCOUNT) {
    throw new Error("SERVICE_ACCOUNT is not set");
  }

  const storage = new Storage({ keyFilename: SERVICE_ACCOUNT });
  const bucket = storage.bucket(DUST_UPSERT_QUEUE_BUCKET);
  const content = await bucket.file(`${upsertQueueId}.json`).download();

  const upsertDocument = JSON.parse(content.toString());

  const documentItemValidation = EnqueueUpsertDocument.decode(upsertDocument);

  if (isLeft(documentItemValidation)) {
    const pathErrorDocument = reporter.formatValidationErrors(
      documentItemValidation.left
    );
    throw new Error(`Invalid upsertQueue document: ${pathErrorDocument}`);
  }

  const upsertQueueItem = documentItemValidation.right;

  const logger = mainLogger.child({
    upsertQueueId,
    workspaceId: upsertQueueItem.workspaceId,
    dataSourceId: upsertQueueItem.dataSourceId,
    documentId: upsertQueueItem.documentId,
  });

  const auth = await Authenticator.internalAdminForWorkspace(
    upsertQueueItem.workspaceId
  );

  const dataSource = await DataSourceResource.fetchById(
    auth,
    upsertQueueItem.dataSourceId
  );
  if (!dataSource) {
    // If the data source was not found, we simply give up and remove the item from the queue as it
    // means that the data source was deleted.
    logger.info(
      {
        delaySinceEnqueueMs: Date.now() - enqueueTimestamp,
      },
      "[UpsertQueue] Giving up: DataSource not found"
    );
    return;
  }

  const statsDTags = [
    `data_source_name:${dataSource.name}`,
    `workspace_id:${upsertQueueItem.workspaceId}`,
  ];

  // Data source operations are performed with our credentials.
  const credentials = dustManagedCredentials();

  const coreAPI = new CoreAPI(config.getCoreAPIConfig(), logger);

  const upsertTimestamp = Date.now();

  // Create document with the Dust internal API.
  const upsertRes = await coreAPI.upsertDataSourceDocument({
    projectId: dataSource.dustAPIProjectId,
    dataSourceId: dataSource.dustAPIDataSourceId,
    documentId: upsertQueueItem.documentId,
    tags: upsertQueueItem.tags || [],
    parents: upsertQueueItem.parents || [],
    sourceUrl: upsertQueueItem.sourceUrl,
    timestamp: upsertQueueItem.timestamp,
    section: upsertQueueItem.section,
    credentials,
    lightDocumentOutput: true,
  });

  if (upsertRes.isErr()) {
    logger.error(
      {
        error: upsertRes.error,
        latencyMs: Date.now() - upsertTimestamp,
        delaySinceEnqueueMs: Date.now() - enqueueTimestamp,
      },
      "[UpsertQueue] Failed document upsert"
    );
    statsDClient.increment("upsert_queue_document_error.count", 1, statsDTags);
    statsDClient.distribution(
      "upsert_queue_upsert_document_error.duration.distribution",
      Date.now() - upsertTimestamp,
      []
    );

    const error: WorkflowError = {
      __is_dust_error: true,
      message: `Upsert error: ${upsertRes.error.message}`,
      type: "upsert_queue_upsert_document_error",
    };

    throw error;
  }

  logger.info(
    {
      latencyMs: Date.now() - upsertTimestamp,
      delaySinceEnqueueMs: Date.now() - enqueueTimestamp,
    },
    "[UpsertQueue] Successful document upsert"
  );
  statsDClient.increment("upsert_queue_document_success.count", 1, statsDTags);
  statsDClient.distribution(
    "upsert_queue_upsert_document_success.duration.distribution",
    Date.now() - upsertTimestamp,
    []
  );
  statsDClient.distribution(
    "upsert_queue_document.duration.distribution",
    Date.now() - enqueueTimestamp,
    []
  );

  await runPostUpsertHooks({
    workspaceId: upsertQueueItem.workspaceId,
    dataSource,
    documentId: upsertQueueItem.documentId,
    section: upsertQueueItem.section,
    document: upsertRes.value.document,
    sourceUrl: upsertQueueItem.sourceUrl,
    upsertContext: upsertQueueItem.upsertContext || undefined,
  });
}

// TODO(2024-10-02 flav) Removed once all the upsert tables have been processed from this queue.
export async function upsertTableActivity(
  upsertQueueId: string,
  enqueueTimestamp: number
) {
  if (!DUST_UPSERT_QUEUE_BUCKET) {
    throw new Error("DUST_UPSERT_QUEUE_BUCKET is not set");
  }
  if (!SERVICE_ACCOUNT) {
    throw new Error("SERVICE_ACCOUNT is not set");
  }

  const storage = new Storage({ keyFilename: SERVICE_ACCOUNT });
  const bucket = storage.bucket(DUST_UPSERT_QUEUE_BUCKET);
  const content = await bucket.file(`${upsertQueueId}.json`).download();

  const upsertDocument = JSON.parse(content.toString());

  const tableItemValidation = EnqueueUpsertTable.decode(upsertDocument);

  if (isLeft(tableItemValidation)) {
    const pathErrorTable = reporter.formatValidationErrors(
      tableItemValidation.left
    );
    throw new Error(`Invalid upsertQueue table: ${pathErrorTable}`);
  }

  const upsertQueueItem = tableItemValidation.right;
  const logger = mainLogger.child({
    upsertQueueId,
    workspaceId: upsertQueueItem.workspaceId,
    dataSourceId: upsertQueueItem.dataSourceId,
    tableId: upsertQueueItem.tableId,
  });

  await launchUpsertTableWorkflow({
    workspaceId: upsertQueueItem.workspaceId,
    dataSourceId: upsertQueueItem.dataSourceId,
    upsertQueueId,
    enqueueTimestamp,
  });

  logger.info({}, "[UpsertQueue] Re-enqueue in new queue");
}

import type { ModelId } from "@dust-tt/types";
import type { Sequelize } from "sequelize";
import { QueryTypes } from "sequelize";

import {
  getConnectorsReplicaDbConnection,
  getCorePrimaryDbConnection,
} from "@app/lib/production_checks/utils";
import type Logger from "@app/logger/logger";
import { makeScript } from "@app/scripts/helpers";

const BATCH_SIZE = 256;

// Copy-pasted from connectors
function getConversationInternalId(
  connectorId: ModelId,
  conversationId: string
): string {
  return `intercom-conversation-${connectorId}-${conversationId}`;
}

function getIntercomDomain(region: string): string {
  if (region === "Europe") {
    return "https://app.eu.intercom.com";
  }
  if (region === "Australia") {
    return "https://app.au.intercom.com";
  }
  return "https://app.intercom.com";
}

function getConversationInAppUrl(
  workspaceId: string,
  conversationId: string,
  region: string
): string {
  const domain = getIntercomDomain(region);
  return `${domain}/a/inbox/${workspaceId}/inbox/conversation/${conversationId}`;
}

async function updateNodes(
  coreSequelize: Sequelize,
  nodeIds: string[],
  urls: string[]
) {
  await coreSequelize.query(
    `UPDATE data_sources_nodes
     SET source_url = urls.url
     FROM (SELECT unnest(ARRAY [:nodeIds]::text[]) as node_id,
                  unnest(ARRAY [:urls]::text[])    as url) urls
     WHERE data_sources_nodes.node_id = urls.node_id;`,
    { replacements: { urls, nodeIds } }
  );
}

async function backfillConversationsForWorkspace(
  coreSequelize: Sequelize,
  connectorsSequelize: Sequelize,
  workspaceId: string,
  region: string,
  connectorId: ModelId,
  execute: boolean,
  logger: typeof Logger
) {
  logger.info("Processing conversations");

  let nextId = 0;
  let updatedRowsCount;
  do {
    const rows: {
      conversationId: string;
      id: number;
      connectorId: number;
    }[] = await connectorsSequelize.query(
      `
          SELECT ic.id, ic."conversationId", ic."connectorId"
          FROM intercom_conversations ic
          WHERE ic.id > :nextId AND ic."connectorId" = :connectorId
          ORDER BY ic.id
          LIMIT :batchSize;`,
      {
        replacements: {
          batchSize: BATCH_SIZE,
          nextId,
          connectorId,
        },
        type: QueryTypes.SELECT,
      }
    );

    if (rows.length == 0) {
      logger.info({ nextId }, `Finished processing conversations.`);
      break;
    }
    nextId = rows[rows.length - 1].id;
    updatedRowsCount = rows.length;

    const urls = rows.map((row) =>
      getConversationInAppUrl(workspaceId, row.conversationId, region)
    );
    const nodeIds = rows.map((row) => {
      return getConversationInternalId(connectorId, row.conversationId);
    });
    if (execute) {
      await updateNodes(coreSequelize, nodeIds, urls);
      logger.info(`Updated ${rows.length} conversations.`);
    } else {
      logger.info(
        `Would update ${rows.length} conversations, sample: ${nodeIds.slice(0, 5).join(", ")}, ${urls.slice(0, 5).join(", ")}`
      );
    }
  } while (updatedRowsCount === BATCH_SIZE);
}

// We need the workspace info to backfill conversations, to compute their urls
async function backfillConversations(
  coreSequelize: Sequelize,
  connectorsSequelize: Sequelize,
  execute: boolean,
  logger: typeof Logger
) {
  const workspaces: {
    id: number;
    intercomWorkspaceId: string;
    region: string;
    connectorId: ModelId;
  }[] = await connectorsSequelize.query(
    `SELECT iw.id, iw."intercomWorkspaceId", iw."region", iw."connectorId"
     FROM intercom_workspaces iw`,
    {
      type: QueryTypes.SELECT,
    }
  );

  if (workspaces.length == 0) {
    logger.info(`Finished processing conversations.`);
    return;
  }

  for (const workspace of workspaces) {
    await backfillConversationsForWorkspace(
      coreSequelize,
      connectorsSequelize,
      workspace.intercomWorkspaceId,
      workspace.region,
      workspace.connectorId,
      execute,
      logger
    );
  }
}

makeScript({}, async ({ execute }, logger) => {
  const coreSequelize = getCorePrimaryDbConnection();
  const connectorsSequelize = getConnectorsReplicaDbConnection();

  await backfillConversations(
    coreSequelize,
    connectorsSequelize,
    execute,
    logger
  );
});

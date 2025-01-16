import { Context } from "@temporalio/activity";
import _ from "lodash";
import { Op, QueryTypes, Sequelize } from "sequelize";

import { destroyConversation } from "@app/lib/api/assistant/conversation/destroy";
import { Authenticator } from "@app/lib/auth";
import { Conversation } from "@app/lib/models/assistant/conversation";
import { Workspace } from "@app/lib/models/workspace";
import config from "@app/lib/production_checks/config";
import logger from "@app/logger/logger";
import type {
  RunExecutionRow,
  RunsJoinsRow,
} from "@app/temporal/hard_delete/types";
import {
  getRunExecutionsDeletionCutoffDate,
  isSequelizeForeignKeyConstraintError,
} from "@app/temporal/hard_delete/utils";

const BATCH_SIZE = 100;

export async function purgeExpiredRunExecutionsActivity() {
  const primaryCoreDatabaseUri = config.getCoreDatabasePrimaryUri();
  const coreSequelize = new Sequelize(primaryCoreDatabaseUri, {
    logging: false,
  });

  const cutoffDate = getRunExecutionsDeletionCutoffDate();

  logger.info(
    {},
    `About to purge block and run executions anterior to ${new Date(
      cutoffDate
    ).toISOString()}.`
  );

  let hasMoreRunsToPurge = true;
  let runsPurgedCount = 0;
  do {
    const batchToDelete = await coreSequelize.query<RunExecutionRow>(
      "SELECT id FROM runs WHERE created < :cutoffDate ORDER BY created, id ASC LIMIT :batchSize",
      {
        replacements: {
          batchSize: BATCH_SIZE,
          cutoffDate,
        },
        type: QueryTypes.SELECT,
      }
    );

    Context.current().heartbeat();

    logger.info(
      { batchSize: BATCH_SIZE },
      "Deleting batch of block executions."
    );

    hasMoreRunsToPurge = batchToDelete.length === BATCH_SIZE;
    runsPurgedCount += batchToDelete.length;

    await deleteRunExecutionBatch(coreSequelize, batchToDelete);
  } while (hasMoreRunsToPurge);

  logger.info({ runsPurgedCount }, "Done purging expired runs executions.");
}

async function deleteRunExecutionBatch(
  coreSequelize: Sequelize,
  runs: RunExecutionRow[]
) {
  if (runs.length === 0) {
    return;
  }

  const runIds = runs.map((r) => r.id);

  const runsJoins = await coreSequelize.query<RunsJoinsRow>(
    "SELECT id, block_execution FROM runs_joins WHERE run IN (:runIds)",
    {
      replacements: {
        runIds,
      },
      type: QueryTypes.SELECT,
    }
  );

  // For legacy rows, runsJoins may be empty.
  if (runsJoins.length > 0) {
    await coreSequelize.query(
      "DELETE FROM runs_joins WHERE id IN (:runsJoinsIds)",
      {
        replacements: {
          runsJoinsIds: runsJoins.map((rj) => rj.id),
        },
      }
    );

    // TODO(2024-06-13 flav) Remove once the schedule has completed at least once.
    // Previously, we had a cache shared between identical block executions.
    // Ensure we delete distinct run block executions.
    const blockExecutionIds = [
      ...new Set(runsJoins.map((rj) => rj.block_execution)),
    ];

    try {
      await coreSequelize.query(
        "DELETE FROM block_executions WHERE id IN (:blockExecutionIds)",
        {
          replacements: {
            blockExecutionIds,
          },
        }
      );
    } catch (err) {
      if (isSequelizeForeignKeyConstraintError(err)) {
        logger.info({}, "Failed to delete runs joins");
      }
    }
  }

  await coreSequelize.query("DELETE FROM runs WHERE id IN (:runIds)", {
    replacements: {
      runIds,
    },
  });
}

export async function getWorkspacesWithConversationsRetentionActivity(): Promise<
  number[]
> {
  const workspaces = await Workspace.findAll({
    attributes: ["id"],
    where: {
      conversationsRetentionDays: {
        [Op.not]: null,
      },
    },
  });
  return workspaces.map((w) => w.id);
}

export async function purgeConversationsBatchActivity({
  workspaceIds,
}: {
  workspaceIds: number[];
}) {
  for (const workspaceId of workspaceIds) {
    const workspace = await Workspace.findByPk(workspaceId);
    if (!workspace) {
      logger.error(
        { workspaceId },
        "Workspace with retention policy not found."
      );
      continue;
    }
    if (!workspace.conversationsRetentionDays) {
      logger.error(
        { workspaceId },
        "Workspace with retention policy has no retention days."
      );
      continue;
    }
    const retentionDays = workspace.conversationsRetentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const conversations = await Conversation.findAll({
      where: { workspaceId: workspace.id, updatedAt: { [Op.lt]: cutoffDate } },
    });

    logger.info(
      {
        workspaceId,
        retentionDays,
        cutoffDate,
        nbConversations: conversations.length,
      },
      "Purging conversations for workspace."
    );

    const auth = await Authenticator.internalAdminForWorkspace(workspace.sId);

    const conversationChunks = _.chunk(conversations, 4);
    for (const conversationChunk of conversationChunks) {
      await Promise.all(
        conversationChunk.map(async (c) => {
          await destroyConversation(auth, { conversationId: c.sId });
        })
      );
    }
  }
}

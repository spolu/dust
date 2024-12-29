import { ConfluenceClientError } from "@dust-tt/types";
import { makeScript } from "scripts/helpers";

import { pageHasReadRestrictions } from "@connectors/connectors/confluence/lib/confluence_api";
import type { ConfluenceClient } from "@connectors/connectors/confluence/lib/confluence_client";
import {
  fetchConfluenceConfigurationActivity,
  getConfluenceClient,
  getSpaceIdsToSyncActivity,
} from "@connectors/connectors/confluence/temporal/activities";
import {
  ExternalOAuthTokenError,
  ProviderWorkflowError,
} from "@connectors/lib/error";
import { ConfluencePage } from "@connectors/lib/models/confluence";
import type Logger from "@connectors/logger/logger";
import { ConnectorResource } from "@connectors/resources/connector_resource";

async function countPagesForConnector(
  connector: ConnectorResource,
  logger: typeof Logger
) {
  const connectorId = connector.id;
  let totalRequestCountOld = 0;
  let totalRequestCountNew = 0;

  const { cloudId } = await fetchConfluenceConfigurationActivity(connectorId);
  const client = await getConfluenceClient({ cloudId, connectorId });

  const spaceIds = await getSpaceIdsToSyncActivity(connectorId);

  for (const spaceId of spaceIds) {
    try {
      // old method
      const { pageCount: pageCountOld, requestCount: requestCountOld } =
        await countOldMethodRequests(client, connector, spaceId);
      logger.info({ spaceId, pageCountOld, requestCountOld }, "Old method");
      totalRequestCountOld += requestCountOld;

      // new method
      const { pageCount: pageCountNew, requestCount: requestCountNew } =
        await countNewMethodRequests(client, spaceId);
      logger.info({ spaceId, pageCountNew, requestCountNew }, "New method");
      totalRequestCountNew += requestCountNew;
    } catch (e) {
      if (
        e instanceof ProviderWorkflowError ||
        e instanceof ExternalOAuthTokenError ||
        e instanceof ConfluenceClientError
      ) {
        logger.error(`ERROR: ${e.message}`);
        continue;
      }
      throw e;
    }
  }
  return { totalRequestCountOld, totalRequestCountNew };
}

/**
 * Count the number of requests required to sync a space using the new method.
 * Returns the number of requests, omitting the request required to check for permissions;
 * assuming that these requests will be made for both the old and the new method.
 * New method: fetch all the pages and then check for the hierarchy.
 */
async function countNewMethodRequests(
  client: ConfluenceClient,
  spaceId: string
) {
  let requestCount = 0;
  let pageCount = 0;

  let cursor = null;
  do {
    const { pages, nextPageCursor } = await client.getPagesInSpace(
      spaceId,
      "all",
      "id",
      cursor,
      250
    );
    requestCount++;
    pageCount += pages.length;
    cursor = nextPageCursor;
  } while (cursor !== null);

  return { pageCount, requestCount };
}

/**
 * Count the number of requests required to sync a space using the old method.
 * Returns a lower bound (because of pagination) on the number of requests, omitting the request required to check for permissions;
 * assuming that these requests will be made for both the old and the new method.
 * Old method: DFS with requests to getChildPages and getPagesByIdsInSpace at each node.
 */
async function countOldMethodRequests(
  client: ConfluenceClient,
  connector: ConnectorResource,
  spaceId: string
) {
  let requestCount = 0;
  let pageCount = 0;

  const topLevelPages = await ConfluencePage.findAll({
    where: { connectorId: connector.id, spaceId, parentId: null },
  });
  requestCount++;
  pageCount += topLevelPages.length;

  const stack = [...topLevelPages];

  while (stack.length > 0) {
    const currentPage = stack.pop();
    if (!currentPage) {
      throw new Error("No more pages to parse.");
    }

    const hasReadRestrictions = await pageHasReadRestrictions(
      client,
      currentPage.pageId
    );
    if (hasReadRestrictions) {
      continue;
    }

    const parentId = currentPage.id.toString();
    const childrenPages = await ConfluencePage.findAll({
      where: { connectorId: connector.id, spaceId, parentId },
    });
    requestCount += 2;
    pageCount += childrenPages.length;

    stack.push(...childrenPages);
  }

  return { pageCount, requestCount };
}

makeScript(
  {
    exclude: {
      type: "array",
      demandOption: false,
      default: [],
      description: "IDs of the connectors to skip.",
    },
    include: {
      type: "array",
      demandOption: false,
      default: [],
      description: "IDs of the connectors to include.",
    },
  },
  async ({ exclude, include }, logger) => {
    const connectors = await ConnectorResource.listByType("confluence", {});

    // we actually get numbers from the CLI
    const connectorsToExclude = exclude.map((id) => id.toString());
    const connectorsToInclude = include.map((id) => id.toString());

    for (const connector of connectors) {
      const connectorId = connector.id;
      if (
        connectorsToExclude.includes(connectorId.toString()) ||
        (connectorsToInclude.length > 0 &&
          !connectorsToInclude.includes(connectorId.toString()))
      ) {
        logger.info({ connectorId }, "SKIP");
        continue;
      }
      logger.info({ connectorId }, "CHECK");
      const { totalRequestCountOld, totalRequestCountNew } =
        await countPagesForConnector(connector, logger.child({ connectorId }));
      logger.info(
        { connectorId, totalRequestCountOld, totalRequestCountNew },
        "SUMMARY"
      );
    }
    logger.info("DONE");
  }
);

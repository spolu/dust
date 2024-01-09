import { ModelId } from "@dust-tt/types";
import { CreationAttributes } from "sequelize";
import TurndownService from "turndown";

import {
  ConfluenceClient,
  ConfluencePageType,
} from "@connectors/connectors/confluence/lib/confluence_client";
import {
  renderMarkdownSection,
  upsertToDatasource,
} from "@connectors/lib/data_sources";
import { Connector } from "@connectors/lib/models";
import {
  ConfluenceConnectorState,
  ConfluencePages,
  ConfluenceSpaces,
} from "@connectors/lib/models/confluence";
import { getConnectionFromNango } from "@connectors/lib/nango_helpers";
import { DataSourceConfig } from "@connectors/types/data_source_config";

const turndownService = new TurndownService();

// TODO: Move as a parameter!
const { NANGO_CONFLUENCE_CONNECTOR_ID = "" } = process.env;

// Should this be an Activity?!
export async function getSpaceIdsToSyncActivity(connectorId: ModelId) {
  const spaces = await ConfluenceSpaces.findAll({
    where: {
      connectorId: connectorId,
    },
  });

  return spaces.map((f) => f.spaceId);
}

async function getConfluenceAccessToken({
  connectionId,
  integrationId,
}: {
  connectionId: string;
  integrationId: string;
}) {
  const connection = await getConnectionFromNango({
    connectionId: connectionId,
    integrationId: integrationId,
    refreshToken: false,
    useCache: true,
  });

  return connection.credentials.access_token;
}

async function getConfluenceClient(config: {
  cloudId: string;
  connectionId: string;
  integrationId: string;
}) {
  const accessToken = await getConfluenceAccessToken(config);

  return new ConfluenceClient(accessToken, { cloudId: config.cloudId });
}

function getPageDocumentId(spaceId: string, pageId: string): string {
  return `confluence-page-${spaceId}-${pageId}`;
}

function renderPageMarkdown(page: ConfluencePageType) {
  const markdown = turndownService.turndown(page.body.storage.value);

  // TODO(2024-01-08 flav) Refactor to use regular markdown.
  const content = renderMarkdownSection(`${page.title}\n`, markdown || "");

  return content;
}

async function upsertPage(
  connectorId: ModelId,
  spaceId: string,
  dataSourceConfig: DataSourceConfig,
  page: ConfluencePageType
) {
  const documentId = getPageDocumentId(spaceId, page.id);
  const renderedPage = renderPageMarkdown(page);
  console.log("------ PAGE -------");
  console.log(">> documentId:", documentId);
  console.log(">> renderedPage (md):", renderedPage);

  await upsertToDatasource({
    dataSourceConfig,
    documentId,
    documentContent: renderedPage,
    // TODO: aggregate the state.url
    // Must be a valid url.
    // documentUrl: `${page._links.tinyui}`,
    // TODO(2024-01-08 flav) Rely on version.
    timestampMs: new Date().getTime(), //page.version.number,
    tags: [],
    parents: [],
    retries: 3,
    delayBetweenRetriesMs: 500,
    loggerArgs: { provider: "confluence", spaceId },
    upsertContext: {
      sync_type: "incremental",
    },
  });

  const params: CreationAttributes<ConfluencePages> = {
    connectorId,
    // createdAt: page.createdAt,
    // updatedAt: page.version.updatedAt,
    title: page.title,
    parentId: page.parentId,
    spaceId,
    pageId: page.id,
    version: page.version.number,
    //   // TODO: aggregate the state.url
    externalUrl: `${page._links.tinyui}`,
  };

  // if (upsertTimestampMs) {
  //   params.lastUpsertedTs = new Date(upsertTimestampMs);
  // }

  await ConfluencePages.upsert(params);
}

export async function syncPagesForSpaceActivity(
  connectorId: ModelId,
  dataSourceConfig: DataSourceConfig,
  spaceId: string,
  startSyncTs: number,
  pageCursor?: string
) {
  const connector = await Connector.findByPk(connectorId);
  const confluenceState = await ConfluenceConnectorState.findOne({
    where: {
      connectorId,
    },
  });
  if (!connector || !confluenceState) {
    throw new Error(`Connector ${connectorId} not found`);
  }

  const client = await getConfluenceClient({
    cloudId: confluenceState?.cloudId,
    connectionId: connector.connectionId,
    integrationId: NANGO_CONFLUENCE_CONNECTOR_ID,
  });

  const { pages, nextPageCursor } = await client.getPagesInSpace(
    spaceId,
    pageCursor
  );
  for (const page of pages) {
    console.log(`>> Fetch page ${page.title} with id ${page.id}`);
    await upsertPage(connectorId, spaceId, dataSourceConfig, page);
  }

  console.log(">> nextPageCursor:", nextPageCursor);
  return {
    count: 0,
    nextPageCursor,
  };
}

import type { ModelId } from "@dust-tt/types";
import TurndownService from "turndown";

import {
  getArticleInternalId,
  getBrandInternalId,
  getCategoryInternalId,
  getHelpCenterInternalId,
} from "@connectors/connectors/zendesk/lib/id_conversions";
import type { ZendeskFetchedArticle } from "@connectors/connectors/zendesk/lib/node-zendesk-types";
import {
  renderDocumentTitleAndContent,
  renderMarkdownSection,
  upsertToDatasource,
} from "@connectors/lib/data_sources";
import type { ZendeskCategoryResource } from "@connectors/resources/zendesk_resources";
import { ZendeskArticleResource } from "@connectors/resources/zendesk_resources";
import type { DataSourceConfig } from "@connectors/types/data_source_config";

const turndownService = new TurndownService();

export async function syncArticle({
  connectorId,
  article,
  category,
  currentSyncDateMs,
  dataSourceConfig,
  loggerArgs,
}: {
  connectorId: ModelId;
  dataSourceConfig: DataSourceConfig;
  article: ZendeskFetchedArticle;
  category: ZendeskCategoryResource;
  currentSyncDateMs: number;
  loggerArgs: Record<string, string | number | null>;
  forceResync: boolean;
}) {
  let articleInDb = await ZendeskArticleResource.fetchByArticleId({
    connectorId,
    articleId: article.id,
  });
  const createdAtDate = new Date(article.created_at);
  const updatedAtDate = new Date(article.updated_at);

  if (!articleInDb) {
    articleInDb = await ZendeskArticleResource.makeNew({
      blob: {
        createdAt: createdAtDate,
        updatedAt: updatedAtDate,
        articleId: article.id,
        brandId: category.brandId,
        categoryId: category.id,
        permission: "read",
        name: article.name,
        url: article.url,
        connectorId,
      },
    });
  } else {
    await articleInDb.update({
      createdAt: createdAtDate,
      updatedAt: updatedAtDate,
      categoryId: category.id, // an article can be moved from one category to another, which does not apply to brands
      name: article.name,
      url: article.url,
    });
  }

  const categoryContent =
    category.name + category.description ? ` - ${category.description}` : "";

  const articleContentInMarkdown =
    typeof article.body === "string"
      ? turndownService.turndown(article.body)
      : "";

  // append the collection description at the beginning of the article
  const markdown = `CATEGORY: ${categoryContent}\n\n${articleContentInMarkdown}`;

  if (articleContentInMarkdown) {
    const createdAt = new Date(article.created_at);
    const updatedAt = new Date(article.updated_at);

    const renderedMarkdown = await renderMarkdownSection(
      dataSourceConfig,
      markdown
    );
    const documentContent = await renderDocumentTitleAndContent({
      dataSourceConfig,
      title: article.title,
      content: renderedMarkdown,
      createdAt,
      updatedAt,
    });

    const documentId = getArticleInternalId(connectorId, article.id);

    await upsertToDatasource({
      dataSourceConfig,
      documentId,
      documentContent,
      documentUrl: article.url,
      timestampMs: updatedAt.getTime(),
      tags: [
        `title:${article.title}`,
        `createdAt:${createdAt.getTime()}`,
        `updatedAt:${updatedAt.getTime()}`,
      ],
      parents: [
        documentId,
        getCategoryInternalId(connectorId, articleInDb.categoryId),
        getHelpCenterInternalId(connectorId, articleInDb.brandId),
        getBrandInternalId(connectorId, articleInDb.brandId),
      ],
      loggerArgs: { ...loggerArgs, articleId: article.id },
      upsertContext: { sync_type: "batch" },
      async: true,
    });
    await articleInDb.update({ lastUpsertedTs: new Date(currentSyncDateMs) });
  }
}

import type { ModelId } from "@dust-tt/types";

import {
  getArticleInternalId,
  getTicketInternalId,
} from "@connectors/connectors/zendesk/lib/id_conversions";
import { getZendeskAccessToken } from "@connectors/connectors/zendesk/lib/zendesk_access_token";
import {
  changeZendeskClientSubdomain,
  createZendeskClient,
} from "@connectors/connectors/zendesk/lib/zendesk_api";
import { dataSourceConfigFromConnector } from "@connectors/lib/api/data_source_config";
import { deleteFromDataSource } from "@connectors/lib/data_sources";
import { syncStarted, syncSucceeded } from "@connectors/lib/sync_status";
import { ConnectorResource } from "@connectors/resources/connector_resource";
import {
  ZendeskArticleResource,
  ZendeskBrandResource,
  ZendeskCategoryResource,
  ZendeskConfigurationResource,
  ZendeskTicketResource,
} from "@connectors/resources/zendesk_resources";
import type { DataSourceConfig } from "@connectors/types/data_source_config";

async function _getZendeskConnectorOrRaise(connectorId: ModelId) {
  const connector = await ConnectorResource.fetchById(connectorId);
  if (!connector) {
    throw new Error("[Zendesk] Connector not found.");
  }
  return connector;
}

async function _getZendeskConfigurationOrRaise(connectorId: ModelId) {
  const configuration =
    await ZendeskConfigurationResource.fetchById(connectorId);
  if (!configuration) {
    throw new Error("[Zendesk] Configuration not found.");
  }
  return configuration;
}

/**
 * This activity is responsible for updating the lastSyncStartTime of the connector to now.
 */
export async function saveZendeskConnectorStartSync({
  connectorId,
}: {
  connectorId: ModelId;
}) {
  const connector = await _getZendeskConnectorOrRaise(connectorId);
  const res = await syncStarted(connector.id);
  if (res.isErr()) {
    throw res.error;
  }
}

/**
 * This activity is responsible for updating the sync status of the connector to "success".
 */
export async function saveZendeskConnectorSuccessSync({
  connectorId,
}: {
  connectorId: ModelId;
}) {
  const connector = await _getZendeskConnectorOrRaise(connectorId);
  const res = await syncSucceeded(connector.id);
  if (res.isErr()) {
    throw res.error;
  }
}

/**
 * This activity is responsible for syncing a Brand.
 * It does not sync the content inside the Brand, only the Brand data in itself.
 *
 * It is going to update the name of the Brand if it has changed.
 * If the Brand is not allowed anymore, it will delete all its data.
 * If the Brand is not present on Zendesk anymore, it will delete all its data as well.
 *
 * @returns true if the Brand was updated, false if it was deleted.
 */
export async function syncZendeskBrandActivity({
  connectorId,
  brandId,
  currentSyncDateMs,
}: {
  connectorId: ModelId;
  brandId: number;
  currentSyncDateMs: number;
}): Promise<{ helpCenterAllowed: boolean; ticketsAllowed: boolean }> {
  const connector = await _getZendeskConnectorOrRaise(connectorId);
  const dataSourceConfig = dataSourceConfigFromConnector(connector);
  const configuration = await _getZendeskConfigurationOrRaise(connectorId);

  const brandInDb = await ZendeskBrandResource.fetchByBrandId({
    connectorId,
    brandId,
  });
  if (!brandInDb) {
    throw new Error(
      `[Zendesk] Brand not found, connectorId: ${connectorId}, brandId: ${brandId}`
    );
  }

  // if all rights were revoked, we delete the brand data.
  if (
    brandInDb.helpCenterPermission === "none" &&
    brandInDb.ticketsPermission === "none"
  ) {
    await brandInDb.delete();
    return { helpCenterAllowed: false, ticketsAllowed: false };
  }

  const accessToken = await getZendeskAccessToken(connector.connectionId);
  const zendeskApiClient = createZendeskClient({
    token: accessToken,
    subdomain: configuration.subdomain,
  });

  // if the brand is not on Zendesk anymore, we delete it
  const {
    result: { brand: fetchedBrand },
  } = await zendeskApiClient.brand.show(brandId);
  if (!fetchedBrand) {
    await deleteBrandChildren({ connectorId, brandId, dataSourceConfig });
    await brandInDb.delete();
    return { helpCenterAllowed: false, ticketsAllowed: false };
  }

  const categoriesWithReadPermissions =
    await ZendeskCategoryResource.fetchByBrandIdReadOnly({
      connectorId,
      brandId,
    });
  const noMoreAllowedCategories = categoriesWithReadPermissions.length === 0;

  if (noMoreAllowedCategories) {
    // if the tickets and all children categories are not allowed anymore, we delete the brand data
    if (brandInDb.ticketsPermission !== "read") {
      await deleteBrandChildren({ connectorId, brandId, dataSourceConfig });
      return { helpCenterAllowed: false, ticketsAllowed: false };
    }
    await brandInDb.update({ helpCenterPermission: "none" });
  }

  // otherwise, we update the brand name and lastUpsertedTs
  await brandInDb.update({
    name: fetchedBrand.name || "Brand",
    lastUpsertedTs: new Date(currentSyncDateMs),
  });
  return {
    helpCenterAllowed: brandInDb.helpCenterPermission === "read",
    ticketsAllowed: brandInDb.ticketsPermission === "read",
  };
}

/**
 * This activity is responsible for checking the permissions for a Brand's Help Center.
 *
 * @returns true if the Help Center has read permissions enabled.
 */
export async function checkZendeskHelpCenterPermissionsActivity({
  connectorId,
  brandId,
}: {
  connectorId: ModelId;
  brandId: number;
}): Promise<boolean> {
  const brandInDb = await ZendeskBrandResource.fetchByBrandId({
    connectorId,
    brandId,
  });
  if (!brandInDb) {
    throw new Error(
      `[Zendesk] Brand not found, connectorId: ${connectorId}, brandId: ${brandId}`
    );
  }

  return brandInDb.helpCenterPermission === "read";
}

/**
 * This activity is responsible for checking the permissions for a Brand's Tickets.
 *
 * @returns true if the Help Center has read permissions enabled.
 */
export async function checkZendeskTicketsPermissionsActivity({
  connectorId,
  brandId,
}: {
  connectorId: ModelId;
  brandId: number;
}): Promise<boolean> {
  const brandInDb = await ZendeskBrandResource.fetchByBrandId({
    connectorId,
    brandId,
  });
  if (!brandInDb) {
    throw new Error(
      `[Zendesk] Brand not found, connectorId: ${connectorId}, brandId: ${brandId}`
    );
  }

  return brandInDb.ticketsPermission === "read";
}

/**
 * Retrieves the categories for a given Brand.
 */
export async function getZendeskCategoriesActivity({
  connectorId,
  brandId,
}: {
  connectorId: ModelId;
  brandId: number;
}): Promise<number[]> {
  const connector = await _getZendeskConnectorOrRaise(connectorId);
  const configuration = await _getZendeskConfigurationOrRaise(connectorId);
  const accessToken = await getZendeskAccessToken(connector.connectionId);
  const client = createZendeskClient({
    token: accessToken,
    subdomain: configuration.subdomain,
  });
  await changeZendeskClientSubdomain({ client, brandId });
  const categories = await client.helpcenter.categories.list();

  return categories.map((category) => category.id);
}

/**
 * This activity is responsible for syncing a Category.
 * It does not sync the articles inside the Category, only the Category data in itself.
 *
 * It is going to update the name of the Category if it has changed.
 * If the Category is not allowed anymore, it will delete all its data.
 * If the Category is not present on Zendesk anymore, it will delete all its data as well.
 *
 * @returns true if the Category was updated, false if it was deleted.
 */
export async function syncZendeskCategoryActivity({
  connectorId,
  categoryId,
  currentSyncDateMs,
}: {
  connectorId: ModelId;
  categoryId: number;
  currentSyncDateMs: number;
}): Promise<boolean> {
  const connector = await _getZendeskConnectorOrRaise(connectorId);
  const dataSourceConfig = dataSourceConfigFromConnector(connector);
  const configuration = await _getZendeskConfigurationOrRaise(connectorId);
  const categoryInDb = await ZendeskCategoryResource.fetchByCategoryId({
    connectorId,
    categoryId,
  });
  if (!categoryInDb) {
    throw new Error(
      `[Zendesk] Category not found, connectorId: ${connectorId}, categoryId: ${categoryId}`
    );
  }

  // if all rights were revoked, we delete the category data.
  if (categoryInDb.permission === "none") {
    await deleteUpsertedArticles({ connectorId, categoryId, dataSourceConfig });
    await ZendeskArticleResource.deleteByCategoryId({
      connectorId,
      categoryId,
    });
    await categoryInDb.delete();
    return false;
  }

  const accessToken = await getZendeskAccessToken(connector.connectionId);
  const zendeskApiClient = createZendeskClient({
    token: accessToken,
    subdomain: configuration.subdomain,
  });

  // if the category is not on Zendesk anymore, we delete it
  const { result: fetchedCategory } =
    await zendeskApiClient.helpcenter.categories.show(categoryId);
  if (!fetchedCategory) {
    await deleteUpsertedArticles({ connectorId, categoryId, dataSourceConfig });
    await ZendeskArticleResource.deleteByCategoryId({
      connectorId,
      categoryId,
    });
    await categoryInDb.delete();
    return false;
  }

  // otherwise, we update the category name and lastUpsertedTs
  await categoryInDb.update({
    name: fetchedCategory.name || "Category",
    lastUpsertedTs: new Date(currentSyncDateMs),
  });
  return true;
}

/**
 * This activity is responsible for syncing all the articles in a Category.
 * It does not sync the Category, only the Articles.
 *
 * @returns true if the Category was updated, false if it was deleted.
 */
// eslint-disable-next-line no-empty-pattern
export async function syncZendeskArticlesActivity({}: {
  connectorId: ModelId;
  categoryId: number;
  currentSyncDateMs: number;
  forceResync: boolean;
}) {}

/**
 * This activity is responsible for syncing all the tickets for a Brand.
 */
// eslint-disable-next-line no-empty-pattern
export async function syncZendeskTicketsActivity({}: {
  connectorId: ModelId;
  brandId: number;
  currentSyncDateMs: number;
  forceResync: boolean;
  afterCursor: string | null;
}): Promise<{ hasMore: boolean; afterCursor: string }> {
  return { hasMore: false, afterCursor: "" };
}

/**
 * Deletes all the data stored in the db and in the data source relative to a brand (category, articles and tickets).
 */
async function deleteBrandChildren({
  connectorId,
  brandId,
  dataSourceConfig,
}: {
  connectorId: number;
  brandId: number;
  dataSourceConfig: DataSourceConfig;
}) {
  /// deleting the upserted articles
  const categories = await ZendeskCategoryResource.fetchByBrandId({
    connectorId,
    brandId,
  });
  await Promise.all(
    categories.map((categoryInDb) =>
      deleteUpsertedArticles({
        connectorId,
        categoryId: categoryInDb.categoryId,
        dataSourceConfig,
      })
    )
  );
  /// deleting the upserted tickets
  await deleteUpsertedTickets({ connectorId, brandId, dataSourceConfig });
  await ZendeskArticleResource.deleteByBrandId({
    connectorId,
    brandId,
  });
  /// deleting the categories stored in the db
  await ZendeskCategoryResource.deleteByBrandId({ connectorId, brandId });
  /// deleting the tickets stored in the db
  await ZendeskTicketResource.deleteByBrandId({ connectorId, brandId });
}

/**
 * Deletes all the articles upserted for a category.
 */
async function deleteUpsertedArticles({
  connectorId,
  categoryId,
  dataSourceConfig,
}: {
  connectorId: number;
  categoryId: number;
  dataSourceConfig: DataSourceConfig;
}) {
  const articles = await ZendeskArticleResource.fetchByCategoryId({
    connectorId,
    categoryId,
  });
  await Promise.all(
    articles.map((article) =>
      deleteFromDataSource(
        dataSourceConfig,
        getArticleInternalId(article.connectorId, article.articleId)
      )
    )
  );
}

/**
 * Deletes all the tickets upserted for a brand.
 */
async function deleteUpsertedTickets({
  connectorId,
  brandId,
  dataSourceConfig,
}: {
  connectorId: number;
  brandId: number;
  dataSourceConfig: DataSourceConfig;
}) {
  const tickets = await ZendeskTicketResource.fetchByBrandId({
    connectorId: connectorId,
    brandId: brandId,
  });
  await Promise.all([
    tickets.map((ticket) =>
      deleteFromDataSource(
        dataSourceConfig,
        getTicketInternalId(ticket.connectorId, ticket.ticketId)
      )
    ),
  ]);
}

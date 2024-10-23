import type {
  ConnectorPermission,
  ContentNode,
  ContentNodesViewType,
  ModelId,
} from "@dust-tt/types";

import {
  getBrandIdFromInternalId,
  getBrandInternalId,
  getCategoryInternalId,
  getHelpCenterInternalId,
} from "@connectors/connectors/zendesk/lib/id_conversions";
import { getZendeskAccessToken } from "@connectors/connectors/zendesk/lib/zendesk_access_token";
import {
  changeZendeskClientSubdomain,
  createZendeskClient,
} from "@connectors/connectors/zendesk/lib/zendesk_api";
import {
  ZendeskArticle,
  ZendeskBrand,
  ZendeskCategory,
} from "@connectors/lib/models/zendesk";
import logger from "@connectors/logger/logger";
import { ConnectorResource } from "@connectors/resources/connector_resource";

/**
 * Mark a brand as permission "read" and all children (help center and tickets) if specified.
 */
export async function allowSyncBrand({
  subdomain,
  connectorId,
  connectionId,
  brandId,
  withChildren = false,
}: {
  subdomain: string;
  connectorId: ModelId;
  connectionId: string;
  brandId: number;
  withChildren?: boolean;
}): Promise<ZendeskBrand> {
  let brand = await ZendeskBrand.findOne({ where: { connectorId, brandId } });
  if (brand?.permission === "none") {
    await brand.update({ permission: "read" });
  }

  const token = await getZendeskAccessToken(connectionId);
  const zendeskApiClient = createZendeskClient({ token, subdomain });

  if (!brand) {
    const {
      result: { brand: fetchedBrand },
    } = await zendeskApiClient.brand.show(brandId);
    if (fetchedBrand) {
      brand = await ZendeskBrand.create({
        subdomain: fetchedBrand.subdomain,
        connectorId: connectorId,
        brandId: fetchedBrand.id,
        name: fetchedBrand.name || "Brand",
        permission: "read",
        hasHelpCenter: fetchedBrand.has_help_center,
        url: fetchedBrand.url,
      });
    } else {
      logger.error({ brandId }, "[Zendesk] Brand could not be fetched.");
      throw new Error("Brand could not be fetched.");
    }
  }

  if (withChildren) {
    throw new Error("withChildren not implemented yet.");
  }

  return brand;
}

/**
 * Mark a help center as permission "none" and all children (collections & articles).
 */
export async function revokeSyncBrand({
  connectorId,
  brandId,
}: {
  connectorId: ModelId;
  brandId: string;
}): Promise<ZendeskBrand | null> {
  const brand = await ZendeskBrand.findOne({ where: { connectorId, brandId } });

  // revoking permissions for the brand, the categories and the articles
  if (brand?.permission === "read") {
    await brand.update({ permission: "none" });
  }
  await ZendeskCategory.update(
    { permission: "none" },
    { where: { brandId: brandId } }
  );
  await ZendeskArticle.update(
    { permission: "none" },
    { where: { brandId: brandId } }
  );

  return brand;
}

export async function retrieveZendeskHelpCenterPermissions({
  connectorId,
  parentInternalId,
  filterPermission,
}: {
  connectorId: ModelId;
  parentInternalId: string | null;
  filterPermission: ConnectorPermission | null;
  viewType: ContentNodesViewType;
}): Promise<ContentNode[]> {
  const connector = await ConnectorResource.fetchById(connectorId);
  if (!connector) {
    logger.error({ connectorId }, "[Zendesk] Connector not found.");
    throw new Error("Connector not found");
  }

  const isRootLevel = !parentInternalId;

  // At the root level, we show two nodes: Help Center and Tickets.
  if (isRootLevel) {
    const helpCenterNode: ContentNode = {
      provider: connector.type,
      internalId: getHelpCenterInternalId(connectorId),
      parentInternalId: null,
      type: "database",
      title: "Help Center",
      sourceUrl: null,
      expandable: true,
      permission: "none",
      dustDocumentId: null,
      lastUpdatedAt: null,
    };

    return [helpCenterNode];
  }

  const token = await getZendeskAccessToken(connector.connectionId);
  const zendeskApiClient = createZendeskClient({ token });

  const isReadPermissionsOnly = filterPermission === "read";
  let nodes: ContentNode[] = [];

  // If the parent is a Help Center, we retrieve the list of Brands for this help center.
  // If isReadPermissionsOnly = true, we retrieve the list of Brands from the DB that have permission == "read"
  // If isReadPermissionsOnly = false, we retrieve the list of Brands from Zendesk
  if (parentInternalId === getHelpCenterInternalId(connectorId)) {
    if (isReadPermissionsOnly) {
      const brandsInDatabase = await ZendeskBrand.findAll({
        where: {
          connectorId: connectorId,
          permission: "read",
          hasHelpCenter: true,
        },
      });
      nodes = brandsInDatabase.map((brand) => ({
        provider: connector.type,
        internalId: getBrandInternalId(connectorId, brand.brandId),
        parentInternalId: getHelpCenterInternalId(connectorId),
        type: "channel",
        title: brand.name,
        sourceUrl: brand.url,
        expandable: true,
        preventSelection: !brand.hasHelpCenter,
        permission: brand.permission,
        dustDocumentId: null,
        lastUpdatedAt: brand.updatedAt.getTime(),
      }));
    } else {
      const { result: brands } = await zendeskApiClient.brand.list();
      nodes = brands
        .filter((brand) => brand.has_help_center)
        .map((brand) => ({
          provider: connector.type,
          internalId: getBrandInternalId(connectorId, brand.id),
          parentInternalId: getHelpCenterInternalId(connectorId),
          type: "folder",
          title: brand.name || "Brand",
          sourceUrl: brand.brand_url,
          expandable: true,
          preventSelection: !brand.has_help_center,
          permission: "none",
          dustDocumentId: null,
          lastUpdatedAt: null,
        }));
    }
  }

  // If the parent is a Brand, we retrieve the list of Categories for this brand.
  // If isReadPermissionsOnly = true, we retrieve the list of Categories from the DB that have permission == "read"
  // If isReadPermissionsOnly = false, we retrieve the list of Categories from Zendesk
  const brandId = getBrandIdFromInternalId(connectorId, parentInternalId);
  if (brandId) {
    const categoriesInDatabase = await ZendeskCategory.findAll({
      where: { connectorId, brandId, permission: "read" },
    });
    if (isReadPermissionsOnly) {
      nodes = categoriesInDatabase.map((category) => ({
        provider: connector.type,
        internalId: getCategoryInternalId(connectorId, category.categoryId),
        parentInternalId: parentInternalId,
        type: "folder",
        title: category.name,
        sourceUrl: category.url,
        expandable: false,
        permission: category.permission,
        dustDocumentId: null,
        lastUpdatedAt: category.updatedAt.getTime(),
      }));
    } else {
      await changeZendeskClientSubdomain({ client: zendeskApiClient, brandId });
      const categories = await zendeskApiClient.helpcenter.categories.list();
      nodes = categories.map((category) => {
        const matchingDbEntry = categoriesInDatabase.find(
          (c) => c.categoryId === category.id
        );
        return {
          provider: connector.type,
          internalId: getCategoryInternalId(connectorId, category.id),
          parentInternalId: getBrandInternalId(connectorId, brandId),
          type: "folder",
          title: category.name,
          sourceUrl: category.html_url,

          expandable: false,
          permission: matchingDbEntry ? "read" : "none",
          dustDocumentId: null,
          lastUpdatedAt: matchingDbEntry?.updatedAt.getTime() ?? null,
        };
      });
    }
  }
  nodes.sort((a, b) => a.title.localeCompare(b.title));
  return nodes;
}

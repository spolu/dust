import type { ContentNode, ModelId } from "@dust-tt/types";

import { getHelpCenterInternalId } from "@connectors/connectors/intercom/lib/utils";
import {
  getBrandInternalId,
  getCategoryInternalId,
} from "@connectors/connectors/zendesk/lib/id_conversions";
import {
  ZendeskBrand,
  ZendeskCategory,
  ZendeskHelpCenter,
} from "@connectors/lib/models/zendesk";
import logger from "@connectors/logger/logger";
import { ConnectorResource } from "@connectors/resources/connector_resource";

/**
 * Retrieve all selected nodes by the admin when setting permissions.
 * For Zendesk, the admin can set:
 * - categories, help centers and whole brands.
 * - all tickets for a brand.
 */
export async function retrieveSelectedNodes({
  connectorId,
}: {
  connectorId: ModelId;
}): Promise<ContentNode[]> {
  const connector = await ConnectorResource.fetchById(connectorId);
  if (!connector) {
    logger.error({ connectorId }, "[Zendesk] Connector not found.");
    throw new Error("Connector not found");
  }

  const brands = await ZendeskBrand.findAll({
    where: { connectorId, permission: "read" },
  });
  const brandNodes: ContentNode[] = brands.map((brand) => {
    return {
      provider: connector.type,
      internalId: getBrandInternalId(connectorId, brand.brandId),
      parentInternalId: null,
      type: "folder",
      title: brand.name,
      sourceUrl: brand.url,
      expandable: true,
      permission: brand.permission,
      dustDocumentId: null,
      lastUpdatedAt: brand.updatedAt.getTime() || null,
    };
  });

  const categories = await ZendeskCategory.findAll({
    where: {
      connectorId: connectorId,
      permission: "read",
    },
  });

  const helpCenters = await ZendeskHelpCenter.findAll({
    where: { connectorId, permission: "read" },
  });
  const helpCenterNodes: ContentNode[] = helpCenters.map((helpCenter) => {
    return {
      provider: connector.type,
      internalId: getHelpCenterInternalId(connectorId, helpCenter.helpCenterId),
      parentInternalId: getBrandInternalId(connectorId, helpCenter.brandId),
      type: "folder",
      title: helpCenter.name,
      sourceUrl: helpCenter.url,
      expandable: true,
      permission: helpCenter.permission,
      dustDocumentId: null,
      lastUpdatedAt: helpCenter.updatedAt.getTime() || null,
    };
  });
  const categoriesNodes: ContentNode[] = categories.map((category) => {
    return {
      provider: connector.type,
      internalId: getCategoryInternalId(connectorId, category.categoryId),
      parentInternalId: getHelpCenterInternalId(
        connectorId,
        category.helpCenterId
      ),
      type: "folder",
      title: category.name,
      sourceUrl: category.url,
      expandable: false,
      permission: category.permission,
      dustDocumentId: null,
      lastUpdatedAt: category.updatedAt.getTime() || null,
    };
  });

  return [...brandNodes, ...helpCenterNodes, ...categoriesNodes];
}

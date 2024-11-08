import type { ModelId } from "@dust-tt/types";

import { getZendeskSubdomainAndAccessToken } from "@connectors/connectors/zendesk/lib/zendesk_access_token";
import { createZendeskClient } from "@connectors/connectors/zendesk/lib/zendesk_api";
import logger from "@connectors/logger/logger";
import {
  ZendeskBrandResource,
  ZendeskTicketResource,
} from "@connectors/resources/zendesk_resources";

/**
 * Marks the node "Tickets" of a Brand as permission "read".
 */
export async function allowSyncZendeskTickets({
  connectorId,
  connectionId,
  brandId,
}: {
  connectorId: ModelId;
  connectionId: string;
  brandId: number;
}): Promise<boolean> {
  const brand = await ZendeskBrandResource.fetchByBrandId({
    connectorId,
    brandId,
  });
  if (brand?.ticketsPermission === "none") {
    await brand.update({ ticketsPermission: "read" });
  }

  if (!brand) {
    const zendeskApiClient = createZendeskClient(
      await getZendeskSubdomainAndAccessToken(connectionId)
    );
    const {
      result: { brand: fetchedBrand },
    } = await zendeskApiClient.brand.show(brandId);
    if (fetchedBrand) {
      await ZendeskBrandResource.makeNew({
        blob: {
          subdomain: fetchedBrand.subdomain,
          connectorId: connectorId,
          brandId: fetchedBrand.id,
          name: fetchedBrand.name || "Brand",
          helpCenterPermission: "none",
          ticketsPermission: "read",
          hasHelpCenter: fetchedBrand.has_help_center,
          url: fetchedBrand.url,
        },
      });
    } else {
      logger.error({ brandId }, "[Zendesk] Brand could not be fetched.");
      return false;
    }
  }

  return true;
}

/**
 * Mark the node "Tickets" and all the children tickets for a Brand as permission "none".
 */
export async function revokeSyncZendeskTickets({
  connectorId,
  brandId,
}: {
  connectorId: ModelId;
  brandId: number;
}): Promise<ZendeskBrandResource | null> {
  const brand = await ZendeskBrandResource.fetchByBrandId({
    connectorId,
    brandId,
  });
  if (!brand) {
    logger.error(
      { brandId },
      "[Zendesk] Brand not found, could not revoke sync."
    );
    return null;
  }

  // updating the field ticketsPermission to "none" for the brand
  await brand.revokeTicketsPermissions();
  // revoking the permissions for all the children tickets
  await ZendeskTicketResource.revokePermissionsForBrand({
    connectorId,
    brandId,
  });
  return brand;
}

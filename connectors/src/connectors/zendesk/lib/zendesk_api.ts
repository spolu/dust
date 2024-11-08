import assert from "node:assert";

import type { ModelId } from "@dust-tt/types";
import type { Client } from "node-zendesk";
import { createClient } from "node-zendesk";

import type {
  ZendeskFetchedArticle,
  ZendeskFetchedTicket,
} from "@connectors/connectors/zendesk/lib/node-zendesk-types";
import { ExternalOAuthTokenError } from "@connectors/lib/error";
import logger from "@connectors/logger/logger";
import { ZendeskBrandResource } from "@connectors/resources/zendesk_resources";

const ZENDESK_RATE_LIMIT_MAX_RETRIES = 5;
const ZENDESK_RATE_LIMIT_TIMEOUT_SECONDS = 60;

export function createZendeskClient({
  accessToken,
  subdomain,
}: {
  accessToken: string;
  subdomain: string;
}) {
  return createClient({ oauth: true, token: accessToken, subdomain });
}

/**
 * Returns a Zendesk client with the subdomain set to the one in the brand.
 * Retrieves the brand from the database if it exists, fetches it from the Zendesk API otherwise.
 * @returns The subdomain of the brand the client was scoped to.
 */
export async function changeZendeskClientSubdomain(
  client: Client,
  { connectorId, brandId }: { connectorId: ModelId; brandId: number }
): Promise<string> {
  const brandSubdomain = await getZendeskBrandSubdomain(client, {
    connectorId,
    brandId,
  });
  client.config.subdomain = brandSubdomain;
  return brandSubdomain;
}

/**
 * Retrieves a brand's subdomain from the database if it exists, fetches it from the Zendesk API otherwise.
 */
async function getZendeskBrandSubdomain(
  client: Client,
  { connectorId, brandId }: { connectorId: ModelId; brandId: number }
): Promise<string> {
  const brandInDb = await ZendeskBrandResource.fetchByBrandId({
    connectorId,
    brandId,
  });
  if (brandInDb) {
    return brandInDb.subdomain;
  }

  const {
    result: { brand },
  } = await client.brand.show(brandId);
  return brand.subdomain;
}

/**
 * Handles rate limit responses from Zendesk API.
 * Expects to find the header `Retry-After` in the response.
 * https://developer.zendesk.com/api-reference/introduction/rate-limits/
 * @returns true if the rate limit was handled and the request should be retried, false otherwise.
 */
async function handleZendeskRateLimit(response: Response): Promise<boolean> {
  if (response.status === 429) {
    const retryAfter = Math.max(
      Number(response.headers.get("Retry-After")) || 1,
      1
    );
    if (retryAfter > ZENDESK_RATE_LIMIT_TIMEOUT_SECONDS) {
      logger.info(
        { retryAfter },
        `[Zendesk] Attempting to wait more than ${ZENDESK_RATE_LIMIT_TIMEOUT_SECONDS} s, aborting.`
      );
      throw new Error(
        `Zendesk retry after larger than ${ZENDESK_RATE_LIMIT_TIMEOUT_SECONDS} s, aborting.`
      );
    }
    logger.info(
      { response, retryAfter },
      "[Zendesk] Rate limit hit, waiting before retrying."
    );
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return true;
  }
  return false;
}

/**
 * Fetches a batch of articles in a category from the Zendesk API.
 */
export async function fetchZendeskArticlesInCategory({
  subdomain,
  accessToken,
  categoryId,
  pageSize,
  cursor = null,
}: {
  subdomain: string;
  accessToken: string;
  categoryId: number;
  pageSize: number;
  cursor: string | null;
}): Promise<{
  articles: ZendeskFetchedArticle[];
  meta: { has_more: boolean; after_cursor: string };
}> {
  assert(
    pageSize <= 100,
    `pageSize must be at most 100 (current value: ${pageSize})` // https://developer.zendesk.com/api-reference/introduction/pagination
  );
  const runFetch = async () =>
    fetch(
      `https://${subdomain}.zendesk.com/api/v2/help_center/categories/${categoryId}/articles?page[size]=${pageSize}` +
        (cursor ? `&page[after]=${cursor}` : ""),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

  let rawResponse = await runFetch();

  let retryCount = 0;
  while (await handleZendeskRateLimit(rawResponse)) {
    rawResponse = await runFetch();
    retryCount++;
    if (retryCount >= ZENDESK_RATE_LIMIT_MAX_RETRIES) {
      logger.info(
        { response: rawResponse },
        `[Zendesk] Rate limit hit more than ${ZENDESK_RATE_LIMIT_MAX_RETRIES}, aborting.`
      );
      throw new Error(
        `Zendesk rate limit hit more than ${ZENDESK_RATE_LIMIT_MAX_RETRIES} times, aborting.`
      );
    }
  }

  const text = await rawResponse.text();
  const response = JSON.parse(text);

  if (!rawResponse.ok) {
    if (
      response.type === "error.list" &&
      response.errors &&
      response.errors.length > 0
    ) {
      const error = response.errors[0];
      if (error.code === "unauthorized") {
        throw new ExternalOAuthTokenError();
      }
      if (error.code === "not_found") {
        return { articles: [], meta: { has_more: false, after_cursor: "" } };
      }
    }
  }

  return response;
}

export async function fetchZendeskTicketsInBrand({
  subdomain,
  accessToken,
  pageSize,
  cursor,
}: {
  subdomain: string;
  accessToken: string;
  pageSize: number;
  cursor: string | null;
}): Promise<{
  tickets: ZendeskFetchedTicket[];
  meta: { has_more: boolean; after_cursor: string };
}> {
  assert(
    pageSize <= 100,
    `pageSize must be at most 100 (current value: ${pageSize})`
  );

  const runFetch = async () =>
    fetch(
      `https://${subdomain}.zendesk.com/api/v2/tickets?page[size]=${pageSize}` +
        (cursor ? `&page[after]=${cursor}` : ""),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

  let rawResponse = await runFetch();

  let retryCount = 0;
  while (await handleZendeskRateLimit(rawResponse)) {
    rawResponse = await runFetch();
    retryCount++;
    if (retryCount >= ZENDESK_RATE_LIMIT_MAX_RETRIES) {
      logger.info(
        { response: rawResponse },
        `[Zendesk] Rate limit hit more than ${ZENDESK_RATE_LIMIT_MAX_RETRIES}, aborting.`
      );
      throw new Error(
        `Zendesk rate limit hit more than ${ZENDESK_RATE_LIMIT_MAX_RETRIES} times, aborting.`
      );
    }
  }

  const text = await rawResponse.text();
  const response = JSON.parse(text);

  if (!rawResponse.ok) {
    if (
      response.type === "error.list" &&
      response.errors &&
      response.errors.length > 0
    ) {
      const error = response.errors[0];
      if (error.code === "unauthorized") {
        throw new ExternalOAuthTokenError();
      }
      if (error.code === "not_found") {
        return { tickets: [], meta: { has_more: false, after_cursor: "" } };
      }
    }
    throw new Error(`Zendesk API error: ${text}`);
  }

  return {
    tickets: response.tickets || [],
    meta: {
      has_more: !!response.meta?.has_more,
      after_cursor: response.meta?.after_cursor || "",
    },
  };
}

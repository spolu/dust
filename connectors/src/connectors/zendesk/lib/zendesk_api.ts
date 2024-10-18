import type {
  ZendeskArticlesResponse,
  ZendeskArticleType,
  ZendeskBrandsResponse,
  ZendeskBrandType,
  ZendeskCategoriesResponse,
  ZendeskCategoryType,
  ZendeskHelpCenterType,
} from "@connectors/connectors/zendesk/lib/types";
import { ExternalOAuthTokenError } from "@connectors/lib/error";
import logger from "@connectors/logger/logger";

/**
 * Utility function to call the Zendesk API.
 * It centralizes calling the API and handles global errors.
 */
async function callZendeskApi({
  subdomain,
  accessToken,
  path,
  method,
  body,
}: {
  subdomain: string;
  accessToken: string;
  path: string;
  method: "GET" | "POST";
  body?: {
    query: {
      operator: "AND" | "OR";
      value: {
        field: string;
        operator: string;
        value: string | number | boolean | [] | null;
      }[];
    };
    pagination: {
      per_page: number;
      starting_after: string | null;
    };
  };
}) {
  const rawResponse = await fetch(
    `https://${subdomain}.zendesk.com/api/v2/${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );

  // We get the text and attempt to parse so that we can log the raw text in case of error (the
  // body is already consumed by response.json() if used otherwise).
  const text = await rawResponse.text();

  let response = null;
  try {
    response = JSON.parse(text);

    if (!rawResponse.ok) {
      if (
        response.type === "error.list" &&
        response.errors &&
        response.errors.length > 0
      ) {
        const error = response.errors[0];
        // This error is thrown when we are dealing with a revoked OAuth token.
        if (error.code === "unauthorized") {
          throw new ExternalOAuthTokenError();
        }
        // We return null for 404 errors.
        if (error.code === "not_found") {
          return null;
        }
      }
    }

    return response;
  } catch (e) {
    logger.info(
      { path, response: text, status: rawResponse.status },
      "Failed to parse Zendesk JSON response."
    );
    throw e;
  }
}

export async function fetchZendeskBrands({
  subdomain,
  accessToken,
}: {
  subdomain: string;
  accessToken: string;
}): Promise<ZendeskBrandType[]> {
  let response: ZendeskBrandsResponse;
  let hasMore: boolean;
  let page = 1;
  const brands: ZendeskBrandType[] = [];

  do {
    try {
      const fetchResponse = await callZendeskApi({
        subdomain,
        accessToken,
        path: "brands.json",
        method: "GET",
      });
      response = await fetchResponse.json();

      if (response.brands && Array.isArray(response.brands)) {
        brands.push(...response.brands);
        logger.info(
          {
            page,
            fetchedCount: response.brands.length,
            totalFetched: brands.length,
          },
          `[Zendesk] Fetched brands page ${page}`
        );
      } else {
        logger.error(
          { page, response },
          "[Zendesk] No brands found in the response"
        );
      }

      hasMore = !!response?.next_page;
      if (hasMore) {
        page += 1;
      }
    } catch (error) {
      logger.error({ page, error }, "[Zendesk] Error fetching brands");
      throw error;
    }
  } while (hasMore);

  logger.info(
    {
      totalBrands: brands.length,
    },
    "[Zendesk] Finished fetching all brands"
  );

  return brands;
}

export async function fetchZendeskBrand({
  subdomain,
  accessToken,
  brandId,
}: {
  subdomain: string;
  accessToken: string;
  brandId: string;
}): Promise<ZendeskHelpCenterType | null> {
  return callZendeskApi({
    subdomain,
    accessToken,
    path: `brands/${brandId}.json`,
    method: "GET",
  }).then((response) => response.json.brand);
}

export async function fetchZendeskHelpCenters({
  subdomain,
  accessToken,
}: {
  subdomain: string;
  accessToken: string;
}): Promise<ZendeskHelpCenterType[]> {
  const response: {
    type: "list";
    data: ZendeskHelpCenterType[];
  } = await callZendeskApi({
    subdomain,
    accessToken,
    path: "help_centers.json",
    method: "GET",
  });
  return response.data;
}

export async function fetchZendeskHelpCenter({
  subdomain,
  accessToken,
  helpCenterId,
}: {
  subdomain: string;
  accessToken: string;
  helpCenterId: string;
}): Promise<ZendeskHelpCenterType | null> {
  return callZendeskApi({
    subdomain,
    accessToken,
    path: `help_centers/${helpCenterId}.json`,
    method: "GET",
  }).then((response) => response.json.help_center);
}

export async function fetchZendeskCategories({
  subdomain,
  accessToken,
  helpCenterId,
}: {
  subdomain: string;
  accessToken: string;
  helpCenterId: number;
}): Promise<ZendeskCategoryType[]> {
  let response: ZendeskCategoriesResponse;
  let hasMore: boolean;
  let page = 1;
  const categories: ZendeskCategoryType[] = [];

  do {
    try {
      const fetchResponse = await callZendeskApi({
        subdomain,
        accessToken,
        path: `help_center/${helpCenterId}/categories.json?page=${page}&per_page=100`,
        method: "GET",
      });
      response = await fetchResponse.json();

      if (response.categories && Array.isArray(response.categories)) {
        categories.push(...response.categories);
      } else {
        logger.error(
          { helpCenterId, page, response },
          "[Zendesk] No categories found in the response"
        );
      }

      hasMore = !!response?.next_page;
      if (hasMore) {
        page += 1;
      }
    } catch (error) {
      logger.error(
        { helpCenterId, page, error },
        "[Zendesk] Error fetching categories"
      );
      throw error;
    }
  } while (hasMore);

  return categories;
}

export async function fetchZendeskCategory({
  subdomain,
  accessToken,
  helpCenterId,
  categoryId,
}: {
  subdomain: string;
  accessToken: string;
  helpCenterId: number;
  categoryId: number;
}): Promise<ZendeskHelpCenterType | null> {
  return callZendeskApi({
    subdomain,
    accessToken,
    path: `help_centers/${helpCenterId}/categories/${categoryId}.json`,
    method: "GET",
  }).then((response) => response.json.category);
}

export async function fetchZendeskArticles({
  subdomain,
  accessToken,
  helpCenterId,
  categoryId,
}: {
  subdomain: string;
  accessToken: string;
  helpCenterId: number;
  categoryId?: number;
  sectionId?: number;
}): Promise<ZendeskArticleType[]> {
  let response: ZendeskArticlesResponse;
  let hasMore: boolean;
  let page = 1;
  const articles: ZendeskArticleType[] = [];

  do {
    try {
      const fetchResponse = await callZendeskApi({
        subdomain,
        accessToken,
        path: categoryId
          ? `help_center/categories/${categoryId}/articles.json`
          : `help_center/${helpCenterId}/articles.json`,
        method: "GET",
      }).then((response) => response.json());
      response = await fetchResponse.json();

      if (response.articles && Array.isArray(response.articles)) {
        articles.push(...response.articles);
        logger.info(
          {
            helpCenterId,
            categoryId,
            page,
            fetchedCount: response.articles.length,
            totalFetched: articles.length,
          },
          `[Zendesk] Fetched articles page ${page}`
        );
      } else {
        logger.error(
          { helpCenterId, categoryId, page, response },
          "[Zendesk] No articles found in the response"
        );
      }

      hasMore = !!response?.next_page;
      if (hasMore) {
        page += 1;
      }
    } catch (error) {
      logger.error(
        { helpCenterId, categoryId, page, error },
        "[Zendesk] Error fetching articles"
      );
      throw error;
    }
  } while (hasMore);

  logger.info(
    {
      helpCenterId,
      categoryId,
      totalArticles: articles.length,
    },
    "[Zendesk] Finished fetching all articles"
  );

  return articles;
}

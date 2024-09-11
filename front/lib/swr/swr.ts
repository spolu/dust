import type { PaginationState } from "@tanstack/react-table";
import { useCallback } from "react";
import type { Fetcher, Key, SWRConfiguration } from "swr";
import useSWR, { useSWRConfig } from "swr";

import { COMMIT_HASH } from "@app/lib/commit-hash";

const DEFAULT_SWR_CONFIG: SWRConfiguration = {
  errorRetryCount: 16,
};

export function useSWRWithDefaults<TKey extends Key, TData>(
  key: TKey,
  fetcher: Fetcher<TData, TKey> | null,
  config?: SWRConfiguration & { disabled?: boolean }
) {
  const { mutate: globalMutate, cache } = useSWRConfig();

  const mergedConfig = { ...DEFAULT_SWR_CONFIG, ...config };
  const disabled = !!mergedConfig.disabled;

  const result = useSWR(disabled ? null : key, fetcher, mergedConfig);

  const mutateKeysWithSameUrl = useCallback(
    (key: TKey) => {
      // If the key looks like an url, we need to remove the query params
      // to make sure we don't cache different pages together
      // Naive way to detect url by checking for '/'
      if (typeof key === "string" && key.includes("/")) {
        const keyWithoutQueryParams = key.split("?")[0];

        // Cycle through all the keys in the cache that start with the same url
        // and mutate them too
        for (const k of cache.keys()) {
          if (
            k !== key &&
            typeof k === "string" &&
            k.startsWith(keyWithoutQueryParams)
          ) {
            void globalMutate<TData>(k);
          }
        }
      }
    },
    [globalMutate, cache]
  );

  if (disabled) {
    // When disabled, as the key is null, the mutate function is not working
    // so we need to provide a custom mutate function that will work
    return {
      ...result,
      mutate: () => {
        mutateKeysWithSameUrl(key);
        return globalMutate(key);
      },
    };
  } else {
    const myMutate: typeof result.mutate = (data, opts) => {
      mutateKeysWithSameUrl(key);
      return result.mutate(data, opts);
    };

    return {
      ...result,
      mutate: myMutate,
    };
  }
}

const addCommitHashToHeaders = (headers: HeadersInit = {}): HeadersInit => ({
  ...headers,
  "X-Commit-Hash": COMMIT_HASH,
});

const resHandler = async (res: Response) => {
  if (res.status >= 300) {
    const errorText = await res.text();
    console.error(
      "Error returned by the front API: ",
      res.status,
      res.headers,
      errorText
    );
    throw new Error(errorText);
  }
  return res.json();
};

export const fetcher = async (...args: Parameters<typeof fetch>) => {
  const [url, config] = args;
  const res = await fetch(url, {
    ...config,
    headers: addCommitHashToHeaders(config?.headers),
  });
  return resHandler(res);
};

export const postFetcher = async ([url, body]: [string, object]) => {
  const res = await fetch(url, {
    method: "POST",
    headers: addCommitHashToHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });

  return resHandler(res);
};

type UrlsAndOptions = { url: string; options: RequestInit };

export const fetcherMultiple = <T>(urlsAndOptions: UrlsAndOptions[]) => {
  const f = async (url: string, options: RequestInit) => fetcher(url, options);

  return Promise.all<T>(
    urlsAndOptions.map(({ url, options }) => f(url, options))
  );
};

export const appendPaginationParams = (
  params: URLSearchParams,
  pagination?: PaginationState
) => {
  if (pagination && pagination.pageIndex) {
    params.set(
      "offset",
      (pagination.pageSize * pagination.pageIndex).toString()
    );
  }
  if (pagination && pagination.pageSize) {
    params.set("limit", pagination.pageSize.toString());
  }
};

import type { Fetcher } from "swr";

import { fetcher, useSWRWithDefaults } from "@app/lib/swr/swr";
import type { GetUserResponseBody } from "@app/pages/api/user";
import type { GetUserDetailsResponseBody } from "@app/pages/api/user/[uId]/details";
import type { GetUserMetadataResponseBody } from "@app/pages/api/user/metadata/[key]";

export function useUser() {
  const userFetcher: Fetcher<GetUserResponseBody> = fetcher;
  const { data, error } = useSWRWithDefaults("/api/user", userFetcher);

  return {
    user: data ? data.user : null,
    isUserLoading: !error && !data,
    isUserError: error,
  };
}

export function useUserMetadata(key: string) {
  const userMetadataFetcher: Fetcher<GetUserMetadataResponseBody> = fetcher;

  const { data, error, mutate } = useSWRWithDefaults(
    `/api/user/metadata/${encodeURIComponent(key)}`,
    userMetadataFetcher
  );

  return {
    metadata: data ? data.metadata : null,
    isMetadataLoading: !error && !data,
    isMetadataError: error,
    mutateMetadata: mutate,
  };
}

export function useUserDetails(userId: number) {
  const userFetcher: Fetcher<GetUserDetailsResponseBody> = fetcher;
  const { data, error } = useSWRWithDefaults(
    `/api/user/${userId}/details`,
    userFetcher
  );

  return {
    userDetails: data,
    isUserDetailsLoading: !error && !data,
    isUserDetailsError: error,
  };
}

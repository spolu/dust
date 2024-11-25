import type { DataSourceViewType, LightWorkspaceType } from "@dust-tt/types";
import type {
  PatchDataSourceWithNameDocumentRequestBody,
  PostDataSourceWithNameDocumentRequestBody,
} from "@dust-tt/types";
import type { Fetcher } from "swr";
import type { SWRMutationConfiguration } from "swr/mutation";
import useSWRMutation from "swr/mutation";

import { useDataSourceViewContentNodes } from "@app/lib/swr/data_source_views";
import { fetcher, fetcherWithBody, useSWRWithDefaults } from "@app/lib/swr/swr";
import type { GetDataSourceViewDocumentResponseBody } from "@app/pages/api/w/[wId]/spaces/[spaceId]/data_source_views/[dsvId]/documents/[documentId]";
import type { PostDocumentResponseBody } from "@app/pages/api/w/[wId]/spaces/[spaceId]/data_sources/[dsId]/documents";
import type { PatchDocumentResponseBody } from "@app/pages/api/w/[wId]/spaces/[spaceId]/data_sources/[dsId]/documents/[documentId]";

export function useDataSourceViewDocument({
  dataSourceView,
  documentId,
  owner,
  disabled,
}: {
  dataSourceView: DataSourceViewType | null;
  documentId: string | null;
  owner: LightWorkspaceType;
  disabled?: boolean;
}) {
  const dataSourceViewDocumentFetcher: Fetcher<GetDataSourceViewDocumentResponseBody> =
    fetcher;
  const url =
    dataSourceView && documentId
      ? `/api/w/${owner.sId}/spaces/${dataSourceView.spaceId}/data_source_views/${dataSourceView.sId}/documents/${encodeURIComponent(documentId)}`
      : null;

  const { data, error, mutate } = useSWRWithDefaults(
    url,
    dataSourceViewDocumentFetcher,
    {
      disabled,
    }
  );

  return {
    document: data?.document,
    isDocumentLoading: !disabled && !error && !data,
    isDocumentError: error,
    mutateDocument: mutate,
  };
}

async function sendPatchRequest(
  url: string,
  {
    arg,
  }: {
    arg: {
      documentBody: PatchDataSourceWithNameDocumentRequestBody;
    };
  }
) {
  const res = await fetcherWithBody([url, arg.documentBody, "PATCH"]);
  return res;
}

function decorateWithInvalidation<T>(
  options: SWRMutationConfiguration<T, Error, string> | undefined,
  invalidateCacheEntries: () => Promise<void>
): SWRMutationConfiguration<T, Error, string> {
  return options
    ? {
        ...options,
        onSuccess: async (data, key, config) => {
          await options.onSuccess?.(data, key, config);
          await invalidateCacheEntries();
        },
      }
    : {
        onSuccess: invalidateCacheEntries,
      };
}

export function useUpdateDataSourceViewDocument(
  owner: LightWorkspaceType,
  dataSourceView: DataSourceViewType,
  documentName: string,
  options?: SWRMutationConfiguration<PatchDocumentResponseBody, Error, string>
) {
  // Used only for cache invalidation
  const { mutate: mutateContentNodes } = useDataSourceViewContentNodes({
    owner,
    dataSourceView,
    disabled: true,
  });

  // Used only for cache invalidation
  const { mutateDocument } = useDataSourceViewDocument({
    owner,
    dataSourceView,
    documentId: documentName,
    disabled: true,
  });

  // Decorate options's onSuccess with cache invalidation
  const invalidateCacheEntries = async () => {
    await Promise.all([mutateContentNodes, mutateDocument]);
  };
  const decoratedOptions = decorateWithInvalidation(
    options,
    invalidateCacheEntries
  );

  const patchUrl = `/api/w/${owner.sId}/spaces/${dataSourceView.spaceId}/data_sources/${dataSourceView.dataSource.sId}/documents/${documentName}`;
  return useSWRMutation(patchUrl, sendPatchRequest, decoratedOptions);
}

async function sendPostRequest(
  url: string,
  {
    arg,
  }: {
    arg: {
      documentBody: PostDataSourceWithNameDocumentRequestBody;
    };
  }
) {
  const res = await fetcherWithBody([url, arg.documentBody, "POST"]);
  return res;
}

export function useCreateDataSourceViewDocument(
  owner: LightWorkspaceType,
  dataSourceView: DataSourceViewType,
  options?: SWRMutationConfiguration<PostDocumentResponseBody, Error, string>
) {
  // Used only for cache invalidation
  const { mutate: mutateContentNodes } = useDataSourceViewContentNodes({
    owner,
    dataSourceView,
    disabled: true,
  });

  // Decorate options's onSuccess with cache invalidation
  const invalidateCacheEntries = async () => {
    await mutateContentNodes();
  };
  const decoratedOptions = decorateWithInvalidation(
    options,
    invalidateCacheEntries
  );

  const createUrl = `/api/w/${owner.sId}/spaces/${dataSourceView.spaceId}/data_sources/${dataSourceView.dataSource.sId}/documents`;
  return useSWRMutation(createUrl, sendPostRequest, decoratedOptions);
}

import type {
  ConnectorPermission,
  ConnectorsAPIError,
  ContentNodesViewType,
  CoreAPIError,
  DataSourceOrViewCategory,
  DataSourceOrViewInfo,
  LightContentNode,
  Result,
} from "@dust-tt/types";
import { ConnectorsAPI, CoreAPI, Ok } from "@dust-tt/types";

import config from "@app/lib/api/config";
import type { Authenticator } from "@app/lib/auth";
import { DataSourceResource } from "@app/lib/resources/data_source_resource";
import { DataSourceViewResource } from "@app/lib/resources/data_source_view_resource";
import type { VaultResource } from "@app/lib/resources/vault_resource";
import logger from "@app/logger/logger";

export const getDataSourceInfo = (
  dataSource: DataSourceResource
): DataSourceOrViewInfo => {
  return {
    ...dataSource.toJSON(),
    sId: dataSource.name,
    usage: 0, // TODO: Implement usage calculation
    category: getDataSourceCategory(dataSource),
  };
};

export const getDataSourceInfos = async (
  auth: Authenticator,
  vault: VaultResource
): Promise<DataSourceOrViewInfo[]> => {
  const dataSources = await DataSourceResource.listByVault(auth, vault);

  return dataSources.map((dataSource) => getDataSourceInfo(dataSource));
};

export const getDataSourceViewInfo = (
  dataSourceView: DataSourceViewResource
): DataSourceOrViewInfo => {
  return {
    ...(dataSourceView.dataSource as DataSourceResource).toJSON(),
    ...dataSourceView.toJSON(),
    usage: 0, // TODO: Implement usage calculation
    category: getDataSourceCategory(
      dataSourceView.dataSource as DataSourceResource
    ),
  };
};

export const getDataSourceViewsInfo = async (
  auth: Authenticator,
  vault: VaultResource
): Promise<DataSourceOrViewInfo[]> => {
  const dataSourceViews = await DataSourceViewResource.listByVault(auth, vault);

  return dataSourceViews.map((view) => getDataSourceViewInfo(view));
};

export const isFolderDataSource = (dataSource: DataSourceResource): boolean =>
  !dataSource.connectorProvider;

export const isWebfolderDataSource = (
  dataSource: DataSourceResource
): boolean => dataSource.connectorProvider === "webcrawler";

export const isConnectedDataSource = (
  dataSource: DataSourceResource
): boolean =>
  !isFolderDataSource(dataSource) && !isWebfolderDataSource(dataSource);

export const getDataSourceCategory = (
  dataSource: DataSourceResource
): DataSourceOrViewCategory => {
  if (isFolderDataSource(dataSource)) {
    return "files";
  }

  if (isWebfolderDataSource(dataSource)) {
    return "webfolder";
  }

  return "managed";
};

export const getDataSourceContent = async (
  dataSource: DataSourceResource,
  viewType: ContentNodesViewType,
  rootIds: string[] | null,
  parentId: string | null,
  { limit, offset }: { limit: number; offset: number }
): Promise<Result<LightContentNode[], ConnectorsAPIError | CoreAPIError>> => {
  return dataSource.connectorId
    ? getManagedDataSourceContent(
        dataSource.connectorId,
        "read",
        rootIds,
        parentId,
        viewType
      )
    : getUnmanagedDataSourceContent(dataSource, viewType, {
        limit,
        offset,
      });
};

export const getManagedDataSourceContent = async (
  connectorId: string,
  permission: ConnectorPermission,
  rootIds: string[] | null,
  parentId: string | null,
  viewType: ContentNodesViewType
): Promise<Result<LightContentNode[], ConnectorsAPIError>> => {
  const connectorsAPI = new ConnectorsAPI(
    config.getConnectorsAPIConfig(),
    logger
  );
  const contentNodes = [];
  if (parentId || !rootIds) {
    const nodesResults = await connectorsAPI.getConnectorPermissions({
      connectorId,
      filterPermission: permission,
      parentId: parentId ?? undefined,
      viewType,
    });

    if (nodesResults.isErr()) {
      return nodesResults;
    }

    contentNodes.push(...nodesResults.value.resources);
  } else {
    const nodesResults = await connectorsAPI.getContentNodes({
      connectorId,
      internalIds: rootIds,
      viewType,
    });

    if (nodesResults.isErr()) {
      return nodesResults;
    }
    contentNodes.push(...nodesResults.value.nodes);
  }

  const results = contentNodes.map((r) => ({
    internalId: r.internalId,
    parentInternalId: r.parentInternalId,
    type: r.type,
    title: r.title,
    expandable: r.expandable,
    preventSelection: r.preventSelection,
    dustDocumentId: r.dustDocumentId,
    lastUpdatedAt: r.lastUpdatedAt,
  }));

  return new Ok(results);
};

export const getUnmanagedDataSourceContent = async (
  dataSource: DataSourceResource,
  viewType: ContentNodesViewType,
  { limit, offset }: { limit: number; offset: number }
): Promise<Result<LightContentNode[], CoreAPIError>> => {
  const coreAPI = new CoreAPI(config.getCoreAPIConfig(), logger);

  if (viewType === "documents") {
    const documentsRes = await coreAPI.getDataSourceDocuments({
      projectId: dataSource.dustAPIProjectId,
      dataSourceName: dataSource.name,
      limit,
      offset,
    });

    if (documentsRes.isErr()) {
      return documentsRes;
    }

    const documentsAsContentNodes = documentsRes.value.documents.map((doc) => ({
      internalId: "string",
      parentInternalId: null,
      type: "file" as const,
      title: doc.document_id,
      expandable: false,
      preventSelection: false,
      dustDocumentId: doc.document_id,
      lastUpdatedAt: doc.timestamp,
    }));
    return new Ok(documentsAsContentNodes);
  } else {
    const tablesRes = await coreAPI.getTables({
      projectId: dataSource.dustAPIProjectId,
      dataSourceName: dataSource.name,
    });

    if (tablesRes.isErr()) {
      return tablesRes;
    }

    const tablesAsContentNodes = tablesRes.value.tables.map((table) => ({
      internalId: "string",
      parentInternalId: null,
      type: "database" as const,
      title: table.name,
      expandable: false,
      preventSelection: false,
      dustDocumentId: table.table_id,
      lastUpdatedAt: table.timestamp,
    }));

    return new Ok(tablesAsContentNodes);
  }
};

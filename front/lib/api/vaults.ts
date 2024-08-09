import type {
  ConnectorsAPIError,
  ContentNodesViewType,
  ContentNodeType,
  CoreAPIError,
  ResourceCategory,
  Result,
  WithAPIErrorResponse,
} from "@dust-tt/types";
import { ConnectorsAPI, CoreAPI, Ok } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";

import config from "@app/lib/api/config";
import type { DataSourceResource } from "@app/lib/resources/data_source_resource";
import logger from "@app/logger/logger";
import { apiError } from "@app/logger/withlogging";

export type LightContentNode = {
  internalId: string;
  parentInternalId: string | null;
  type: ContentNodeType;
  title: string;
  expandable: boolean;
  preventSelection?: boolean;
  dustDocumentId: string | null;
  lastUpdatedAt: number | null;
};

export type GetDataSourceContentResponseBody = {
  nodes: LightContentNode[];
};

export const getDataSourceCategory = (
  dataSource: DataSourceResource
): ResourceCategory => {
  if (!dataSource.connectorProvider) {
    return "files";
  }

  if (dataSource.connectorProvider === "webcrawler") {
    return "webfolder";
  }

  return "managed";
};

export const getContentHandler = async (
  req: NextApiRequest,
  res: NextApiResponse<WithAPIErrorResponse<GetDataSourceContentResponseBody>>,
  dataSource: DataSourceResource,
  rootIds: string[] | null
): Promise<void> => {
  const viewType = req.query.viewType;
  if (
    !viewType ||
    typeof viewType !== "string" ||
    (viewType !== "tables" && viewType !== "documents")
  ) {
    return apiError(req, res, {
      status_code: 400,
      api_error: {
        type: "invalid_request_error",
        message: "Invalid viewType. Required: tables | documents",
      },
    });
  }

  let parentId: string | null = null;
  if (req.query.parentId && typeof req.query.parentId === "string") {
    parentId = req.query.parentId;
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

  const content = dataSource.connectorId
    ? await getManagedDataSourceContent(
        dataSource.connectorId,
        "read",
        rootIds,
        parentId,
        viewType
      )
    : await getUnmanagedDataSourceContent(dataSource, viewType, limit, offset);

  if (content.isErr()) {
    return apiError(req, res, {
      status_code: 500,
      api_error: {
        type: "internal_server_error",
        message: `An error occurred while retrieving the data source permissions.`,
      },
    });
  }

  res.status(200).json({
    nodes: content.value,
  });
  return;
};

export const getManagedDataSourceContent = async (
  connectorId: string,
  permission: "read" | "write" | "read_write" | "none",
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
  limit: number,
  offset: number
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

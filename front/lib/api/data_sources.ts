import type {
  DataSourceSearchQuery,
  DataSourceSearchResponseType,
} from "@dust-tt/client";
import type {
  AdminCommandType,
  ConnectorProvider,
  ConnectorType,
  ConversationWithoutContentType,
  CoreAPIDataSource,
  CoreAPIDocument,
  CoreAPIError,
  CoreAPILightDocument,
  CoreAPITable,
  DataSourceType,
  DataSourceWithConnectorDetailsType,
  FrontDataSourceDocumentSectionType,
  PlanType,
  Result,
  UpsertTableFromCsvRequestType,
  WithConnector,
  WorkspaceType,
} from "@dust-tt/types";
import {
  assertNever,
  concurrentExecutor,
  ConnectorsAPI,
  CoreAPI,
  DEFAULT_EMBEDDING_PROVIDER_ID,
  DEFAULT_QDRANT_CLUSTER,
  dustManagedCredentials,
  EMBEDDING_CONFIGS,
  Err,
  isDataSourceNameValid,
  Ok,
  sectionFullText,
} from "@dust-tt/types";
import { validateUrl } from "@dust-tt/types/src/shared/utils/url_utils";
import assert from "assert";
import type { Transaction } from "sequelize";

import { default as apiConfig, default as config } from "@app/lib/api/config";
import { sendGithubDeletionEmail } from "@app/lib/api/email";
import { rowsFromCsv, upsertTableFromCsv } from "@app/lib/api/tables";
import { getMembers } from "@app/lib/api/workspace";
import type { Authenticator } from "@app/lib/auth";
import { getFeatureFlags } from "@app/lib/auth";
import { CONNECTOR_CONFIGURATIONS } from "@app/lib/connector_providers";
import { DustError } from "@app/lib/error";
import { Lock } from "@app/lib/lock";
import { DataSourceResource } from "@app/lib/resources/data_source_resource";
import { DataSourceViewResource } from "@app/lib/resources/data_source_view_resource";
import { SpaceResource } from "@app/lib/resources/space_resource";
import { generateRandomModelSId } from "@app/lib/resources/string_ids";
import { ServerSideTracking } from "@app/lib/tracking/server";
import { enqueueUpsertTable } from "@app/lib/upsert_queue";
import logger from "@app/logger/logger";
import { launchScrubDataSourceWorkflow } from "@app/poke/temporal/client";

import type { FileResource } from "../resources/file_resource";
import { getConversationWithoutContent } from "./assistant/conversation/without_content";
import { isJITActionsEnabled } from "./assistant/jit_actions";

export async function getDataSources(
  auth: Authenticator,
  { includeEditedBy }: { includeEditedBy: boolean } = {
    includeEditedBy: false,
  }
): Promise<DataSourceResource[]> {
  const owner = auth.workspace();

  // This condition is critical it checks that we can identify the workspace and that the current
  // auth is a user for this workspace. Checking `auth.isUser()` is critical as it would otherwise
  // be possible to access data sources without being authenticated.
  if (!owner || !auth.isUser()) {
    return [];
  }

  return DataSourceResource.listByWorkspace(auth, {
    includeEditedBy,
  });
}

/**
 * Soft delete a data source. This will mark the data source as deleted and will trigger a scrubbing.
 */
export async function softDeleteDataSourceAndLaunchScrubWorkflow(
  auth: Authenticator,
  dataSource: DataSourceResource,
  transaction?: Transaction
): Promise<
  Result<DataSourceType, { code: "unauthorized_deletion"; message: string }>
> {
  const owner = auth.getNonNullableWorkspace();

  if (!auth.isBuilder()) {
    return new Err({
      code: "unauthorized_deletion",
      message: "Only builders can delete data sources.",
    });
  }

  await dataSource.delete(auth, { transaction, hardDelete: false });

  // The scrubbing workflow will delete associated resources and hard delete the data source.
  await launchScrubDataSourceWorkflow(owner, dataSource);

  return new Ok(dataSource.toJSON());
}

/**
 * Performs a hard deletion of the specified data source, ensuring complete removal of the data
 * source and all its associated resources, including any existing connectors.
 */
export async function hardDeleteDataSource(
  auth: Authenticator,
  dataSource: DataSourceResource
) {
  assert(auth.isBuilder(), "Only builders can delete data sources.");

  const { dustAPIProjectId } = dataSource;
  if (dataSource.connectorId && dataSource.connectorProvider) {
    if (
      !CONNECTOR_CONFIGURATIONS[dataSource.connectorProvider].isDeletable &&
      !auth.isAdmin()
    ) {
      return new Err({
        code: "unauthorized_deletion",
        message:
          "Only users that are `admins` for the current workspace can delete connections.",
      });
    }

    const connectorsAPI = new ConnectorsAPI(
      config.getConnectorsAPIConfig(),
      logger
    );
    const connDeleteRes = await connectorsAPI.deleteConnector(
      dataSource.connectorId.toString(),
      true
    );
    if (connDeleteRes.isErr()) {
      // If we get a not found we proceed with the deletion of the data source. This will enable
      // us to retry deletion of the data source if it fails at a later stage. Otherwise we throw
      // as this is unexpected.
      if (connDeleteRes.error.type !== "connector_not_found") {
        throw new Error(
          "Unexpected error deleting connector: " + connDeleteRes.error.message
        );
      }
    }
  }

  const coreAPI = new CoreAPI(config.getCoreAPIConfig(), logger);
  const coreDeleteRes = await coreAPI.deleteDataSource({
    projectId: dustAPIProjectId,
    dataSourceId: dataSource.dustAPIDataSourceId,
  });
  if (coreDeleteRes.isErr()) {
    // Same as above we proceed with the deletion if the data source is not found in core. Otherwise
    // we throw as this is unexpected.
    if (coreDeleteRes.error.code !== "data_source_not_found") {
      throw new Error(
        "Unexpected error deleting data source: " + coreDeleteRes.error.message
      );
    }
  }

  await dataSource.delete(auth, { hardDelete: true });

  if (dataSource.connectorProvider) {
    await warnPostDeletion(auth, dataSource.connectorProvider);
  }
}

async function warnPostDeletion(
  auth: Authenticator,
  dataSourceProvider: ConnectorProvider
) {
  // if the datasource is Github, send an email inviting to delete the Github app
  switch (dataSourceProvider) {
    case "github":
      // get admin emails
      const { members } = await getMembers(auth, {
        roles: ["admin"],
        activeOnly: true,
      });
      const adminEmails = members.map((u) => u.email);
      // send email to admins
      for (const email of adminEmails) {
        await sendGithubDeletionEmail(email);
      }
      break;

    default:
      break;
  }
}

export async function augmentDataSourceWithConnectorDetails(
  dataSource: DataSourceType & WithConnector
): Promise<DataSourceWithConnectorDetailsType> {
  let connector: ConnectorType | null = null;
  let fetchConnectorError = false;
  let fetchConnectorErrorMessage: string | null = null;
  try {
    const connectorsAPI = new ConnectorsAPI(
      config.getConnectorsAPIConfig(),
      logger
    );
    const statusRes =
      await connectorsAPI.getConnectorFromDataSource(dataSource);
    if (statusRes.isErr()) {
      fetchConnectorError = true;
      fetchConnectorErrorMessage = statusRes.error.message;
    } else {
      connector = statusRes.value;
    }
  } catch (e) {
    // Probably means `connectors` is down, we don't fail to avoid a 500 when just displaying
    // the datasources (eventual actions will fail but a 500 just at display is not desirable).
    // When that happens the managed data sources are shown as failed.
    fetchConnectorError = true;
    fetchConnectorErrorMessage = "Synchonization service is down";
  }

  return {
    ...dataSource,
    connector,
    fetchConnectorError,
    fetchConnectorErrorMessage,
  };
}

export interface UpsertDocumentArgs {
  document_id: string;
  source_url?: string | null;
  text?: string | null;
  section?: FrontDataSourceDocumentSectionType | null;
  tags?: string[] | null;
  parent_id?: string | null;
  parents?: string[] | null;
  timestamp?: number | null;
  light_document_output?: boolean;
  dataSource: DataSourceResource;
  auth: Authenticator;
  mime_type: string;
  title: string;
}

export async function upsertDocument({
  document_id,
  source_url,
  text,
  section,
  tags,
  parent_id,
  parents,
  timestamp,
  light_document_output,
  dataSource,
  auth,
  mime_type,
  title,
}: UpsertDocumentArgs): Promise<
  Result<
    {
      document:
        | CoreAPIDocument
        // if lightDocumentOutput is true, we return this type
        | CoreAPILightDocument;

      data_source: CoreAPIDataSource;
    },
    DustError
  >
> {
  // enforcing validation on the parents and parent_id
  const documentId = document_id;
  const documentParents = parents || [documentId];
  const documentParentId = parent_id ?? null;

  // parents must comply to the invariant parents[0] === document_id
  if (documentParents[0] !== documentId) {
    return new Err(
      new DustError(
        "invalid_parents",
        "Invalid request body, parents[0] and document_id should be equal"
      )
    );
  }
  // parents and parentId must comply to the invariant parents[1] === parentId || (parentId === null && parents.length < 2)
  if (
    (documentParents.length >= 2 || documentParentId !== null) &&
    documentParents[1] !== documentParentId
  ) {
    return new Err(
      new DustError(
        "invalid_parent_id",
        "Invalid request body, parents[1] and parent_id should be equal"
      )
    );
  }

  let sourceUrl: string | null = null;
  if (source_url) {
    const { valid: isSourceUrlValid, standardized: standardizedSourceUrl } =
      validateUrl(source_url);

    if (!isSourceUrlValid) {
      return new Err(
        new DustError(
          "invalid_url",
          "Invalid request body, `source_url` if provided must be a valid URL."
        )
      );
    }
    sourceUrl = standardizedSourceUrl;
  }

  const generatedSection =
    typeof text === "string"
      ? {
          prefix: null,
          content: text,
          sections: [],
        }
      : section || null;

  const nonNullTags = tags || [];

  // Add selection of tags as prefix to the section if they are present.
  let tagsPrefix = "";
  ["title", "author"].forEach((t) => {
    nonNullTags.forEach((tag) => {
      if (tag.startsWith(t + ":") && tag.length > t.length + 1) {
        tagsPrefix += `$${t} : ${tag.slice(t.length + 1)}\n`;
      }
    });
  });
  if (tagsPrefix && generatedSection) {
    generatedSection.prefix = tagsPrefix;
  }

  if (!generatedSection) {
    return new Err(
      new DustError(
        "text_or_section_required",
        "Invalid request body, `text` or `section` must be provided."
      )
    );
  }

  const fullText = sectionFullText(generatedSection);

  const coreAPI = new CoreAPI(apiConfig.getCoreAPIConfig(), logger);
  const plan = auth.getNonNullablePlan();
  // Enforce plan limits: DataSource documents count.
  // We only load the number of documents if the limit is not -1 (unlimited).
  // the `getDataSourceDocuments` query involves a SELECT COUNT(*) in the DB that is not
  // optimized, so we avoid it for large workspaces if we know we're unlimited anyway
  if (plan.limits.dataSources.documents.count !== -1) {
    const documents = await coreAPI.getDataSourceDocuments(
      {
        projectId: dataSource.dustAPIProjectId,
        dataSourceId: dataSource.dustAPIDataSourceId,
      },
      { limit: 1, offset: 0 }
    );
    if (documents.isErr()) {
      return new Err(
        new DustError(
          "core_api_error",
          "There was an error retrieving the data source."
        )
      );
    }

    if (
      plan.limits.dataSources.documents.count != -1 &&
      documents.value.total >= plan.limits.dataSources.documents.count
    ) {
      return new Err(
        new DustError(
          "data_source_quota_error",
          `Data sources are limited to ${plan.limits.dataSources.documents.count} ` +
            `documents on your current plan. Contact support@dust.tt if you want to increase this limit.`
        )
      );
    }
  }

  // Enforce plan limits: DataSource document size.
  if (
    plan.limits.dataSources.documents.sizeMb != -1 &&
    fullText.length > 1024 * 1024 * plan.limits.dataSources.documents.sizeMb
  ) {
    return new Err(
      new DustError(
        "data_source_quota_error",
        `Data sources document upload size is limited to ` +
          `${plan.limits.dataSources.documents.sizeMb}MB on your current plan. ` +
          `You are attempting to upload ${fullText.length} bytes. ` +
          `Contact support@dust.tt if you want to increase it.`
      )
    );
  }

  // Data source operations are performed with our credentials.
  const credentials = dustManagedCredentials();

  // Create document with the Dust internal API.
  const upsertRes = await coreAPI.upsertDataSourceDocument({
    projectId: dataSource.dustAPIProjectId,
    dataSourceId: dataSource.dustAPIDataSourceId,
    documentId,
    tags: nonNullTags,
    parentId: documentParentId,
    parents: documentParents,
    sourceUrl,
    // TEMPORARY -- need to unstuck a specific entry
    // TODO(FONTANIERH): remove this once the entry is unstuck
    timestamp: timestamp ? Math.floor(timestamp) : null,
    section: generatedSection,
    credentials,
    lightDocumentOutput: light_document_output === true,
    title,
    mimeType: mime_type,
  });

  if (upsertRes.isErr()) {
    return new Err(
      new DustError(
        "core_api_error",
        "There was an error upserting the document."
      )
    );
  }

  return new Ok(upsertRes.value);
}

export interface UpsertTableArgs {
  tableId: string;
  name: string;
  description: string;
  truncate: boolean;
  csv?: string | null;
  tags?: string[] | null;
  parentId?: string | null;
  parents?: string[] | null;
  timestamp?: number | null;
  async: boolean;
  dataSource: DataSourceResource;
  auth: Authenticator;
  useAppForHeaderDetection?: boolean;
  title: string;
  mimeType: string;
  sourceUrl?: string | null;
}

export async function upsertTable({
  tableId,
  name,
  description,
  truncate,
  csv,
  tags,
  parentId,
  parents,
  timestamp,
  async,
  dataSource,
  auth,
  useAppForHeaderDetection,
  title,
  mimeType,
  sourceUrl,
}: UpsertTableArgs) {
  const tableParents = parents ?? [tableId];
  const tableParentId = parentId ?? null;

  // parents must comply to the invariant parents[0] === document_id
  if (tableParents[0] !== tableId) {
    return new Err(
      new DustError(
        "invalid_parents",
        "Invalid request body, parents[0] and table_id should be equal"
      )
    );
  }

  // parents and parentId must comply to the invariant parents[1] === parentId
  if (
    (tableParents.length >= 2 || tableParentId !== null) &&
    tableParents[1] !== tableParentId
  ) {
    return new Err(
      new DustError(
        "invalid_parent_id",
        "Invalid request body, parents[1] and parent_id should be equal"
      )
    );
  }
  let standardizedSourceUrl: string | null = null;
  if (sourceUrl) {
    const { valid: isSourceUrlValid, standardized } = validateUrl(sourceUrl);

    if (!isSourceUrlValid) {
      return new Err(
        new DustError(
          "invalid_url",
          "Invalid request body, `source_url` if provided must be a valid URL."
        )
      );
    }
    standardizedSourceUrl = standardized;
  }

  const flags = await getFeatureFlags(auth.getNonNullableWorkspace());

  const useAppForHeaderDetectionFlag = flags.includes(
    "use_app_for_header_detection"
  );

  const useApp = !!useAppForHeaderDetection && useAppForHeaderDetectionFlag;

  if (async) {
    // Ensure the CSV is valid before enqueuing the upsert.
    const csvRowsRes = csv
      ? await rowsFromCsv({ auth, csv, useAppForHeaderDetection: useApp })
      : null;
    if (csvRowsRes?.isErr()) {
      return csvRowsRes;
    }

    const detectedHeaders = csvRowsRes?.isOk()
      ? csvRowsRes.value.detectedHeaders
      : undefined;

    const enqueueRes = await enqueueUpsertTable({
      upsertTable: {
        workspaceId: auth.getNonNullableWorkspace().sId,
        dataSourceId: dataSource.sId,
        tableId,
        tableName: name,
        tableDescription: description,
        tableTimestamp: timestamp ?? null,
        tableTags: tags ?? [],
        tableParentId,
        tableParents,
        csv: csv ?? null,
        truncate,
        useAppForHeaderDetection: useApp,
        detectedHeaders,
        title,
        mimeType,
        sourceUrl: standardizedSourceUrl,
      },
    });
    if (enqueueRes.isErr()) {
      return enqueueRes;
    }

    return new Ok(undefined);
  }

  const tableRes = await upsertTableFromCsv({
    auth,
    dataSource: dataSource,
    tableId,
    tableName: name,
    tableDescription: description,
    tableTimestamp: timestamp ?? null,
    tableTags: tags || [],
    tableParentId,
    tableParents,
    csv: csv ?? null,
    truncate,
    useAppForHeaderDetection: useApp,
    title,
    mimeType,
    sourceUrl: standardizedSourceUrl,
  });

  return tableRes;
}

export async function handleDataSourceSearch({
  searchQuery,
  dataSource,
  dataSourceView,
}: {
  searchQuery: DataSourceSearchQuery;
  dataSource: DataSourceResource;
  dataSourceView?: DataSourceViewResource;
}): Promise<
  Result<
    DataSourceSearchResponseType,
    Omit<DustError, "code"> & { code: "data_source_error" }
  >
> {
  // Dust managed credentials: all data sources.
  const credentials = dustManagedCredentials();

  const coreAPI = new CoreAPI(config.getCoreAPIConfig(), logger);
  const data = await coreAPI.searchDataSource(
    dataSource.dustAPIProjectId,
    dataSource.dustAPIDataSourceId,
    {
      query: searchQuery.query,
      topK: searchQuery.top_k,
      fullText: searchQuery.full_text,
      target_document_tokens: searchQuery.target_document_tokens,
      filter: {
        tags: {
          in: searchQuery.tags_in ?? null,
          not: searchQuery.tags_not ?? null,
        },
        parents: {
          in: searchQuery.parents_in ?? null,
          not: searchQuery.parents_not ?? null,
        },
        timestamp: {
          gt: searchQuery.timestamp_gt ?? null,
          lt: searchQuery.timestamp_lt ?? null,
        },
      },
      view_filter: dataSourceView
        ? {
            parents: {
              in: dataSourceView.parentsIn,
              not: [],
            },
            tags: null,
            timestamp: null,
          }
        : undefined,
      credentials: credentials,
    }
  );

  if (data.isErr()) {
    return new Err({
      name: "dust_error",
      code: "data_source_error",
      message: data.error.message,
    });
  }

  return new Ok({
    documents: data.value.documents,
  });
}

export async function handleDataSourceTableCSVUpsert({
  auth,
  params,
  dataSource,
}: {
  auth: Authenticator;
  params: UpsertTableFromCsvRequestType;
  dataSource: DataSourceResource;
}): Promise<
  Result<
    | {
        table: {
          table_id: string;
        };
      }
    | {
        table: CoreAPITable;
      },
    Omit<DustError, "code"> & {
      code:
        | "missing_csv"
        | "data_source_error"
        | "invalid_rows"
        | "resource_not_found"
        | "invalid_parent_id"
        | "internal_error";
    }
  >
> {
  const owner = auth.getNonNullableWorkspace();

  const { name, description, csv, truncate, async } = params;
  if (!csv && truncate) {
    return new Err({
      name: "dust_error",
      code: "missing_csv",
      message: "Cannot truncate a table without providing a CSV.",
    });
  }

  const tableId = params.tableId ?? generateRandomModelSId();
  const tableParents: string[] = params.parents ?? [tableId];

  const flags = await getFeatureFlags(owner);

  const useAppForHeaderDetection =
    !!params.useAppForHeaderDetection &&
    flags.includes("use_app_for_header_detection");

  if (async) {
    // Ensure the CSV is valid before enqueuing the upsert.
    const csvRowsRes = csv
      ? await rowsFromCsv({ auth, csv, useAppForHeaderDetection })
      : null;
    if (csvRowsRes?.isErr()) {
      return new Err({
        name: "dust_error",
        code: "invalid_rows",
        message: "Failed to parse CSV: " + csvRowsRes.error.message,
      });
    }

    const detectedHeaders = csvRowsRes?.isOk()
      ? csvRowsRes.value.detectedHeaders
      : undefined;

    const enqueueRes = await enqueueUpsertTable({
      upsertTable: {
        workspaceId: owner.sId,
        dataSourceId: dataSource.sId,
        tableId,
        tableName: name,
        tableDescription: description,
        tableTimestamp: params.timestamp ?? null,
        tableTags: params.tags ?? [],
        tableParentId: params.parentId ?? null,
        tableParents,
        csv: csv ?? null,
        truncate,
        useAppForHeaderDetection,
        detectedHeaders,
        title: params.title,
        mimeType: params.mimeType,
        sourceUrl: params.sourceUrl ?? null,
      },
    });
    if (enqueueRes.isErr()) {
      return new Err({
        name: "dust_error",
        code: "data_source_error",
        message:
          "There was an error enqueueing the the document for asynchronous upsert.",
      });
    }
    return new Ok({
      table: {
        table_id: tableId,
      },
    });
  }

  const tableRes = await upsertTableFromCsv({
    auth,
    dataSource,
    tableId,
    tableName: name,
    tableDescription: description,
    tableTimestamp: params.timestamp ?? null,
    tableTags: params.tags || [],
    tableParentId: params.parentId ?? null,
    tableParents,
    csv: csv ?? null,
    truncate,
    useAppForHeaderDetection,
    title: params.title,
    mimeType: params.mimeType,
    sourceUrl: params.sourceUrl ?? null,
  });

  if (tableRes.isErr()) {
    if (tableRes.error.type === "internal_server_error") {
      return new Err({
        name: "dust_error",
        code: "internal_error",
        message: tableRes.error.message,
      });
    }

    if (tableRes.error.type === "invalid_request_error") {
      if ("csvParsingError" in tableRes.error) {
        return new Err({
          name: "dust_error",
          code: "internal_error",
          message:
            "Failed to parse CSV: " + tableRes.error.csvParsingError.message,
        });
      } else if ("inputValidationError" in tableRes.error) {
        return new Err({
          name: "dust_error",
          code: "internal_error",
          message:
            "Invalid request body: " + tableRes.error.inputValidationError,
        });
      } else if ("message" in tableRes.error) {
        return new Err({
          name: "dust_error",
          code: "invalid_parent_id",
          message: "Invalid request body: " + tableRes.error.message,
        });
      } else {
        assertNever(tableRes.error);
      }
    }

    if (tableRes.error.type === "not_found_error") {
      return new Err({
        name: "dust_error",
        code: "resource_not_found",
        message: tableRes.error.notFoundError.message,
      });
    }

    assertNever(tableRes.error);
  }

  return new Ok(tableRes.value);
}

/**
 * Data sources without provider = folders
 */
export async function createDataSourceWithoutProvider(
  auth: Authenticator,
  {
    plan,
    owner,
    space,
    name,
    description,
    conversation,
  }: {
    plan: PlanType;
    owner: WorkspaceType;
    space: SpaceResource;
    name: string;
    description: string | null;
    conversation?: ConversationWithoutContentType;
  }
): Promise<
  Result<
    DataSourceViewResource,
    Omit<DustError, "code"> & {
      code:
        | "invalid_request_error"
        | "plan_limit_error"
        | "internal_server_error";
      dataSourceError?: CoreAPIError;
    }
  >
> {
  if (name.startsWith("managed-")) {
    return new Err({
      name: "dust_error",
      code: "invalid_request_error",
      message: "The data source name cannot start with `managed-`.",
    });
  }
  if (!isDataSourceNameValid(name)) {
    return new Err({
      name: "dust_error",
      code: "invalid_request_error",
      message: "Data source names cannot be empty.",
    });
  }
  const dataSources = await DataSourceResource.listByWorkspace(auth);
  if (
    plan.limits.dataSources.count != -1 &&
    dataSources.length >= plan.limits.dataSources.count
  ) {
    return new Err({
      name: "dust_error",
      code: "plan_limit_error",
      message: "Your plan does not allow you to create more data sources.",
    });
  }

  if (dataSources.some((ds) => ds.name === name)) {
    return new Err({
      name: "dust_error",
      code: "invalid_request_error",
      message: "Data source with that name already exist.",
    });
  }

  const dataSourceEmbedder =
    owner.defaultEmbeddingProvider ?? DEFAULT_EMBEDDING_PROVIDER_ID;
  const embedderConfig = EMBEDDING_CONFIGS[dataSourceEmbedder];
  const coreAPI = new CoreAPI(config.getCoreAPIConfig(), logger);

  const dustProject = await coreAPI.createProject();
  if (dustProject.isErr()) {
    return new Err({
      name: "dust_error",
      code: "internal_server_error",
      message: "Failed to create internal project for the data source.",
      dataSourceError: dustProject.error,
    });
  }

  const dustDataSource = await coreAPI.createDataSource({
    projectId: dustProject.value.project.project_id.toString(),
    config: {
      qdrant_config: {
        cluster: DEFAULT_QDRANT_CLUSTER,
        shadow_write_cluster: null,
      },
      embedder_config: {
        embedder: {
          max_chunk_size: embedderConfig.max_chunk_size,
          model_id: embedderConfig.model_id,
          provider_id: embedderConfig.provider_id,
          splitter_id: embedderConfig.splitter_id,
        },
      },
    },
    credentials: dustManagedCredentials(),
  });

  if (dustDataSource.isErr()) {
    return new Err({
      name: "dust_error",
      code: "internal_server_error",
      message: "Failed to create the data source.",
      dataSourceError: dustDataSource.error,
    });
  }

  const dataSourceView =
    await DataSourceViewResource.createDataSourceAndDefaultView(
      {
        name,
        description,
        dustAPIProjectId: dustProject.value.project.project_id.toString(),
        dustAPIDataSourceId: dustDataSource.value.data_source.data_source_id,
        workspaceId: owner.id,
        assistantDefaultSelected: false,
        conversationId: conversation?.id,
      },
      space,
      auth.user()
    );

  try {
    // Asynchronous tracking without awaiting, handled safely
    void ServerSideTracking.trackDataSourceCreated({
      user: auth.user() ?? undefined,
      workspace: owner,
      dataSource: dataSourceView.dataSource.toJSON(),
    });
  } catch (error) {
    logger.error(
      {
        error,
      },
      "Failed to track data source creation"
    );
  }

  return new Ok(dataSourceView);
}

async function getOrCreateConversationDataSource(
  auth: Authenticator,
  conversation: ConversationWithoutContentType
): Promise<
  Result<
    DataSourceResource,
    Omit<DustError, "code"> & {
      code: "internal_server_error" | "invalid_request_error";
    }
  >
> {
  const jitEnabled = isJITActionsEnabled();

  if (!jitEnabled) {
    return new Err({
      name: "dust_error",
      code: "invalid_request_error",
      message: "JIT processing is not enabled for this file.",
    });
  }

  const lockName = "conversationDataSource" + conversation.id;

  const res = await Lock.executeWithLock(
    lockName,
    async (): Promise<
      Result<
        DataSourceResource,
        Omit<DustError, "code"> & {
          code: "internal_server_error" | "invalid_request_error";
        }
      >
    > => {
      // Fetch the datasource linked to the conversation...
      let dataSource = await DataSourceResource.fetchByConversation(
        auth,
        conversation
      );

      if (!dataSource) {
        // ...or create a new one.
        const conversationsSpace =
          await SpaceResource.fetchWorkspaceConversationsSpace(auth);

        // IMPORTANT: never use the conversation sID in the name or description, as conversation sIDs
        // are used as secrets to share the conversation within the workspace users.
        const r = await createDataSourceWithoutProvider(auth, {
          plan: auth.getNonNullablePlan(),
          owner: auth.getNonNullableWorkspace(),
          space: conversationsSpace,
          name: generateRandomModelSId("conv"),
          description: "Files uploaded to conversation",
          conversation: conversation,
        });

        if (r.isErr()) {
          return new Err({
            name: "dust_error",
            code: "internal_server_error",
            message: `Failed to create datasource : ${r.error}`,
          });
        }

        dataSource = r.value.dataSource;
      }

      return new Ok(dataSource);
    }
  );

  return res;
}

export async function getOrCreateConversationDataSourceFromFile(
  auth: Authenticator,
  file: FileResource
): Promise<
  Result<
    DataSourceResource,
    Omit<DustError, "code"> & {
      code: "internal_server_error" | "invalid_request_error";
    }
  >
> {
  // Note: this assume that if we don't have useCaseMetadata, the file is fine.
  const hasRequiredMetadata =
    !!file.useCaseMetadata && !!file.useCaseMetadata.conversationId;

  if (!hasRequiredMetadata) {
    return new Err({
      name: "dust_error",
      code: "invalid_request_error",
      message: "File is missing required metadata for JIT processing.",
    });
  }

  const cRes = await getConversationWithoutContent(
    auth,
    file.useCaseMetadata.conversationId
  );
  if (cRes.isErr()) {
    return new Err({
      name: "dust_error",
      code: "internal_server_error",
      message: `Failed to fetch conversation.`,
    });
  }

  return getOrCreateConversationDataSource(auth, cRes.value);
}

async function getAllManagedDataSources(auth: Authenticator) {
  const dataSources = await DataSourceResource.listByWorkspace(auth);

  return dataSources.filter((ds) => ds.connectorId !== null);
}

export async function pauseAllManagedDataSources(
  auth: Authenticator,
  { markAsError }: { markAsError: boolean }
) {
  const dataSources = await getAllManagedDataSources(auth);

  const connectorsAPI = new ConnectorsAPI(
    config.getConnectorsAPIConfig(),
    logger
  );

  const res = await concurrentExecutor(
    dataSources,
    async (ds) => {
      assert(ds.connectorId, "Connector ID is required");

      const { connectorId } = ds;

      if (markAsError) {
        const setErrorCommand: AdminCommandType = {
          majorCommand: "connectors",
          command: "set-error",
          args: {
            connectorId,
            error: "oauth_token_revoked",
            wId: auth.getNonNullableWorkspace().sId,
            dsId: ds.sId,
          },
        };

        const setErrorRes = await connectorsAPI.admin(setErrorCommand);
        if (setErrorRes.isErr()) {
          return new Err(new Error(setErrorRes.error.message));
        }
      }

      const pauseRes = await connectorsAPI.pauseConnector(ds.connectorId);
      if (pauseRes.isErr()) {
        return new Err(new Error(pauseRes.error.message));
      }

      logger.info(
        {
          connectorId: ds.connectorId,
          connectorProvider: ds.connectorProvider,
          dataSourceName: ds.name,
          workspaceId: auth.getNonNullableWorkspace().sId,
        },
        "Paused connector"
      );

      return new Ok(pauseRes.value);
    },
    { concurrency: 5 }
  );

  const failed = res.filter((r) => r.isErr());
  if (failed.length > 0) {
    return new Err(new Error(`Failed to pause ${failed.length} connectors.`));
  }

  return new Ok(res);
}

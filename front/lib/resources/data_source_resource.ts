import type {
  ConnectorProvider,
  DataSourceType,
  ModelId,
  PokeDataSourceType,
  Result,
} from "@dust-tt/types";
import { Err, formatUserFullName, Ok, removeNulls } from "@dust-tt/types";
import type {
  Attributes,
  CreationAttributes,
  ModelStatic,
  Transaction,
} from "sequelize";
import { Op } from "sequelize";

import { getDataSourceUsage } from "@app/lib/api/agent_data_sources";
import config from "@app/lib/api/config";
import type { Authenticator } from "@app/lib/auth";
import { AgentDataSourceConfiguration } from "@app/lib/models/assistant/actions/data_sources";
import { AgentTablesQueryConfigurationTable } from "@app/lib/models/assistant/actions/tables_query";
import { User } from "@app/lib/models/user";
import { ResourceWithVault } from "@app/lib/resources/resource_with_vault";
import { DataSourceModel } from "@app/lib/resources/storage/models/data_source";
import type { ReadonlyAttributesType } from "@app/lib/resources/storage/types";
import {
  getResourceIdFromSId,
  isResourceSId,
  makeSId,
} from "@app/lib/resources/string_ids";
import type { ResourceFindOptions } from "@app/lib/resources/types";
import type { VaultResource } from "@app/lib/resources/vault_resource";
import { getWorkspaceByModelId } from "@app/lib/workspace";
import logger from "@app/logger/logger";

import { DataSourceViewModel } from "./storage/models/data_source_view";

export type FetchDataSourceOrigin =
  | "document_tracker"
  | "registry_lookup"
  | "v1_data_sources_search"
  | "v1_data_sources_documents"
  | "v1_data_sources_documents_document_get_or_upsert"
  | "v1_data_sources_documents_document_parents"
  | "v1_data_sources_tables_csv"
  | "v1_data_sources_tables"
  | "v1_data_sources_tables_table"
  | "v1_data_sources_tables_table_parents"
  | "v1_data_sources_tables_table_rows"
  | "v1_data_sources_tables_table_rows_row"
  | "v1_data_sources_tokenize";

export type FetchDataSourceOptions = {
  includeEditedBy?: boolean;
  limit?: number;
  order?: [string, "ASC" | "DESC"][];
  origin?: FetchDataSourceOrigin;
};

// Attributes are marked as read-only to reflect the stateless nature of our Resource.
// This design will be moved up to BaseResource once we transition away from Sequelize.
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-unsafe-declaration-merging
export interface DataSourceResource
  extends ReadonlyAttributesType<DataSourceModel> {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class DataSourceResource extends ResourceWithVault<DataSourceModel> {
  static model: ModelStatic<DataSourceModel> = DataSourceModel;

  readonly editedByUser?: Attributes<User>;

  constructor(
    model: ModelStatic<DataSourceModel>,
    blob: Attributes<DataSourceModel>,
    vault: VaultResource,
    { editedByUser }: { editedByUser?: Attributes<User> } = {}
  ) {
    super(DataSourceResource.model, blob, vault);

    this.editedByUser = editedByUser;
  }

  static async makeNew(
    auth: Authenticator,
    blob: Omit<
      CreationAttributes<DataSourceModel>,
      "editedAt" | "editedByUserId" | "vaultId"
    >,
    vault: VaultResource,
    transaction?: Transaction
  ) {
    const dataSource = await DataSourceModel.create(
      {
        ...blob,
        editedByUserId: auth.getNonNullableUser().id,
        editedAt: new Date(),
        vaultId: vault.id,
      },
      { transaction }
    );

    return new this(DataSourceResource.model, dataSource.get(), vault);
  }

  // Fetching.

  private static getOptions(
    options?: FetchDataSourceOptions
  ): ResourceFindOptions<DataSourceModel> {
    const result: ResourceFindOptions<DataSourceModel> = {};

    if (options?.includeEditedBy) {
      result.includes = [
        {
          model: User,
          as: "editedByUser",
        },
      ];
    }

    if (options?.limit) {
      result.limit = options.limit;
    }

    if (options?.order) {
      result.order = options.order;
    }

    return result;
  }

  private static async baseFetch(
    auth: Authenticator,
    fetchDataSourceOptions?: FetchDataSourceOptions,
    options?: ResourceFindOptions<DataSourceModel>
  ) {
    return this.baseFetchWithAuthorization(auth, {
      ...this.getOptions(fetchDataSourceOptions),
      ...options,
    });
  }

  static async fetchById(
    auth: Authenticator,
    id: string,
    options?: Omit<FetchDataSourceOptions, "limit" | "order">
  ): Promise<DataSourceResource | null> {
    const [dataSource] = await DataSourceResource.fetchByIds(
      auth,
      [id],
      options
    );

    return dataSource ?? null;
  }

  // TODO(DATASOURCE_SID): remove
  static async fetchByNameOrId(
    auth: Authenticator,
    nameOrId: string,
    options?: Omit<FetchDataSourceOptions, "limit" | "order">
  ): Promise<DataSourceResource | null> {
    if (DataSourceResource.isDataSourceSId(nameOrId)) {
      // Fetch by sId
      const dataSourceModelId = getResourceIdFromSId(nameOrId);
      if (!dataSourceModelId) {
        logger.error(
          {
            workspaceId: auth.workspace()?.sId,
            nameOrId: nameOrId,
            type: "sid",
            sId: nameOrId,
            origin: options?.origin,
            error: "invalid_sid",
            success: false,
          },
          "fetchByNameOrId"
        );
        return null;
      }

      const dataSources = await this.fetchByModelIds(
        auth,
        [dataSourceModelId],
        options
      );

      if (dataSources.length === 0) {
        logger.error(
          {
            workspaceId: auth.workspace()?.sId,
            nameOrId: nameOrId,
            type: "sid",
            sId: nameOrId,
            origin: options?.origin,
            error: "id_from_sid_not_found",
            success: false,
          },
          "fetchByNameOrId"
        );
        return null;
      }

      logger.info(
        {
          workspaceId: auth.workspace()?.sId,
          nameOrId: nameOrId,
          type: "sid",
          sId: nameOrId,
          origin: options?.origin,
          success: true,
        },
        "fetchByNameOrId"
      );
      return dataSources[0];
    } else {
      // Fetch by name
      const dataSources = await this.fetchByNames(auth, [nameOrId], options);
      if (dataSources.length === 0) {
        logger.error(
          {
            workspaceId: auth.workspace()?.sId,
            nameOrId: nameOrId,
            type: "name",
            name: nameOrId,
            origin: options?.origin,
            error: "name_not_found",
            success: false,
          },
          "fetchByNameOrId"
        );
        return null;
      }

      logger.info(
        {
          workspaceId: auth.workspace()?.sId,
          nameOrId: nameOrId,
          type: "name",
          name: nameOrId,
          origin: options?.origin,
          success: true,
        },
        "fetchByNameOrId"
      );
      return dataSources[0];
    }
  }

  // TODO(DATASOURCE_SID): remove
  static async fetchByNames(
    auth: Authenticator,
    names: string[],
    options?: Omit<FetchDataSourceOptions, "limit" | "order">
  ): Promise<DataSourceResource[]> {
    const dataSources = await this.baseFetch(auth, options, {
      where: {
        name: {
          [Op.in]: names,
        },
        // /!\ Names being generic, we need to filter by workspace.
        workspaceId: auth.getNonNullableWorkspace().id,
      },
    });

    return dataSources;
  }

  static async fetchByModelIds(
    auth: Authenticator,
    ids: ModelId[],
    options?: FetchDataSourceOptions
  ) {
    return this.baseFetch(auth, options, {
      where: {
        id: ids,
      },
    });
  }

  static async fetchByIds(
    auth: Authenticator,
    ids: string[],
    options?: Omit<FetchDataSourceOptions, "limit" | "order">
  ) {
    return DataSourceResource.fetchByModelIds(
      auth,
      removeNulls(ids.map(getResourceIdFromSId)),
      options
    );
  }

  static async listByWorkspace(
    auth: Authenticator,
    options?: FetchDataSourceOptions
  ): Promise<DataSourceResource[]> {
    return this.baseFetch(auth, options, {
      where: {
        workspaceId: auth.getNonNullableWorkspace().id,
      },
    });
  }

  static async listByConnectorProvider(
    auth: Authenticator,
    connectorProvider: ConnectorProvider,
    options?: FetchDataSourceOptions
  ): Promise<DataSourceResource[]> {
    return this.baseFetch(auth, options, {
      where: {
        connectorProvider,
        workspaceId: auth.getNonNullableWorkspace().id,
      },
    });
  }

  static async listByVault(auth: Authenticator, vault: VaultResource) {
    return this.listByVaults(auth, [vault]);
  }

  static async listByVaults(auth: Authenticator, vaults: VaultResource[]) {
    return this.baseFetch(auth, undefined, {
      where: {
        vaultId: vaults.map((v) => v.id),
      },
    });
  }

  static async fetchByModelIdWithAuth(auth: Authenticator, id: ModelId) {
    const [dataSource] = await this.baseFetch(auth, undefined, {
      where: { id },
    });

    return dataSource ?? null;
  }

  async delete(
    auth: Authenticator,
    transaction?: Transaction
  ): Promise<Result<undefined, Error>> {
    await AgentDataSourceConfiguration.destroy({
      where: {
        dataSourceId: this.id,
      },
      transaction,
    });

    await AgentTablesQueryConfigurationTable.destroy({
      where: {
        dataSourceId: this.id,
      },
      transaction,
    });

    // We directly delete the DataSourceViewResource.model here to avoid a circular dependency.
    // DataSourceViewResource depends on DataSourceResource
    await DataSourceViewModel.destroy({
      where: {
        workspaceId: auth.getNonNullableWorkspace().id,
        dataSourceId: this.id,
      },
      transaction,
    });

    try {
      await this.model.destroy({
        where: {
          id: this.id,
        },
        transaction,
      });

      return new Ok(undefined);
    } catch (err) {
      return new Err(err as Error);
    }
  }

  // Updating.

  async setEditedBy(auth: Authenticator) {
    await this.update({
      editedByUserId: auth.getNonNullableUser().id,
      editedAt: new Date(),
    });
  }

  private makeEditedBy(
    editedByUser: Attributes<User> | undefined,
    editedAt: Date | undefined
  ) {
    if (!editedByUser || !editedAt) {
      return undefined;
    }

    return {
      editedByUser: {
        editedAt: editedAt.getTime(),
        fullName: formatUserFullName(editedByUser),
        imageUrl: editedByUser.imageUrl,
        email: editedByUser.email,
        userId: editedByUser.sId,
      },
    };
  }

  async setDefaultSelectedForAssistant(defaultSelected: boolean) {
    return this.update({
      assistantDefaultSelected: defaultSelected,
    });
  }

  async setDescription(description: string) {
    return this.update({
      description,
    });
  }

  async setConnectorId(connectorId: string) {
    return this.update({
      connectorId,
    });
  }

  getUsagesByAgents(auth: Authenticator) {
    return getDataSourceUsage({ auth, dataSource: this });
  }

  // Permissions.

  canRead(auth: Authenticator) {
    return this.vault.canRead(auth);
  }

  canWrite(auth: Authenticator) {
    return this.vault.canWrite(auth);
  }

  // sId logic.

  get sId(): string {
    return DataSourceResource.modelIdToSId({
      id: this.id,
      workspaceId: this.workspaceId,
    });
  }

  static modelIdToSId({
    id,
    workspaceId,
  }: {
    id: ModelId;
    workspaceId: ModelId;
  }): string {
    return makeSId("data_source", {
      id,
      workspaceId,
    });
  }

  static isDataSourceSId(sId: string): boolean {
    return isResourceSId("data_source", sId);
  }

  // Serialization.

  toJSON(): DataSourceType {
    return {
      id: this.id,
      sId: this.sId,
      createdAt: this.createdAt.getTime(),
      name: this.name,
      description: this.description,
      dustAPIProjectId: this.dustAPIProjectId,
      dustAPIDataSourceId: this.dustAPIDataSourceId,
      connectorId: this.connectorId,
      connectorProvider: this.connectorProvider,
      assistantDefaultSelected: this.assistantDefaultSelected,
      ...this.makeEditedBy(this.editedByUser, this.editedAt),
    };
  }

  async toPokeJSON(): Promise<PokeDataSourceType> {
    const workspace = await getWorkspaceByModelId(this.workspaceId);

    return {
      ...this.toJSON(),
      link: workspace
        ? `${config.getClientFacingUrl()}/poke/${workspace.sId}/data_sources/${this.sId}`
        : null,
      name: `Data Source View (${this.name})`,
      vault: this.vault.toPokeJSON(),
    };
  }
}

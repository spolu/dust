import type {
  ACLType,
  GroupType,
  LightWorkspaceType,
  ModelId,
  Result,
  WorkspaceType,
} from "@dust-tt/types";
import { Err, Ok } from "@dust-tt/types";
import type {
  Attributes,
  CreationAttributes,
  ModelStatic,
  Transaction,
} from "sequelize";

import type { Authenticator } from "@app/lib/auth";
import { BaseResource } from "@app/lib/resources/base_resource";
import { VaultModel } from "@app/lib/resources/storage/models/vaults";
import type { ReadonlyAttributesType } from "@app/lib/resources/storage/types";
import { getResourceIdFromSId, makeSId } from "@app/lib/resources/string_ids";

// Attributes are marked as read-only to reflect the stateless nature of our Resource.
// This design will be moved up to BaseResource once we transition away from Sequelize.
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-unsafe-declaration-merging
export interface VaultResource extends ReadonlyAttributesType<VaultModel> {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class VaultResource extends BaseResource<VaultModel> {
  static model: ModelStatic<VaultModel> = VaultModel;

  constructor(model: ModelStatic<VaultModel>, blob: Attributes<VaultModel>) {
    super(VaultModel, blob);
  }

  static async makeNew(blob: CreationAttributes<VaultModel>) {
    const vault = await VaultModel.create(blob);

    return new this(VaultModel, vault.get());
  }

  static async makeDefaultsForWorkspace(
    workspace: LightWorkspaceType,
    {
      systemGroup,
      globalGroup,
    }: {
      systemGroup: GroupType;
      globalGroup: GroupType;
    }
  ) {
    const existingVaults = await VaultModel.findAll({
      where: {
        workspaceId: workspace.id,
      },
    });
    const systemVault =
      existingVaults.find((v) => v.kind === "system") ||
      (await VaultResource.makeNew({
        name: "System",
        kind: "system",
        workspaceId: workspace.id,
        groupId: systemGroup.id,
      }));
    const globalVault =
      existingVaults.find((v) => v.kind === "global") ||
      (await VaultResource.makeNew({
        name: "Workspace",
        kind: "global",
        workspaceId: workspace.id,
        groupId: globalGroup.id,
      }));
    return {
      systemVault,
      globalVault,
    };
  }

  get sId(): string {
    return VaultResource.modelIdToSId({
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
    return makeSId("vault", {
      id,
      workspaceId,
    });
  }

  static async listWorkspaceVaults(
    auth: Authenticator
  ): Promise<VaultResource[]> {
    const owner = auth.getNonNullableWorkspace();

    const vaults = await this.model.findAll({
      where: {
        workspaceId: owner.id,
      },
    });

    return vaults.map((vault) => new this(VaultModel, vault.get()));
  }

  static async fetchWorkspaceSystemVault(
    auth: Authenticator
  ): Promise<VaultResource> {
    const owner = auth.getNonNullableWorkspace();
    const vault = await this.model.findOne({
      where: {
        workspaceId: owner.id,
        kind: "system",
      },
    });

    if (!vault) {
      throw new Error("System vault not found.");
    }

    return new this(VaultModel, vault.get());
  }

  static async fetchWorkspaceGlobalVault(
    auth: Authenticator
  ): Promise<VaultResource> {
    const owner = auth.getNonNullableWorkspace();
    const vault = await this.model.findOne({
      where: {
        workspaceId: owner.id,
        kind: "global",
      },
    });

    if (!vault) {
      throw new Error("Global vault not found.");
    }

    return new this(VaultModel, vault.get());
  }

  static async fetchById(
    auth: Authenticator,
    sId: string
  ): Promise<VaultResource | null> {
    const owner = auth.getNonNullableWorkspace();

    const vaultModelId = getResourceIdFromSId(sId);
    if (!vaultModelId) {
      return null;
    }

    const vault = await this.model.findOne({
      where: {
        id: vaultModelId,
        workspaceId: owner.id,
      },
    });

    if (!vault) {
      return null;
    }

    return new this(VaultModel, vault.get());
  }

  async delete(
    auth: Authenticator,
    transaction?: Transaction
  ): Promise<Result<undefined, Error>> {
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

  static async deleteAllForWorkspace(
    workspace: LightWorkspaceType,
    transaction?: Transaction
  ) {
    await this.model.destroy({
      where: {
        workspaceId: workspace.id,
      },
      transaction,
    });
  }

  acl(): ACLType {
    return {
      aclEntries: [
        {
          groupId: this.groupId,
          permissions: ["read", "write"],
        },
      ],
    };
  }
}

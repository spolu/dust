import type {
  ACLType,
  ModelId,
  Permission,
  PokeVaultType,
  Result,
  VaultType,
} from "@dust-tt/types";
import { Err } from "@dust-tt/types";
import { Ok } from "@dust-tt/types";
import assert from "assert";
import type {
  Attributes,
  CreationAttributes,
  Includeable,
  Transaction,
  WhereOptions,
} from "sequelize";
import { Op } from "sequelize";

import type { Authenticator } from "@app/lib/auth";
import { DustError } from "@app/lib/error";
import { BaseResource } from "@app/lib/resources/base_resource";
import { GroupResource } from "@app/lib/resources/group_resource";
import { frontSequelize } from "@app/lib/resources/storage";
import { GroupVaultModel } from "@app/lib/resources/storage/models/group_vaults";
import { GroupModel } from "@app/lib/resources/storage/models/groups";
import { VaultModel } from "@app/lib/resources/storage/models/vaults";
import type { ReadonlyAttributesType } from "@app/lib/resources/storage/types";
import type { ModelStaticSoftDeletable } from "@app/lib/resources/storage/wrappers";
import { getResourceIdFromSId, makeSId } from "@app/lib/resources/string_ids";
import type { ResourceFindOptions } from "@app/lib/resources/types";
import { UserResource } from "@app/lib/resources/user_resource";

// Attributes are marked as read-only to reflect the stateless nature of our Resource.
// This design will be moved up to BaseResource once we transition away from Sequelize.
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-unsafe-declaration-merging
export interface VaultResource extends ReadonlyAttributesType<VaultModel> {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class VaultResource extends BaseResource<VaultModel> {
  static model: ModelStaticSoftDeletable<VaultModel> = VaultModel;

  constructor(
    model: ModelStaticSoftDeletable<VaultModel>,
    blob: Attributes<VaultModel>,
    readonly groups: GroupResource[]
  ) {
    super(VaultModel, blob);
  }

  static fromModel(vault: VaultModel) {
    return new VaultResource(
      VaultModel,
      vault.get(),
      vault.groups.map((group) => new GroupResource(GroupModel, group.get()))
    );
  }

  static async makeNew(
    blob: CreationAttributes<VaultModel>,
    groups: GroupResource[]
  ) {
    return frontSequelize.transaction(async (transaction) => {
      const vault = await VaultModel.create(blob, { transaction });

      for (const group of groups) {
        await GroupVaultModel.create(
          {
            groupId: group.id,
            vaultId: vault.id,
          },
          { transaction }
        );
      }

      return new this(VaultModel, vault.get(), groups);
    });
  }

  static async makeDefaultsForWorkspace(
    auth: Authenticator,
    {
      systemGroup,
      globalGroup,
    }: {
      systemGroup: GroupResource;
      globalGroup: GroupResource;
    }
  ) {
    assert(auth.isAdmin(), "Only admins can call `makeDefaultsForWorkspace`");

    const existingVaults = await this.listWorkspaceDefaultVaults(auth);
    const systemVault =
      existingVaults.find((v) => v.kind === "system") ||
      (await VaultResource.makeNew(
        {
          name: "System",
          kind: "system",
          workspaceId: auth.getNonNullableWorkspace().id,
        },
        [systemGroup]
      ));

    const globalVault =
      existingVaults.find((v) => v.kind === "global") ||
      (await VaultResource.makeNew(
        {
          name: "Company Data",
          kind: "global",
          workspaceId: auth.getNonNullableWorkspace().id,
        },
        [globalGroup]
      ));

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

  private static async baseFetch(
    auth: Authenticator,
    {
      includes,
      limit,
      order,
      where,
      includeDeleted,
    }: ResourceFindOptions<VaultModel> = {}
  ) {
    const includeClauses: Includeable[] = [
      {
        model: GroupResource.model,
      },
      ...(includes || []),
    ];

    const vaultModels = await this.model.findAll({
      where: {
        ...where,
        workspaceId: auth.getNonNullableWorkspace().id,
      } as WhereOptions<VaultModel>,
      include: includeClauses,
      limit,
      order,
      includeDeleted,
    });

    return vaultModels.map(this.fromModel);
  }

  static async listWorkspaceVaults(
    auth: Authenticator
  ): Promise<VaultResource[]> {
    const vaults = await this.baseFetch(auth);

    return vaults.filter((vault) => vault.canList(auth));
  }

  static async listWorkspaceVaultsAsMember(auth: Authenticator) {
    const vaults = await this.baseFetch(auth);
    // using canRead() as we know that only members can read vaults (but admins can list them)
    return vaults.filter((vault) => vault.canList(auth) && vault.canRead(auth));
  }

  static async listWorkspaceDefaultVaults(auth: Authenticator) {
    return this.baseFetch(auth, {
      where: {
        kind: {
          [Op.in]: ["system", "global"],
        },
      },
    });
  }

  static async listForGroups(auth: Authenticator, groups: GroupResource[]) {
    const groupVaults = await GroupVaultModel.findAll({
      where: {
        groupId: groups.map((g) => g.id),
      },
    });

    const vaults = await this.baseFetch(auth, {
      where: {
        id: groupVaults.map((v) => v.vaultId),
      },
    });

    return vaults.filter((v) => v.canRead(auth));
  }

  static async fetchWorkspaceSystemVault(
    auth: Authenticator
  ): Promise<VaultResource> {
    const [vault] = await this.baseFetch(auth, { where: { kind: "system" } });

    if (!vault) {
      throw new Error("System vault not found.");
    }

    return vault;
  }

  static async fetchWorkspaceGlobalVault(
    auth: Authenticator
  ): Promise<VaultResource> {
    const [vault] = await this.baseFetch(auth, { where: { kind: "global" } });

    if (!vault) {
      throw new Error("Global vault not found.");
    }

    return vault;
  }

  static async fetchById(
    auth: Authenticator,
    sId: string,
    { includeDeleted }: { includeDeleted?: boolean } = {}
  ): Promise<VaultResource | null> {
    const vaultModelId = getResourceIdFromSId(sId);
    if (!vaultModelId) {
      return null;
    }

    const [vault] = await this.baseFetch(auth, {
      where: { id: vaultModelId },
      includeDeleted,
    });

    return vault;
  }

  static async isNameAvailable(
    auth: Authenticator,
    name: string
  ): Promise<boolean> {
    const owner = auth.getNonNullableWorkspace();

    const vault = await this.model.findOne({
      where: {
        name,
        workspaceId: owner.id,
      },
    });

    return !vault;
  }

  async delete(
    auth: Authenticator,
    options: { hardDelete: boolean; transaction?: Transaction }
  ): Promise<Result<undefined, Error>> {
    const { hardDelete, transaction } = options;

    await GroupVaultModel.destroy({
      where: {
        vaultId: this.id,
      },
      transaction,
    });

    await VaultModel.destroy({
      where: {
        id: this.id,
      },
      transaction,
      hardDelete,
    });

    return new Ok(undefined);
  }

  async updateName(
    auth: Authenticator,
    newName: string
  ): Promise<Result<undefined, Error>> {
    if (!auth.isAdmin()) {
      return new Err(new Error("Only admins can update vault names."));
    }

    const nameAvailable = await VaultResource.isNameAvailable(auth, newName);
    if (!nameAvailable) {
      return new Err(new Error("This vault name is already used."));
    }

    await this.update({ name: newName });
    return new Ok(undefined);
  }

  // Permissions.

  async updatePermissions(
    auth: Authenticator,
    {
      isRestricted,
      memberIds,
    }: { isRestricted: boolean; memberIds: string[] | null }
  ): Promise<Result<undefined, DustError>> {
    if (!this.canAdministrate(auth)) {
      return new Err(
        new DustError(
          "unauthorized",
          "You do not have permission to update vault permissions."
        )
      );
    }

    const regularGroups = this.groups.filter(
      (group) => group.kind === "regular"
    );

    // Ensure exactly one regular group is associated with the vault.
    // IMPORTANT: This constraint is critical for the acl() method logic.
    // Modifying this requires careful review and updates to acl().
    assert(
      regularGroups.length === 1,
      `Expected exactly one regular group for the vault, but found ${regularGroups.length}.`
    );
    const [defaultVaultGroup] = regularGroups;

    const wasRestricted = this.groups.every((g) => !g.isGlobal());

    const groupRes = await GroupResource.fetchWorkspaceGlobalGroup(auth);
    if (groupRes.isErr()) {
      return groupRes;
    }

    const globalGroup = groupRes.value;
    if (isRestricted) {
      // If the vault should be restricted and was not restricted before, remove the global group.
      if (!wasRestricted) {
        await this.removeGroup(globalGroup);
      }

      if (memberIds) {
        const users = await UserResource.fetchByIds(memberIds);

        return defaultVaultGroup.setMembers(
          auth,
          users.map((u) => u.toJSON())
        );
      }

      return new Ok(undefined);
    } else {
      // If the vault should not be restricted and was restricted before, add the global group.
      if (wasRestricted) {
        await this.addGroup(globalGroup);
      }

      // Remove all members.
      await defaultVaultGroup.setMembers(auth, []);

      return new Ok(undefined);
    }
  }

  private async addGroup(group: GroupResource) {
    await GroupVaultModel.create({
      groupId: group.id,
      vaultId: this.id,
    });
  }

  private async removeGroup(group: GroupResource) {
    await GroupVaultModel.destroy({
      where: {
        groupId: group.id,
        vaultId: this.id,
      },
    });
  }

  private mapGroupPermissions(permissions: Permission[]) {
    return this.groups.map((group) => ({
      id: group.id,
      permissions,
    }));
  }

  /**
   * Computes Access Control List (ACL) entries based on vault type and group configuration.
   *
   * Permission patterns:
   * - System vaults: admin-only write access
   * - Public vaults: anyone can read, workspace members can write
   * - Global vaults: admin and builder have read/write access
   * - Regular vaults with global group: hierarchical access (admin > builder > user)
   * - Restricted vaults: admin access + explicit group permissions
   */
  acl(): ACLType {
    const globalGroup = this.isRegular()
      ? this.groups.find((group) => group.isGlobal())
      : undefined;

    if (this.isSystem()) {
      return {
        workspaceId: this.workspaceId,
        roles: [{ name: "admin", permissions: ["write"] }],
        groups: [],
      };
    }

    if (this.isPublic()) {
      return {
        workspaceId: this.workspaceId,
        roles: [
          { name: "admin", permissions: ["admin", "read", "write"] },
          { name: "builder", permissions: ["read", "write"] },
          { name: "user", permissions: ["read", "write"] },
          // Everyone can read.
          { name: "none", permissions: ["read"] },
        ],
        groups: this.mapGroupPermissions(["read", "write"]),
      };
    }

    if (this.isGlobal()) {
      return {
        workspaceId: this.workspaceId,
        roles: [
          { name: "admin", permissions: ["read", "write"] },
          { name: "builder", permissions: ["read", "write"] },
        ],
        groups: this.mapGroupPermissions(["read"]),
      };
    }

    // Open vaults.
    if (globalGroup) {
      return {
        workspaceId: this.workspaceId,
        roles: [
          { name: "admin", permissions: ["read", "write", "admin"] },
          { name: "builder", permissions: ["read", "write"] },
          { name: "user", permissions: ["read"] },
        ],
        groups: this.mapGroupPermissions(["read"]),
      };
    }

    return {
      workspaceId: this.workspaceId,
      roles: [{ name: "admin", permissions: ["write", "admin"] }],
      groups: this.mapGroupPermissions(["read", "write"]),
    };
  }

  canAdministrate(auth: Authenticator) {
    return auth.canAdministrate([this.acl()]);
  }

  canWrite(auth: Authenticator) {
    return auth.canWrite([this.acl()]);
  }

  canRead(auth: Authenticator) {
    return auth.canRead([this.acl()]);
  }

  canList(auth: Authenticator) {
    return this.canRead(auth) || this.canAdministrate(auth);
  }

  isGlobal() {
    return this.kind === "global";
  }

  isSystem() {
    return this.kind === "system";
  }

  isRegular() {
    return this.kind === "regular";
  }

  isPublic() {
    return this.kind === "public";
  }

  isDeleted() {
    return this.deletedAt !== null;
  }

  // Serialization.

  toJSON(): VaultType {
    return {
      groupIds: this.groups.map((group) => group.sId),
      isRestricted: !this.groups.some((group) => group.isGlobal()),
      kind: this.kind,
      name: this.name,
      sId: this.sId,
    };
  }

  toPokeJSON(): PokeVaultType {
    return {
      ...this.toJSON(),
      groups: this.groups.map((group) => group.toJSON()),
    };
  }
}

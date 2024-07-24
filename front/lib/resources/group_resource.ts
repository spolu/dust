import type { ModelId, Result } from "@dust-tt/types";
import { Err, Ok } from "@dust-tt/types";
import type {
  Attributes,
  CreationAttributes,
  ModelStatic,
  Transaction,
} from "sequelize";

import type { Authenticator } from "@app/lib/auth";
import type { Workspace } from "@app/lib/models/workspace";
import { BaseResource } from "@app/lib/resources/base_resource";
import { GroupModel } from "@app/lib/resources/storage/models/groups";
import type { ReadonlyAttributesType } from "@app/lib/resources/storage/types";
import { getResourceIdFromSId, makeSId } from "@app/lib/resources/string_ids";

// Attributes are marked as read-only to reflect the stateless nature of our Resource.
// This design will be moved up to BaseResource once we transition away from Sequelize.
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-unsafe-declaration-merging
export interface GroupResource extends ReadonlyAttributesType<GroupModel> {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class GroupResource extends BaseResource<GroupModel> {
  static model: ModelStatic<GroupModel> = GroupModel;

  private workspace?: Workspace;

  constructor(model: ModelStatic<GroupModel>, blob: Attributes<GroupModel>) {
    super(GroupModel, blob);
  }

  static async makeNew(blob: Omit<CreationAttributes<GroupModel>, "sId">) {
    const group = await GroupModel.create({
      ...blob,
    });

    return new this(GroupModel, group.get());
  }

  get sId(): string {
    return GroupResource.modelIdToSId({
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
    return makeSId("group", {
      id,
      workspaceId,
    });
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

  static async fetchById({
    auth,
    sId,
  }: {
    auth: Authenticator;
    sId: string;
  }): Promise<GroupResource | null> {
    const owner = auth.workspace();
    if (!owner) {
      throw new Error(
        "Unexpected unauthenticated call to `GroupResource.fetchById`"
      );
    }

    const groupModelId = getResourceIdFromSId(sId);
    if (!groupModelId) {
      return null;
    }

    const blob = await this.model.findOne({
      where: {
        id: groupModelId,
        workspaceId: owner.id,
      },
    });
    if (!blob) {
      return null;
    }

    // Use `.get` to extract model attributes, omitting Sequelize instance metadata.
    return new this(this.model, blob.get());
  }

  static async fetchByAuthWorkspace({
    auth,
    transaction,
  }: {
    auth: Authenticator;
    transaction?: Transaction;
  }): Promise<GroupResource[]> {
    const owner = auth.workspace();
    if (!owner) {
      throw new Error(
        "Unexpected unauthenticated call to `GroupResource.fetchByAuthWorkspace`"
      );
    }

    const groups = await this.model.findAll({
      where: {
        workspaceId: owner.id,
      },
      transaction,
    });

    return groups.map((group) => new this(GroupModel, group.get()));
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      workspaceId: this.workspaceId,
      type: this.type,
    };
  }
}

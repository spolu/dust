import type {
  LightWorkspaceType,
  MembershipRoleType,
  RequireAtLeastOne,
  Result,
  UserType,
} from "@dust-tt/types";
import { Err, Ok } from "@dust-tt/types";
import type {
  Attributes,
  InferAttributes,
  ModelStatic,
  Transaction,
  WhereOptions,
} from "sequelize";
import { Op } from "sequelize";

import { BaseResource } from "@app/lib/resources/base_resource";
import { SolutionsTranscriptsConfigurationModel } from "@app/lib/resources/storage/models/solutions";
import type { ReadonlyAttributesType } from "@app/lib/resources/storage/types";
import type { SolutionProviderType } from "@app/lib/solutions/transcripts/utils/types";
import logger from "@app/logger/logger";

// Attributes are marked as read-only to reflect the stateless nature of our Resource.
// This design will be moved up to BaseResource once we transition away from Sequelize.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SolutionsTranscriptsConfigurationResource
  extends ReadonlyAttributesType<SolutionsTranscriptsConfigurationModel> {}
export class SolutionsTranscriptsConfigurationResource extends BaseResource<SolutionsTranscriptsConfigurationModel> {
  static model: ModelStatic<SolutionsTranscriptsConfigurationModel> = SolutionsTranscriptsConfigurationModel;

  constructor(
    model: ModelStatic<SolutionsTranscriptsConfigurationModel>,
    blob: Attributes<SolutionsTranscriptsConfigurationModel>
  ) {
    super(SolutionsTranscriptsConfigurationModel, blob);
  }


  static async makeNew({
    userId,
    connectionId,
    provider,
  }: {
    userId: number;
    connectionId: string;
    provider: SolutionProviderType;
  }): Promise<SolutionsTranscriptsConfigurationResource> {
    if (
      await SolutionsTranscriptsConfigurationModel.count({
        where: {
          userId: userId,
          connectionId: connectionId,
          provider: provider,
        }
      })
    ) {
      throw new Error(
        `A Solution configuration already exists for user ${userId} with connectionId ${connectionId} and provider ${provider}`
      );
    }
    const configuration = await SolutionsTranscriptsConfigurationModel.create(
      {
        userId,
        connectionId,
        provider,
      }
    );

    return new SolutionsTranscriptsConfigurationResource(SolutionsTranscriptsConfigurationModel, configuration.get());
  }

  static async findByUserIdAndProvider({
    attributes,
    where
  }: {
    attributes: string[];
    where: RequireAtLeastOne<{
      userId: number;
      provider: SolutionProviderType;
    }>;
  }): Promise<SolutionsTranscriptsConfigurationResource | null> {
    const configuration = await SolutionsTranscriptsConfigurationModel.findOne({
      attributes,
      where,
    });

    return configuration
      ? new SolutionsTranscriptsConfigurationResource(SolutionsTranscriptsConfigurationModel, configuration.get())
      : null;
  }

  async delete(transaction?: Transaction): Promise<Result<undefined, Error>> {
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

}

import type {
  ActionPreset,
  AssistantCreativityLevel,
  ModelIdType,
  ModelProviderIdType,
  TemplateTagCodeType,
  TemplateVisibility,
  TimeframeUnit,
} from "@dust-tt/types";
import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from "sequelize";
import { DataTypes, Model } from "sequelize";

import { frontSequelize } from "@app/lib/resources/storage";

type TemplateAction = {
  type:
    | "RETRIEVAL_SEARCH"
    | "RETRIEVAL_EXHAUSTIVE"
    | "DUST_APP_RUN"
    | "TABLES_QUERY"
    | "PROCESS";
  helpContent: string | null;
  name: string | null;
  description: string | null;
  configuration: Record<string, unknown>;
};

export class TemplateModel extends Model<
  InferAttributes<TemplateModel>,
  InferCreationAttributes<TemplateModel>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare sId: string;
  declare description: string | null;

  declare visibility: TemplateVisibility;

  declare backgroundColor: string;
  declare emoji: string;
  declare handle: string;

  declare presetDescription: string | null;
  declare presetInstructions: string | null;
  declare presetTemperature: AssistantCreativityLevel;
  declare presetProviderId: ModelProviderIdType;
  declare presetModelId: ModelIdType;
  declare presetAction: ActionPreset; // @todo[daph] Remove this field once templates are migrated to multi-ations.
  declare presetActions: TemplateAction[];

  declare timeFrameDuration: number | null;
  declare timeFrameUnit: TimeframeUnit | null;

  declare helpInstructions: string | null;
  declare helpActions: string | null;

  declare tags: TemplateTagCodeType[];
}

TemplateModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    sId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    backgroundColor: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    emoji: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    visibility: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    handle: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    presetDescription: {
      type: DataTypes.TEXT,
    },
    presetInstructions: {
      type: DataTypes.TEXT,
    },
    presetTemperature: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    presetProviderId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    presetModelId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    presetAction: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    presetActions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    timeFrameDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    timeFrameUnit: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    helpInstructions: {
      type: DataTypes.TEXT,
    },
    helpActions: {
      type: DataTypes.TEXT,
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
    },
  },
  {
    sequelize: frontSequelize,
    modelName: "template",
    indexes: [
      { unique: true, fields: ["sId"] },
      {
        fields: ["visibility"],
      },
    ],
  }
);

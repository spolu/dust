import type {
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
} from "sequelize";
import { DataTypes, Model } from "sequelize";

import { frontSequelize } from "@app/lib/resources/storage";

export class TemplateModel extends Model<
  InferAttributes<TemplateModel>,
  InferCreationAttributes<TemplateModel>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare sId: string;
  declare name: string;
  declare description: string | null;

  declare visibility: "draft" | "published" | "disabled";

  declare presetHandle: string | null;
  declare presetDescription: string | null;
  declare presetInstructions: string | null;
  declare presetTemperature:
    | "deterministic"
    | "factual"
    | "balanced"
    | "creative"
    | null;
  declare presetProviderId: string | null;
  declare presetModelId: string | null;
  declare presetAction:
    | "reply"
    | "search_datasources"
    | "process_datasources"
    | "query_tables"
    | null;

  declare helpInstructions: string | null;
  declare helpActions: string | null;
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
    },
    visibility: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    presetHandle: {
      type: DataTypes.STRING,
    },
    presetDescription: {
      type: DataTypes.STRING,
    },
    presetInstructions: {
      type: DataTypes.STRING,
    },
    presetTemperature: {
      type: DataTypes.STRING,
    },
    presetProviderId: {
      type: DataTypes.STRING,
    },
    presetModelId: {
      type: DataTypes.STRING,
    },
    presetAction: {
      type: DataTypes.STRING,
    },
    helpInstructions: {
      type: DataTypes.STRING,
    },
    helpActions: {
      type: DataTypes.STRING,
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

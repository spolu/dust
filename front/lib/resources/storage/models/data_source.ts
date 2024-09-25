import type { ConnectorProvider } from "@dust-tt/types";
import type {
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from "sequelize";
import { DataTypes, Model } from "sequelize";

import { User } from "@app/lib/models/user";
import { Workspace } from "@app/lib/models/workspace";
import { frontSequelize } from "@app/lib/resources/storage";
import { VaultModel } from "@app/lib/resources/storage/models/vaults";

export class DataSourceModel extends Model<
  InferAttributes<DataSourceModel>,
  InferCreationAttributes<DataSourceModel>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: Date | null;

  // Corresponds to the ID of the last user to configure the connection.
  declare editedByUserId: ForeignKey<User["id"]>;
  declare editedAt: Date;

  declare name: string;
  declare description: string | null;
  declare assistantDefaultSelected: boolean;
  declare dustAPIProjectId: string;
  declare dustAPIDataSourceId: string;
  declare connectorId: string | null;
  declare connectorProvider: ConnectorProvider | null;
  declare workspaceId: ForeignKey<Workspace["id"]>;
  declare vaultId: ForeignKey<VaultModel["id"]>;

  declare editedByUser: NonAttribute<User>;
  declare vault: NonAttribute<VaultModel>;
  declare workspace: NonAttribute<Workspace>;
}

DataSourceModel.init(
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
    deletedAt: {
      type: DataTypes.DATE,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    assistantDefaultSelected: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    dustAPIProjectId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dustAPIDataSourceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    connectorId: {
      type: DataTypes.STRING,
    },
    connectorProvider: {
      type: DataTypes.STRING,
    },
  },
  {
    modelName: "data_source",
    sequelize: frontSequelize,
    indexes: [
      { fields: ["workspaceId", "name"], unique: true },
      { fields: ["workspaceId", "connectorProvider"] },
      { fields: ["workspaceId", "vaultId"] },
    ],
    paranoid: true,
  }
);
Workspace.hasMany(DataSourceModel, {
  as: "workspace",
  foreignKey: { name: "workspaceId", allowNull: false },
  onDelete: "CASCADE",
});
DataSourceModel.belongsTo(Workspace, {
  as: "workspace",
  foreignKey: { name: "workspaceId", allowNull: false },
});

DataSourceModel.belongsTo(User, {
  as: "editedByUser",
  foreignKey: { name: "editedByUserId", allowNull: false },
});

DataSourceModel.belongsTo(VaultModel, {
  foreignKey: { name: "vaultId", allowNull: false },
  onDelete: "RESTRICT",
});

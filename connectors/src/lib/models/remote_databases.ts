import type { CreationOptional } from "sequelize";
import { DataTypes } from "sequelize";

import { sequelizeConnection } from "@connectors/resources/storage";
import { ConnectorBaseModel } from "@connectors/resources/storage/wrappers/model_with_connectors";

type RemoteTablePermission = "selected" | "inherited"; // todo Daph move in next PR

export class RemoteDatabaseModel extends ConnectorBaseModel<RemoteDatabaseModel> {
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare internalId: string;
  declare name: string;
}
RemoteDatabaseModel.init(
  {
    internalId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
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
  },
  {
    sequelize: sequelizeConnection,
    modelName: "remote_databases",
    indexes: [{ fields: ["connectorId", "internalId"], unique: true }],
  }
);

export class RemoteSchemaModel extends ConnectorBaseModel<RemoteSchemaModel> {
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare internalId: string;
  declare name: string;

  declare databaseName: string;
}
RemoteSchemaModel.init(
  {
    internalId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    databaseName: {
      type: DataTypes.STRING,
      allowNull: false,
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
  },
  {
    sequelize: sequelizeConnection,
    modelName: "remote_schemas",
    indexes: [{ fields: ["connectorId", "internalId"], unique: true }],
  }
);

export class RemoteTableModel extends ConnectorBaseModel<RemoteTableModel> {
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare lastUpsertedAt: CreationOptional<Date> | null;

  declare internalId: string;
  declare name: string;

  declare schemaName: string;
  declare databaseName: string;
  declare permission: RemoteTablePermission;
}
RemoteTableModel.init(
  {
    internalId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    schemaName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    databaseName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    permission: {
      type: DataTypes.STRING,
      allowNull: false,
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
    lastUpsertedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: sequelizeConnection,
    modelName: "remote_tables",
    indexes: [{ fields: ["connectorId", "internalId"], unique: true }],
  }
);

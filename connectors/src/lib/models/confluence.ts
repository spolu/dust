import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";

import { Connector, sequelize_conn } from "@connectors/lib/models";

export class ConfluenceConnectorState extends Model<
  InferAttributes<ConfluenceConnectorState>,
  InferCreationAttributes<ConfluenceConnectorState>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // declare lastGarbageCollectionFinishTime?: Date;
  declare cloudId: string;
  declare url: string;

  declare connectorId: ForeignKey<Connector["id"]>;
}
ConfluenceConnectorState.init(
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
    cloudId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize: sequelize_conn,
    modelName: "confluence_connector_states",
    indexes: [{ fields: ["connectorId"], unique: true }],
  }
);
Connector.hasOne(ConfluenceConnectorState);

// ConfluenceSpaces stores the global spaces selected by the user to sync.
export class ConfluenceSpaces extends Model<
  InferAttributes<ConfluenceSpaces>,
  InferCreationAttributes<ConfluenceSpaces>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare connectorId: ForeignKey<Connector["id"]>;
  declare spaceId: string;
}
ConfluenceSpaces.init(
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
    connectorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    spaceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize: sequelize_conn,
    modelName: "confluence_spaces",
    indexes: [{ fields: ["connectorId", "spaceId"], unique: true }],
  }
);
Connector.hasOne(ConfluenceSpaces);

// ConfluencePages stores the pages.
export class ConfluencePages extends Model<
  InferAttributes<ConfluencePages>,
  InferCreationAttributes<ConfluencePages>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // declare lastSeenTs: Date;
  declare lastUpsertedTs?: Date;

  declare skipReason: string | null;

  declare parentId: string | null;
  declare pageId: string;
  declare spaceId: string;
  declare title: string;
  declare externalUrl: string;
  declare version: number;

  declare connectorId: ForeignKey<Connector["id"]> | null;
}
ConfluencePages.init(
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
    version: {
      type: DataTypes.SMALLINT,
      allowNull: false,
    },
    // lastSeenTs: {
    //   type: DataTypes.DATE,
    //   allowNull: false,
    // },
    lastUpsertedTs: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    skipReason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    parentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pageId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    spaceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    externalUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize: sequelize_conn,
    indexes: [
      { fields: ["connectorId", "pageId"], unique: true },
      { fields: ["connectorId"] },
      { fields: ["connectorId", "spaceId"] },
      // { fields: ["lastSeenTs"] },
      { fields: ["parentId"] },
    ],
    modelName: "confluence_pages",
  }
);
Connector.hasMany(ConfluencePages);

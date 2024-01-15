import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";

import { front_sequelize } from "@app/lib/databases";

export class AgentTablesQueryConfiguration extends Model<
  InferAttributes<AgentTablesQueryConfiguration>,
  InferCreationAttributes<AgentTablesQueryConfiguration>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare sId: string;
}

AgentTablesQueryConfiguration.init(
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
  },
  {
    modelName: "agent_tables_query_configuration",
    indexes: [
      {
        unique: true,
        fields: ["sId"],
        name: "agent_tables_query_configuration_s_id",
      },
    ],
    sequelize: front_sequelize,
  }
);

export class AgentTablesQueryConfigurationTable extends Model<
  InferAttributes<AgentTablesQueryConfigurationTable>,
  InferCreationAttributes<AgentTablesQueryConfigurationTable>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare dataSourceWorkspaceId: string;
  declare dataSourceId: string;
  declare tableId: string;

  declare tablesQueryConfigurationId: ForeignKey<
    AgentTablesQueryConfiguration["id"]
  >;
}

AgentTablesQueryConfigurationTable.init(
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

    dataSourceWorkspaceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dataSourceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tableId: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    tablesQueryConfigurationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    modelName: "agent_tables_query_configuration_table",
    indexes: [
      {
        unique: true,
        fields: [
          "dataSourceWorkspaceId",
          "dataSourceId",
          "tableId",
          "tablesQueryConfigurationId",
        ],
        name: "agent_tables_query_configuration_table_unique",
      },
    ],
    sequelize: front_sequelize,
  }
);

AgentTablesQueryConfiguration.hasMany(AgentTablesQueryConfigurationTable, {
  foreignKey: { name: "tablesQueryConfigurationId", allowNull: false },
  onDelete: "CASCADE",
});
AgentTablesQueryConfigurationTable.belongsTo(AgentTablesQueryConfiguration, {
  foreignKey: { name: "tablesQueryConfigurationId", allowNull: false },
  onDelete: "CASCADE",
});

export class AgentTablesQueryAction extends Model<
  InferAttributes<AgentTablesQueryAction>,
  InferCreationAttributes<AgentTablesQueryAction>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare tablesQueryConfigurationId: string;

  declare params: unknown | null;
  declare output: unknown | null;
}

AgentTablesQueryAction.init(
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

    tablesQueryConfigurationId: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    params: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    output: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    modelName: "agent_tables_query_action",
    sequelize: front_sequelize,
  }
);

AgentTablesQueryConfiguration.hasMany(AgentTablesQueryAction, {
  foreignKey: { name: "tablesQueryConfigurationId", allowNull: false },
  onDelete: "CASCADE",
});

AgentTablesQueryAction.belongsTo(AgentTablesQueryConfiguration, {
  foreignKey: { name: "tablesQueryConfigurationId", allowNull: false },
  onDelete: "CASCADE",
});

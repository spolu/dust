import type { CreationOptional } from "sequelize";
import { DataTypes } from "sequelize";

import { sequelizeConnection } from "@connectors/resources/storage";
import { ConnectorBaseModel } from "@connectors/resources/storage/wrappers/model_with_connectors";

function throwOnUnsafeInteger(value: number | null) {
  if (value !== null && !Number.isSafeInteger(value)) {
    throw new Error(`Value must be a safe integer: ${value}`);
  }
}

export class ZendeskTimestampCursor extends ConnectorBaseModel<ZendeskTimestampCursor> {
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // start date of the last successful sync
  declare timestampCursor: Date;
}

ZendeskTimestampCursor.init(
  {
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
    timestampCursor: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize: sequelizeConnection,
    modelName: "zendesk_timestamp_cursors",
    indexes: [{ fields: ["connectorId"], unique: true }],
  }
);

export class ZendeskConfiguration extends ConnectorBaseModel<ZendeskConfiguration> {
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare subdomain: string;
  declare retentionPeriodDays: number;
}

ZendeskConfiguration.init(
  {
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
    subdomain: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    retentionPeriodDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 180, // approximately 6 months
    },
  },
  {
    sequelize: sequelizeConnection,
    modelName: "zendesk_configurations",
    indexes: [{ fields: ["connectorId"], unique: true }],
    relationship: "hasOne",
  }
);

export class ZendeskBrand extends ConnectorBaseModel<ZendeskBrand> {
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare brandId: number;
  declare helpCenterPermission: "read" | "none";
  declare ticketsPermission: "read" | "none";

  declare name: string;
  declare url: string;
  declare subdomain: string;

  declare lastUpsertedTs?: Date;
}

ZendeskBrand.init(
  {
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
    brandId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: { throwOnUnsafeInteger },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    subdomain: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    helpCenterPermission: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ticketsPermission: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastUpsertedTs: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: sequelizeConnection,
    modelName: "zendesk_brands",
    indexes: [
      {
        fields: ["connectorId", "brandId"],
        unique: true,
        name: "zendesk_brands_connector_brand_idx",
      },
      { fields: ["connectorId"] },
    ],
  }
);

export class ZendeskCategory extends ConnectorBaseModel<ZendeskCategory> {
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare categoryId: number;
  declare brandId: number;
  declare permission: "read" | "none";

  declare name: string;
  declare description: string | null;
  declare url: string;

  declare lastUpsertedTs?: Date;
}

ZendeskCategory.init(
  {
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
    categoryId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: { throwOnUnsafeInteger },
    },
    brandId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: { throwOnUnsafeInteger },
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    permission: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastUpsertedTs: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: sequelizeConnection,
    modelName: "zendesk_categories",
    indexes: [
      {
        fields: ["connectorId", "brandId", "categoryId"],
        unique: true,
        name: "zendesk_categories_connector_brand_category_idx",
      },
      {
        fields: ["connectorId", "brandId"],
        name: "zendesk_categories_connector_brand_idx",
      },
      { fields: ["connectorId"] },
    ],
  }
);

export class ZendeskArticle extends ConnectorBaseModel<ZendeskArticle> {
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare articleId: number;
  declare brandId: number;
  declare categoryId: number;
  declare permission: "read" | "none";

  declare name: string;
  declare url: string;

  declare lastUpsertedTs: Date | null;
}

ZendeskArticle.init(
  {
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
    articleId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: { throwOnUnsafeInteger },
    },
    brandId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: { throwOnUnsafeInteger },
    },
    categoryId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: { throwOnUnsafeInteger },
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    permission: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastUpsertedTs: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: sequelizeConnection,
    modelName: "zendesk_articles",
    indexes: [
      {
        fields: ["connectorId", "brandId", "articleId"],
        unique: true,
        name: "zendesk_articles_connector_brand_article_idx",
      },
      {
        fields: ["connectorId", "brandId", "categoryId"],
        name: "zendesk_articles_connector_brand_category_idx",
      },
      {
        fields: ["connectorId", "brandId"],
        name: "zendesk_articles_connector_brand_idx",
      },
      { fields: ["connectorId"] },
    ],
  }
);

export class ZendeskTicket extends ConnectorBaseModel<ZendeskTicket> {
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare ticketId: number;
  declare brandId: number;
  declare permission: "read" | "none";

  declare subject: string;
  declare url: string;

  declare ticketUpdatedAt: Date;
  declare lastUpsertedTs: Date;
}

ZendeskTicket.init(
  {
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
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ticketId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: { throwOnUnsafeInteger },
    },
    brandId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: { throwOnUnsafeInteger },
    },
    permission: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ticketUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    lastUpsertedTs: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: sequelizeConnection,
    modelName: "zendesk_tickets",
    indexes: [
      {
        fields: ["connectorId", "brandId", "ticketId"],
        unique: true,
        name: "zendesk_tickets_connector_brand_ticket_idx",
      },
      {
        fields: ["connectorId", "brandId"],
        name: "zendesk_tickets_connector_brand_idx",
      },
      { fields: ["connectorId"] },
    ],
  }
);

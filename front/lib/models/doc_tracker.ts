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
import { DataSourceModel } from "@app/lib/resources/storage/models/data_source";
import { DataSourceViewModel } from "@app/lib/resources/storage/models/data_source_view";
import { SpaceModel } from "@app/lib/resources/storage/models/spaces";
import { SoftDeletableModel } from "@app/lib/resources/storage/wrappers";

export class TrackerModel extends SoftDeletableModel<TrackerModel> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare status: "active" | "inactive";

  declare modelId: string;
  declare providerId: string;
  declare temperature: number;

  declare prompt: string | null;

  declare frequency: string | null;

  declare recipients: string[] | null;

  declare workspaceId: ForeignKey<Workspace["id"]>;
  declare spaceId: ForeignKey<SpaceModel["id"]>;
  declare userId: ForeignKey<User["id"]> | null; // If a user is deleted, the tracker should still be available

  declare workspace: NonAttribute<Workspace>;
  declare space: NonAttribute<SpaceModel>;
  declare user: NonAttribute<User> | null;
}

TrackerModel.init(
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
    deletedAt: {
      type: DataTypes.DATE,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "active",
    },
    modelId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    providerId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    temperature: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.7,
    },
    prompt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    frequency: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    recipients: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
  },
  {
    modelName: "tracker",
    sequelize: frontSequelize,
    indexes: [{ fields: ["workspaceId"] }],
  }
);

Workspace.hasMany(TrackerModel, {
  foreignKey: { allowNull: false },
  onDelete: "RESTRICT",
});

TrackerModel.belongsTo(Workspace, {
  foreignKey: { allowNull: false },
});

SpaceModel.hasMany(TrackerModel, {
  foreignKey: { allowNull: false },
  onDelete: "RESTRICT",
});

TrackerModel.belongsTo(SpaceModel, {
  foreignKey: { allowNull: false },
});

User.hasMany(TrackerModel, {
  foreignKey: { allowNull: true },
  onDelete: "RESTRICT",
});

TrackerModel.belongsTo(User, {
  foreignKey: { allowNull: true },
});

export class TrackerDataSouceConfigurationModel extends SoftDeletableModel<TrackerDataSouceConfigurationModel> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare scope: "maintained" | "watched";
  declare parentsIn: string[] | null;
  declare parentsNotIn: string[] | null;

  declare trackerId: ForeignKey<TrackerModel["id"]>;

  declare dataSourceId: ForeignKey<DataSourceModel["id"]>;
  declare dataSourceViewId: ForeignKey<DataSourceViewModel["id"]>;

  declare tracker: NonAttribute<TrackerModel>;
  declare dataSource: NonAttribute<DataSourceModel>;
  declare dataSourceView: NonAttribute<DataSourceViewModel>;
}

TrackerDataSouceConfigurationModel.init(
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
    deletedAt: {
      type: DataTypes.DATE,
    },
    scope: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    parentsIn: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    parentsNotIn: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
  },
  {
    modelName: "tracker_data_source_configuration",
    sequelize: frontSequelize,
    indexes: [{ fields: ["trackerId"] }],
  }
);

TrackerModel.hasMany(TrackerDataSouceConfigurationModel, {
  foreignKey: { allowNull: false },
  onDelete: "RESTRICT",
});
TrackerDataSouceConfigurationModel.belongsTo(TrackerModel, {
  foreignKey: { allowNull: false },
});

DataSourceModel.hasMany(TrackerDataSouceConfigurationModel, {
  foreignKey: { allowNull: false },
  onDelete: "RESTRICT",
});
TrackerDataSouceConfigurationModel.belongsTo(DataSourceModel, {
  foreignKey: { allowNull: false },
});

DataSourceViewModel.hasMany(TrackerDataSouceConfigurationModel, {
  foreignKey: { allowNull: false },
  onDelete: "RESTRICT",
});
TrackerDataSouceConfigurationModel.belongsTo(DataSourceViewModel, {
  foreignKey: { allowNull: false },
});

export class TrackerGenerationModel extends SoftDeletableModel<TrackerGenerationModel> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare content: string;
  declare thinking: string | null;

  declare trackerId: ForeignKey<TrackerModel["id"]>;
  declare dataSourceId: ForeignKey<DataSourceModel["id"]>;
  declare documentId: string;

  declare tracker: NonAttribute<TrackerModel>;
}

TrackerGenerationModel.init(
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
    deletedAt: {
      type: DataTypes.DATE,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    thinking: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    documentId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    modelName: "tracker_generation",
    sequelize: frontSequelize,
    indexes: [{ fields: ["trackerId"] }],
  }
);

TrackerModel.hasMany(TrackerGenerationModel, {
  foreignKey: { allowNull: false },
  onDelete: "RESTRICT",
});
TrackerGenerationModel.belongsTo(TrackerModel, {
  foreignKey: { allowNull: false },
});

DataSourceModel.hasMany(TrackerGenerationModel, {
  foreignKey: { allowNull: false },
  onDelete: "RESTRICT",
});
TrackerGenerationModel.belongsTo(DataSourceModel, {
  foreignKey: { allowNull: false },
});

// TODO(DOC_TRACKER) Delete models below this line
// They will be replaced by the new models

export class TrackedDocument extends Model<
  InferAttributes<TrackedDocument>,
  InferCreationAttributes<TrackedDocument>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare documentId: string;
  declare trackingEnabledAt: Date | null;

  declare userId: ForeignKey<User["id"]>;
  declare dataSourceId: ForeignKey<DataSourceModel["id"]>;
}

TrackedDocument.init(
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
    documentId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    trackingEnabledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    modelName: "tracked_document",
    sequelize: frontSequelize,
    indexes: [
      { fields: ["userId", "dataSourceId", "documentId"], unique: true },
      { fields: ["dataSourceId"] },
    ],
  }
);

DataSourceModel.hasMany(TrackedDocument, {
  foreignKey: { allowNull: false },
  onDelete: "CASCADE",
});
User.hasMany(TrackedDocument, {
  foreignKey: { allowNull: false },
  onDelete: "CASCADE",
});

export class DocumentTrackerChangeSuggestion extends Model<
  InferAttributes<DocumentTrackerChangeSuggestion>,
  InferCreationAttributes<DocumentTrackerChangeSuggestion>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare suggestion: string;
  declare reason: string | null;
  declare status: "pending" | "done" | "rejected";

  declare trackedDocumentId: ForeignKey<TrackedDocument["id"]>;
  declare sourceDataSourceId: ForeignKey<DataSourceModel["id"]>;
  declare sourceDocumentId: string;
}

DocumentTrackerChangeSuggestion.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
    suggestion: { type: DataTypes.TEXT, allowNull: false },
    //@ts-expect-error TODO remove once propagated
    suggestionTitle: { type: DataTypes.TEXT, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },
    sourceDocumentId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    modelName: "document_tracker_change_suggestion",
    sequelize: frontSequelize,
    indexes: [{ fields: ["trackedDocumentId"] }],
  }
);

TrackedDocument.hasMany(DocumentTrackerChangeSuggestion, {
  foreignKey: { allowNull: false },
  onDelete: "CASCADE",
});
DataSourceModel.hasMany(DocumentTrackerChangeSuggestion, {
  foreignKey: { allowNull: false, name: "sourceDataSourceId" },
  onDelete: "CASCADE",
});

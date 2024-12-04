CREATE TABLE IF NOT EXISTS "trackers" (
    "id" SERIAL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "status" VARCHAR(255) NOT NULL DEFAULT 'active',
    "modelId" VARCHAR(255) NOT NULL,
    "providerId" VARCHAR(255) NOT NULL,
    "temperature" FLOAT NOT NULL DEFAULT '0.7',
    "prompt" TEXT,
    "frequency" VARCHAR(255),
    "recipients" VARCHAR(255)[],
    "workspaceId" INTEGER NOT NULL REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "spaceId" INTEGER NOT NULL REFERENCES "vaults" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "userId" INTEGER REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    PRIMARY KEY ("id")
);
CREATE INDEX "trackers_workspace_id" ON "trackers" ("workspaceId");

CREATE TABLE IF NOT EXISTS "tracker_data_source_configurations" (
    "id" SERIAL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "scope" VARCHAR(255) NOT NULL,
    "parentsIn" VARCHAR(255)[],
    "parentsNotIn" VARCHAR(255)[],
    "trackerId" INTEGER NOT NULL REFERENCES "trackers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "dataSourceId" INTEGER NOT NULL REFERENCES "data_sources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "dataSourceViewId" INTEGER NOT NULL REFERENCES "data_source_views" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    PRIMARY KEY ("id")
);
CREATE INDEX "tracker_data_source_configurations_tracker_id" ON "tracker_data_source_configurations" ("trackerId");

CREATE TABLE IF NOT EXISTS "tracker_generations" (
    "id" SERIAL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "content" TEXT NOT NULL,
    "thinking" TEXT,
    "documentId" VARCHAR(255) NOT NULL,
    "trackerId" INTEGER NOT NULL REFERENCES "trackers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "dataSourceId" INTEGER NOT NULL REFERENCES "data_sources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    PRIMARY KEY ("id")
);
CREATE INDEX "tracker_generations_tracker_id" ON "tracker_generations" ("trackerId");

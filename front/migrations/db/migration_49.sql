-- Migration created on Jul 29, 2024
CREATE TABLE IF NOT EXISTS "data_source_views" ("id"  SERIAL , "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "name" VARCHAR(255) NOT NULL, "parentsIn" VARCHAR(255)[] NOT NULL, "workspaceId" INTEGER NOT NULL REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE, "vaultId" INTEGER NOT NULL REFERENCES "vaults" ("id") ON DELETE RESTRICT ON UPDATE CASCADE, "dataSourceId" INTEGER NOT NULL REFERENCES "data_sources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE, PRIMARY KEY ("id"));
CREATE INDEX "data_source_views_workspace_id_id" ON "data_source_views" ("workspaceId", "id");
CREATE INDEX "data_source_views_workspace_id_vault_id" ON "data_source_views" ("workspaceId", "vaultId");
CREATE INDEX "data_source_views_workspace_id_data_source_id" ON "data_source_views" ("workspaceId", "dataSourceId");

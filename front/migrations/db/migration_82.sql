-- Migration created on Sep 16, 2024
ALTER TABLE "public"."agent_tables_query_configuration_tables"
ADD COLUMN "dataSourceId" INTEGER REFERENCES "data_sources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "public"."agent_tables_query_configuration_tables"
SET
  "dataSourceId" = "dataSourceIdNew";
-- Migration created on Oct 09, 2024
ALTER TABLE "notion_connector_block_cache_entries"
ALTER COLUMN "childDatabaseTitle"
DROP NOT NULL;

ALTER TABLE "notion_connector_block_cache_entries"
ALTER COLUMN "childDatabaseTitle"
DROP DEFAULT;

ALTER TABLE "notion_connector_block_cache_entries"
ALTER COLUMN "childDatabaseTitle" TYPE TEXT;
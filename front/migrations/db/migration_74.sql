<<<<<<< HEAD
-- Migration created on Aug 30, 2024
UPDATE "public"."data_source_views"
SET
    "editedByUserId" = "data_sources"."editedByUserId"
FROM "public"."data_sources"
WHERE
    "data_sources"."id" = "data_source_views"."dataSourceId"
    AND "data_source_views"."editedByUserId" IS NULL
    AND "data_sources"."editedByUserId" IS NOT NULL
=======
-- Migration created on Sep 03, 2024
ALTER TABLE "public"."agent_configurations" ADD COLUMN "groupIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
>>>>>>> main

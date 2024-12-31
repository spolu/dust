-- Migration created on Dec 31, 2024
ALTER TABLE "user_metadata" ALTER COLUMN "userId" SET NOT NULL;ALTER TABLE "user_metadata"  ADD FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workspace_has_domains" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "workspace_has_domains"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memberships" ALTER COLUMN "userId" SET NOT NULL;ALTER TABLE "memberships"  ADD FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memberships" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "memberships"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "membership_invitations" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "membership_invitations"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "apps" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "apps"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "datasets" ALTER COLUMN "appId" SET NOT NULL;ALTER TABLE "datasets"  ADD FOREIGN KEY ("appId") REFERENCES "apps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "datasets" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "datasets"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "providers" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "providers"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clones" ALTER COLUMN "fromId" SET NOT NULL;ALTER TABLE "clones"  ADD FOREIGN KEY ("fromId") REFERENCES "apps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clones" ALTER COLUMN "toId" SET NOT NULL;ALTER TABLE "clones"  ADD FOREIGN KEY ("toId") REFERENCES "apps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "keys" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "keys"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dust_app_secrets" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "dust_app_secrets"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "conversations"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_participants" ALTER COLUMN "conversationId" SET NOT NULL;ALTER TABLE "conversation_participants"  ADD FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_participants" ALTER COLUMN "userId" SET NOT NULL;ALTER TABLE "conversation_participants"  ADD FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "data_sources" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "data_sources"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "runs" ALTER COLUMN "appId" SET NOT NULL;ALTER TABLE "runs"  ADD FOREIGN KEY ("appId") REFERENCES "apps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "runs" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "runs"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "run_usages" ALTER COLUMN "runId" SET NOT NULL;ALTER TABLE "run_usages"  ADD FOREIGN KEY ("runId") REFERENCES "runs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_tracker_change_suggestions" ALTER COLUMN "sourceDataSourceId" SET NOT NULL;ALTER TABLE "document_tracker_change_suggestions"  ADD FOREIGN KEY ("sourceDataSourceId") REFERENCES "data_sources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ALTER COLUMN "planId" SET NOT NULL;ALTER TABLE "subscriptions"  ADD FOREIGN KEY ("planId") REFERENCES "plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "subscriptions"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_configurations" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "agent_configurations"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_configurations" ALTER COLUMN "authorId" SET NOT NULL;ALTER TABLE "agent_configurations"  ADD FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_user_relations" ALTER COLUMN "userId" SET NOT NULL;ALTER TABLE "agent_user_relations"  ADD FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_user_relations" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "agent_user_relations"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "global_agent_settings" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "global_agent_settings"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_tables_query_configuration_tables" ALTER COLUMN "tablesQueryConfigurationId" SET NOT NULL;ALTER TABLE "agent_tables_query_configuration_tables"  ADD FOREIGN KEY ("tablesQueryConfigurationId") REFERENCES "agent_tables_query_configurations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_data_source_configurations"  ADD FOREIGN KEY ("retrievalConfigurationId") REFERENCES "agent_retrieval_configurations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_data_source_configurations"  ADD FOREIGN KEY ("processConfigurationId") REFERENCES "agent_process_configurations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ALTER COLUMN "conversationId" SET NOT NULL;ALTER TABLE "messages"  ADD FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "message_reactions" ALTER COLUMN "messageId" SET NOT NULL;ALTER TABLE "message_reactions"  ADD FOREIGN KEY ("messageId") REFERENCES "messages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentions" ALTER COLUMN "messageId" SET NOT NULL;ALTER TABLE "mentions"  ADD FOREIGN KEY ("messageId") REFERENCES "messages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feature_flags" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "feature_flags"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "labs_transcripts_configurations" ALTER COLUMN "workspaceId" SET NOT NULL;ALTER TABLE "labs_transcripts_configurations"  ADD FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

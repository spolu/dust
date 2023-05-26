import { Transaction } from "sequelize";

import { createGithubConnector } from "@connectors/connectors/github";
import {
  cleanupNotionConnector,
  createNotionConnector,
  fullResyncNotionConnector,
  resumeNotionConnector,
  stopNotionConnector,
} from "@connectors/connectors/notion";
import { cleanupSlackConnector } from "@connectors/connectors/slack";
import { createSlackConnector } from "@connectors/connectors/slack";
import { launchSlackSyncWorkflow } from "@connectors/connectors/slack/temporal/client";
import { Ok, Result } from "@connectors/lib/result";
import logger from "@connectors/logger/logger";
import { ConnectorProvider } from "@connectors/types/connector";
import { DataSourceConfig } from "@connectors/types/data_source_config";

export type ConnectorCreatorParams =
  | {
      nangoConnectionId: string;
    }
  | { githubInstallationId: string };

type ConnectorCreator = (
  dataSourceConfig: DataSourceConfig,
  connectionId: string
) => Promise<Result<string, Error>>;

export const CREATE_CONNECTOR_BY_TYPE: Record<
  ConnectorProvider,
  ConnectorCreator
> = {
  slack: createSlackConnector,
  notion: createNotionConnector,
  github: createGithubConnector,
};

type ConnectorStopper = (connectorId: string) => Promise<Result<string, Error>>;

export const STOP_CONNECTOR_BY_TYPE: Record<
  ConnectorProvider,
  ConnectorStopper
> = {
  slack: async (connectorId: string) => {
    logger.info(
      `Stopping Slack connector is a no-op. ConnectorId: ${connectorId}`
    );
    return new Ok(connectorId);
  },
  github: async (connectorId: string) => {
    logger.info(
      `Stopping Github connector is a no-op. ConnectorId: ${connectorId}`
    );
    return new Ok(connectorId);
  },
  notion: stopNotionConnector,
};

// Should cleanup any state/resources associated with the connector
type ConnectorCleaner = (
  connectorId: string,
  transaction: Transaction
) => Promise<Result<void, Error>>;

export const CLEAN_CONNECTOR_BY_TYPE: Record<
  ConnectorProvider,
  ConnectorCleaner
> = {
  slack: cleanupSlackConnector,
  notion: cleanupNotionConnector,
  github: async (connectorId: string) => {
    logger.info(
      `Cleaning up Github connector is a no-op. ConnectorId: ${connectorId}`
    );
    return new Ok(undefined);
  },
};

type ConnectorResumer = (connectorId: string) => Promise<Result<string, Error>>;

export const RESUME_CONNECTOR_BY_TYPE: Record<
  ConnectorProvider,
  ConnectorResumer
> = {
  slack: async (connectorId: string) => {
    logger.info(
      `Resuming Slack connector is a no-op. ConnectorId: ${connectorId}`
    );
    return new Ok(connectorId);
  },
  notion: resumeNotionConnector,
  github: async (connectorId: string) => {
    logger.info(
      `Resuming Github connector is a no-op. ConnectorId: ${connectorId}`
    );
    return new Ok(connectorId);
  },
};

type SyncConnector = (connectorId: string) => Promise<Result<string, Error>>;

export const SYNC_CONNECTOR_BY_TYPE: Record<ConnectorProvider, SyncConnector> =
  {
    slack: launchSlackSyncWorkflow,
    notion: fullResyncNotionConnector,
    github: async (connectorId: string) => {
      logger.info(
        `Syncing Github connector is a no-op. ConnectorId: ${connectorId}`
      );
      return new Ok(connectorId);
    },
  };

import { Transaction } from "sequelize";

import {
  cleanupGithubConnector,
  createGithubConnector,
  fullResyncGithubConnector,
  resumeGithubConnector,
  retrieveGithubConnectorPermissions,
  stopGithubConnector,
  updateGithubConnector,
} from "@connectors/connectors/github";
import {
  cleanupGoogleDriveConnector,
  createGoogleDriveConnector,
  retrieveGoogleDriveConnectorPermissions,
  setGoogleDriveConnectorPermissions,
  updateGoogleDriveConnector,
} from "@connectors/connectors/google_drive";
import { launchGoogleDriveFullSyncWorkflow } from "@connectors/connectors/google_drive/temporal/client";
import {
  cleanupNotionConnector,
  createNotionConnector,
  fullResyncNotionConnector,
  resumeNotionConnector,
  retrieveNotionConnectorPermissions,
  stopNotionConnector,
  updateNotionConnector,
} from "@connectors/connectors/notion";
import {
  cleanupSlackConnector,
  createSlackConnector,
  retrieveSlackConnectorPermissions,
  setSlackConnectorPermissions,
  updateSlackConnector,
} from "@connectors/connectors/slack";
import { launchSlackSyncWorkflow } from "@connectors/connectors/slack/temporal/client";
import { ModelId } from "@connectors/lib/models";
import { Err, Ok, Result } from "@connectors/lib/result";
import logger from "@connectors/logger/logger";
import { ConnectorProvider } from "@connectors/types/connector";
import { DataSourceConfig } from "@connectors/types/data_source_config";
import { ConnectorsAPIErrorResponse } from "@connectors/types/errors";
import {
  ConnectorPermission,
  ConnectorResource,
} from "@connectors/types/resources";

import { getBotEnabled, toggleSlackbot } from "./slack/bot";

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
  google_drive: createGoogleDriveConnector,
};

type ConnectorUpdater = (
  connectorId: ModelId,
  params: {
    connectionId?: string | null;
    defaultNewResourcePermission?: ConnectorPermission | null;
  }
) => Promise<Result<string, ConnectorsAPIErrorResponse>>;

export const UPDATE_CONNECTOR_BY_TYPE: Record<
  ConnectorProvider,
  ConnectorUpdater
> = {
  slack: updateSlackConnector,
  notion: updateNotionConnector,
  github: updateGithubConnector,
  google_drive: updateGoogleDriveConnector,
};

type ConnectorStopper = (connectorId: string) => Promise<Result<string, Error>>;

export const STOP_CONNECTOR_BY_TYPE: Record<
  ConnectorProvider,
  ConnectorStopper
> = {
  slack: async (connectorId: string) => {
    logger.info({ connectorId }, `Stopping Slack connector is a no-op.`);
    return new Ok(connectorId);
  },
  github: stopGithubConnector,
  notion: stopNotionConnector,
  google_drive: async (connectorId: string) => {
    logger.info({ connectorId }, `Stopping Google Drive connector is a no-op.`);
    return new Ok(connectorId);
  },
};

// Should cleanup any state/resources associated with the connector
type ConnectorCleaner = (
  connectorId: string,
  transaction: Transaction,
  force: boolean
) => Promise<Result<void, Error>>;

export const CLEAN_CONNECTOR_BY_TYPE: Record<
  ConnectorProvider,
  ConnectorCleaner
> = {
  slack: cleanupSlackConnector,
  notion: cleanupNotionConnector,
  github: cleanupGithubConnector,
  google_drive: cleanupGoogleDriveConnector,
};

type ConnectorResumer = (connectorId: string) => Promise<Result<string, Error>>;

export const RESUME_CONNECTOR_BY_TYPE: Record<
  ConnectorProvider,
  ConnectorResumer
> = {
  slack: async (connectorId: string) => {
    logger.info({ connectorId }, `Resuming Slack connector is a no-op.`);
    return new Ok(connectorId);
  },
  notion: resumeNotionConnector,
  github: resumeGithubConnector,
  google_drive: async (connectorId: string) => {
    throw new Error(`Not implemented ${connectorId}`);
  },
};

type BotToggler = (
  connectorId: ModelId,
  botEnabled: boolean
) => Promise<Result<void, Error>>;

const toggleBotNotImplemented = async (
  connectorId: ModelId
): Promise<Result<void, Error>> => {
  return new Err(
    new Error(`Toggling bot for connector ${connectorId} is not implemented.`)
  );
};

export const TOGGLE_BOT_BY_TYPE: Record<ConnectorProvider, BotToggler> = {
  slack: toggleSlackbot,
  notion: toggleBotNotImplemented,
  github: toggleBotNotImplemented,
  google_drive: toggleBotNotImplemented,
};

type BotEnabledGetter = (
  connectorId: ModelId
) => Promise<Result<boolean, Error>>;

const getBotEnabledNotImplemented = async (
  connectorId: ModelId
): Promise<Result<boolean, Error>> => {
  return new Err(
    new Error(
      `Getting botEnabled for connector ${connectorId} is not implemented.`
    )
  );
};

export const GET_BOT_ENABLED_BY_TYPE: Record<
  ConnectorProvider,
  BotEnabledGetter
> = {
  slack: getBotEnabled,
  notion: getBotEnabledNotImplemented,
  github: getBotEnabledNotImplemented,
  google_drive: getBotEnabledNotImplemented,
};

type SyncConnector = (
  connectorId: string,
  fromTs: number | null
) => Promise<Result<string, Error>>;

export const SYNC_CONNECTOR_BY_TYPE: Record<ConnectorProvider, SyncConnector> =
  {
    slack: launchSlackSyncWorkflow,
    notion: fullResyncNotionConnector,
    github: fullResyncGithubConnector,
    google_drive: launchGoogleDriveFullSyncWorkflow,
  };

type ConnectorPermissionRetriever = (
  connectorId: ModelId,
  parentInternalId: string | null,
  filterPermission: ConnectorPermission | null
) => Promise<Result<ConnectorResource[], Error>>;

export const RETRIEVE_CONNECTOR_PERMISSIONS_BY_TYPE: Record<
  ConnectorProvider,
  ConnectorPermissionRetriever
> = {
  slack: retrieveSlackConnectorPermissions,
  github: retrieveGithubConnectorPermissions,
  notion: retrieveNotionConnectorPermissions,
  google_drive: retrieveGoogleDriveConnectorPermissions,
};

type ConnectorPermissionSetter = (
  connectorId: ModelId,
  // internalId -> "read" | "write" | "read_write" | "none"
  permissions: Record<string, ConnectorPermission>
) => Promise<Result<void, Error>>;

export const SET_CONNECTOR_PERMISSIONS_BY_TYPE: Record<
  ConnectorProvider,
  ConnectorPermissionSetter
> = {
  slack: setSlackConnectorPermissions,
  notion: async () => {
    return new Err(
      new Error(`Setting Notion connector permissions is not implemented yet.`)
    );
  },
  github: async () => {
    return new Err(
      new Error(`Setting Github connector permissions is not implemented yet.`)
    );
  },
  google_drive: setGoogleDriveConnectorPermissions,
};

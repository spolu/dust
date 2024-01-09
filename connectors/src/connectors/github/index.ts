import { ModelId } from "@dust-tt/types";

import {
  getRepo,
  getReposPage,
  validateInstallationId,
} from "@connectors/connectors/github/lib/github_api";
import { launchGithubFullSyncWorkflow } from "@connectors/connectors/github/temporal/client";
import { Connector, sequelize_conn } from "@connectors/lib/models";
import {
  GithubConnectorState,
  GithubDiscussion,
  GithubIssue,
} from "@connectors/lib/models/github";
import { Err, Ok, Result } from "@connectors/lib/result";
import mainLogger from "@connectors/logger/logger";
import { DataSourceConfig } from "@connectors/types/data_source_config";
import { ConnectorsAPIErrorResponse } from "@connectors/types/errors";
import {
  ConnectorPermission,
  ConnectorResource,
} from "@connectors/types/resources";

import { ConnectorPermissionRetriever } from "../interface";

type GithubInstallationId = string;

const logger = mainLogger.child({ provider: "github" });

export async function createGithubConnector(
  dataSourceConfig: DataSourceConfig,
  connectionId: GithubInstallationId
): Promise<Result<string, Error>> {
  const githubInstallationId = connectionId;

  if (!(await validateInstallationId(githubInstallationId))) {
    return new Err(new Error("Github installation id is invalid"));
  }
  try {
    const connector = await sequelize_conn.transaction(async (transaction) => {
      const connector = await Connector.create(
        {
          type: "github",
          connectionId: githubInstallationId,
          workspaceAPIKey: dataSourceConfig.workspaceAPIKey,
          workspaceId: dataSourceConfig.workspaceId,
          dataSourceName: dataSourceConfig.dataSourceName,
        },
        { transaction }
      );
      await GithubConnectorState.create(
        {
          connectorId: connector.id,
          webhooksEnabledAt: new Date(),
          codeSyncEnabled: false,
        },
        { transaction }
      );

      return connector;
    });
    await launchGithubFullSyncWorkflow({
      connectorId: connector.id.toString(),
      syncCodeOnly: false,
    });
    return new Ok(connector.id.toString());
  } catch (err) {
    logger.error({ error: err }, "Error creating github connector");

    return new Err(err as Error);
  }
}

export async function updateGithubConnector(
  connectorId: ModelId,
  {
    connectionId,
  }: {
    connectionId?: string | null;
  }
): Promise<Result<string, ConnectorsAPIErrorResponse>> {
  const c = await Connector.findOne({
    where: {
      id: connectorId,
    },
  });
  if (!c) {
    logger.error({ connectorId }, "Connector not found");
    return new Err({
      error: {
        message: "Connector not found",
        type: "connector_not_found",
      },
    });
  }

  if (connectionId) {
    const oldGithubInstallationId = c.connectionId;
    const newGithubInstallationId = connectionId;

    if (oldGithubInstallationId !== newGithubInstallationId) {
      return new Err({
        error: {
          type: "connector_oauth_target_mismatch",
          message: "Cannot change the Installation Id of a Github Data Source",
        },
      });
    }

    await c.update({ connectionId });
  }

  return new Ok(c.id.toString());
}

export async function stopGithubConnector(
  connectorId: string
): Promise<Result<string, Error>> {
  try {
    const connector = await Connector.findOne({
      where: {
        id: connectorId,
      },
    });

    if (!connector) {
      return new Err(new Error("Connector not found"));
    }

    const connectorState = await GithubConnectorState.findOne({
      where: {
        connectorId: connector.id,
      },
    });

    if (!connectorState) {
      return new Err(new Error("Connector state not found"));
    }

    if (!connectorState.webhooksEnabledAt) {
      return new Err(new Error("Connector is already stopped"));
    }

    await connectorState.update({
      webhooksEnabledAt: null,
    });

    return new Ok(connector.id.toString());
  } catch (err) {
    return new Err(err as Error);
  }
}

export async function resumeGithubConnector(
  connectorId: string
): Promise<Result<string, Error>> {
  try {
    const connector = await Connector.findOne({
      where: {
        id: connectorId,
      },
    });

    if (!connector) {
      return new Err(new Error("Connector not found"));
    }

    const connectorState = await GithubConnectorState.findOne({
      where: {
        connectorId: connector.id,
      },
    });

    if (!connectorState) {
      return new Err(new Error("Connector state not found"));
    }

    if (connectorState.webhooksEnabledAt) {
      return new Err(new Error("Connector is not stopped"));
    }

    await connectorState.update({
      webhooksEnabledAt: new Date(),
    });

    await launchGithubFullSyncWorkflow({
      connectorId: connector.id.toString(),
      syncCodeOnly: false,
    });

    return new Ok(connector.id.toString());
  } catch (err) {
    return new Err(err as Error);
  }
}

export async function fullResyncGithubConnector(
  connectorId: string,
  fromTs: number | null
): Promise<Result<string, Error>> {
  if (fromTs) {
    return new Err(
      new Error("Github connector does not support partial resync")
    );
  }

  try {
    await launchGithubFullSyncWorkflow({
      connectorId: connectorId,
      syncCodeOnly: false,
    });
    return new Ok(connectorId);
  } catch (err) {
    return new Err(err as Error);
  }
}

export async function cleanupGithubConnector(
  connectorId: string
): Promise<Result<void, Error>> {
  return sequelize_conn.transaction(async (transaction) => {
    try {
      const connector = await Connector.findOne({
        where: {
          id: connectorId,
        },
        transaction,
      });

      if (!connector) {
        logger.error({ connectorId }, "Connector not found");
        return new Err(new Error("Connector not found"));
      }

      await GithubIssue.destroy({
        where: {
          connectorId: connector.id,
        },
        transaction,
      });
      await GithubConnectorState.destroy({
        where: {
          connectorId: connector.id,
        },
        transaction,
      });
      await connector.destroy({
        transaction: transaction,
      });
      return new Ok(undefined);
    } catch (err) {
      logger.error(
        { connectorId, error: err },
        "Error cleaning up github connector"
      );
      return new Err(err as Error);
    }
  });
}

export async function retrieveGithubConnectorPermissions({
  connectorId,
  parentInternalId,
}: Parameters<ConnectorPermissionRetriever>[0]): Promise<
  Result<ConnectorResource[], Error>
> {
  const c = await Connector.findOne({
    where: {
      id: connectorId,
    },
  });
  if (!c) {
    logger.error({ connectorId }, "Connector not found");
    return new Err(new Error("Connector not found"));
  }

  const githubInstallationId = c.connectionId;

  if (!parentInternalId) {
    // No parentInternalId: we return the repositories.

    let resources: ConnectorResource[] = [];
    let pageNumber = 1; // 1-indexed
    for (;;) {
      const page = await getReposPage(githubInstallationId, pageNumber);
      pageNumber += 1;
      if (page.length === 0) {
        break;
      }

      resources = resources.concat(
        page.map((repo) => ({
          provider: c.type,
          internalId: repo.id.toString(),
          parentInternalId: null,
          type: "folder",
          title: repo.name,
          sourceUrl: repo.url,
          expandable: true,
          permission: "read" as ConnectorPermission,
          dustDocumentId: null,
          lastUpdatedAt: null,
        }))
      );
    }

    resources.sort((a, b) => {
      return a.title.localeCompare(b.title);
    });

    return new Ok(resources);
  } else {
    // If parentInternalId is set this means we are fetching the children of a repository. For now
    // we only support issues and discussions.
    const repoId = parseInt(parentInternalId, 10);
    if (isNaN(repoId)) {
      return new Err(new Error(`Invalid repoId: ${parentInternalId}`));
    }

    const [latestDiscussion, latestIssue, repo] = await Promise.all([
      (async () => {
        return await GithubDiscussion.findOne({
          where: {
            connectorId: c.id,
            repoId: repoId.toString(),
          },
          limit: 1,
          order: [["updatedAt", "DESC"]],
        });
      })(),
      (async () => {
        return await GithubIssue.findOne({
          where: {
            connectorId: c.id,
            repoId: repoId.toString(),
          },
          limit: 1,
          order: [["updatedAt", "DESC"]],
        });
      })(),
      getRepo(githubInstallationId, repoId),
    ]);

    const resources: ConnectorResource[] = [];

    if (latestIssue) {
      resources.push({
        provider: c.type,
        internalId: `${repoId}-issues`,
        parentInternalId,
        type: "database",
        title: "Issues",
        sourceUrl: repo.url + "/issues",
        expandable: false,
        permission: "read" as ConnectorPermission,
        dustDocumentId: null,
        lastUpdatedAt: latestIssue.updatedAt.getTime(),
      });
    }

    if (latestDiscussion) {
      resources.push({
        provider: c.type,
        internalId: `${repoId}-discussions`,
        parentInternalId,
        type: "channel",
        title: "Discussions",
        sourceUrl: repo.url + "/discussions",
        expandable: false,
        permission: "read" as ConnectorPermission,
        dustDocumentId: null,
        lastUpdatedAt: latestDiscussion.updatedAt.getTime(),
      });
    }

    return new Ok(resources);
  }
}

export async function retrieveGithubReposTitles(
  connectorId: ModelId,
  repoIds: string[]
): Promise<Result<Record<string, string>, Error>> {
  const c = await Connector.findOne({
    where: {
      id: connectorId,
    },
  });
  if (!c) {
    logger.error({ connectorId }, "Connector not found");
    return new Err(new Error("Connector not found"));
  }

  const githubInstallationId = c.connectionId;

  const repoIdsSet = new Set(repoIds);

  // for github, we just fetch all the repos from the github API and only filter the ones we need
  // this is fine as we don't expect to have a lot of repos (it should rarely be more than 1 api call)
  const repoTitles: Record<string, string> = {};
  let pageNumber = 1; // 1-indexed
  for (;;) {
    const page = await getReposPage(githubInstallationId, pageNumber);
    pageNumber += 1;
    if (page.length === 0) {
      break;
    }

    page.forEach((repo) => {
      if (repoIdsSet.has(repo.id.toString())) {
        repoTitles[repo.id.toString()] = repo.name;
      }
    });
  }

  return new Ok(repoTitles);
}

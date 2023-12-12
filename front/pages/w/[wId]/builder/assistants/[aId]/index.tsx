import {
  CoreAPI,
  DataSourceType,
  UserType,
  WorkspaceType,
} from "@dust-tt/types";
import { isDatabaseQueryConfiguration } from "@dust-tt/types";
import { isDustAppRunConfiguration } from "@dust-tt/types";
import { isRetrievalConfiguration } from "@dust-tt/types";
import { AgentConfigurationType } from "@dust-tt/types";
import { AppType } from "@dust-tt/types";
import { PlanType, SubscriptionType } from "@dust-tt/types";
import { ConnectorsAPI } from "@dust-tt/types";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";

import AssistantBuilder, {
  AssistantBuilderInitialState,
} from "@app/components/assistant_builder/AssistantBuilder";
import { getApps } from "@app/lib/api/app";
import { getAgentConfiguration } from "@app/lib/api/assistant/configuration";
import { getDataSources } from "@app/lib/api/data_sources";
import { Authenticator, getSession, getUserFromSession } from "@app/lib/auth";
import logger from "@app/logger/logger";

const { GA_TRACKING_ID = "" } = process.env;

type DataSourceConfig = NonNullable<
  AssistantBuilderInitialState["dataSourceConfigurations"]
>[string];

export const getServerSideProps: GetServerSideProps<{
  user: UserType;
  owner: WorkspaceType;
  subscription: SubscriptionType;
  plan: PlanType;
  gaTrackingId: string;
  dataSources: DataSourceType[];
  dataSourceConfigurations: Record<string, DataSourceConfig>;
  dustApps: AppType[];
  dustAppConfiguration: AssistantBuilderInitialState["dustAppConfiguration"];
  databaseQueryConfiguration: AssistantBuilderInitialState["databaseQueryConfiguration"];
  agentConfiguration: AgentConfigurationType;
}> = async (context) => {
  const session = await getSession(context.req, context.res);
  const user = await getUserFromSession(session);
  const auth = await Authenticator.fromSession(
    session,
    context.params?.wId as string
  );

  const owner = auth.workspace();
  const plan = auth.plan();
  const subscription = auth.subscription();
  if (
    !owner ||
    !plan ||
    !user ||
    !subscription ||
    !auth.isBuilder() ||
    !context.params?.aId
  ) {
    return {
      notFound: true,
    };
  }

  const allDataSources = await getDataSources(auth);

  const dataSourceByName = allDataSources.reduce(
    (acc, ds) => ({ ...acc, [ds.name]: ds }),
    {} as Record<string, DataSourceType>
  );

  const config = await getAgentConfiguration(
    auth,
    context.params?.aId as string
  );

  if (!config) {
    return {
      notFound: true,
    };
  }

  const selectedResources: {
    dataSourceName: string;
    resources: string[] | null;
    isSelectAll: boolean;
  }[] = [];

  if (isRetrievalConfiguration(config.action)) {
    for (const ds of config.action.dataSources) {
      selectedResources.push({
        dataSourceName: ds.dataSourceId,
        resources: ds.filter.parents?.in ?? null,
        isSelectAll: !ds.filter.parents,
      });
    }
  }

  const dataSourceConfigurationsArray: DataSourceConfig[] = await Promise.all(
    selectedResources.map(async (ds): Promise<DataSourceConfig> => {
      const dataSource = dataSourceByName[ds.dataSourceName];
      if (!dataSource.connectorId || !ds.resources) {
        return {
          dataSource: dataSource,
          selectedResources: {},
          isSelectAll: ds.isSelectAll,
        };
      }
      const connectorsAPI = new ConnectorsAPI(logger);
      const response = await connectorsAPI.getResourcesTitles({
        connectorId: dataSource.connectorId,
        resourceInternalIds: ds.resources,
      });

      if (response.isErr()) {
        throw response.error;
      }

      // key: interalId, value: title
      const selectedResources: Record<string, string> = {};
      for (const resource of response.value.resources) {
        selectedResources[resource.internalId] = resource.title;
      }

      return {
        dataSource: dataSource,
        selectedResources,
        isSelectAll: ds.isSelectAll,
      };
    })
  );

  // key: dataSourceName, value: DataSourceConfig
  const dataSourceConfigurations = dataSourceConfigurationsArray.reduce(
    (acc, curr) => ({ ...acc, [curr.dataSource.name]: curr }),
    {} as Record<string, DataSourceConfig>
  );

  const allDustApps = await getApps(auth);

  let dustAppConfiguration: AssistantBuilderInitialState["dustAppConfiguration"] =
    null;

  if (isDustAppRunConfiguration(config.action)) {
    for (const app of allDustApps) {
      if (app.sId === config.action.appId) {
        dustAppConfiguration = {
          app,
        };
        break;
      }
    }
  }

  let databaseQueryConfiguration: AssistantBuilderInitialState["databaseQueryConfiguration"] =
    null;

  if (isDatabaseQueryConfiguration(config.action)) {
    const dataSource = dataSourceByName[config.action.dataSourceId];

    const coreAPI = new CoreAPI(logger);
    const databaseRes = await coreAPI.getDatabase({
      projectId: dataSource.dustAPIProjectId,
      dataSourceName: config.action.dataSourceId,
      databaseId: config.action.databaseId,
    });

    if (databaseRes.isOk()) {
      const { database } = databaseRes.value;
      databaseQueryConfiguration = {
        dataSourceWorkspaceId: config.action.dataSourceWorkspaceId,
        dataSourceId: config.action.dataSourceId,
        databaseId: config.action.databaseId,
        databaseName: database.name,
      };
    }
  }

  return {
    props: {
      user,
      owner,
      plan,
      subscription,
      gaTrackingId: GA_TRACKING_ID,
      dataSources: allDataSources,
      dataSourceConfigurations,
      dustApps: allDustApps,
      dustAppConfiguration,
      databaseQueryConfiguration: databaseQueryConfiguration,
      agentConfiguration: config,
    },
  };
};

export default function EditAssistant({
  user,
  owner,
  subscription,
  plan,
  gaTrackingId,
  dataSources,
  dataSourceConfigurations,
  dustApps,
  dustAppConfiguration,
  databaseQueryConfiguration,
  agentConfiguration,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  let actionMode: AssistantBuilderInitialState["actionMode"] = "GENERIC";

  let timeFrame: AssistantBuilderInitialState["timeFrame"] = null;

  if (isRetrievalConfiguration(agentConfiguration.action)) {
    if (agentConfiguration.action.query === "none") {
      if (
        agentConfiguration.action.relativeTimeFrame === "auto" ||
        agentConfiguration.action.relativeTimeFrame === "none"
      ) {
        /** Should never happen. Throw loudly if it does */
        throw new Error(
          "Invalid configuration: exhaustive retrieval must have a definite time frame"
        );
      }
      actionMode = "RETRIEVAL_EXHAUSTIVE";
      timeFrame = {
        value: agentConfiguration.action.relativeTimeFrame.duration,
        unit: agentConfiguration.action.relativeTimeFrame.unit,
      };
    }
    if (agentConfiguration.action.query === "auto") {
      actionMode = "RETRIEVAL_SEARCH";
    }
  }

  if (isDustAppRunConfiguration(agentConfiguration.action)) {
    actionMode = "DUST_APP_RUN";
  }

  if (isDatabaseQueryConfiguration(agentConfiguration.action)) {
    actionMode = "DATABASE_QUERY";
  }

  return (
    <AssistantBuilder
      user={user}
      owner={owner}
      subscription={subscription}
      plan={plan}
      gaTrackingId={gaTrackingId}
      dataSources={dataSources}
      dustApps={dustApps}
      initialBuilderState={{
        actionMode,
        timeFrame,
        dataSourceConfigurations,
        dustAppConfiguration,
        databaseQueryConfiguration,
        handle: agentConfiguration.name,
        description: agentConfiguration.description,
        instructions: agentConfiguration.generation?.prompt || "", // TODO we don't support null in the UI yet
        avatarUrl: agentConfiguration.pictureUrl,
        generationSettings: agentConfiguration.generation
          ? {
              modelSettings: agentConfiguration.generation.model,
              temperature: agentConfiguration.generation.temperature,
            }
          : null,
      }}
      agentConfigurationId={agentConfiguration.sId}
    />
  );
}

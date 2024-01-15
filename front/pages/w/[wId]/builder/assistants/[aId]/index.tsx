import type {
  AgentConfigurationType,
  AppType,
  DataSourceType,
  PlanType,
  SubscriptionType,
  UserType,
  WorkspaceType,
} from "@dust-tt/types";
import {
  ConnectorsAPI,
  isDustAppRunConfiguration,
  isRetrievalConfiguration,
  isTablesQueryConfiguration,
} from "@dust-tt/types";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";

import type {
  AssistantBuilderInitialState,
  BuilderFlow,
} from "@app/components/assistant_builder/AssistantBuilder";
import AssistantBuilder, {
  BUILDER_FLOWS,
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

export async function buildInitialState({
  dataSourceByName,
  config,
  dustApps,
}: {
  dataSourceByName: Record<string, DataSourceType>;
  config: AgentConfigurationType;
  dustApps: AppType[];
}) {
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

  let dustAppConfiguration: AssistantBuilderInitialState["dustAppConfiguration"] =
    null;

  if (isDustAppRunConfiguration(config.action)) {
    for (const app of dustApps) {
      if (app.sId === config.action.appId) {
        dustAppConfiguration = {
          app,
        };
        break;
      }
    }
  }

  let tableQueryConfiguration: AssistantBuilderInitialState["tableQueryConfiguration"] =
    null;

  if (
    isTablesQueryConfiguration(config.action) &&
    config.action.tables.length
  ) {
    tableQueryConfiguration = {
      workspaceId: config.action.tables[0].workspaceId,
      tableId: config.action.tables[0].tableId,
      dataSourceId: config.action.tables[0].dataSourceId,
    };
  }

  return {
    dataSourceConfigurations,
    dustAppConfiguration,
    tableQueryConfiguration,
  };
}

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
  tableQueryConfiguration: AssistantBuilderInitialState["tableQueryConfiguration"];
  agentConfiguration: AgentConfigurationType;
  flow: BuilderFlow;
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
    !auth.isUser() ||
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
  if (config?.scope === "workspace" && !auth.isBuilder()) {
    return {
      notFound: true,
    };
  }

  if (!config) {
    return {
      notFound: true,
    };
  }

  const flow: BuilderFlow = BUILDER_FLOWS.includes(
    context.query.flow as BuilderFlow
  )
    ? (context.query.flow as BuilderFlow)
    : "personal_assistants";

  const allDustApps = await getApps(auth);

  const {
    dataSourceConfigurations,
    dustAppConfiguration,
    tableQueryConfiguration,
  } = await buildInitialState({
    config,
    dataSourceByName,
    dustApps: allDustApps,
  });

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
      tableQueryConfiguration,
      agentConfiguration: config,
      flow,
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
  tableQueryConfiguration,
  agentConfiguration,
  flow,
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

  if (isTablesQueryConfiguration(agentConfiguration.action)) {
    actionMode = "TABLE_QUERY";
  }
  if (agentConfiguration.scope === "global") {
    throw new Error("Cannot edit global assistant");
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
      flow={flow}
      initialBuilderState={{
        actionMode,
        timeFrame,
        dataSourceConfigurations,
        dustAppConfiguration,
        tableQueryConfiguration,
        scope: agentConfiguration.scope,
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

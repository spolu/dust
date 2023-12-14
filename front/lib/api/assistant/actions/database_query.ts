import {
  AgentConfigurationType,
  AgentMessageType,
  cloneBaseConfig,
  ConversationType,
  DatabaseQueryActionType,
  DatabaseQueryErrorEvent,
  DatabaseQuerySuccessEvent,
  DustProdActionRegistry,
  Err,
  isDatabaseQueryConfiguration,
  ModelMessageType,
  Ok,
  Result,
  UserMessageType,
} from "@dust-tt/types";

import { runActionStreamed } from "@app/lib/actions/server";
import { generateActionInputs } from "@app/lib/api/assistant/agent";
import { Authenticator } from "@app/lib/auth";
import { AgentDatabaseQueryAction } from "@app/lib/models";
import logger from "@app/logger/logger";

/**
 * Model rendering of DatabaseQueryAction.
 */

export function renderDatabaseQueryActionForModel(
  action: DatabaseQueryActionType
): ModelMessageType {
  let content = "";
  if (!action.output) {
    throw new Error(
      "Output not set on DatabaseQuery action; execution is likely not finished."
    );
  }
  content += `OUTPUT:\n`;
  content += `${JSON.stringify(action.output, null, 2)}\n`;

  return {
    role: "action" as const,
    name: "DatabaseQuery",
    content,
  };
}

/**
 * Generate the specification for the DatabaseQuery app.
 * This is the instruction given to the LLM to understand the task.
 */
function getDatabaseQueryAppSpecification() {
  return {
    name: "query_database",
    description:
      "Query the database associated to answer the question provided by the user." +
      "Generate the best SQL query (from the question received and the database schema), execute the query, and retrieve the result.",
    inputs: [
      {
        name: "question",
        description:
          "The string containing the raw question from the user about the data on the linked database. " +
          "It should include all relevant information to build the best SQL query to fetch the data they need to retrieve. " +
          "Always unaccent the user's query, replace (eg replace é/è with e etc.)" +
          "When requesting to retrieve specific information, especially names or titles, it's crucial to approach the query with flexibility in terms of text case. " +
          "For instance, if the query is, 'Is there a cat named Soupinou in the database?', " +
          "you should comprehensively search the database for the name 'Soupinou' without being restricted by text case sensitivity, unless explicitly instructed otherwise. " +
          "This means the search should include variations like 'soupinou', 'SOUPINOU', or any other case combinations. " +
          "This approach ensures a thorough search and accurate results, accommodating the possibility of case variations in the database entries.",
        type: "string" as const,
      },
    ],
  };
}

/**
 * Generate the parameters for the DatabaseQuery app.
 */
export async function generateDatabaseQueryAppParams(
  auth: Authenticator,
  configuration: AgentConfigurationType,
  conversation: ConversationType,
  userMessage: UserMessageType
): Promise<
  Result<
    {
      [key: string]: string | number | boolean;
    },
    Error
  >
> {
  const c = configuration.action;
  if (!isDatabaseQueryConfiguration(c)) {
    throw new Error(
      "Unexpected action configuration received in `runQueryDatabase`"
    );
  }

  const spec = getDatabaseQueryAppSpecification();
  const rawInputsRes = await generateActionInputs(
    auth,
    configuration,
    spec,
    conversation,
    userMessage
  );

  if (rawInputsRes.isErr()) {
    return new Err(rawInputsRes.error);
  }
  return new Ok(rawInputsRes.value);
}

/**
 * Run the DatabaseQuery app.
 */
export async function* runDatabaseQuery({
  auth,
  configuration,
  conversation,
  userMessage,
  agentMessage,
}: {
  auth: Authenticator;
  configuration: AgentConfigurationType;
  conversation: ConversationType;
  userMessage: UserMessageType;
  agentMessage: AgentMessageType;
}): AsyncGenerator<DatabaseQueryErrorEvent | DatabaseQuerySuccessEvent> {
  // Checking authorizations
  const owner = auth.workspace();
  if (!owner) {
    throw new Error("Unexpected unauthenticated call to `runQueryDatabase`");
  }
  const c = configuration.action;
  if (!isDatabaseQueryConfiguration(c)) {
    throw new Error(
      "Unexpected action configuration received in `runQueryDatabase`"
    );
  }
  if (owner.sId !== c.dataSourceWorkspaceId) {
    yield {
      type: "database_query_error",
      created: Date.now(),
      configurationId: configuration.sId,
      messageId: agentMessage.sId,
      error: {
        code: "database_query_parameters_generation_error",
        message: "Cannot access the database linked to this action.",
      },
    };
  }

  // Generating inputs
  const inputRes = await generateDatabaseQueryAppParams(
    auth,
    configuration,
    conversation,
    userMessage
  );
  if (inputRes.isErr()) {
    yield {
      type: "database_query_error",
      created: Date.now(),
      configurationId: configuration.sId,
      messageId: agentMessage.sId,
      error: {
        code: "database_query_parameters_generation_error",
        message: `Error generating parameters for database_query: ${inputRes.error.message}`,
      },
    };
    return;
  }
  const input = inputRes.value;

  // Generating configuration
  const config = cloneBaseConfig(
    DustProdActionRegistry["assistant-v2-query-database"].config
  );
  const database = {
    workspace_id: c.dataSourceWorkspaceId,
    data_source_id: c.dataSourceId,
    database_id: c.databaseId,
  };
  config.DATABASE_SCHEMA = {
    type: "database_schema",
    database,
  };
  config.DATABASE = {
    type: "database",
    database,
  };

  // Running the app
  const res = await runActionStreamed(
    auth,
    "assistant-v2-query-database",
    config,
    [{ question: input.question }]
  );

  if (res.isErr()) {
    yield {
      type: "database_query_error",
      created: Date.now(),
      configurationId: configuration.sId,
      messageId: agentMessage.sId,
      error: {
        code: "database_query_error",
        message: `Error running DatabaseQuery app: ${res.error.message}`,
      },
    };
    return;
  }

  let output: Record<string, string | boolean | number> = {};

  const { eventStream } = res.value;
  for await (const event of eventStream) {
    if (event.type === "block_execution") {
      const e = event.content.execution[0][0];

      if (e.error) {
        logger.error(
          {
            workspaceId: owner.id,
            conversationId: conversation.id,
            error: e.error,
          },
          "Error running query_database app"
        );
        yield {
          type: "database_query_error",
          created: Date.now(),
          configurationId: configuration.sId,
          messageId: agentMessage.sId,
          error: {
            code: "database_query_error",
            message: `Error getting execution from DatabaseQuery app: ${e.error}`,
          },
        };
        return;
      }

      if (event.content.block_name === "OUTPUT" && e.value) {
        output = JSON.parse(e.value as string);
      }
    }
  }

  const action = await AgentDatabaseQueryAction.create({
    dataSourceWorkspaceId: c.dataSourceWorkspaceId,
    dataSourceId: c.dataSourceId,
    databaseId: c.databaseId,
    databaseQueryConfigurationId: configuration.sId,
    params: input,
    output,
  });
  yield {
    type: "database_query_success",
    created: Date.now(),
    configurationId: configuration.sId,
    messageId: agentMessage.sId,
    action: {
      id: action.id,
      type: "database_query_action",
      dataSourceWorkspaceId: action.dataSourceWorkspaceId,
      dataSourceId: action.dataSourceId,
      databaseId: action.databaseId,
      output: action.output,
    },
  };
  return;
}

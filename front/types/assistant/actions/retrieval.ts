/**
 * Data Source configuration
 */

import { ModelId } from "@app/lib/databases";

import { AgentActionConfigurationType } from "../agent";
import { AssistantAgentActionType } from "../conversation";

export type TimeFrame = {
  count: number;
  duration: "hour" | "day" | "week" | "month" | "year";
};

export type DataSourceFilter = {
  tags: { in: string[]; not: string[] } | null;
  parents: { in: string[]; not: string[] } | null;
};

export type DataSourceConfiguration = {
  workspaceId: string;
  dataSourceId: string;
  filter: DataSourceFilter;
};

/**
 * Retrieval configuration
 */

export type TemplatedQuery = {
  template: string;
};

// Retrieval specifies a list of data sources (with possible parent / tags filtering, possible "all"
// data sources), a query ("auto" generated by the model "none", no query, `TemplatedQuery`, fixed
// query), a relative time frame ("auto" generated by the model, "none" no time filtering
// `TimeFrame`) which applies to all data sources, and a top_k parameter.
//
// `query` and `relativeTimeFrame` will be used to generate the inputs specification for the model
// in charge of generating the action inputs. The results will be used along with `topK` and
// `dataSources` to query the data.
export type RetrievalConfigurationType = {
  type: "retrieval_configuration";
  dataSources: "all" | DataSourceConfiguration[];
  query: "auto" | "none" | TemplatedQuery;
  relativeTimeFrame: "auto" | "none" | TimeFrame;
  topK: number;

  // Dynamically decide to skip, if needed in the future
  // autoSkip: boolean;
};

export function isRetrievalConfiguration(
  arg: AgentActionConfigurationType | null
): arg is RetrievalConfigurationType {
  return arg !== null && arg.type && arg.type === "retrieval_configuration";
}

/**
 * Retrieval action
 */

export type RetrievalDocumentType = {
  id: ModelId;
  dataSourceId: string;
  sourceUrl: string | null;
  documentId: string;
  timestamp: number;
  tags: string[];
  score: number;
  chunks: {
    text: string;
    offset: number;
    score: number;
  }[];
};

export function isRetrievalActionType(
  arg: AssistantAgentActionType
): arg is RetrievalActionType {
  return arg.type === "retrieval_action";
}

export type RetrievalActionType = {
  id: ModelId; // AssistantAgentRetrieval.
  type: "retrieval_action";
  params: {
    dataSources: "all" | DataSourceConfiguration[];
    relativeTimeFrame: TimeFrame | null;
    query: string | null;
    topK: number;
  };
  documents: RetrievalDocumentType[];
};

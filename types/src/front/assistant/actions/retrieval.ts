/**
 * Data Source configuration
 */

import { BaseAction } from "../../../front/assistant/actions/index";
import { ConnectorProvider } from "../../../front/data_source";
import { DataSourceViewType } from "../../../front/data_source_view";
import { ModelId } from "../../../shared/model_id";
import { ioTsEnum } from "../../../shared/utils/iots_utils";

export const TIME_FRAME_UNITS = [
  "hour",
  "day",
  "week",
  "month",
  "year",
] as const;
export type TimeframeUnit = (typeof TIME_FRAME_UNITS)[number];
export const TimeframeUnitCodec = ioTsEnum<TimeframeUnit>(TIME_FRAME_UNITS);

export type TimeFrame = {
  duration: number;
  unit: TimeframeUnit;
};
export function isTimeFrame(arg: RetrievalTimeframe): arg is TimeFrame {
  return (
    (arg as TimeFrame).duration !== undefined &&
    (arg as TimeFrame).unit !== undefined
  );
}

export type DataSourceFilter = {
  parents: { in: string[]; not: string[] } | null;
  tags: { in: string[]; not: string[] } | "auto" | null;
};

export type DataSourceConfiguration = {
  workspaceId: string;
  dataSourceViewId: string;
  filter: DataSourceFilter;
};

/**
 * Retrieval configuration
 */

// Retrieval specifies a list of data sources (with possible parent filtering, possible "all" data
// sources), a query ("auto" generated by the model "none", no query, `TemplatedQuery`, fixed
// query), a relative time frame ("auto" generated by the model, "none" no time filtering
// `TimeFrame`) which applies to all data sources, and a top_k parameter.
//
// `query` and `relativeTimeFrame` will be used to generate the inputs specification for the model
// in charge of generating the action inputs. The results will be used along with `topK` and
// `dataSources` to query the data.
export type RetrievalQuery = "auto" | "none";
export type RetrievalTimeframe = "auto" | "none" | TimeFrame;
export type RetrievalConfigurationType = {
  id: ModelId;
  sId: string;

  type: "retrieval_configuration";

  dataSources: DataSourceConfiguration[];
  query: RetrievalQuery;
  relativeTimeFrame: RetrievalTimeframe;
  topK: number | "auto";

  name: string;
  description: string | null;
};

/**
 * Retrieval action
 */

export interface RetrievalDocumentChunkType {
  offset: number;
  score: number | null;
  text: string;
}

export interface RetrievalDocumentType {
  chunks: RetrievalDocumentChunkType[];
  documentId: string;
  dataSourceView: DataSourceViewType | null;
  id: ModelId;
  reference: string; // Short random string so that the model can refer to the document.
  score: number | null;
  sourceUrl: string | null;
  tags: string[];
  timestamp: number;
}

type ConnectorProviderDocumentType =
  | Exclude<ConnectorProvider, "webcrawler">
  | "document";

export function getProviderFromRetrievedDocument(
  document: RetrievalDocumentType
): ConnectorProviderDocumentType {
  if (document.dataSourceView) {
    if (document.dataSourceView.dataSource.connectorProvider === "webcrawler") {
      return "document";
    }
    return document.dataSourceView.dataSource.connectorProvider || "document";
  }
  return "document";
}

export function getTitleFromRetrievedDocument(
  document: RetrievalDocumentType
): string {
  const provider = getProviderFromRetrievedDocument(document);

  if (provider === "slack") {
    for (const t of document.tags) {
      if (t.startsWith("channelName:")) {
        return `#${t.substring(12)}`;
      }
    }
  }

  for (const t of document.tags) {
    if (t.startsWith("title:")) {
      return t.substring(6);
    }
  }

  return document.documentId;
}

export interface RetrievalActionType extends BaseAction {
  id: ModelId; // AgentRetrievalAction
  agentMessageId: ModelId; // AgentMessage

  params: {
    relativeTimeFrame: TimeFrame | null;
    query: string | null;
    topK: number;
  };
  functionCallId: string | null;
  functionCallName: string | null;
  documents: RetrievalDocumentType[] | null;
  step: number;
  type: "retrieval_action";
}

/**
 * Retrieval Action Events
 */

// Event sent during retrieval with the finalized query used to retrieve documents.
export type RetrievalParamsEvent = {
  type: "retrieval_params";
  created: number;
  configurationId: string;
  messageId: string;
  dataSources: DataSourceConfiguration[];
  action: RetrievalActionType;
};

export type RetrievalErrorEvent = {
  type: "retrieval_error";
  created: number;
  configurationId: string;
  messageId: string;
  error: {
    code: string;
    message: string;
  };
};

export type RetrievalSuccessEvent = {
  type: "retrieval_success";
  created: number;
  configurationId: string;
  messageId: string;
  action: RetrievalActionType;
};

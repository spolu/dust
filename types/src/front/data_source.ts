import { ModelId } from "../shared/model_id";

export type DataSourceVisibility = "public" | "private";

export const CONNECTOR_PROVIDERS = [
  "confluence",
  "github",
  "google_drive",
  "intercom",
  "notion",
  "slack",
  "webcrawler",
] as const;
export type ConnectorProvider = (typeof CONNECTOR_PROVIDERS)[number];

export type DataSourceType = {
  id: ModelId;
  name: string;
  description: string | null;
  visibility: DataSourceVisibility;
  assistantDefaultSelected: boolean;
  dustAPIProjectId: string;
  connectorId: string | null;
  connectorProvider: ConnectorProvider | null;
};

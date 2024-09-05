import type {
  ConnectorProvider,
  CoreAPIDocument,
  DataSourceType,
  WithConnector,
} from "@dust-tt/types";
import { assertNever } from "@dust-tt/types";

import { CONNECTOR_CONFIGURATIONS } from "@app/lib/connector_providers";
import type { DataSourceResource } from "@app/lib/resources/data_source_resource";

export function getDisplayNameForDocument(document: CoreAPIDocument): string {
  const titleTagPrefix = "title:";
  const titleTag = document.tags.find((tag) => tag.startsWith(titleTagPrefix));
  if (!titleTag) {
    return document.document_id;
  }
  return titleTag.substring(titleTagPrefix.length);
}

export function getDisplayNameForDataSource(ds: DataSourceType) {
  if (ds.connectorProvider) {
    switch (ds.connectorProvider) {
      case "confluence":
      case "slack":
      case "google_drive":
      case "github":
      case "intercom":
      case "microsoft":
      case "notion":
        return CONNECTOR_CONFIGURATIONS[ds.connectorProvider].name;
        break;
      case "webcrawler":
        return ds.name;
      default:
        assertNever(ds.connectorProvider);
    }
  } else {
    return ds.name;
  }
}

type DataSource = DataSourceType | DataSourceResource;

export function isFolder(
  ds: DataSource
): ds is DataSource & { connectorProvider: null } {
  // If there is no connectorProvider, it's a folder.
  return !ds.connectorProvider;
}

export function isWebsite(
  ds: DataSource
): ds is DataSource & { connectorProvider: "webcrawler" } {
  return ds.connectorProvider === "webcrawler";
}

export function isManaged(ds: DataSource): ds is DataSource & WithConnector {
  return ds.connectorProvider !== null && !isWebsite(ds);
}

const STRUCTURED_DATA_SOURCES: ConnectorProvider[] = [
  "google_drive",
  "notion",
  "microsoft",
];

export function supportsStructuredData(ds: DataSource): boolean {
  return Boolean(
    isFolder(ds) ||
      (ds.connectorProvider &&
        STRUCTURED_DATA_SOURCES.includes(ds.connectorProvider))
  );
}

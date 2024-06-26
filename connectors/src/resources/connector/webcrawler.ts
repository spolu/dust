import type { ModelId, WebCrawlerConfiguration } from "@dust-tt/types";
import type { Transaction } from "sequelize";

import type { WebCrawlerConfigurationModel } from "@connectors/lib/models/webcrawler";
import type {
  ConnectorProviderModelResourceMapping,
  ConnectorProviderStrategy,
  WithCreationAttributes,
} from "@connectors/resources/connector/strategy";
import type { ConnectorResource } from "@connectors/resources/connector_resource";
import { WebCrawlerConfigurationResource } from "@connectors/resources/webcrawler_resource";

export class WebCrawlerStrategy
  implements ConnectorProviderStrategy<"webcrawler">
{
  async makeNew(
    connectorId: ModelId,
    blob: WithCreationAttributes<WebCrawlerConfigurationModel> & {
      headers: WebCrawlerConfiguration["headers"];
    },
    transaction: Transaction
  ): Promise<ConnectorProviderModelResourceMapping["webcrawler"] | null> {
    return WebCrawlerConfigurationResource.makeNew(
      {
        ...blob,
        connectorId,
      },
      transaction
    );
  }

  async delete(
    connector: ConnectorResource,
    transaction: Transaction
  ): Promise<void> {
    const resource = await WebCrawlerConfigurationResource.fetchByConnectorId(
      connector.id
    );
    if (!resource) {
      throw new Error(
        `No WebCrawlerConfiguration found for connector ${connector.id}`
      );
    }
    await resource.delete(transaction);
  }

  async fetchConfigurationsbyConnectorIds(
    connectorIds: ModelId[]
  ): Promise<
    Record<ModelId, ConnectorProviderModelResourceMapping["webcrawler"]>
  > {
    return WebCrawlerConfigurationResource.fetchByConnectorIds(connectorIds);
  }
}

import type { CrawlingFrequency, ModelId, Result } from "@dust-tt/types";
import { CrawlingFrequencies, Err, Ok } from "@dust-tt/types";
import type {
  Attributes,
  CreationAttributes,
  ModelStatic,
  Transaction,
} from "sequelize";
import { literal, Op } from "sequelize";

import {
  WebCrawlerConfigurationModel,
  WebCrawlerFolder,
  WebCrawlerPage,
} from "@connectors/lib/models/webcrawler";
import { BaseResource } from "@connectors/resources/base_resource";
import type {} from "@connectors/resources/connector/strategy";
import { ConnectorResource } from "@connectors/resources/connector_resource";
import type { ReadonlyAttributesType } from "@connectors/resources/storage/types";

// Attributes are marked as read-only to reflect the stateless nature of our Resource.
// This design will be moved up to BaseResource once we transition away from Sequelize.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface WebCrawlerConfigurationResource
  extends ReadonlyAttributesType<WebCrawlerConfigurationModel> {}
export class WebCrawlerConfigurationResource extends BaseResource<WebCrawlerConfigurationModel> {
  static model: ModelStatic<WebCrawlerConfigurationModel> =
    WebCrawlerConfigurationModel;

  constructor(
    model: ModelStatic<WebCrawlerConfigurationModel>,
    blob: Attributes<WebCrawlerConfigurationModel>
  ) {
    super(WebCrawlerConfigurationModel, blob);
  }

  static async fetchByConnectorId(connectorId: ModelId) {
    const blob = await this.model.findOne({
      where: {
        connectorId: connectorId,
      },
    });
    if (!blob) {
      return null;
    }

    return new this(this.model, blob.get());
  }

  static async makeNew(
    blob: CreationAttributes<WebCrawlerConfigurationModel>,
    transaction: Transaction
  ) {
    const config = await WebCrawlerConfigurationModel.create(
      {
        ...blob,
      },
      { transaction }
    );

    const res = new this(this.model, config.get());

    return res;
  }

  static async getWebsitesToCrawl() {
    const frequencyToSQLQuery: Record<CrawlingFrequency, string> = {
      never: "never",
      daily: "1 day",
      weekly: "1 week",
      monthly: "1 month",
    };
    const allConnectorIds: ModelId[] = [];

    for (const frequency of CrawlingFrequencies) {
      if (frequency === "never") {
        continue;
      }
      const sql = frequencyToSQLQuery[frequency];
      const websites = await this.model.findAll({
        where: {
          lastCrawledAt: {
            [Op.lt]: literal(`NOW() - INTERVAL '${sql}'`),
          },
          crawlFrequency: frequency,
        },
      });
      allConnectorIds.push(...websites.map((w) => w.connectorId));
    }

    const connectors = await ConnectorResource.fetchByIds(allConnectorIds);
    const unPausedConnectorIds = connectors
      .filter((c) => !c.isPaused())
      .map((c) => c.id);

    return unPausedConnectorIds;
  }

  async markedAsCrawled() {
    await this.model.update(
      {
        lastCrawledAt: new Date(),
      },
      {
        where: {
          id: this.id,
        },
      }
    );
  }

  async delete(transaction?: Transaction): Promise<Result<undefined, Error>> {
    await WebCrawlerPage.destroy({
      where: {
        connectorId: this.connectorId,
      },
      transaction,
    });
    await WebCrawlerFolder.destroy({
      where: {
        connectorId: this.connectorId,
      },
      transaction,
    });
    await this.model.destroy({
      where: {
        id: this.id,
      },
      transaction,
    });

    return new Ok(undefined);
  }
}

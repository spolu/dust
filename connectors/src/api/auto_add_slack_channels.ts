import type { Result } from "@dust-tt/types";
import { Err, Ok } from "@dust-tt/types";

import { joinChannel } from "@connectors/connectors/slack/lib/channels";
import { getSlackClient } from "@connectors/connectors/slack/lib/slack_client";
import {
  SlackChannel,
  SlackConfigurationModel,
} from "@connectors/lib/models/slack";
import type { Logger } from "@connectors/logger/logger";
import { ConnectorResource } from "@connectors/resources/connector_resource";

export function isChannelNameWhitelisted(
  remoteChannelName: string,
  whiteListedChannelPatterns?: string
): boolean {
  if (!whiteListedChannelPatterns) {
    return false;
  }

  const regex = new RegExp(whiteListedChannelPatterns);
  return regex.test(remoteChannelName);
}

export async function autoJoinChannel(
  teamId: string,
  logger: Logger,
  requestedConnectorId?: string,
  slackChannelId?: string
): Promise<Result<undefined, Error>> {
  const slackConfiguration = await SlackConfigurationModel.findOne({
    where: {
      slackTeamId: teamId,
    },
  });
  if (!slackConfiguration || !slackChannelId) {
    return new Err(
      new Error(`Slack configuration not found for teamId ${teamId}`)
    );
  }
  const { connectorId } = slackConfiguration;

  const connector = await ConnectorResource.fetchById(connectorId);
  if (!connector) {
    return new Err(new Error(`Connector ${requestedConnectorId} not found`));
  }
  const slackClient = await getSlackClient(connectorId);
  const remoteChannel = await slackClient.conversations.info({
    channel: slackChannelId,
  });
  const remoteChannelName = remoteChannel.channel?.name;

  if (!remoteChannel.ok || !remoteChannelName) {
    logger.error({
      connectorId,
      channelId: slackChannelId,
      error: remoteChannel.error,
    });
    return new Err(new Error("Could not get the Slack channel information."));
  }

  const { whiteListedChannelPatterns } = slackConfiguration;
  const isWhiteListed = isChannelNameWhitelisted(
    remoteChannelName,
    whiteListedChannelPatterns
  );
  if (isWhiteListed) {
    await SlackChannel.create({
      connectorId,
      slackChannelId,
      slackChannelName: remoteChannelName,
      permission: "read_write",
    });

    const joinChannelRes = await joinChannel(connectorId, slackChannelId);
    if (joinChannelRes.isErr()) {
      return joinChannelRes;
    }
  }
  return new Ok(undefined);
}

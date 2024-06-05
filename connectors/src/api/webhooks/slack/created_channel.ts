import type { Result } from "@dust-tt/types";
import { Err, Ok } from "@dust-tt/types";

import type { SlackWebhookEvent } from "@connectors/api/webhooks/webhook_slack";
import { autoReadChannel } from "@connectors/connectors/slack/auto_read_channel";
import type { Logger } from "@connectors/logger/logger";

interface ChannelCreatedEventPayload {
  context_team_id: string;
  created: number;
  creator: string;
  id: string;
  name: string;
}

type ChannelCreatedEvent = Omit<SlackWebhookEvent, "channel"> & {
  channel: ChannelCreatedEventPayload;
};

export function isChannelCreatedEvent(
  event: unknown
): event is ChannelCreatedEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "context_team_id" in event &&
    "created" in event &&
    "creator" in event &&
    "id" in event &&
    "name" in event
  );
}

export interface OnChannelCreationProps {
  event: ChannelCreatedEvent;
  logger: Logger;
}

export async function onChannelCreation({
  event,
  logger,
}: OnChannelCreationProps): Promise<Result<void, Error>> {
  const { channel } = event;
  const autoReadRes = await autoReadChannel(
    channel.context_team_id,
    logger,
    channel.name
  );
  if (autoReadRes.isErr()) {
    return new Err(
      new Error(`Error joining slack channel: ${autoReadRes.error}`)
    );
  }
  return new Ok(undefined);
}

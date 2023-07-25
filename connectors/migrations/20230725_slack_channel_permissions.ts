import {
  getAccessToken,
  getChannels,
} from "@connectors/connectors/slack/temporal/activities";
import { Connector, SlackChannel } from "@connectors/lib/models";

async function main() {
  const slackConnectors = await Connector.findAll({
    where: {
      type: "slack",
    },
  });

  for (const c of slackConnectors) {
    const channelsInDb = (
      await SlackChannel.findAll({
        where: {
          connectorId: c.id,
        },
      })
    ).reduce(
      (acc, c) => Object.assign(acc, { [c.slackChannelId]: c }),
      {} as {
        [key: string]: SlackChannel;
      }
    );

    const accessToken = await getAccessToken(c.connectionId);
    const channelsInSlack = await getChannels(accessToken);

    for (const channel of channelsInSlack) {
      if (!channel.id) {
        console.log("Channel has no id", channel);
        continue;
      }
      if (!channel.name) {
        console.log("Channel has no name", channel);
        continue;
      }
      const existingChannel = channelsInDb[channel.id];
      if (existingChannel) {
        await existingChannel.update({
          slackChannelName: channel.name,
        });
      } else {
        await SlackChannel.create({
          connectorId: c.id,
          slackChannelId: channel.id,
          slackChannelName: channel.name,
          permission: "read_write",
        });
      }
    }
  }
}

main()
  .then(() => {
    console.log("Done");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

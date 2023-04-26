import { Client, Connection, ConnectionOptions } from "@temporalio/client";
import fs from "fs-extra";

export async function getTemporalClient(): Promise<Client> {
  const connectionOptions = await getConnectionOptions();
  const connection = await Connection.connect(connectionOptions);
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE,
  });

  return client;
}

async function getConnectionOptions(): Promise<ConnectionOptions> {
  const { NODE_ENV = "development" } = process.env;
  const isDeployed = ["production", "staging"].includes(NODE_ENV);

  let connectionOptions: ConnectionOptions = {};
  if (isDeployed) {
    const { TEMPORAL_CERT_PATH, TEMPORAL_CERT_KEY, TEMPORAL_NAMESPACE } =
      process.env;
    if (!TEMPORAL_CERT_PATH || !TEMPORAL_CERT_KEY || !TEMPORAL_NAMESPACE) {
      throw new Error(
        "TEMPORAL_CERT_PATH, TEMPORAL_CERT_KEY and TEMPORAL_NAMESPACE are required " +
          `when NODE_ENV=${NODE_ENV}, but not found in the environment`
      );
    }

    const cert = await fs.readFile(TEMPORAL_CERT_PATH);
    const key = await fs.readFile(TEMPORAL_CERT_KEY);

    connectionOptions = {
      address: `${TEMPORAL_NAMESPACE}.tmprl.cloud:7233`,
      tls: {
        clientCertPair: {
          crt: cert,
          key,
        },
      },
    };
  }

  return connectionOptions;
}

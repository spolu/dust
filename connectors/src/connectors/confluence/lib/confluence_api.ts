// TODO:

import { ConfluenceClient } from "@connectors/connectors/confluence/lib/confluence_client";

export function getConfluenceCloudInformation(accessToken: string) {
  const client = new ConfluenceClient(accessToken);

  return client.getCloudInformation();
}

export function listConfluenceSpaces(accessToken: string, cloudId: string) {
  const client = new ConfluenceClient(accessToken, {cloudId});

  return client.listGlobalSpaces();
}

// export async function validateAccessToken(intercomAccessToken: string) {
//   const intercomClient = new Client({
//     tokenAuth: { token: intercomAccessToken },
//   });
//   try {
//     await intercomClient.admins.list(); // trying a simple request
//   } catch (e) {
//     return false;
//   }
//   return true;
// }

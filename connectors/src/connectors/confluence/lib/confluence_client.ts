import { isLeft } from 'fp-ts/Either';
import * as t from 'io-ts';
import { PathReporter } from 'io-ts/PathReporter';

// Define the io-ts validation for the response
const ConfluencePageCodec = t.type({
  id: t.string,
  type: t.string,
  title: t.string,
  // Add other necessary response properties and validation
});

const ConfluenceAccessibleResourcesCodec = t.array(
    t.intersection([
    t.type({
      id: t.string,
      url: t.string
    }),
    t.record(t.string, t.unknown) // Catch-all for unknown properties
  ])
);

const ConfluenceListSpacesCodec = t.type({
  results: t.array(
    t.intersection([
      t.type({
        id: t.string,
        name: t.string,
        _links: t.type({
          webui: t.string
        }),
      }),
      t.record(t.string, t.unknown) // Catch-all for unknown properties
    ])
  )
});
// const ConfluenceListSpacesCodec = t.type({
//   results: t.array(
//     t.intersection([
//       t.type({
//         id: t.string,
//         version: t.type({
//           number: t.number
//         })
//       }),
//       t.record(t.string, t.unknown) // Catch-all for unknown properties
//     ])
//   )
// });

export class ConfluenceClient {
  private readonly apiUrl = "https://api.atlassian.com";
  private readonly restApiBaseUrl: string;

  constructor(private readonly authToken: string, {cloudId}: {cloudId?: string} = {}) {
    this.restApiBaseUrl = `/ex/confluence/${cloudId}/wiki/api/v2`;
  }

  private async request<T>(endpoint: string, codec: t.Type<T>): Promise<T> {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Confluence API responded with status: ${response.status}: ${this.apiUrl}${endpoint}`);
    }

    const responseBody = await response.json();
    const result = codec.decode(responseBody);

    if (isLeft(result)) {
      console.error(PathReporter.report(result));
      throw new Error('Response validation failed');
    }

    return result.right;
  }

  async getCloudInformation() {
    const accessibleResources = await this.request('/oauth/token/accessible-resources', ConfluenceAccessibleResourcesCodec);

    // Currently, the Confluence Auth token may grant access to multiple cloud instances.
    // This implementation restricts usage to the primary (first-listed) cloud instance only.
    const [firstAccessibleResource] = accessibleResources;
    return {id: firstAccessibleResource?.id, url: firstAccessibleResource?.url};
  }

  async listGlobalSpaces() {
    return (await this.request(`${this.restApiBaseUrl}/spaces?status=current&type=global&sort=name`, ConfluenceListSpacesCodec)).results;
  }

  // async getConfluencePage(pageId: string): Promise<t.TypeOf<typeof ConfluencePageCodec>> {
  //   return this.request(`/wiki/rest/api/content/${pageId}`, ConfluencePageCodec);
  // }

  // Add other methods for different endpoints
}
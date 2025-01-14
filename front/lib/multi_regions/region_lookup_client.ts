import type {
  UserLookupRequestBodyType,
  UserLookupResponse,
  WorkspaceLookupRequestBodyType,
  WorkspaceLookupResponse,
} from "@app/pages/api/lookup/[resource]";

import { config } from "./config";

type Resource = "user";

export class RegionLookupClient {
  private async lookup<T extends object, U>(resource: Resource, body: U) {
    const dustAlternativeRegionUrl = config.getAlternativeRegionUrl();
    const response = await fetch(
      `${dustAlternativeRegionUrl}/api/lookup/${resource}`,
      {
        method: "POST",
        headers: this.getDefaultHeaders(),
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    if ("error" in data) {
      throw new Error(
        `${dustAlternativeRegionUrl} lookup failed: ${data.error.message}`
      );
    } else {
      return {
        response: data as T,
      };
    }
  }

  private getDefaultHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.getLookupApiSecret()}`,
    };
  }

  async lookupUser(user: UserLookupRequestBodyType["user"]) {
    return this.lookup<UserLookupResponse, UserLookupRequestBodyType>("user", {
      user,
    });
  }

  async lookupWorkspace(
    workspace: WorkspaceLookupRequestBodyType["workspace"]
  ) {
    return this.lookup<WorkspaceLookupResponse, WorkspaceLookupRequestBodyType>(
      "workspace",
      {
        workspace,
      }
    );
  }
}

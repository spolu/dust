import type { MembershipRoleType } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";
import type { RequestMethod } from "node-mocks-http";
import { createMocks } from "node-mocks-http";
import { vi } from "vitest";

import { groupFactory } from "@app/tests/utils/GroupFactory";
import { membershipFactory } from "@app/tests/utils/MembershipFactory";
import { userFactory } from "@app/tests/utils/UserFactory";
import { workspaceFactory } from "@app/tests/utils/WorkspaceFactory";

vi.mock(import("../../lib/auth"), async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    getSession: vi.fn(),
  };
});

import { getSession } from "../../lib/auth";

/**
 * Creates a mock request with authentication for testing private API endpoints.
 *
 * This helper sets up a test workspace with a user and membership, then creates
 * a mock request authenticated with that user. Used to simulate authenticated API calls
 * in tests.
 *
 * @param options Configuration options
 * @param options.method HTTP method to use for the request (default: "GET")
 * @param options.role Role to assign to the user in the workspace (default: "user")
 * @returns Object containing:
 *   - req: Mocked NextApiRequest
 *   - res: Mocked NextApiResponse
 *   - workspace: Created test workspace
 *   - user: Created test user
 *   - membership: Created workspace membership
 *   - globalGroup: Created global group for the workspace
 */
export const createPrivateApiMockRequest = async ({
  method = "GET",
  role = "user",
}: { method?: RequestMethod; role?: MembershipRoleType } = {}) => {
  const workspace = await workspaceFactory().basic().create();
  const user = await userFactory().basic().create();
  const globalGroup = await groupFactory().global(workspace).create();

  const membership = await membershipFactory()
    .associate(workspace, user, role)
    .create();

  // Mock the getSession function to return the user without going through the auth0 session
  vi.mocked(getSession).mockReturnValue(
    Promise.resolve({
      user: {
        sub: user.auth0Sub!,
        email: user.email!,
        email_verified: true,
        name: user.username!,
        nickname: user.username!,
      },
    })
  );

  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: method,
    query: { wId: workspace.sId },
    headers: {},
  });

  return { req, res, workspace, user, membership, globalGroup };
};

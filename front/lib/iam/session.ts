import type { Session } from "@auth0/nextjs-auth0";
import type { RoleType, UserTypeWithWorkspaces } from "@dust-tt/types";
import { Op } from "sequelize";

import {
  fetchUserFromSession,
  maybeUpdateFromExternalUser,
} from "@app/lib/iam/users";
import { Membership, Workspace } from "@app/lib/models";

/**
 * Retrieves the user for a given session
 * @param session any NextAuth session
 * @returns Promise<UserType | null>
 */
export async function getUserFromSession(
  session: Session | null
): Promise<UserTypeWithWorkspaces | null> {
  if (!session) {
    return null;
  }

  const user = await fetchUserFromSession(session);
  if (!user) {
    return null;
  }

  const memberships = await Membership.findAll({
    where: {
      userId: user.id,
      role: { [Op.in]: ["admin", "builder", "user"] },
    },
  });
  const workspaces = await Workspace.findAll({
    where: {
      id: memberships.map((m) => m.workspaceId),
    },
  });

  // TODO:
  await maybeUpdateFromExternalUser(user, session.user as ExternalUser);

  return {
    id: user.id,
    auth0Sub: user.auth0Sub,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.firstName + (user.lastName ? ` ${user.lastName}` : ""),
    image: user.imageUrl,
    workspaces: workspaces.map((w) => {
      const m = memberships.find((m) => m.workspaceId === w.id);
      let role = "none" as RoleType;
      if (m) {
        switch (m.role) {
          case "admin":
          case "builder":
          case "user":
            role = m.role;
            break;
          default:
            role = "none";
        }
      }
      return {
        id: w.id,
        sId: w.sId,
        name: w.name,
        role,
        segmentation: w.segmentation || null,
      };
    }),
  };
}

import type { Session } from "@auth0/nextjs-auth0";
import type { Attributes } from "sequelize";

import type { User } from "@app/lib/models/user";

// This maps to the Auth0 user.
export interface ExternalUser {
  given_name: string;
  family_name: string;
  nickname?: string;
  name: string;
  picture?: string;
  email: string;
  email_verified: boolean;
  sub: string;
}

export function isExternalUser(user: Session["user"]): user is ExternalUser {
  return (
    typeof user === "object" &&
    "given_name" in user &&
    "family_name" in user &&
    "name" in user &&
    "picture" in user &&
    "email" in user &&
    "email_verified" in user &&
    "sub" in user
  );
}

export function convertAuth0UserToAppUser(
  externalUser: ExternalUser
): Partial<Attributes<User>> {
  return {
    auth0Sub: externalUser.sub,
    username: externalUser.nickname,
    email: externalUser.email,
    name: externalUser.name,
    firstName: externalUser.given_name,
    lastName: externalUser.family_name,
  };
}

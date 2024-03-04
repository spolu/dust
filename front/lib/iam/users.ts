import type { Session } from "@auth0/nextjs-auth0";

import type { ExternalUser } from "@app/lib/iam/auth0";
import { isExternalUser } from "@app/lib/iam/auth0";
import { User } from "@app/lib/models/user";

interface LegacyProviderInfo {
  provider: "google" | "github";
  providerId: string;
}

async function fetchUserWithAuth0Sub(sub: string) {
  const userWithAuth0 = await User.findOne({
    where: {
      auth0Sub: sub,
    },
  });

  return userWithAuth0;
}

async function fetchUserWithLegacyProvider(
  { provider, providerId }: LegacyProviderInfo,
  sub: string
) {
  const user = await User.findOne({
    where: {
      provider,
      providerId,
    },
  });

  // If a legacy user is found, attach the Auth0 user ID (sub) to the existing user account.
  if (user) {
    console.log(">> updating user sub:", new Error().stack);
    await user.update({ auth0Sub: sub });
  }

  return user;
}

export async function fetchUserFromSession(session: Session) {
  const { user } = session;

  if (!isExternalUser(user)) {
    return null;
  }

  const { sub } = user;
  if (!sub) {
    return null;
  }

  const userWithAuth0 = await fetchUserWithAuth0Sub(sub);
  if (userWithAuth0) {
    return userWithAuth0;
  }

  const legacyProviderInfo = mapAuth0ProviderToLegacy(session);
  if (!legacyProviderInfo) {
    return null;
  }

  return fetchUserWithLegacyProvider(legacyProviderInfo, sub);
}

function mapAuth0ProviderToLegacy(session: Session): LegacyProviderInfo | null {
  const { user } = session;

  const [rawProvider, providerId] = user.sub.split("|");
  switch (rawProvider) {
    case "google-oauth2":
      return { provider: "google", providerId };

    // TODO(2024-03-01 flav): Update the rawProvider once tested with GitHub.
    case "github":
      return { provider: "github", providerId };

    default:
      return null;
  }
}

export async function maybeUpdateFromExternalUser(
  user: User,
  externalUser: ExternalUser
) {
  if (externalUser.picture && externalUser.picture !== user.imageUrl) {
    void User.update(
      {
        imageUrl: externalUser.picture,
      },
      {
        where: {
          id: user.id,
        },
      }
    );
  }
}

export async function createOrUpdateUser(session: Session): Promise<User> {
  const { user: externalUser } = session;

  if (!isExternalUser(externalUser)) {
    // Throw error!
    throw new Error("");
  }

  // TODO: We should only update user sub here.
  const user = await fetchUserFromSession(session);

  console.log(">> user:", user?.toJSON());

  if (user) {
    // Update the user object from the updated session information.
    user.firstName = externalUser.given_name;
    user.lastName = externalUser.family_name;
    user.name = externalUser.name;
    user.username = externalUser.nickname ?? externalUser.name;

    // We only update the user's email if the email is verified.
    if (externalUser.email_verified) {
      user.email = externalUser.email;
    }

    await user.save();

    return user;
  } else {
    return User.create({
      auth0Sub: externalUser.sub,
      email: externalUser.email,
      firstName: externalUser.given_name,
      lastName: externalUser.family_name,
      name: externalUser.name,
      username: externalUser.nickname ?? externalUser.name,
    });
  }
}

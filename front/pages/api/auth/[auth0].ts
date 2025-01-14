import type { AfterCallbackPageRoute, LoginOptions } from "@auth0/nextjs-auth0";
import {
  CallbackHandlerError,
  handleAuth,
  handleCallback,
  handleLogin,
  handleLogout,
  IdentityProviderError,
} from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";

import { getRegionForUserSession, setRegionForUser } from "@app/lib/api/auth0";
import config from "@app/lib/api/config";
import type { RegionType } from "@app/lib/api/regions/config";
import { config as multiRegionsConfig } from "@app/lib/api/regions/config";
import { checkUserRegionAffinity } from "@app/lib/api/regions/lookup";
import { getRegionFromRequest } from "@app/lib/api/regions/utils";
import { isEmailValid } from "@app/lib/utils";
import logger from "@app/logger/logger";
import { statsDClient } from "@app/logger/withlogging";

const isString = (value: unknown): value is string => typeof value === "string";

const afterCallback: AfterCallbackPageRoute = async (req, res, session) => {
  const currentRegion = multiRegionsConfig.getCurrentRegion();

  let targetRegion: RegionType | null = null;

  // If user has a region, redirect to the region page.
  const userSessionRegion = getRegionForUserSession(session);
  if (userSessionRegion) {
    targetRegion = userSessionRegion;
  } else {
    // For new users or users without region, perform lookup.
    const regionWithAffinityRes = await checkUserRegionAffinity({
      email: session.user.email,
      email_verified: session.user.email_verified,
    });

    // Throw error it will be caught by the callback wrapper.
    if (regionWithAffinityRes.isErr()) {
      throw regionWithAffinityRes.error;
    }

    if (regionWithAffinityRes.value.hasAffinity) {
      targetRegion = regionWithAffinityRes.value.region;
    } else {
      // Use original region as fallback.
      targetRegion = getRegionFromRequest(req);
    }

    // Update Auth0 metadata only once when not set.
    await setRegionForUser(session, targetRegion);

    // Update current session with new metadata.
    session.user.app_metadata = {
      ...session.user.app_metadata,
      region: targetRegion,
    };
  }

  // Handle redirect to other region if needed.
  if (targetRegion !== currentRegion) {
    const targetRegionInfo = multiRegionsConfig.getOtherRegionInfo();

    res.writeHead(302, {
      Location: `${targetRegionInfo.url}${req.url}`,
    });
    res.end();
    return;
  }

  return session;
};

export default handleAuth({
  login: handleLogin((req) => {
    const { connection, screen_hint, login_hint } =
      "query" in req
        ? req.query
        : {
            connection: undefined,
            login_hint: undefined,
            screen_hint: undefined,
          };

    const defaultAuthorizationParams: Partial<
      LoginOptions["authorizationParams"]
    > = {
      scope: "openid profile email",
    };

    // Set the Auth0 connection based on the provided connection param, redirecting the user to the correct screen.
    if (isString(connection)) {
      defaultAuthorizationParams.connection = connection;
    }

    if (isString(screen_hint) && screen_hint === "signup") {
      defaultAuthorizationParams.screen_hint = screen_hint;
    }

    if (isString(login_hint) && isEmailValid(login_hint)) {
      defaultAuthorizationParams.login_hint = login_hint;
    }

    return {
      authorizationParams: defaultAuthorizationParams,
      returnTo: "/api/login", // Note from seb, I think this is not used
    };
  }),
  callback: async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handleCallback(req, res, { afterCallback });
    } catch (error) {
      let reason: string | null = null;

      if (error instanceof CallbackHandlerError) {
        if (error.cause instanceof IdentityProviderError) {
          const { error: err, errorDescription } = error.cause;
          if (err === "access_denied") {
            reason = errorDescription ?? err;
          } else {
            reason = err ?? null;
          }
        }

        logger.info(
          { cause: error.cause?.message, reason },
          "login error in auth0 callback"
        );

        statsDClient.increment("login.callback.error", 1, [
          `error:${error.cause?.message}`,
        ]);

        return res.redirect(`/login-error?reason=${reason}`);
      }

      statsDClient.increment("login.callback.error", 1, ["error:unknow"]);

      return res.redirect("/login-error");
    }
  },
  logout: handleLogout((req) => {
    return {
      returnTo:
        "query" in req
          ? (req.query.returnTo as string)
          : config.getClientFacingUrl(),
    };
  }),
});

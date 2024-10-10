import { generatePKCE, randomString } from "./src/lib/utils";
import {
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_DOMAIN,
  AUTH0_CLIENT_ID,
  AuthBackroundMessage,
  Auth0AuthorizeResponse,
  AuthBackgroundResponse,
} from "./src/lib/auth";

/**
 * Listener to open/close the side panel when the user clicks on the extension icon.
 */
chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

/**
 * Listener for messages sent from the react app to the background script.
 * For now we use messages to authenticate the user.
 */
chrome.runtime.onMessage.addListener(
  (
    message: AuthBackroundMessage,
    sender,
    sendResponse: (
      response: Auth0AuthorizeResponse | AuthBackgroundResponse
    ) => void
  ) => {
    switch (message.type) {
      case "AUTHENTICATE":
        void authenticate(sendResponse);
        return true; // Keep the message channel open for async response.

      case "LOGOUT":
        void logout(sendResponse);
        return true; // Keep the message channel open.

      default:
        console.error(`Unknown message type: ${message.type}.`);
    }
  }
);

/**
 * Authenticate the user using Auth0.
 */
const authenticate = async (
  sendResponse: (auth: Auth0AuthorizeResponse | AuthBackgroundResponse) => void
) => {
  if (!AUTH0_CLIENT_ID || !AUTH0_CLIENT_DOMAIN) {
    console.error("Auth0 client ID or domain is missing.");
    return;
  }

  const redirectUrl = chrome.identity.getRedirectURL();
  const { codeVerifier, codeChallenge } = await generatePKCE();
  const options = {
    client_id: AUTH0_CLIENT_ID,
    response_type: "code", // Use code response type for PKCE.
    scope: "openid profile email offline_access",
    redirect_uri: redirectUrl,
    audience: AUTH0_AUDIENCE,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  };

  const queryString = new URLSearchParams(options).toString();
  const authUrl = `https://${AUTH0_CLIENT_DOMAIN}/authorize?${queryString}`;

  chrome.identity.launchWebAuthFlow(
    { url: authUrl, interactive: true },
    async (redirectUrl) => {
      if (chrome.runtime.lastError) {
        console.error(`Auth error: ${chrome.runtime.lastError.message}`);
        sendResponse({ success: false });
        return;
      }
      if (!redirectUrl || redirectUrl.includes("error")) {
        console.error(`Auth error in redirect URL: ${redirectUrl}`);
        sendResponse({ success: false });
        return;
      }

      const url = new URL(redirectUrl);
      const queryParams = new URLSearchParams(url.search);
      const authorizationCode = queryParams.get("code");

      if (authorizationCode) {
        const data = await exchangeCodeForTokens(
          authorizationCode,
          codeVerifier
        );
        sendResponse(data);
      } else {
        console.error(`No authorization code in redirect URL: ${redirectUrl}`);
        sendResponse({ success: false });
      }
    }
  );
};

/**
 *  Exchange authorization code for tokens
 */
const exchangeCodeForTokens = async (
  code: string,
  codeVerifier: string
): Promise<Auth0AuthorizeResponse | AuthBackgroundResponse> => {
  try {
    if (!AUTH0_CLIENT_ID || !AUTH0_CLIENT_DOMAIN) {
      throw new Error("Auth0 client ID or domain is missing.");
    }

    const tokenUrl = `https://${AUTH0_CLIENT_DOMAIN}/oauth/token`;
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: AUTH0_CLIENT_ID,
        code_verifier: codeVerifier,
        code,
        redirect_uri: chrome.identity.getRedirectURL(),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(
        `Token exchange failed: ${data.error} - ${data.error_description}`
      );
    }

    const data = await response.json();
    return {
      idToken: data.id_token,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    console.error(`Token exchange error: ${message}`);
    return { success: false };
  }
};

/**
 * Logout the user from Auth0.
 */
const logout = (sendResponse: (response: AuthBackgroundResponse) => void) => {
  const redirectUri = chrome.identity.getRedirectURL();
  const logoutUrl = `https://${AUTH0_CLIENT_DOMAIN}/v2/logout?client_id=${AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(redirectUri)}`;

  chrome.identity.launchWebAuthFlow(
    { url: logoutUrl, interactive: true },
    () => {
      if (chrome.runtime.lastError) {
        console.error("Logout error:", chrome.runtime.lastError.message);
        sendResponse({ success: false });
      } else {
        sendResponse({ success: true });
      }
    }
  );
};

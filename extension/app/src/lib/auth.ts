// Auth0 config.
export const AUTH0_CLIENT_DOMAIN = process.env.AUTH0_CLIENT_DOMAIN;
export const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
export const AUTH0_AUDIENCE = `https://${AUTH0_CLIENT_DOMAIN}/api/v2/`;
export const AUTH0_PROFILE_ROUTE = `https://${AUTH0_CLIENT_DOMAIN}/userinfo`;

export type Auth0AuthorizeResponse = {
  idToken: string | null;
  accessToken: string | null;
  code: string | null;
  expiresIn: string | null;
};

export type AuthBackgroundResponse = {
  success: boolean;
};

export type AuthBackroundMessage = {
  type: "AUTHENTICATE" | "LOGOUT";
};

/**
 * Sends an authentication request to the background script.
 * Wrapped to ensure the service worker is ready to receive messages.
 */
export const sendAuthMessage = (): Promise<Auth0AuthorizeResponse> => {
  return new Promise((resolve, reject) => {
    const message: AuthBackroundMessage = { type: "AUTHENTICATE" };
    chrome.runtime.sendMessage(
      message,
      (response: Auth0AuthorizeResponse | undefined) => {
        const error = chrome.runtime.lastError;
        if (error) {
          if (error.message?.includes("Could not establish connection")) {
            // Attempt to wake up the service worker
            chrome.runtime.getBackgroundPage(() => {
              chrome.runtime.sendMessage(
                message,
                (response: Auth0AuthorizeResponse | undefined) => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve(response as Auth0AuthorizeResponse);
                  }
                }
              );
            });
          } else {
            reject(new Error(error.message || "An unknown error occurred"));
          }
        } else {
          resolve(response as Auth0AuthorizeResponse);
        }
      }
    );
  });
};

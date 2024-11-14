import { saveTokens } from "@extension/lib/storage";

export type Auth0AuthorizeResponse = {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
};
export type AuthBackgroundResponse = {
  success: boolean;
};

export type AuthBackgroundMessage = {
  type: "AUTHENTICATE" | "REFRESH_TOKEN" | "LOGOUT" | "SIGN_CONNECT";
  refreshToken?: string;
};

export type GetActiveTabOptions = {
  includeContent: boolean;
  includeScreenshot: boolean;
  includeSelectionOnly?: boolean;
};

export type GetActiveTabBackgroundMessage = {
  type: "GET_ACTIVE_TAB";
} & GetActiveTabOptions;

export type GetActiveTabBackgroundResponse = {
  title: string;
  url: string;
  content?: string;
  screenshot?: string;
};

export type AttachSelectionMessage = {
  type: "ATTACH_TAB";
} & GetActiveTabOptions;

export type AttachAndSubmitMessage = {
  type: "ATTACH_TAB_AND_SUBMIT";
  text: string;
  configurationId: string;
} & GetActiveTabOptions;

export type InputBarStatusMessage = {
  type: "INPUT_BAR_STATUS";
  available: boolean;
};

export type RouteChangeMesssage = {
  type: "ROUTE_CHANGE";
  pathname: string;
  search: string;
};

const sendMessage = <T, U>(message: T): Promise<U> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: U | undefined) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      if (!response) {
        return reject(new Error("No response received."));
      }
      return resolve(response);
    });
  });
};

/**
 * Messages to the background script to authenticate, refresh tokens, and logout.
 */

export const sendAuthMessage = (): Promise<Auth0AuthorizeResponse> => {
  return new Promise((resolve, reject) => {
    const message: AuthBackgroundMessage = { type: "AUTHENTICATE" };
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
                    return reject(chrome.runtime.lastError);
                  }
                  if (!response) {
                    return reject(new Error("No response received."));
                  }
                  return resolve(response);
                }
              );
            });
          } else {
            reject(new Error(error.message || "An unknown error occurred."));
          }
        }
        if (!response) {
          return reject(new Error("No response received."));
        }
        return resolve(response);
      }
    );
  });
};

export const sendRefreshTokenMessage = (
  refreshToken: string
): Promise<Auth0AuthorizeResponse> => {
  return new Promise((resolve, reject) => {
    const message: AuthBackgroundMessage = {
      type: "REFRESH_TOKEN",
      refreshToken,
    };
    chrome.runtime.sendMessage(
      message,
      (response: Auth0AuthorizeResponse | undefined) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        if (!response) {
          return reject(new Error("No response received."));
        }
        if (
          !response.accessToken ||
          !response.refreshToken ||
          !response.expiresIn
        ) {
          return reject(new Error("Invalid response received."));
        }
        void saveTokens(response);
        return resolve(response);
      }
    );
  });
};

export const sentLogoutMessage = (): Promise<AuthBackgroundResponse> => {
  return sendMessage<AuthBackgroundMessage, AuthBackgroundResponse>({
    type: "LOGOUT",
  });
};

/**
 * Message to the background script to get the active tab content.
 */

export const sendGetActiveTabMessage = (params: GetActiveTabOptions) => {
  return sendMessage<
    GetActiveTabBackgroundMessage,
    GetActiveTabBackgroundResponse
  >({
    type: "GET_ACTIVE_TAB",
    ...params,
  });
};

export const sendInputBarStatus = (available: boolean) => {
  return sendMessage<InputBarStatusMessage, void>({
    type: "INPUT_BAR_STATUS",
    available,
  });
};

// Messages from background script to content script

export const sendAttachSelection = (
  opts: GetActiveTabOptions = { includeContent: true, includeScreenshot: false }
) => {
  return sendMessage<AttachSelectionMessage, void>({
    type: "ATTACH_TAB",
    ...opts,
  });
};

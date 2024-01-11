import { ExternalOauthTokenError } from "@connectors/lib/error";

// This type is a simplified abstraction and
// does not fully represent the structure of errors returned by the Notion API.
interface NotionError extends Error {
  body: unknown;
  code: string;
  status: number;
}

export function isNotionError(error: Error): error is NotionError {
  return "code" in error;
}

export class NotionExternalOauthTokenError extends ExternalOauthTokenError {
  constructor(readonly innerError?: Error) {
    super(innerError?.message);
    this.name = "NotionExternalOauthTokenError";
  }
}

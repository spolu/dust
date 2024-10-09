import type {
  PluginArgDefinition,
  PluginArgs,
  PluginManifest,
  Result,
} from "@dust-tt/types";

import type { Authenticator } from "@app/lib/auth";

// Helper type to infer the correct TypeScript type from SupportedArgType.
type InferArgType<T extends PluginArgDefinition["type"]> = T extends "string"
  ? string
  : T extends "number"
    ? number
    : T extends "boolean"
      ? boolean
      : never;

export interface Plugin<T extends PluginArgs> {
  manifest: PluginManifest<T>;
  execute: (
    auth: Authenticator,
    resourceId: string | undefined,
    args: { [K in keyof T]: InferArgType<T[K]["type"]> }
  ) => Promise<Result<string, Error>>;
}

export function createPlugin<T extends PluginArgs>(
  manifest: PluginManifest<T>,
  execute: Plugin<T>["execute"]
): Plugin<T> {
  return { manifest, execute };
}

export type PluginListItem = Pick<
  PluginManifest<PluginArgs>,
  "id" | "title" | "description"
>;

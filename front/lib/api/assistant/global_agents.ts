import fs from "fs";
import path from "path";
import { promisify } from "util";

const readFileAsync = promisify(fs.readFile);

import { Authenticator, prodAPICredentialsForOwner } from "@app/lib/auth";
import { ConnectorProvider } from "@app/lib/connectors_api";
import { DustAPI } from "@app/lib/dust_api";
import logger from "@app/logger/logger";
import { AgentConfigurationType } from "@app/types/assistant/agent";
import { UserType } from "@app/types/user";

/**
 * GLOBAL AGENTS CONFIGURATION
 *
 * To add an agent:
 * - Add a unique SID in GLOBAL_AGENTS_SID.
 * - Add a unique ID in GLOBAL_AGENTS_ID.
 * - Add a case in getGlobalAgent with associated function.
 */

enum GLOBAL_AGENTS_SID {
  HELPER = "helper",
  DUST = "dust",
  SLACK = "slack",
  GOOGLE_DRIVE = "google_drive",
  NOTION = "notion",
  GITHUB = "github",
  GPT4 = "gpt-4",
  CLAUDE = "claude-2",
  GPT35_TURBO = "gpt-3.5-turbo",
  CLAUDE_INSTANT = "claude-instant-1",
}

async function _getHelperGlobalAgent(
  user: UserType | null
): Promise<AgentConfigurationType> {
  let prompt = "";

  if (user) {
    prompt = `My name is ${user.name}. `;
  }

  try {
    const filePath = path.join(
      process.cwd(),
      "prompt/global_agent_helper_prompt.md"
    );
    const staticPrompt = await readFileAsync(filePath, "utf-8");
    if (staticPrompt) {
      prompt = prompt + staticPrompt;
    }
  } catch (err) {
    logger.error("Error reading prompt file for @helper agent:", err);
  }
  return {
    id: -1,
    sId: GLOBAL_AGENTS_SID.HELPER,
    name: "helper",
    description:
      "Here to help with everything about assistant, and Dust's product in general",
    pictureUrl: "https://dust.tt/static/systemavatar/helper_avatar_full.png",
    status: "active",
    scope: "global",
    generation: {
      id: -1,
      prompt: prompt,
      model: {
        providerId: "openai",
        modelId: "gpt-3.5-turbo",
      },
      temperature: 0.7,
    },
    action: null,
  };
}

async function _getGPT35TurboGlobalAgent(): Promise<AgentConfigurationType> {
  return {
    id: -1,
    sId: GLOBAL_AGENTS_SID.GPT35_TURBO,
    name: "gpt3.5-turbo",
    description: "OpenAI's cost-effective and high throughput model.",
    pictureUrl: "https://dust.tt/static/systemavatar/gpt3_avatar_full.png",
    status: "active",
    scope: "global",
    generation: {
      id: -1,
      prompt: "",
      model: {
        providerId: "openai",
        modelId: "gpt-3.5-turbo",
      },
      temperature: 0.7,
    },
    action: null,
  };
}

async function _getGPT4GlobalAgent(): Promise<AgentConfigurationType> {
  return {
    id: -1,
    sId: GLOBAL_AGENTS_SID.GPT4,
    name: "gpt4",
    description: "OpenAI's most powerful model.",
    pictureUrl: "https://dust.tt/static/systemavatar/gpt4_avatar_full.png",
    status: "active",
    scope: "global",
    generation: {
      id: -1,
      prompt: "",
      model: {
        providerId: "openai",
        modelId: "gpt-4",
      },
      temperature: 0.7,
    },
    action: null,
  };
}

async function _getClaudeInstantGlobalAgent(): Promise<AgentConfigurationType> {
  return {
    id: -1,
    sId: GLOBAL_AGENTS_SID.CLAUDE_INSTANT,
    name: "claude-instant",
    description: "Anthropic's low-latency and high throughput model.",
    pictureUrl: "https://dust.tt/static/systemavatar/claude_avatar_full.png",
    status: "active",
    scope: "global",
    generation: {
      id: -1,
      prompt: "",
      model: {
        providerId: "anthropic",
        modelId: "claude-instant-1.2",
      },
      temperature: 0.7,
    },
    action: null,
  };
}

async function _getClaudeGlobalAgent(): Promise<AgentConfigurationType> {
  return {
    id: -1,
    sId: GLOBAL_AGENTS_SID.CLAUDE,
    name: "claude",
    description: "Anthropic's superior performance model.",
    pictureUrl: "https://dust.tt/static/systemavatar/claude_avatar_full.png",
    status: "active",
    scope: "global",
    generation: {
      id: -1,
      prompt: "",
      model: {
        providerId: "anthropic",
        modelId: "claude-2",
      },
      temperature: 0.7,
    },
    action: null,
  };
}

async function _getManagedDataSourceAgent(
  auth: Authenticator,
  connectorProvider: ConnectorProvider,
  agentId: GLOBAL_AGENTS_SID,
  name: string,
  description: string,
  pictureUrl: string,
  prompt: string
): Promise<AgentConfigurationType | null> {
  const owner = auth.workspace();
  if (!owner) {
    throw new Error("Unexpected `auth` without `workspace`.");
  }

  const prodCredentials = await prodAPICredentialsForOwner(owner);
  const api = new DustAPI(prodCredentials);

  const dsRes = await api.getDataSources(prodCredentials.workspaceId);
  if (dsRes.isErr()) {
    return null;
  }

  const dataSources = dsRes.value.filter(
    (d) => d.connectorProvider === connectorProvider
  );

  if (dataSources.length === 0) {
    return null;
  }

  return {
    id: -1,
    sId: agentId,
    name: name,
    description,
    pictureUrl,
    status: "active",
    scope: "global",
    generation: {
      id: -1,
      prompt,
      model: {
        providerId: "openai",
        modelId: "gpt-4",
      },
      temperature: 0.4,
    },
    action: {
      id: -1,
      sId: agentId + "-action",
      type: "retrieval_configuration",
      query: "auto",
      relativeTimeFrame: "auto",
      topK: 16,
      dataSources: dataSources.map((ds) => ({
        dataSourceId: ds.name,
        workspaceId: prodCredentials.workspaceId,
        filter: { tags: null, parents: null },
      })),
    },
  };
}

async function _getGoogleDriveGlobalAgent(
  auth: Authenticator
): Promise<AgentConfigurationType | null> {
  return await _getManagedDataSourceAgent(
    auth,
    "google_drive",
    GLOBAL_AGENTS_SID.GOOGLE_DRIVE,
    "googledrive",
    "An assistant with context on your Google Drives.",
    "https://dust.tt/static/systemavatar/drive_avatar_full.png",
    "Assist the user based on the retrieved data from their Google Drives."
  );
}

async function _getSlackGlobalAgent(auth: Authenticator) {
  return await _getManagedDataSourceAgent(
    auth,
    "slack",
    GLOBAL_AGENTS_SID.SLACK,
    "slack",
    "An assistant with context on your Slack Channels.",
    "https://dust.tt/static/systemavatar/slack_avatar_full.png",
    "Assist the user based on the retrieved data from their Slack Channels."
  );
}

async function _getGithubGlobalAgent(auth: Authenticator) {
  return await _getManagedDataSourceAgent(
    auth,
    "github",
    GLOBAL_AGENTS_SID.GITHUB,
    "github",
    "An assistant with context on your Github Issues and Discussions.",
    "https://dust.tt/static/systemavatar/github_avatar_full.png",
    "Assist the user based on the retrieved data from their Github Issues and Discussions."
  );
}

async function _getNotionGlobalAgent(
  auth: Authenticator
): Promise<AgentConfigurationType | null> {
  return await _getManagedDataSourceAgent(
    auth,
    "notion",
    GLOBAL_AGENTS_SID.NOTION,
    "notion",
    "An assistant with context on your Notion Spaces.",
    "https://dust.tt/static/systemavatar/notion_avatar_full.png",
    "Assist the user based on the retrieved data from their Notion Spaces."
  );
}

async function _getDustGlobalAgent(
  auth: Authenticator
): Promise<AgentConfigurationType | null> {
  const owner = auth.workspace();
  if (!owner) {
    throw new Error("Unexpected `auth` without `workspace`.");
  }

  const prodCredentials = await prodAPICredentialsForOwner(owner);
  const api = new DustAPI(prodCredentials);

  const dsRes = await api.getDataSources(prodCredentials.workspaceId);
  if (dsRes.isErr()) {
    return null;
  }

  const dataSources = dsRes.value.filter(
    (d) => d.assistantDefaultSelected === true
  );

  if (dataSources.length === 0) {
    return null;
  }

  return {
    id: -1,
    sId: GLOBAL_AGENTS_SID.DUST,
    name: "Dust",
    description:
      "An assistant with context on your managed and static data sources.",
    pictureUrl: "https://dust.tt/static/systemavatar/dust_avatar_full.png",
    status: "active",
    scope: "global",
    generation: {
      id: -1,
      prompt:
        "Assist the user based on the retrieved data from their workspace.",
      model: {
        providerId: "openai",
        modelId: "gpt-4",
      },
      temperature: 0.4,
    },
    action: {
      id: -1,
      sId: GLOBAL_AGENTS_SID.DUST + "-action",
      type: "retrieval_configuration",
      query: "auto",
      relativeTimeFrame: "auto",
      topK: 16,
      dataSources: dataSources.map((ds) => ({
        dataSourceId: ds.name,
        workspaceId: prodCredentials.workspaceId,
        filter: { tags: null, parents: null },
      })),
    },
  };
}

/**
 * EXPORTED FUNCTIONS
 */

export function isGlobalAgentId(sId: string): boolean {
  return (Object.values(GLOBAL_AGENTS_SID) as string[]).includes(sId);
}

export async function getGlobalAgent(
  auth: Authenticator,
  sId: string | number
): Promise<AgentConfigurationType | null> {
  const owner = auth.workspace();
  if (!owner) {
    throw new Error("Cannot find Global Agent Configuration: no workspace.");
  }
  const user = auth.user();

  switch (sId) {
    case GLOBAL_AGENTS_SID.HELPER:
      return _getHelperGlobalAgent(user);
    case GLOBAL_AGENTS_SID.GPT35_TURBO:
      return _getGPT35TurboGlobalAgent();
    case GLOBAL_AGENTS_SID.GPT4:
      return _getGPT4GlobalAgent();
    case GLOBAL_AGENTS_SID.CLAUDE_INSTANT:
      return _getClaudeInstantGlobalAgent();
    case GLOBAL_AGENTS_SID.CLAUDE:
      return _getClaudeGlobalAgent();
    case GLOBAL_AGENTS_SID.SLACK:
      return _getSlackGlobalAgent(auth);
    case GLOBAL_AGENTS_SID.GOOGLE_DRIVE:
      return _getGoogleDriveGlobalAgent(auth);
    case GLOBAL_AGENTS_SID.NOTION:
      return _getNotionGlobalAgent(auth);
    case GLOBAL_AGENTS_SID.GITHUB:
      return _getGithubGlobalAgent(auth);
    case GLOBAL_AGENTS_SID.DUST:
      return _getDustGlobalAgent(auth);
    default:
      return null;
  }
}

export async function getGlobalAgents(
  auth: Authenticator
): Promise<AgentConfigurationType[]> {
  const owner = auth.workspace();
  if (!owner) {
    throw new Error("Cannot find Global Agent Configuration: no workspace.");
  }
  const user = auth.user();

  // For now we retrieve them all
  // We will store them in the database later to allow admin enable them or not
  const globalAgents = [
    await _getHelperGlobalAgent(user),
    await _getGPT4GlobalAgent(),
    await _getGPT35TurboGlobalAgent(),
    await _getClaudeGlobalAgent(),
    await _getClaudeInstantGlobalAgent(),
  ];

  const slackAgent = await _getSlackGlobalAgent(auth);
  if (slackAgent) {
    globalAgents.push(slackAgent);
  }

  const googleDriveAgent = await _getGoogleDriveGlobalAgent(auth);
  if (googleDriveAgent) {
    globalAgents.push(googleDriveAgent);
  }
  const notionAgent = await _getNotionGlobalAgent(auth);
  if (notionAgent) {
    globalAgents.push(notionAgent);
  }
  const githubAgent = await _getGithubGlobalAgent(auth);
  if (githubAgent) {
    globalAgents.push(githubAgent);
  }
  const dustAgent = await _getDustGlobalAgent(auth);
  if (dustAgent) {
    globalAgents.push(dustAgent);
  }

  return globalAgents;
}

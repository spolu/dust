import {
  AnthropicLogo,
  GoogleLogo,
  MistralLogo,
  OpenaiLogo,
  PlanetIcon,
} from "@dust-tt/sparkle";
import type { ModelConfig, SUPPORTED_MODEL_CONFIGS } from "@dust-tt/types";
import {
  CLAUDE_3_5_HAIKU_DEFAULT_MODEL_CONFIG,
  CLAUDE_3_5_SONNET_DEFAULT_MODEL_CONFIG,
  DEEPSEEK_CHAT_MODEL_CONFIG,
  DEEPSEEK_REASONER_MODEL_CONFIG,
  GEMINI_2_FLASH_PREVIEW_MODEL_CONFIG,
  GEMINI_2_FLASH_THINKING_PREVIEW_MODEL_CONFIG,
  GEMINI_FLASH_DEFAULT_MODEL_CONFIG,
  GEMINI_PRO_DEFAULT_MODEL_CONFIG,
  GPT_4_TURBO_MODEL_CONFIG,
  GPT_4O_MINI_MODEL_CONFIG,
  GPT_4O_MODEL_CONFIG,
  MISTRAL_CODESTRAL_MODEL_CONFIG,
  MISTRAL_LARGE_MODEL_CONFIG,
  MISTRAL_SMALL_MODEL_CONFIG,
  O1_HIGH_REASONING_MODEL_CONFIG,
  O1_MINI_MODEL_CONFIG,
  O1_MODEL_CONFIG,
  TOGETHERAI_DEEPSEEK_R1_MODEL_CONFIG,
  TOGETHERAI_DEEPSEEK_V3_MODEL_CONFIG,
  TOGETHERAI_LLAMA_3_3_70B_INSTRUCT_TURBO_MODEL_CONFIG,
  TOGETHERAI_QWEN_2_5_CODER_32B_INSTRUCT_MODEL_CONFIG,
  TOGETHERAI_QWEN_72B_INSTRUCT_MODEL_CONFIG,
  TOGETHERAI_QWEN_QWQ_32B_PREVIEW_MODEL_CONFIG,
} from "@dust-tt/types";
import type { ComponentType } from "react";

type ModelProvider = (typeof SUPPORTED_MODEL_CONFIGS)[number]["providerId"];

export const MODEL_PROVIDER_LOGOS: Record<ModelProvider, ComponentType> = {
  openai: OpenaiLogo,
  anthropic: AnthropicLogo,
  mistral: MistralLogo,
  google_ai_studio: GoogleLogo,
  togetherai: PlanetIcon,
  deepseek: PlanetIcon,
};

export const USED_MODEL_CONFIGS: readonly ModelConfig[] = [
  GPT_4O_MODEL_CONFIG,
  GPT_4O_MINI_MODEL_CONFIG,
  GPT_4_TURBO_MODEL_CONFIG,
  O1_MODEL_CONFIG,
  O1_MINI_MODEL_CONFIG,
  O1_HIGH_REASONING_MODEL_CONFIG,
  CLAUDE_3_5_SONNET_DEFAULT_MODEL_CONFIG,
  CLAUDE_3_5_HAIKU_DEFAULT_MODEL_CONFIG,
  MISTRAL_LARGE_MODEL_CONFIG,
  MISTRAL_SMALL_MODEL_CONFIG,
  MISTRAL_CODESTRAL_MODEL_CONFIG,
  GEMINI_PRO_DEFAULT_MODEL_CONFIG,
  GEMINI_FLASH_DEFAULT_MODEL_CONFIG,
  GEMINI_2_FLASH_PREVIEW_MODEL_CONFIG,
  GEMINI_2_FLASH_THINKING_PREVIEW_MODEL_CONFIG,
  TOGETHERAI_LLAMA_3_3_70B_INSTRUCT_TURBO_MODEL_CONFIG,
  TOGETHERAI_QWEN_2_5_CODER_32B_INSTRUCT_MODEL_CONFIG,
  TOGETHERAI_QWEN_QWQ_32B_PREVIEW_MODEL_CONFIG,
  TOGETHERAI_QWEN_72B_INSTRUCT_MODEL_CONFIG,
  TOGETHERAI_DEEPSEEK_V3_MODEL_CONFIG,
  TOGETHERAI_DEEPSEEK_R1_MODEL_CONFIG,
  DEEPSEEK_CHAT_MODEL_CONFIG,
  DEEPSEEK_REASONER_MODEL_CONFIG,
] as const;

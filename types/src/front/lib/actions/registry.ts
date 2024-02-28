import { DustAppType } from "../../../front/lib/dust_api";

const PRODUCTION_DUST_APPS_WORKSPACE_ID = "78bda07b39";

export type Action = {
  app: DustAppType;
  config: { [key: string]: unknown };
};

const createActionRegistry = <K extends string, R extends Record<K, Action>>(
  registry: R
) => registry;

export const DustProdActionRegistry = createActionRegistry({
  "assistant-v2-inputs-generator": {
    app: {
      workspaceId: PRODUCTION_DUST_APPS_WORKSPACE_ID,
      appId: "f4816b1e13",
      appHash:
        "83dffd37b090ad428fd87f31140e283ac1a1595ca0c69758d184e1c96dc5d4cd",
    },
    config: {
      MODEL: {
        provider_id: "openai",
        model_id: "gpt-4-32k",
        function_call: "auto",
        use_cache: false,
      },
    },
  },
  "assistant-v2-title-generator": {
    app: {
      workspaceId: PRODUCTION_DUST_APPS_WORKSPACE_ID,
      appId: "84dfc1d4f7",
      appHash:
        "cddc215f2cc07e4a1bdd9c253524ac09667de629420af2570ab1e715fa4ee2b2",
    },
    config: {
      MODEL: {
        provider_id: "openai",
        model_id: "gpt-3.5-turbo-16k",
        function_call: "update_title",
        use_cache: false,
      },
    },
  },
  "assistant-v2-retrieval": {
    app: {
      workspaceId: PRODUCTION_DUST_APPS_WORKSPACE_ID,
      appId: "471b6aa923",
      appHash:
        "3b634a84930020a7a18d3b32f4c5f5cd85690bf4958127ba51061fb101edea33",
    },
    config: {
      DATASOURCE: {
        data_sources: [],
        top_k: 32,
        filter: { tags: null, parents: null, timestamp: null },
        use_cache: false,
      },
    },
  },
  "assistant-v2-generator": {
    app: {
      workspaceId: PRODUCTION_DUST_APPS_WORKSPACE_ID,
      appId: "6a27050429",
      appHash:
        "e0b00417afae51adc7e23c1365850fab154d9b945364c47074ef907915cf8c2c",
    },
    config: {
      MODEL: {
        provider_id: "openai",
        model_id: "gpt-4",
        function_call: null,
        use_cache: false,
        use_stream: true,
      },
    },
  },

  "doc-tracker-retrieval": {
    app: {
      workspaceId: PRODUCTION_DUST_APPS_WORKSPACE_ID,
      appId: "4180309c80",
      appHash:
        "8adcc9ae33a63cc735c9a23a97d7bffe658c6ef2400fc997e61e8817f611a1f8",
    },
    config: {
      SEMANTIC_SEARCH: {
        data_sources: [],
        // top k will probably need to be
        // proportional to the number of documents
        top_k: 64,
        filter: {
          tags: null,
          timestamp: null,
        },
        use_cache: false,
        full_text: false,
        target_document_tokens: 2000,
      },
    },
  },
  "doc-tracker-suggest-changes": {
    app: {
      workspaceId: PRODUCTION_DUST_APPS_WORKSPACE_ID,
      appId: "76b40f14fb",
      appHash:
        "93877e16b59a07eff3b4f154b8f568f172d6a463f27bd3bcbf5f6aa264216163",
    },
    config: {
      SUGGEST_CHANGES: {
        provider_id: "openai",
        model_id: "gpt-4",
        use_cache: false,
        function_call: "suggest_changes",
      },
    },
  },
  "extract-events": {
    app: {
      workspaceId: PRODUCTION_DUST_APPS_WORKSPACE_ID,
      appId: "d4f31b6a63",
      appHash:
        "65304e44043046ff37dd85e98b31557f21937a6b0b468fbfa2eb4bf424f1cc0d",
    },
    config: {
      MODEL: {
        provider_id: "openai",
        model_id: "gpt-4",
        use_cache: false,
        function_call: "extract_events",
      },
    },
  },
  "assistant-v2-query-tables": {
    app: {
      workspaceId: PRODUCTION_DUST_APPS_WORKSPACE_ID,
      appId: "b4f205e453",
      appHash:
        "fee382573c535c4d21d79c3d315b444eda6d6282f44127a2f6a3fb8b544d9f6d",
    },
    config: {
      MODEL: {
        provider_id: "openai",
        model_id: "gpt-4",
        use_cache: false,
        function_call: "execute_sql_query",
      },
    },
  },
  "assistant-builder-instructions-suggestions": {
    app: {
      workspaceId: PRODUCTION_DUST_APPS_WORKSPACE_ID,
      appId: "d995d868a8",
      appHash:
        "174d83511a51ba35dd57e840a2189a75474695e87b75902c9d04955367804446",
    },
    config: {
      INSTRUCTIONS_FINISHED: {
        provider_id: "openai",
        model_id: "gpt-3.5-turbo",
        function_call: "send_instructions_finished",
        use_cache: true,
      },
      CREATE_SUGGESTIONS: {
        provider_id: "openai",
        model_id: "gpt-4",
        function_call: "send_suggestions",
        use_cache: true,
      },
    },
  },
  "assistant-builder-name-suggestions": {
    app: {
      workspaceId: PRODUCTION_DUST_APPS_WORKSPACE_ID,
      appId: "34a8c4a2aa",
      appHash:
        "bbe701de9cbb4bc3e8670405326eead911dd4bc372de0611779af3aaad44902b",
    },
    config: {
      IS_FINISHED: {
        provider_id: "openai",
        model_id: "gpt-3.5-turbo",
        function_call: "send_creation_finished",
        use_cache: true,
      },
      CREATE_SUGGESTIONS: {
        provider_id: "openai",
        model_id: "gpt-4",
        function_call: "send_suggestions",
        use_cache: true,
      },
    },
  },
  "assistant-builder-description-suggestions": {
    app: {
      workspaceId: PRODUCTION_DUST_APPS_WORKSPACE_ID,
      appId: "aba0057f4c",
      appHash:
        "9f927c9386cf4ce85e91e8972b8580a19480805c982754a469511e9f163b08a0",
    },
    config: {
      CREATE_SUGGESTIONS: {
        provider_id: "openai",
        model_id: "gpt-4",
        function_call: "send_suggestions",
        use_cache: true,
      },
      IS_FINISHED: {
        provider_id: "openai",
        model_id: "gpt-3.5-turbo",
        function_call: "send_instructions_finished",
        use_cache: true,
      },
    },
  },
});

export type DustRegistryActionName = keyof typeof DustProdActionRegistry;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cloneBaseConfig(config: { [model: string]: any }) {
  return JSON.parse(JSON.stringify(config));
}

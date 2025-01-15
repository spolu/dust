import config from "@app/lib/api/config";

export type ActionApp = {
  workspaceId: string;
  appId: string;
  appHash: string;
  appSpaceId: string;
};

export type Action = {
  app: ActionApp;
  config: { [key: string]: unknown };
};

const workspaceId = config.getDustAppsWorkspaceId();
const spaceId = config.getDustAppsSpaceId();

const createActionRegistry = <K extends string, R extends Record<K, Action>>(
  registry: R
) => {
  return registry;
};

export const DustProdActionRegistry = createActionRegistry({
  "assistant-v2-multi-actions-agent": {
    app: {
      workspaceId: workspaceId,
      appId: "0e9889c787",
      appHash:
        "4e896f08ef6c2c69c97610c861cd444e3d34c839eab44f9b4fd7dd1d166c40a2",
      appSpaceId: spaceId,
    },
    config: {
      MODEL: {
        // `provider_id` and `model_id` must be set by caller.
        function_call: "auto",
        use_cache: false,
        use_stream: true,
      },
    },
  },
  "assistant-v2-title-generator": {
    app: {
      workspaceId: workspaceId,
      appId: "84dfc1d4f7",
      appHash:
        "6ea231add2ae690ee959c5d8d5d06420ea2feae7dd32ac13a4e655910087e313",
      appSpaceId: spaceId,
    },
    config: {
      MODEL: {
        // `provider_id` and `model_id` must be set by caller.
        function_call: "update_title",
        use_cache: false,
      },
    },
  },
  "assistant-v2-retrieval": {
    app: {
      workspaceId: workspaceId,
      appId: "471b6aa923",
      appHash:
        "3b634a84930020a7a18d3b32f4c5f5cd85690bf4958127ba51061fb101edea33",
      appSpaceId: spaceId,
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
  "assistant-v2-process": {
    app: {
      workspaceId: workspaceId,
      appId: "953b79fe89",
      appHash:
        "3240c3804948d0587b1f4051e0101b9f2731c212856b8c3cd46d5268b3479fb0",
      appSpaceId: spaceId,
    },
    config: {
      DATASOURCE: {
        data_sources: [],
        top_k: 128,
        filter: { tags: null, parents: null, timestamp: null },
        use_cache: false,
      },
      MODEL: {
        // `provider_id` and `model_id` must be set by caller.
        function_call: "extract_data",
        use_cache: false,
      },
    },
  },

  "doc-tracker-retrieval": {
    app: {
      workspaceId: workspaceId,
      appId: "4180309c80",
      appHash:
        "8adcc9ae33a63cc735c9a23a97d7bffe658c6ef2400fc997e61e8817f611a1f8",
      appSpaceId: spaceId,
    },
    config: {
      SEMANTIC_SEARCH: {
        data_sources: [],
        top_k: 1,
        filter: {
          tags: null,
          timestamp: null,
          parents: null,
        },
        use_cache: false,
        full_text: false,
        target_document_tokens: 2000,
      },
    },
  },
  "doc-tracker-score-docs": {
    app: {
      workspaceId: workspaceId,
      appId: "N0RrhyTXfq",
      appHash:
        "ba5637f356c55676c7e175719bbd4fa5059c5a99a519ec75aea78b452e2168dc",
      appSpaceId: spaceId,
    },
    config: {
      MODEL: {
        use_cache: true,
      },
    },
  },
  "doc-tracker-suggest-changes": {
    app: {
      workspaceId: workspaceId,
      appId: "76b40f14fb",
      appHash:
        "5cf8b39da27d1b107c75af833d2ddec8d796ce919eefa10a1aa91779c9cbb33c",
      appSpaceId: spaceId,
    },
    config: {
      SUGGEST_CHANGES: {
        // `provider_id` and `model_id` must be set by caller.
        use_cache: true,
        function_call: "suggest_changes",
      },
    },
  },
  "assistant-v2-query-tables": {
    app: {
      workspaceId: workspaceId,
      appId: "b4f205e453",
      appHash:
        "4c422305b747430c646454c11127a01855cf43b74b977ed76b417f783619db51",
      appSpaceId: spaceId,
    },
    config: {
      MODEL: {
        // `provider_id` and `model_id` must be set by caller.
        use_cache: false,
        function_call: "execute_sql_query",
      },
    },
  },
  "assistant-v2-websearch": {
    app: {
      workspaceId: workspaceId,
      appId: "098b515f8e",
      appHash:
        "514d54c0967638656b437417228efec26de465796b5ab67ae0480d6976250768",
      appSpaceId: spaceId,
    },
    config: { SEARCH: { provider_id: "serpapi", use_cache: false } },
  },
  "assistant-v2-browse": {
    app: {
      workspaceId: workspaceId,
      appId: "21092925b9",
      appHash:
        "766618e57ff6600cac27d170395c74f4067e8671ef5bf36db5a820fb411f044b",
      appSpaceId: spaceId,
    },
    config: {
      WEBCONTENT: {
        provider_id: "browserlessapi",
        use_cache: true,
        error_as_output: true,
      },
    },
  },
  "assistant-builder-instructions-suggestions": {
    app: {
      workspaceId: workspaceId,
      appId: "d995d868a8",
      appHash:
        "7fb9c826d9de74c98de2a675093f66eab9da93a1a2cb9bc0bcc919fd074cd7eb",
      appSpaceId: spaceId,
    },
    config: {
      CREATE_SUGGESTIONS: {
        // `provider_id` and `model_id` must be set by caller.
        function_call: "send_ranked_suggestions",
        use_cache: false,
      },
    },
  },
  "assistant-builder-name-suggestions": {
    app: {
      workspaceId: workspaceId,
      appId: "34a8c4a2aa",
      appHash:
        "65020161030b555f4d2efc9d1ce3a6d0020dcf76e663f746bd98213c90a0675f",
      appSpaceId: spaceId,
    },
    config: {
      CREATE_SUGGESTIONS: {
        // `provider_id` and `model_id` must be set by caller.
        function_call: "send_suggestions",
        use_cache: false,
      },
    },
  },
  "assistant-builder-emoji-suggestions": {
    app: {
      workspaceId: workspaceId,
      appId: "b69YdlJ3PJ",
      appHash:
        "0b6b63def0224321f2bece0751bad632baca33f6d5bb596bbeb3f95b6bea5966",
      appSpaceId: spaceId,
    },
    config: {
      CREATE_SUGGESTIONS: {
        // `provider_id` and `model_id` must be set by caller.
        function_call: "send_suggestions",
        use_cache: false,
      },
    },
  },
  "assistant-builder-description-suggestions": {
    app: {
      workspaceId: workspaceId,
      appId: "aba0057f4c",
      appHash:
        "e4bda2ba50f160712c08309628b4a6bf2b68dd7e9709669cc29ac43e36d663f7",
      appSpaceId: spaceId,
    },
    config: {
      CREATE_SUGGESTIONS: {
        // `provider_id` and `model_id` must be set by caller.
        function_call: "send_suggestions",
        use_cache: false,
      },
    },
  },
  "assistant-builder-process-action-schema-generator": {
    app: {
      workspaceId: workspaceId,
      appId: "b36c7416bd",
      appHash:
        "1ca7b9568681b06ef6cc0830239a479644a3ecc203c812983f3386a72e214d48",
      appSpaceId: spaceId,
    },
    config: {
      MODEL: {
        // `provider_id` and `model_id` must be set by caller.
        function_call: "set_extraction_schema",
        use_cache: false,
      },
    },
  },
  "assistant-v2-visualization": {
    app: {
      workspaceId: workspaceId,
      appId: "tWcuYDj1OE",
      appHash:
        "8298c6543759d1d11db0e360a8b7aa7b8ec0fa71ed274f2667678302073e4f8d",
      appSpaceId: spaceId,
    },
    config: {
      MODEL: {
        // `provider_id` and `model_id` must be set by caller.
        use_cache: false,
        use_stream: true,
      },
    },
  },
  "table-header-detection": {
    app: {
      workspaceId: workspaceId,
      appId: "Hllp6rDlNo",
      appHash:
        "50441165e07ce247227b95e55a3dd82cbc373e16455addb472adeee43f9f62d3",
      appSpaceId: spaceId,
    },
    config: {
      MODEL: {
        // `provider_id` and `model_id` must be set by caller.
        use_cache: false,
        use_stream: true,
      },
    },
  },
  "conversation-file-summarizer": {
    app: {
      workspaceId: workspaceId,
      appId: "iy1pjLCMzZ",
      appHash:
        "0cd0a82dcfaa327b2d5d1f645a314ea885e995a12921a1024ee96b92e8f15768",
      appSpaceId: spaceId,
    },
    config: {
      MODEL: {
        // `provider_id` and `model_id` must be set by caller.
        use_cache: false,
        use_stream: false,
      },
    },
  },
});

export type DustRegistryActionName = keyof typeof DustProdActionRegistry;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cloneBaseConfig(config: { [model: string]: any }) {
  return JSON.parse(JSON.stringify(config));
}

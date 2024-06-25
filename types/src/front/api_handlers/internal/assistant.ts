import * as t from "io-ts";

export const InternalPostMessagesRequestBodySchema = t.type({
  content: t.string,
  mentions: t.array(t.type({ configurationId: t.string })),
  context: t.type({
    timezone: t.string,
    profilePictureUrl: t.union([t.string, t.null]),
  }),
});


export const InternalPostContentFragmentRequestBodySchema = t.type({
  title: t.string,
  content: t.string,
  url: t.union([t.string, t.null]),
  contentType: t.union([
    t.literal("text/plain"),
    t.literal("text/csv"),
    t.literal("text/markdown"),
    t.literal("text/tsv"),
    t.literal("text/comma-separated-values"),
    t.literal("text/tab-separated-values"),
    t.literal("application/pdf"),
    t.literal("image/png"),
    t.literal("image/jpeg"),
    t.literal("image/jpg"),
    t.literal("dust-application/slack")
  ]),
  context: t.type({
    profilePictureUrl: t.union([t.string, t.null]),
  }),
});

export const InternalPostConversationsRequestBodySchema = t.type({
  title: t.union([t.string, t.null]),
  visibility: t.union([
    t.literal("unlisted"),
    t.literal("workspace"),
    t.literal("deleted"),
    t.literal("test"),
  ]),
  message: t.union([InternalPostMessagesRequestBodySchema, t.null]),
  contentFragments: t.array(InternalPostContentFragmentRequestBodySchema),
});

export const InternalPostBuilderSuggestionsRequestBodySchema = t.union([
  t.type({
    type: t.literal("name"),
    inputs: t.type({ instructions: t.string, description: t.string }),
  }),
  t.type({
    type: t.literal("instructions"),
    inputs: t.type({
      current_instructions: t.string,
      former_suggestions: t.array(t.string),
    }),
  }),
  t.type({
    type: t.literal("description"),
    inputs: t.type({ instructions: t.string, name: t.string }),
  }),
]);

export type BuilderSuggestionsRequestType = t.TypeOf<
  typeof InternalPostBuilderSuggestionsRequestBodySchema
>;

export const BuilderSuggestionsResponseBodySchema = t.union([
  t.type({
    status: t.literal("ok"),
    suggestions: t.array(t.string),
  }),
  t.type({
    status: t.literal("unavailable"),
    reason: t.union([
      t.literal("user_not_finished"), // The user has not finished inputing data for suggestions to make sense
      t.literal("irrelevant"),
    ]),
  }),
]);

export type BuilderSuggestionsType = t.TypeOf<
  typeof BuilderSuggestionsResponseBodySchema
>;

export const InternalPostBuilderProcessActionGenerateSchemaRequestBodySchema =
  t.type({
    instructions: t.string,
  });

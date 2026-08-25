## ADDED Requirements

### Requirement: Generation requests forward the stable conversation id

After loading the authoritative persisted conversation, `ConversationStreamingService.streamCompletion` SHALL pass `startConversation.id` to the selected generation transport. Both the Chat Completions request issued through `sendChatCompletionRequest` and the Responses request issued through `createResponse` MUST include `X-CONVERSATION-ID: <startConversation.id>` in the outbound BFF-to-DIAL-Core headers. The value SHALL be derived by the BFF and SHALL NOT require a new browser request header or completion DTO field.

This internal transport change SHALL NOT alter `POST /api/v1/conversations/completions`, its request/response DTOs, authentication, rate limit, cache behavior, generated-client surface, feature-flag behavior, or SSE contract. It introduces no UI, state, i18n, RTL, accessibility, or telemetry event changes; it restores the identifier consumed by downstream DIAL Core observability.

#### Scenario: Chat Completions forwards the persisted conversation id

- **WHEN** a completion resolves to `GenerationApi.ChatCompletions` and the loaded conversation has `id: "bucket/gpt-4o__Hello__uuid"`
- **THEN** the BFF calls DIAL Core's Chat Completions transport with `X-CONVERSATION-ID: bucket/gpt-4o__Hello__uuid`

#### Scenario: Responses API forwards the same persisted conversation id

- **WHEN** a completion resolves to `GenerationApi.Responses` and the loaded conversation has `id: "bucket/gpt-4o__Hello__uuid"`
- **THEN** the BFF calls DIAL Core's Responses transport with `X-CONVERSATION-ID: bucket/gpt-4o__Hello__uuid`

#### Scenario: Browser completion contract is unchanged

- **WHEN** the frontend starts a completion after this change
- **THEN** it continues to send the existing completion DTO without a new conversation header or identifier field, and the BFF derives the outbound header from the loaded conversation

## MODIFIED Requirements

### Requirement: SDK createResponse call and cast isolation

`responses.adapter.ts` SHALL call `this.dialClient.client.createResponse({ body: responsesRequest as never, headers: { ...bearer auth headers, Accept: 'text/event-stream', 'X-CONVERSATION-ID': conversationId, ...optional X-DIAL-CLIENT-CHANNEL-ID }, parseAs: 'stream', signal })`. The `as never` cast SHALL be confined to this single call site; the function's return value SHALL be converted immediately to the locally defined types in `generation.types.ts` before being passed to any caller.

#### Scenario: Cast does not leak past the adapter

- **WHEN** `ConversationService` or `apply-chunk.server.ts` consumes output from `responses.adapter.ts`
- **THEN** the consumed value is typed via `generation.types.ts`, with no `as never`/`any` in the calling code

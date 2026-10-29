## MODIFIED Requirements

### Requirement: ConversationService resolves generation API before opening the upstream stream

`ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) SHALL obtain the generation API from `GenerationApiSelector.select(sub, model, token)` (`apps/chat-api/src/conversations/generation/generation-api-selector.service.ts`) before issuing any upstream generation call. `GenerationApiSelector` SHALL call `DeploymentsService.getDeploymentDetails(sub, model, token)` (the existing cached, user-token-scoped lookup already used by the deployment details endpoint), read `features` off the returned `modelDetails`/`applicationDetails` per the resolved `type`, and pass the result through `resolveGenerationApi` to compute a candidate generation API. `ConversationModule` SHALL import `DeploymentsModule` and `AppConfigModule` to obtain `DeploymentsService` and `FeatureFlagsService` respectively. `getDeploymentDetails` and the `FeatureKey.ResponsesApiEnabled`/`FeatureKey.ResponsesBackgroundEnabled` flag lookups SHALL be resolved concurrently (one `Promise.all` in `GenerationApiSelector.select`). When `getDeploymentDetails` resolves the target id to `type: 'toolset'`, `GenerationApiSelector.select` SHALL reject the request with HTTP 400 (`BadRequestException`) before any generation call, regardless of the resolved flag values, since a toolset is not a generation deployment. `getDeploymentDetails` SHALL be called unconditionally for every completion request, regardless of the state of the feature flag introduced below — it is not skipped, short-circuited, or bypassed based on that flag, because it also performs the toolset rejection above and the `temperature`-capability derivation below, neither of which is specific to the Responses API.

The same `features` lookup used to resolve the generation API SHALL also be used to determine whether the resolved deployment explicitly supports the `temperature` parameter (`features.temperature === true`). `ConversationStreamingService` SHALL make no additional `getDeploymentDetails` (or equivalent deployment-details) call for this purpose — the boolean SHALL be derived from the `features` object already read while resolving `GenerationApi`, and passed through to whichever adapter's `buildRequest` is invoked for that generation.

`GenerationApi.Responses` SHALL only ever be the resolved generation API when **both** of the following hold:

1. `resolveGenerationApi(features)` returns `GenerationApi.Responses` (i.e. the resolved deployment reports `features.responsesApi === true`); **AND**
2. `FeatureFlagsService.isEnabled(FeatureKey.ResponsesApiEnabled, context)` resolves to `true`, where `context` is a fixed server-side `AppConfigEvalContext` (the module-level `SERVER_APP_CONFIG_CONTEXT = { appId: 'chat-api' }`, no per-request `roles`, matching the `features.llmConversationNaming` precedent in `apps/chat-api/src/conversations/conversation-naming.service.ts`).

When condition 2 does not hold — the flag is disabled, absent (default `false`), or its resolution fails for any reason — `streamCompletion` SHALL resolve to `GenerationApi.ChatCompletions` regardless of what `resolveGenerationApi(features)` alone would have returned, and SHALL NOT invoke `ResponsesAdapter.buildRequest` or `ResponsesAdapter.stream` for that request. This flag check SHALL NOT alter, wrap, or gate the `resolveGenerationApi` pure function itself (`apps/chat-api/src/conversations/generation/generation-api.ts`) — that function's existing signature, behavior, and spec scenarios (Requirement: "Generation API resolver") are unchanged by this requirement.

Feature-flag resolution failure SHALL be treated identically to the flag being disabled — `FeatureFlagsService.isEnabled` already fails closed (returns `false` without throwing) per the `feature-flags-service` capability, so no additional error handling is required in `ConversationStreamingService` beyond what already exists for the `getDeploymentDetails` failure path.

This requirement SHALL NOT introduce, remove, or change any `@RequireFeature`/`FeatureGuard` decoration on `ConversationController` or any of its routes. The flag gates the internal generation-API selection only; it MUST NOT cause `POST /api/v1/conversations/completions` (or any other conversation route) to reject the request with `403 Forbidden` when disabled — the request MUST still proceed and complete via Chat Completions.

#### Scenario: Flag disabled, deployment supports Responses — falls back to Chat Completions

- **WHEN** `features.responsesApiEnabled` resolves to `false` (or is unset, its default) and a completion request targets a deployment whose `getDeploymentDetails` result has `features.responsesApi: true`
- **THEN** `streamCompletion` calls `sendChatCompletionRequest` and does not call `ResponsesAdapter.buildRequest` or `ResponsesAdapter.stream`

#### Scenario: Flag enabled, deployment supports Responses — dispatches to the Responses adapter

- **WHEN** `features.responsesApiEnabled` resolves to `true` and a completion request targets a model or application whose `getDeploymentDetails` result has `features.responsesApi: true`
- **THEN** `streamCompletion` calls the Responses adapter and does not call `sendChatCompletionRequest`

#### Scenario: Flag enabled, deployment does not support Responses — uses Chat Completions

- **WHEN** `features.responsesApiEnabled` resolves to `true` and a completion request targets a deployment whose `getDeploymentDetails` result has `features.responsesApi: false` or no `responsesApi` field
- **THEN** `streamCompletion` calls `sendChatCompletionRequest` and does not call the Responses adapter

#### Scenario: Feature-flag resolution failure falls back to Chat Completions

- **WHEN** `FeatureFlagsService.isEnabled(FeatureKey.ResponsesApiEnabled, context)` fails to resolve for any reason (already fails closed to `false` per `feature-flags-service`) while the targeted deployment reports `features.responsesApi: true`
- **THEN** `streamCompletion` calls `sendChatCompletionRequest` and does not call the Responses adapter or surface an error to the caller because of the flag-resolution outcome

#### Scenario: Legacy deployment without the flag keeps using Chat Completions

- **WHEN** a completion request targets a deployment whose `getDeploymentDetails` result has no `responsesApi` field (older Core, or capability not declared), independent of `features.responsesApiEnabled`'s state
- **THEN** `streamCompletion` calls `sendChatCompletionRequest` exactly as before this change

#### Scenario: Target resolves to a toolset regardless of the feature flag

- **WHEN** a completion request's `model` resolves via `getDeploymentDetails` to `type: 'toolset'`, in any state of `features.responsesApiEnabled`
- **THEN** the request is rejected with HTTP 400 before any generation call is made, whatever the (concurrently resolved) flag values are

#### Scenario: getDeploymentDetails is not skipped when the flag is disabled

- **WHEN** `features.responsesApiEnabled` resolves to `false` and a completion request is made
- **THEN** `DeploymentsService.getDeploymentDetails` is still called exactly once for that request, and its toolset-rejection and `temperatureSupported` derivation behave identically to a build of this code without the feature flag

#### Scenario: Capability lookup fails

- **WHEN** `getDeploymentDetails` rejects with a 401/403/404/5xx-mapped exception
- **THEN** `streamCompletion` surfaces the corresponding BFF error and does not call either generation adapter, independent of the feature flag's state

#### Scenario: Temperature capability is derived from the same lookup used for generation-API resolution

- **WHEN** a completion request targets a Responses-capable deployment (flag enabled) whose `getDeploymentDetails` result has `features.temperature: true`
- **THEN** `streamCompletion` passes `temperatureSupported: true` to `ResponsesAdapter.buildRequest` without issuing a second `getDeploymentDetails` call for that generation

#### Scenario: Missing or false temperature capability is derived without a duplicate lookup

- **WHEN** a completion request targets a Responses-capable deployment (flag enabled) whose `getDeploymentDetails` result has `features.temperature: false` or no `temperature` field
- **THEN** `streamCompletion` passes `temperatureSupported: false` to `ResponsesAdapter.buildRequest` without issuing a second `getDeploymentDetails` call for that generation

#### Scenario: Endpoint is never gated by @RequireFeature/FeatureGuard

- **WHEN** `ConversationController`'s completion route is inspected, in any state of `features.responsesApiEnabled`
- **THEN** it carries no `@RequireFeature`/`FeatureGuard` decoration tied to `FeatureKey.ResponsesApiEnabled`, and a disabled flag never produces a `403 Forbidden` response for that route


### Requirement: Chat Completions transport extracted behind the adapter seam

The SDK `sendChatCompletionRequest` call, request construction from `buildConversationHistory`'s `messages`, and SSE chunk parsing SHALL live in `ChatCompletionsAdapter` (`apps/chat-api/src/conversations/generation/chat-completions.adapter.ts`), exposing the same normalized chunk stream contract (`GenerationRelayOutcome`) as the Responses adapter. `ConversationStreamingService.streamCompletion` SHALL route every generation that does not resolve to `GenerationApi.Responses` through `ChatCompletionsAdapter.buildRequest` and `ChatCompletionsAdapter.stream`, symmetric with `ResponsesAdapter`, and SHALL hold no copy of that request construction or relay.

The adapter SHALL send exactly what the streaming service sent before the move:

- skill URLs encoded with `encodeDialResourcePath`;
- the validated `X-Timezone` header when present;
- the client-channel, conversation-id and job-title headers;
- an `onChunkApplied` callback invoked with each applied chunk and the updated message.

This move SHALL NOT change any request sent to DIAL Core nor any chunk delivered to `apply-chunk.server.ts`. `ChatCompletionsAdapter` SHALL NOT keep a method that writes to an Express `Response` directly.

#### Scenario: Chat Completions behavior is unchanged after extraction

- **WHEN** an existing Chat Completions integration test exercises `streamCompletion` for a non-Responses deployment
- **THEN** the outbound DIAL Core request and the resulting `StreamChunk` sequence are identical to the pre-change behavior

#### Scenario: The streaming service holds no Chat Completions transport

- **WHEN** `conversation-streaming.service.ts` is searched for `sendChatCompletionRequest` or a chat-completions request body builder
- **THEN** nothing is found; both generation APIs are reached only through their adapters

#### Scenario: A skill URL with a space reaches DIAL Core encoded

- **WHEN** a Chat Completions generation sends a message whose `custom_content.skills[0].url` is `skills/public/my chats/123`
- **THEN** the request body built by `ChatCompletionsAdapter.buildRequest` carries `skills/public/my%20chats/123`


### Requirement: No automatic fallback after a Responses call has started

Once `responses.adapter.ts` has issued the `createResponse` call, a subsequent 4xx/5xx response or an in-stream error SHALL terminate the attempt as an error through the existing stream-error path. The system SHALL NOT automatically retry the same generation through the Chat Completions adapter. This SHALL hold regardless of the state of `features.responsesApiEnabled` — the flag only affects whether a Responses call is started in the first place; once started (flag was enabled and the deployment was eligible at the time `GenerationApiSelector.select` ran), its outcome is never retried through Chat Completions even if the flag's resolved value could theoretically change between requests.

#### Scenario: Upstream 5xx during a Responses call is not retried via Chat Completions

- **WHEN** `createResponse` returns a 5xx response
- **THEN** the generation ends with an error, and no Chat Completions request is made for that same generation attempt

#### Scenario: A Responses call already in flight is not retried even if the flag is toggled mid-stream

- **WHEN** a Responses request was started while `features.responsesApiEnabled` was `true` and that flag's underlying env var changes value before the stream terminates
- **THEN** the in-flight generation's outcome (success or error) is unaffected, and no Chat Completions retry is issued for that same generation attempt

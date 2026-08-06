## MODIFIED Requirements

### Requirement: ConversationService resolves generation API before opening the upstream stream

`ConversationService.streamCompletion` SHALL call `DeploymentsService.getDeploymentDetails(sub, model, token)` (the existing cached, user-token-scoped lookup already used by the deployment details endpoint) before issuing any upstream generation call, read `features` off the returned `modelDetails`/`applicationDetails` per the resolved `type`, and pass the result through `resolveGenerationApi` to select the adapter. `ConversationModule` SHALL import `DeploymentsModule` to obtain `DeploymentsService`. When `getDeploymentDetails` resolves the target id to `type: 'toolset'`, `streamCompletion` SHALL reject the request with HTTP 400 before any generation call, since a toolset is not a generation deployment.

The same `features` lookup used to resolve the generation API SHALL also be used to determine whether the resolved deployment explicitly supports the `temperature` parameter (`features.temperature === true`). `ConversationService` SHALL make no additional `getDeploymentDetails` (or equivalent deployment-details) call for this purpose — the boolean SHALL be derived from the `features` object already read while resolving `GenerationApi`, and passed through to whichever adapter's `buildRequest` is invoked for that generation.

#### Scenario: Responses-capable model dispatches to the Responses adapter

- **WHEN** a completion request targets a model whose `getDeploymentDetails` result has `features.responsesApi: true`
- **THEN** `streamCompletion` calls the Responses adapter and does not call `sendChatCompletionRequest`

#### Scenario: Responses-capable application dispatches to the Responses adapter

- **WHEN** a completion request targets an application whose `getDeploymentDetails` result has `features.responsesApi: true`
- **THEN** `streamCompletion` calls the Responses adapter and does not call `sendChatCompletionRequest`

#### Scenario: Legacy deployment without the flag keeps using Chat Completions

- **WHEN** a completion request targets a deployment whose `getDeploymentDetails` result has no `responsesApi` field (older Core, or capability not declared)
- **THEN** `streamCompletion` calls `sendChatCompletionRequest` exactly as before this change

#### Scenario: Target resolves to a toolset

- **WHEN** a completion request's `model` resolves via `getDeploymentDetails` to `type: 'toolset'`
- **THEN** the request is rejected with HTTP 400 and no generation call is made

#### Scenario: Capability lookup fails

- **WHEN** `getDeploymentDetails` rejects with a 401/403/404/5xx-mapped exception
- **THEN** `streamCompletion` surfaces the corresponding BFF error and does not call either generation adapter

#### Scenario: Temperature capability is derived from the same lookup used for generation-API resolution

- **WHEN** a completion request targets a Responses-capable deployment whose `getDeploymentDetails` result has `features.temperature: true`
- **THEN** `streamCompletion` passes `temperatureSupported: true` to `ResponsesAdapter.buildRequest` without issuing a second `getDeploymentDetails` call for that generation

#### Scenario: Missing or false temperature capability is derived without a duplicate lookup

- **WHEN** a completion request targets a Responses-capable deployment whose `getDeploymentDetails` result has `features.temperature: false` or no `temperature` field
- **THEN** `streamCompletion` passes `temperatureSupported: false` to `ResponsesAdapter.buildRequest` without issuing a second `getDeploymentDetails` call for that generation

## ADDED Requirements

### Requirement: Responses request forwards conversation temperature only when explicitly supported

`ResponsesAdapter.buildRequest` SHALL accept a `temperatureSupported: boolean` parameter, computed by `ConversationService` from the deployment `features` already fetched to resolve the generation API. The built `ResponsesApiRequestBody` SHALL include an optional `temperature: number` field set to `startConversation.temperature` only when `temperatureSupported === true` AND `startConversation.temperature` is not `null`/`undefined`. Presence SHALL be checked with a nullish check, not a truthiness check, so that `temperature: 0` is preserved. The field SHALL be omitted entirely — never sent as `null`, `undefined`, or a substituted default — when `temperatureSupported` is `false`, when it was not determined (absent capability), or when the conversation has no usable value. `ResponsesAdapter` SHALL NOT read a default temperature from any frontend constant, environment variable, or DIAL Core configuration, and SHALL NOT alter `ChatCompletionsAdapter.buildRequest`'s existing unconditional temperature forwarding.

#### Scenario: Supported deployment forwards a zero temperature exactly

- **WHEN** `temperatureSupported` is `true` and `startConversation.temperature` is `0`
- **THEN** the built Responses request body has `temperature: 0`

#### Scenario: Supported deployment forwards a non-zero temperature exactly

- **WHEN** `temperatureSupported` is `true` and `startConversation.temperature` is `0.7`
- **THEN** the built Responses request body has `temperature: 0.7`

#### Scenario: Temperature is omitted when the deployment does not support it

- **WHEN** `temperatureSupported` is `false` and `startConversation.temperature` is any usable value
- **THEN** the built Responses request body has no `temperature` field

#### Scenario: Temperature is omitted when support is unknown

- **WHEN** `temperatureSupported` is `false` because the deployment `features` object had no `temperature` field
- **THEN** the built Responses request body has no `temperature` field

#### Scenario: Chat Completions temperature forwarding is unaffected

- **WHEN** a generation is routed through `ChatCompletionsAdapter` rather than `ResponsesAdapter`
- **THEN** `ChatCompletionsAdapter.buildRequest`'s existing temperature-forwarding behavior (unconditional on presence, capability-independent) is unchanged

### Requirement: Persisted conversation carries an optional Responses output-token limit

The shared `Conversation` model (`@epam/ai-dial-chat-shared`) and `ConversationResponseDto` SHALL each gain an optional `maxOutputTokens?: number` field. The field SHALL be a Chat-side, user/import-settable value distinct from and never derived from `limits.maxCompletionTokens`, `defaultMaxTokens`, `defaults.max_tokens`, token usage, context-window size, or any hard-coded constant. Existing conversations that omit the field SHALL continue to load, save, duplicate, import, and export exactly as before this change, with the field simply absent.

#### Scenario: New field is optional and independently settable

- **WHEN** a conversation payload sets `maxOutputTokens: 4096` without any relation to the deployment's `limits.maxCompletionTokens`
- **THEN** the conversation persists with `maxOutputTokens: 4096` regardless of the deployment's limit value

#### Scenario: Legacy conversations remain unaffected

- **WHEN** an existing conversation payload has no `maxOutputTokens` field
- **THEN** the conversation continues to load, save, duplicate, import, and export with identical behavior to before this change, and no `maxOutputTokens` value is invented

### Requirement: Responses request maps a valid maxOutputTokens to max_output_tokens

`ResponsesAdapter.buildRequest` SHALL include an optional `max_output_tokens: number` field on the built `ResponsesApiRequestBody`, set to `startConversation.maxOutputTokens` verbatim (no renaming, scaling, or transformation) only when that value passes a runtime validation check: it SHALL be a positive, finite integer within `Number.isSafeInteger` range (equivalently: `Number.isInteger(value) && Number.isSafeInteger(value) && value > 0`). The check SHALL be a real runtime predicate, not solely a TypeScript type assertion. The value `1` SHALL be preserved (checked via this validation, not truthiness). Any other value — absent, `null`, `0`, negative, fractional, `NaN`, `Infinity`, or outside the safe-integer range — SHALL cause `max_output_tokens` to be omitted entirely from the request; it SHALL NOT be sent as `null`, `undefined`, `0`, or a value derived from deployment limits or Chat Completions defaults. `max_output_tokens` mapping SHALL NOT be gated by `maxTokensSupported`, `maxCompletionTokensSupported`, or any other Chat-Completions-scoped capability flag. `ResponsesAdapter` SHALL NOT emit `max_tokens` or `max_completion_tokens` on a Responses request under any circumstance.

#### Scenario: Minimum valid value is preserved

- **WHEN** `startConversation.maxOutputTokens` is `1`
- **THEN** the built Responses request body has `max_output_tokens: 1`

#### Scenario: A representative larger value is preserved exactly

- **WHEN** `startConversation.maxOutputTokens` is `4096`
- **THEN** the built Responses request body has `max_output_tokens: 4096`

#### Scenario: Absent value omits the wire field

- **WHEN** `startConversation.maxOutputTokens` is `undefined`
- **THEN** the built Responses request body has no `max_output_tokens` field, and no substituted value from deployment metadata is sent in its place

#### Scenario: Invalid values are rejected rather than forwarded

- **WHEN** `startConversation.maxOutputTokens` is `0`, a negative number, a fractional number, `NaN`, `Infinity`, or a number exceeding `Number.MAX_SAFE_INTEGER`
- **THEN** the built Responses request body has no `max_output_tokens` field

#### Scenario: max_output_tokens is not gated by Chat Completions capability flags

- **WHEN** the resolved deployment has `maxTokensSupported: false` and `maxCompletionTokensSupported: false`, and `startConversation.maxOutputTokens` is a valid positive safe integer
- **THEN** the built Responses request body still includes `max_output_tokens` set to that value

#### Scenario: Legacy Chat Completions field names never appear on a Responses request

- **WHEN** any Responses request is built by `ResponsesAdapter.buildRequest`, with or without `maxOutputTokens` set
- **THEN** the built request body never contains a `max_tokens` or `max_completion_tokens` key

### Requirement: Temperature and max_output_tokens coexist without altering base request or stream semantics

A Responses request MAY include both `temperature` and `max_output_tokens` simultaneously when both are independently eligible per their own requirements above. Adding either or both fields SHALL NOT change `stream: true`, `store: false`, the `input` array, message ordering, system-prompt mapping, status-message filtering, or the omission of `previous_response_id`/`conversation`. Adding either field SHALL NOT alter SSE parsing, terminal-state precedence, partial-message persistence, abort handling, error propagation, or unknown-event handling as specified by the hardened Responses stream behavior; those requirements are unchanged by this capability delta.

#### Scenario: Both parameters present together

- **WHEN** a Responses-capable deployment supports temperature, `startConversation.temperature` is `0.4`, and `startConversation.maxOutputTokens` is `2048`
- **THEN** the built Responses request body includes `temperature: 0.4` and `max_output_tokens: 2048` alongside the unchanged base fields (`model`, `input`, `stream: true`, `store: false`), with no `previous_response_id` or `conversation` key

#### Scenario: Hardened stream behavior is unaffected by request-construction changes

- **WHEN** a Responses request built with either or both new parameters is relayed through `ResponsesAdapter.relay`
- **THEN** SSE event handling, terminal-state precedence, partial-message persistence on error, and abort/error outcome reporting behave identically to a request built without the new parameters

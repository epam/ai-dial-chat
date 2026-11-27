## Context

See `proposal.md` for motivation and issue #9949. The current integration is an explicit BFF projection, a generated SDK, a headless details mapper/hook, then a generic catalog renderer. No additional Core fetch is necessary.

Observed integration points:

- `apps/chat-api/src/deployments/details/deployments-details.service.ts` explicitly maps `getModel`/`getApplication` results; deployment-mapper.util.ts already performs defensive feature reads.
- `apps/chat-api/src/models/catalog/model-catalog.service.ts` projects the shared model list; `getCatalogEntry` returns that projected cached object without a single-model Core request.
- `apps/chat/src/server-api/deployments.ts` delegates to the configured `deploymentsApi` singleton; `useCatalogItems` supplies its adapter and `dialCoreExternalUrl` to `useCatalogItemDetails`.
- `libs/chat-hooks/src/catalog/deployment-endpoint-url.ts` builds two generation endpoint entries; entity-details.ts and map-entity-details-to-catalog.ts carry their capabilities.
- `libs/catalog/src/components/Details/ApiDetails.tsx` already renders arbitrary endpoints, with a selector only for multiple entries. `libs/catalog/src/utils/details-tabs.ts` gates Connect on a nonempty endpoint list, not on model type/provider.

Primary Core evidence at cb6a3e3a7b786239f713944af0a51c1712a49d42:

- [InterfaceConfigData](https://github.com/epam/ai-dial-core/blob/cb6a3e3a7b786239f713944af0a51c1712a49d42/server/src/main/java/com/epam/aidial/core/server/data/InterfaceConfigData.java) constructs one `interface_configs` entry per advertised interface and includes effective features/defaults/headers.
- [InterfaceType](https://github.com/epam/ai-dial-core/blob/cb6a3e3a7b786239f713944af0a51c1712a49d42/config/src/main/java/com/epam/aidial/core/config/InterfaceType.java) defines `openaiChatCompletions`, `openaiEmbeddings`, `openaiResponses` and `anthropicMessages`.
- [InterfaceConfigDataTest](https://github.com/epam/ai-dial-core/blob/cb6a3e3a7b786239f713944af0a51c1712a49d42/server/src/test/java/com/epam/aidial/core/server/data/InterfaceConfigDataTest.java) verifies mixed declarations and advertisement of legacy endpoints.
- [Proxy authentication](https://github.com/epam/ai-dial-core/blob/cb6a3e3a7b786239f713944af0a51c1712a49d42/server/src/main/java/com/epam/aidial/core/server/Proxy.java#L392) accepts Api-Key, with x-api-key as a fallback when neither Api-Key nor Authorization is supplied.

## Goals / Non-Goals

**Goals:**

- Minimal, deterministic API discovery data for Chat and Models Garden.
- Independently capability-driven Connect entries, including Messages-only deployments.
- Existing integration and presentation seams, with no new state or requests.

**Non-Goals:**

- Generation transport, provider heuristics or raw interface configuration exposure.
- Combined MCP/generation presentation, module-boundary changes or public-helper relocation.

Follow `apps/chat-api/AGENTS.md` for backend conventions and `.claude/rules/libs.md` for public helper/label contracts.

## Decisions

### 1. Normalize declared APIs once at the BFF boundary

Add a defensive declared-interface reader and supported-interface projection alongside the existing helpers in `apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`. Input is the raw Core deployment/model record, not a model ID.

Declaration precedence:

1. An object-valued `interface_configs` is authoritative for declaration discovery. Accept a canonical key only when its value is an object (an empty object is valid); reject arrays/null/primitives as descriptors. An empty map or a map containing no usable known descriptor yields an explicitly empty known-interface set. Unknown keys are ignored.
2. If `interface_configs` is absent or not an object, use equivalent declared API names in an interfaces string array. Ignore categorical values such as chat/mcp and unknown values. An explicitly empty array is empty metadata; a nonempty array with no known API names is unusable, not evidence for any API.
3. For the model-catalog normalized list only, when declaration metadata is unavailable, derive OpenAI names from boolean `features.chat_completion`/`features.responses_api`. No legacy Messages flag, provider or ID fallback is invented. If neither usable declarations nor boolean OpenAI flags exist, omit `supportedInterfaces`. Explicit false legacy flags may yield an empty list.

Use a private/local string-enum registry for canonical names; expose an optional string array in Swagger rather than a closed wire enum. Current normalization allowlists the four names above, deduplicates them, and emits them in that fixed order. Unknown metadata must not throw or change unrelated feature mapping. This bounds the disclosure; adding future API names is an explicit contract extension rather than exposing arbitrary configuration keys.

*Alternative:* forwarding `interface_configs` would retain much more than discovery data; copying interfaces alone misses the model endpoints observed in Core. Independent ad hoc parsing in both services risks divergence.

### 2. Keep declaration metadata and explicit OpenAI flags distinct

Extend `DeploymentFeaturesDetailsDto` with optional `anthropicMessages`. For model/application detail mapping, derive it from the declared-interface set: true when `anthropicMessages` is present, false when usable metadata excludes it, and undefined when declaration metadata is unavailable. Do not read a hypothetical legacy Messages boolean.

Preserve explicit boolean `chat_completion` and `responses_api` values. If an individual OpenAI flag is absent/non-boolean, recover that flag only from its own canonical declaration, if usable declaration metadata exists. Neither Messages nor one OpenAI API enables another. This handles interface-only detail payloads while preserving existing explicit OpenAI capability behavior. A contradictory explicit OpenAI flag wins for Chat's feature contract; the normalized catalog list still describes Core's declarations, not a union fabricated from those flags.

The detail features object must be constructed when declaration-derived values exist even if `raw.features` is missing. Do not retain an early return that discards Messages-only payloads. Toolsets keep their current semantics; no Messages inference is added to their feature path.

Map the optional new feature to `hasAnthropicMessages` in the model/agent headless capability contracts and pass it through the existing details hook. Overview capability rows do not gain unrelated UI.

*Alternative:* requiring `raw.features` breaks Messages-only payloads; indiscriminately OR-ing all signals can override explicit false OpenAI capabilities and invent entries.

### 3. Add a minimal model-catalog wire field

`ModelCatalogEntryDto` gains `supportedInterfaces?: string[]` separately from `MODEL_CATALOG_ENTRY_FIELDS`, just as `catalog_properties` is a separately projected field. The wire field and generated client both use `supportedInterfaces`. The generator uses `withoutRuntimeChecks=true`, so normal methods preserve the JSON rather than converting its case. This follows normalized BFF DTO naming without changing existing Core-shaped fields or the generator configuration. Both catalog routes share the same projected object.

Do not add raw `interface_configs` to the copy allowlist or widen invocation-settings exposure. Existing interfaces can remain as copied display data but are not the new normalized contract. Ordinary /api/v1/models and /api/v1/models/{modelName} retain their per-model passthrough behavior and hidden-tag handling; no runtime projection is added there.

HTTP methods, path validation, session requirements, operation IDs, status mapping, five-minute shared catalog cache, cached detail lookup and Cache-Control are unchanged. The deployment-details cache remains user-scoped at deployments:details:<userSub>:<deployment>, TTL 60000 ms, with existing write/auth invalidation and in-flight generation protection; browser caching remains private, no-store. No new cache is introduced.

Update Swagger DTOs/controller descriptions, run repository OpenAPI generation, then verify generated deserialization preserves `supportedInterfaces` and `anthropicMessages`. No hand editing generated artifacts. Existing normal `DeploymentsApi.getDeploymentDetails` and `ModelsApi.listModelCatalog`/`getModelCatalogEntry` methods remain sufficient; no Raw methods, new singleton, or direct-fetch wrapper is needed.

### 4. Extend the requested existing DIAL-aware integration helper

Add `buildAnthropicMessagesUrl(baseUrl)`, returning the supplied base with its existing trailing-slash normalization plus `/anthropic/v1/messages`. Add optional `hasAnthropicMessages` to `DeploymentGenerationApiSupport`. Append its endpoint after the existing Chat Completions and Responses entries, and return `undefined` only when all three support flags are false/absent.

The extension stays in the existing pure DIAL protocol helper in `libs/chat-hooks`: no environment/config access, configured-client creation, session/credential reads, app contexts, routing, SDK setup or provider/tenant heuristics. `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts` supplies `dialCoreExternalUrl` and translated labels; `apps/chat/src/server-api/deployments.ts` owns the configured request adapter. `libs/catalog` receives only resolved `CatalogItemApiDetails` endpoint values and snippets. Do not widen lint boundaries or extend this exception to feature libs.

Example shape (the builder replaces the base and ID):

```sh
curl -X POST 'https://dial.example.com/anthropic/v1/messages' \
  -H 'Content-Type: application/json' \
  -H 'Api-Key: <key>' \
  -H 'anthropic-version: 2023-06-01' \
  -d '{"model":"selected-deployment","max_tokens":128,"messages":[{"role":"user","content":"Hello"}]}'
```

Construct the request object with the unmodified selected deployment ID, `JSON.stringify` it, then shell-quote the resulting JSON and URL. This must round-trip quotes, apostrophes, backslashes, spaces and percent-encoded IDs without injection. The readable `resource.modelId` retains the existing display decoding rule. Do not put the ID in the Messages URL or add the OpenAI api-version query placeholder.

Use a placeholder for the caller's DIAL key, never `MODEL_CATALOG_API_KEY`, a provider key or session bearer token. No X-UPSTREAM-* header is needed: Core owns upstream routing/authentication. The [Anthropic API-version reference](https://platform.claude.com/docs/en/api/versioning) documents the version header and 2023-06-01; use that conservative version for this minimal existing-model example, not a provider-dependent version choice. The body includes model, positive `max_tokens` and user messages; no optional temperature/thinking/streaming parameter is required.

### 5. Localize labels without changing catalog rendering

Add exported `DeploymentConnectLabels` with English defaults for chatCompletions, responses and `anthropicMessages`. `buildDeploymentConnectApi` accepts optional partial labels as a backward-compatible fourth argument; `useCatalogItemDetails` accepts optional `deploymentConnectLabels` and forwards it. Memoize the translated labels in `useCatalogItems` so `onFetchDetails` remains stable for stable inputs.

Add `CatalogI18nKeys` members for `catalog.details.api.chatCompletions`, `catalog.details.api.responses` and `catalog.details.api.anthropicMessages` in `apps/chat/src/constants/i18n-keys/catalog.ts`, with en.json values Chat Completions, Responses and Anthropic Messages. Keep translation-keys.ts's existing re-export. Technical protocol keys and code samples are not translated.

No catalog layout/component rewrite is needed. Keep its current selector/plain-title distinction, copy-only blocks, stable copy labels and already-mounted polite copy announcement. Preserve logical spacing, RTL direction, touch/keyboard operation, long-URL/code-block handling and mobile/tablet/desktop detail surfaces. Add automated coverage at 360, 767, 768, 900, 1024, 1279, 1280 and 1920 px as applicable to those existing surfaces; no new breakpoint or JS width branch is introduced.

Existing loading/error states stay with the details fetch owner. Before details resolve, Connect remains governed by existing data; on failure the current error behavior remains. When no supported entry exists, omit Connect; when exactly one Messages entry exists, show a plain endpoint title rather than an inert selector. Endpoint selection state remains in `ApiDetails`; no additional persisted state is introduced.

### 6. Separate implementation slices from verification

Implement the model details-to-Connect path first, then widen the same normalization to the model-catalog projection and add generic UI regression coverage. Follow with documentation. Keep automated verification, quality review and manual acceptance testing in a separate final task slice, rather than a verification block on every implementation step. New utilities receive isolated tests; existing service/controller, mapper/hook and generic UI suites cover end-to-end seams. See `tasks.md` for exact files and commands.

## Risks / Trade-offs

- [SDK types lag Core fields] → read unknown raw metadata defensively; do not modify node_modules or require an SDK upgrade.
- [Messages-only features object can be dropped] → regression-test Core records and frontend DTOs with no legacy features or OpenAI flags.
- [New normalized wire name could be mistaken for interfaces] → document the same `supportedInterfaces` field on the wire and in the generated SDK; the companion frontend adopts this explicit additive contract.
- [Unknown future APIs are not included in this bounded normalization] → ignore safely and keep the field optional; add future canonical names deliberately.
- [Snippet values can break shell syntax] → JSON serialization plus shell quoting with adversarial ID/URL tests, without executing any live API request.
- [Existing specs say only two APIs and no model-catalog extension] → modify those complete requirements in delta specs, rather than hiding the conflict in implementation notes.
- [A selected deployment can advertise an interface that is unavailable operationally] → Connect reports declarations, not a live health check or permission to invoke; Core remains the authority at request time.

## Migration Plan

Deploy additive BFF/Swagger changes and the regenerated client alongside the Chat integration. Old clients ignore new fields; new clients retain legacy handling when fields are absent. No Core config, user data or route migration is necessary. Models Garden frontend rollout is independent.

Rollback removes these additions and their UI entry, preserving the same APIs/caches/client operations; it does not roll back or alter Core interface configuration. Metadata changes appear after existing cache expiry/invalidation, not through a new forced refresh.

## Open Questions

Only operational follow-ups remain: confirm the reported model's live declaration, and identify/link the companion Models Garden repository/issue. Do not block implementation, invent availability, or create cross-repository changes based on either unknown.

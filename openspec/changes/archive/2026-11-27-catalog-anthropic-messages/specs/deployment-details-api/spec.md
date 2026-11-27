## MODIFIED Requirements

### Requirement: DeploymentDetailsDto shape

`DeploymentDetailsDto` SHALL be a strongly typed Swagger DTO, structurally aligned with `libs/chat-hooks/src/catalog/entity-details.ts`'s `ModelEntityDetails` / `AgentEntityDetails` / `ToolsetEntityDetails` split so the frontend mapping step is a field-by-field transcription. It excludes most fields already returned by the list endpoint's `DeploymentItemDto` (`description`, `iconUrl`, `displayVersion`, `interfaces`, `topics`, `updatedAt`) — those are supplied to the UI via the already-loaded `CatalogItem`, not duplicated here. The exception is `applicationDetails.displayName`, which the code does return.

`ModelCatalogPropertiesDto` (`catalogProperties`) is `{ vendor?, license?, knowledgeCutoffDate?, parameters? }`, read as strings from DIAL Core's `catalog_properties` by `mapCatalogProperties` (`deployments/utils/deployment-mapper.util.ts`) and omitted when none of the four is present. `catalog_properties.provider` is not read for any entity type. A model's provider is `modelDetails.provider` (below). Applications and toolsets have no provider field, because DIAL Core added the top-level `provider` to models only.

- `id: string` — the requested deployment id
- `type: 'model' | 'application' | 'toolset'` — resolved discriminator
- `modelDetails?: ModelDetailsDto` — present only when `type === 'model'`:
  - `capabilities?: { completion?: boolean; chatCompletion?: boolean; embeddings?: boolean; fineTune?: boolean; inference?: boolean; scaleTypes?: string[] }` — from `ModelOpenAi.capabilities`
  - `lifecycleStatus?: string`
  - `provider?: string` — from DIAL Core's top-level `provider` (free-form, e.g. `AWS`, `Google`, `Azure`)
  - `deprecationDate?: string` — from `deprecation_date`; documented by Core as `YYYY-MM-DD`, forwarded verbatim without validation
  - `endOfService?: string` — from `end_of_service`; same rules as `deprecationDate`
  - `tokenizerModel?: string`
  - `limits?: { maxTotalTokens?: number; maxPromptTokens?: number; maxCompletionTokens?: number }`
  - `pricing?: Record<string, string | ModelPricingRateDto>` — `unit` names the billing unit; scalar prices and recursive conditional pricing trees from DIAL Core are forwarded verbatim. `ModelPricingRateDto` is `{ rate?: string; test?: object; ifTrue?: string | ModelPricingRateDto; ifFalse?: string | ModelPricingRateDto }`: a branch is either a per-unit price string or a nested tree, and the OpenAPI schema SHALL declare both (`oneOf`), so the generated client types the branches as `ModelPricingRateDtoIfTrue` / `ModelPricingRateDtoIfFalse` (`ModelPricingRateDto | string`)
  - `features?: DeploymentFeaturesDetailsDto` (see below)
  - `catalogProperties?: ModelCatalogPropertiesDto`
  - `owner?: string`
  - `inputAttachmentTypes?: string[]`
  - `defaultMaxTokens?: number` — from `defaults.max_tokens`
  - `createdAt?: number`
- `applicationDetails?: ApplicationDetailsDto` — present only when `type === 'application'`:
  - `displayName?: string` — DIAL Core `display_name`; a locale map resolves to its first string value (`resolveLocalizedValue`)
  - `applicationProperties?: Record<string, unknown>` — a **verbatim passthrough** of DIAL
    Core's stored `application_properties` object for this application (non-secret custom
    properties only — function-level secrets are excluded per the allowlist). It SHALL NOT be
    merged with, or have any key overwritten by, the top-level DIAL Core `features` JSON — a
    stored `application_properties.features` key (for example a Quick App's own
    `features.timestamp` flag) round-trips unchanged. The top-level DIAL Core `features` JSON is
    exposed separately as `customAppFeatures` (below), never mixed into this field.
    For `applications/{bucket}/{path}`, the object from `getCustomApplication` SHALL
    take precedence over `getApplication` deployment metadata, which can omit, redact
    or contain stale properties. An explicitly empty stored object `{}` SHALL remain
    empty. If the full-configuration response is unavailable or its properties are
    not an object, retain the existing `getApplication.application_properties` object
    fallback; otherwise omit the field. Reuse the existing full-configuration request.
  - `customAppFeatures?: Record<string, unknown>` — the raw top-level DIAL Core `features` JSON
    read from `getCustomApplication`, distinct from both `applicationProperties.features` (a
    schema-specific key some applications store, now passed through untouched) and from
    `features` (the allow-listed `DeploymentFeaturesDetailsDto` capability flags below, sourced
    from `getApplication`/list-shaped data). Present only for applications resolvable via
    `applications/{bucket}/{path}` (the same set `endpoint` is already scoped to), and only when
    DIAL Core's custom-application response carries a `features` key; this is the field the
    plain Custom App editor's Features textarea reads and writes through `updateApplication`'s
    `features` DTO field.
  - `functionRuntime?: string` — from `function.runtime`
  - `functionStatus?: string` — from `function.status`
  - `routes?: string[]` — route names (`Object.keys(raw.routes)`), not the route definitions themselves
  - `owner?: string`
  - `features?: DeploymentFeaturesDetailsDto`
  - `inputAttachmentTypes?: string[]`
  - `catalogProperties?: ModelCatalogPropertiesDto`
  - `applicationTypeSchemaId?: string`
  - `endpoint?: string` — the string `endpoint` from `getCustomApplication`, falling back to the `getApplication` payload's `endpoint`
  - `maxInputAttachments?: number` — `max_input_attachments` when it is a number
  - `createdAt?: number`
- `toolsetDetails?: ToolsetDetailsDto` — present only when `type === 'toolset'`:
  - `transport?: string`
  - `allowedTools?: string[]`
  - `allToolNames?: string[]` — from `GET /v1/toolset/{id}/tools` (`getToolSetTools`), a best-effort supplementary call: a failure or non-2xx response is logged and omits this field without failing the whole request
  - `authSettings?: ToolsetAuthSettingsDto` — `{ authenticationType?, dynamicallyRegistered?, globalAuthStatus?, appLevelAuthStatus?, userLevelAuthStatus?, scopesSupported?, authorizationEndpoint?, tokenEndpoint?, apiKeyHeader?, clientId?, redirectUri?, tokenEndpointAuthMethod?, codeChallenge?, codeChallengeMethod? }` — every field DIAL Core's `auth_settings` payload exposes except `client_secret`/`code_verifier`, which are never read or forwarded. Read defensively off the raw untyped payload (`mapToolsetAuthSettings` in `deployments/utils/deployment-mapper.util.ts`), mirroring `mapDeploymentFeatures`, since the SDK's typed `ResourceAuthSettingsData` shape declares fewer fields than DIAL Core actually returns (e.g. it omits `token_endpoint`/`token_endpoint_auth_method` even though DIAL Core sends them).
  - `owner?: string`
  - `features?: DeploymentFeaturesDetailsDto`
  - `catalogProperties?: ModelCatalogPropertiesDto`
  - `createdAt?: number`
- `DeploymentFeaturesDetailsDto` — shared feature-flag shape reused by all three detail types (DIAL Core's runtime `features` payload extends one common schema): `rate`, `mcp`, `tokenize`, `truncatePrompt`, `hasConfigurationSchema` (named to avoid an OpenAPI-generator collision with the generated client's own `Configuration` runtime class — the raw field is `configuration`), `systemPrompt`, `tools`, `seed`, `urlAttachments`, `folderAttachments`, `allowResume`, `accessibleByPerRequestKey`, `contentParts`, `temperature`, `cache`, `autoCaching`, `parallelToolCalls`, `assistantAttachmentsInRequest`, `chatCompletion`, `responsesApi`, `anthropicMessages`, `skillsSupported` (from DIAL Core's `skills_supported`, PR #1976 — whether the deployment accepts custom skills), `maxTokensSupported`, `maxCompletionTokensSupported`, `customTemperatureSupported`, `reasoningEfforts?: string[]` — all read defensively off the raw untyped payload (`mapDeploymentFeatures` in `deployments/utils/deployment-mapper.util.ts`) since the SDK's typed `DeploymentFeatures` shape declares fewer flags than DIAL Core actually returns. `skillsSupported` follows the same defensive boolean rule as its neighbors: absent or non-boolean source values map to `undefined`, never throw.

The three model fields `provider`, `deprecationDate` and `endOfService` SHALL be read from the typed `ModelData` of `@epam/ai-dial-typescript-sdk` (`0.3.0-dev.3` or later), with no cast and no defensive `getString` read. Each SHALL be absent from the JSON body when Core omits it. Regenerating `@epam/ai-dial-chat-api-client` SHALL add the three optional properties to `ModelDetailsDto` and remove `provider` from `ModelCatalogPropertiesDto`. `operationId: getDeploymentDetails` and `DeploymentsApi.getDeploymentDetails({ deployment })` do not change. The response still uses the user-scoped details cache (`deployments:details:<userSub>:<deployment>`, 60-second TTL), with unchanged invalidation.

For model/application details, `anthropicMessages` SHALL be derived from declared-interface metadata rather than a legacy features flag. Explicit boolean `chat_completion`/`responses_api` values SHALL remain authoritative for their respective feature fields; when an individual flag is missing or malformed, only that API's own canonical declaration SHALL supply its fallback. If declarations supply any feature value, the features object SHALL exist even when the legacy features object does not. Toolset feature semantics SHALL remain unchanged. The additional generated property is optional `anthropicMessages`?: boolean; `getDeploymentDetails` and its normal generated method remain unchanged.

No `any` types are allowed in the success response shape.

#### Scenario: Best-effort all-tools fetch failure does not fail the request

- **WHEN** `GET /v1/toolset/{id}/tools` returns a non-2xx response or throws
- **THEN** the endpoint still responds 200 with the rest of `toolsetDetails` populated, and `allToolNames` is omitted

#### Scenario: Model provider and lifecycle dates are forwarded

- **WHEN** DIAL Core returns a model with `provider: "Azure"`, `deprecation_date: "2026-12-31"` and `end_of_service: "2027-03-31"`
- **THEN** `modelDetails` carries `provider: "Azure"`, `deprecationDate: "2026-12-31"` and `endOfService: "2027-03-31"`

#### Scenario: Absent lifecycle fields are omitted

- **WHEN** DIAL Core returns a model with none of `provider`, `deprecation_date` or `end_of_service`
- **THEN** the response's `modelDetails` has no `provider`, `deprecationDate` or `endOfService` key, and every other field is unchanged

#### Scenario: catalog_properties.provider is never forwarded

- **WHEN** DIAL Core returns a model, an application or a toolset with `catalog_properties: { "provider": "Legacy", "vendor": "OpenAI" }`
- **THEN** the branch's `catalogProperties` is `{ "vendor": "OpenAI" }`, and a model's `provider` comes only from Core's top-level `provider`

#### Scenario: A provider-only catalog_properties omits catalogProperties

- **WHEN** DIAL Core returns a model with no top-level `provider` and `catalog_properties: { "provider": "Legacy" }`
- **THEN** `modelDetails` has neither `provider` nor `catalogProperties`

#### Scenario: Model details omit application/toolset fields

- **WHEN** `type` is `'model'`
- **THEN** `applicationDetails` and `toolsetDetails` are both absent from the response

#### Scenario: Sensitive fields never serialize

- **WHEN** the underlying DIAL Core response for an application includes `function.env` or a toolset includes `auth_settings.client_secret`/`code_verifier`-shaped fields
- **THEN** the mapped `DeploymentDetailsDto` does not contain those values anywhere in its JSON representation, including in any debug-level log line

#### Scenario: Non-secret auth fields are forwarded, not just authenticationType

- **WHEN** a toolset's `auth_settings` includes `client_id`, `redirect_uri`, `token_endpoint_auth_method`, `code_challenge`, and `code_challenge_method`
- **THEN** all five values appear in `toolsetDetails.authSettings` under their camelCase names

#### Scenario: skills_supported maps to features.skillsSupported in details

- **WHEN** a deployment's raw `features` payload includes `skills_supported: true`
- **THEN** the detail type's `features.skillsSupported` is `true` in the response

#### Scenario: Absent or non-boolean skills_supported omits the field in details

- **WHEN** a deployment's raw `features` payload has no `skills_supported` field, or a non-boolean value there
- **THEN** the detail type's `features.skillsSupported` is `undefined` and the request still succeeds

#### Scenario: Deployment metadata omits saved application configuration

- **WHEN** deployment metadata contains missing, empty or stale application properties and the full custom-application response contains the saved configuration
- **THEN** details return the full stored object, including orchestrator, file contexts, skills, tool sets and schema-specific features, without merging deployment metadata into it

#### Scenario: The stored application configuration is explicitly empty

- **WHEN** the full custom-application response contains `application_properties: {}` while deployment metadata contains nonempty properties
- **THEN** details return `applicationProperties: {}`, without restoring stale deployment properties

#### Scenario: Full application properties are unavailable

- **WHEN** the full custom-application response cannot be obtained or does not contain object-valued properties
- **THEN** details retain the existing deployment properties fallback, or omit the field when neither source contains an object

#### Scenario: A Quick App's own features key is not overwritten by the top-level DIAL Core features
- **WHEN** a Quick App's stored `application_properties` includes `{ features: { timestamp: true }, orchestrator: {...} }` and DIAL Core's custom-application response also carries an unrelated top-level `features` JSON
- **THEN** the response's `applicationDetails.applicationProperties.features` is `{ timestamp: true }`, unchanged from what is stored, and the top-level DIAL Core `features` JSON appears only in `applicationDetails.customAppFeatures`

#### Scenario: The plain Custom App editor reads the relocated features field
- **WHEN** a plain custom application (no Quick Apps schema) has a top-level DIAL Core `features` JSON and an empty or absent `application_properties`
- **THEN** the response's `applicationDetails.customAppFeatures` carries that JSON and
  `applicationDetails.applicationProperties` is `undefined` (or omits `features` entirely) —
  matching what the plain Custom App editor's Features field (`apps/chat/src/pages/ApplicationEditor/definitions/customAppDefinition.tsx`) reads

#### Scenario: An application's own application_properties round-trips through read, edit, and save unchanged
- **WHEN** a Quick App's `applicationDetails.applicationProperties` is read via `GET
  .../details`, sent back unmodified as the `applicationProperties` body of a `PATCH
  .../applications/:applicationName` update, and then read again via `GET .../details`
- **THEN** the second read's `applicationDetails.applicationProperties` is identical to the
  first, including any `features` key it carries

#### Scenario: A conditional price branch may be a plain price string

- **WHEN** DIAL Core returns `pricing.prompt` as `{ test: { field: 'promptTokens', operator: '>', value: '200000' }, ifTrue: '0.000004', ifFalse: '0.000002' }`
- **THEN** `modelDetails.pricing.prompt` carries the same object unchanged, and the OpenAPI schema for `ModelPricingRateDto.ifTrue`/`ifFalse` accepts the string branches

## ADDED Requirements

### Requirement: Deployment details expose independently declared API capabilities

GET /api/v1/deployments/{deployment}/details SHALL expose Anthropic Messages support as optional `modelDetails.features.anthropicMessages` (and `applicationDetails.features.anthropicMessages` when an application declares it). Support MUST come from Core's canonical `anthropicMessages` declaration, never from the deployment ID, provider, model type or a hypothetical legacy Messages flag.

An object-valued `interface_configs` SHALL be the primary declaration source. A canonical key SHALL count as declared when its descriptor is an object, including an empty object; null, arrays and primitives SHALL NOT activate an interface. Unknown keys SHALL be ignored. Empty or unknown-only object metadata SHALL report no known declared APIs. When `interface_configs` is absent or not an object, equivalent canonical names in interfaces SHALL be accepted; categorical chat/mcp values and unknown names SHALL NOT count as API declarations. A nonempty array with no canonical names SHALL count as unavailable declaration metadata; an explicitly empty array SHALL count as an empty declaration.

`anthropicMessages` SHALL be true when declared, false when usable metadata excludes it, and omitted when declaration metadata is unavailable. Missing legacy features MUST NOT prevent a declared capability from appearing. Explicit boolean `chat_completion` and `responses_api` flags SHALL retain their own values; absent/non-boolean flags SHALL fall back only to their corresponding `openaiChatCompletions`/`openaiResponses` declarations when usable metadata exists. Anthropic support SHALL NOT enable either OpenAI capability.

The response SHALL NOT expose `interface_configs`, interface defaults, default headers or upstream addresses as part of this metadata addition. All pre-existing detail fields SHALL remain intact.

The request remains authenticated GET with no body, the existing deployment path validation, and the existing error mapping including 400 validation, 401 session, 403 authorization, 404 missing resource, 429 upstream limits, 502 upstream failure and 503 unavailable/timeout. OpenAPI operationId `getDeploymentDetails`, its deployment string request parameter and `DeploymentDetailsDto` response SHALL remain stable; the generated normal `DeploymentsApi.getDeploymentDetails` call SHALL deserialize the optional capability. No Raw method is required.

Existing state ownership, cache and observability SHALL remain unchanged: `useCatalogItemDetails` consumes the details response; the BFF cache key is deployments:details:<userSub>:<deployment>, TTL 60000 ms, invalidated by existing successful application/toolset mutations and toolset auth changes. No new cache/invalidation event, frontend context, i18n string, telemetry event, or `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` gate SHALL be introduced by the metadata contract itself.

Example request:

```http
GET /api/v1/deployments/messages-only/details HTTP/1.1
Cookie: <session cookie>
```

Example Core input:

```json
{"id":"messages-only","object":"model","interface_configs":{"anthropicMessages":{}}}
```

Relevant response fields:

```json
{"id":"messages-only","type":"model","modelDetails":{"features":{"chatCompletion":false,"responsesApi":false,"anthropicMessages":true}}}
```

#### Scenario: Mixed APIs retain independent capabilities

- **WHEN** Core declares `openaiChatCompletions`, `openaiResponses` and `anthropicMessages` and reports both legacy OpenAI flags as true
- **THEN** the model detail features contain `chatCompletion`: true, `responsesApi`: true and `anthropicMessages`: true

#### Scenario: Messages-only metadata has no legacy features

- **WHEN** Core supplies `interface_configs`: { "`anthropicMessages`": {} } with no features or interfaces field
- **THEN** `modelDetails.features` exists with `anthropicMessages`: true, `chatCompletion`: false and `responsesApi`: false

#### Scenario: Interface-only mixed metadata recovers each own API

- **WHEN** Core declares all three APIs in `interface_configs` with no legacy features flags
- **THEN** each corresponding detail feature is true, independently of the other declarations

#### Scenario: Equivalent declared-interface names are accepted

- **WHEN** `interface_configs` is absent and interfaces includes the canonical `anthropicMessages` name
- **THEN** the details expose `anthropicMessages`: true without consulting the model ID

#### Scenario: Missing metadata preserves legacy OpenAI behavior

- **WHEN** a deployment has no usable declarations and legacy `chat_completion`: true and `responses_api`: false
- **THEN** details preserve `chatCompletion`: true and `responsesApi`: false and omit `anthropicMessages`

#### Scenario: Explicit OpenAI false is not overridden

- **WHEN** metadata declares `openaiChatCompletions` and `anthropicMessages` but legacy `chat_completion` is false
- **THEN** `chatCompletion` remains false and `anthropicMessages` is true

#### Scenario: Malformed and unknown metadata cannot manufacture Messages support

- **WHEN** Core sends an unknown-only declaration map, an `anthropicMessages` descriptor that is null/a primitive/an array, or malformed `interface_configs` with no equivalent Messages declaration
- **THEN** the request succeeds without `anthropicMessages`: true, and explicit legacy OpenAI booleans are unchanged

#### Scenario: Model and provider names are not capabilities

- **WHEN** the model ID begins anthropic. or the provider is Anthropic but neither metadata source advertises `anthropicMessages`
- **THEN** the detail response does not advertise Messages support

#### Scenario: Private interface configuration does not reach the response

- **WHEN** a declared interface contains defaults, `default_headers` and arbitrary nested settings
- **THEN** details expose only its capability, not those settings or raw `interface_configs`

## MODIFIED Requirements

### Requirement: DeploymentDetailsDto shape

`DeploymentDetailsDto` SHALL be a strongly typed Swagger DTO, structurally aligned with `apps/chat/src/types/entity-details.ts`'s `ModelEntityDetails` / `AgentEntityDetails` / `ToolsetEntityDetails` split so the frontend mapping step is a field-by-field transcription. It deliberately excludes fields already returned by the list endpoint's `DeploymentItemDto` (`description`, `displayName`, `iconUrl`, `displayVersion`, `interfaces`, `topics`, `updatedAt`) — those are supplied to the UI via the already-loaded `CatalogItem`, not duplicated here.

- `id: string` — the requested deployment id
- `type: 'model' | 'application' | 'toolset'` — resolved discriminator
- `modelDetails?: ModelDetailsDto` — present only when `type === 'model'`:
  - `capabilities?: { completion?: boolean; chatCompletion?: boolean; embeddings?: boolean; fineTune?: boolean; inference?: boolean; scaleTypes?: string[] }` — from `ModelOpenAi.capabilities`
  - `lifecycleStatus?: string`
  - `tokenizerModel?: string`
  - `limits?: { maxTotalTokens?: number; maxPromptTokens?: number; maxCompletionTokens?: number }`
  - `pricing?: Record<string, string | PricingRate>` — `unit` names the billing unit; scalar prices and recursive conditional pricing trees from DIAL Core are forwarded verbatim
  - `features?: DeploymentFeaturesDetailsDto` (see below)
  - `owner?: string`
  - `inputAttachmentTypes?: string[]`
  - `defaultMaxTokens?: number` — from `defaults.max_tokens`
  - `createdAt?: number`
- `applicationDetails?: ApplicationDetailsDto` — present only when `type === 'application'`:
  - `applicationProperties?: Record<string, unknown>` — a **verbatim passthrough** of DIAL
    Core's stored `application_properties` object for this application (non-secret custom
    properties only — function-level secrets are excluded per the allowlist). It SHALL NOT be
    merged with, or have any key overwritten by, the top-level DIAL Core `features` JSON — a
    stored `application_properties.features` key (for example a Quick App's own
    `features.timestamp` flag) round-trips unchanged. The top-level DIAL Core `features` JSON is
    exposed separately as `customAppFeatures` (below), never mixed into this field.
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
  - `applicationTypeSchemaId?: string`
  - `createdAt?: number`
- `toolsetDetails?: ToolsetDetailsDto` — present only when `type === 'toolset'`:
  - `transport?: string`
  - `allowedTools?: string[]`
  - `allToolNames?: string[]` — from `GET /v1/toolset/{id}/tools` (`getToolSetTools`), a best-effort supplementary call: a failure or non-2xx response is logged and omits this field without failing the whole request
  - `authSettings?: ToolsetAuthSettingsDto` — `{ authenticationType?, globalAuthStatus?, appLevelAuthStatus?, userLevelAuthStatus?, scopesSupported?, authorizationEndpoint?, tokenEndpoint?, apiKeyHeader?, clientId?, redirectUri?, tokenEndpointAuthMethod?, codeChallenge?, codeChallengeMethod? }` — every field DIAL Core's `auth_settings` payload exposes except `client_secret`/`code_verifier`, which are never read or forwarded. Read defensively off the raw untyped payload (`mapToolsetAuthSettings` in `deployments/utils/deployment-mapper.util.ts`), mirroring `mapDeploymentFeatures`, since the SDK's typed `ResourceAuthSettingsData` shape declares fewer fields than DIAL Core actually returns (e.g. it omits `token_endpoint`/`token_endpoint_auth_method` even though DIAL Core sends them).
  - `owner?: string`
  - `features?: DeploymentFeaturesDetailsDto`
  - `createdAt?: number`
- `DeploymentFeaturesDetailsDto` — shared feature-flag shape reused by all three detail types (DIAL Core's runtime `features` payload extends one common schema): `rate`, `mcp`, `tokenize`, `truncatePrompt`, `hasConfigurationSchema` (named to avoid an OpenAPI-generator collision with the generated client's own `Configuration` runtime class — the raw field is `configuration`), `systemPrompt`, `tools`, `seed`, `urlAttachments`, `folderAttachments`, `allowResume`, `accessibleByPerRequestKey`, `contentParts`, `temperature`, `cache`, `autoCaching`, `parallelToolCalls`, `assistantAttachmentsInRequest`, `chatCompletion`, `responsesApi`, `maxTokensSupported`, `maxCompletionTokensSupported`, `customTemperatureSupported`, `reasoningEfforts?: string[]` — all read defensively off the raw untyped payload (`mapDeploymentFeatures` in `deployments/utils/deployment-mapper.util.ts`) since the SDK's typed `DeploymentFeatures` shape declares fewer flags than DIAL Core actually returns.

No `any` types are allowed in the success response shape.

#### Scenario: Best-effort all-tools fetch failure does not fail the request

- **WHEN** `GET /v1/toolset/{id}/tools` returns a non-2xx response or throws
- **THEN** the endpoint still responds 200 with the rest of `toolsetDetails` populated, and `allToolNames` is omitted

#### Scenario: Model details omit application/toolset fields

- **WHEN** `type` is `'model'`
- **THEN** `applicationDetails` and `toolsetDetails` are both absent from the response

#### Scenario: Sensitive fields never serialize

- **WHEN** the underlying DIAL Core response for an application includes `function.env` or a toolset includes `auth_settings.client_secret`/`code_verifier`-shaped fields
- **THEN** the mapped `DeploymentDetailsDto` does not contain those values anywhere in its JSON representation, including in any debug-level log line

#### Scenario: Non-secret auth fields are forwarded, not just authenticationType

- **WHEN** a toolset's `auth_settings` includes `client_id`, `redirect_uri`, `token_endpoint_auth_method`, `code_challenge`, and `code_challenge_method`
- **THEN** all five values appear in `toolsetDetails.authSettings` under their camelCase names

#### Scenario: A Quick App's own features key is not overwritten by the top-level DIAL Core features
- **WHEN** a Quick App's stored `application_properties` includes `{ features: { timestamp: true }, orchestrator: {...} }` and DIAL Core's custom-application response also carries an unrelated top-level `features` JSON
- **THEN** the response's `applicationDetails.applicationProperties.features` is `{ timestamp: true }`, unchanged from what is stored, and the top-level DIAL Core `features` JSON appears only in `applicationDetails.customAppFeatures`

#### Scenario: The plain Custom App editor reads the relocated features field
- **WHEN** a plain custom application (no Quick Apps schema) has a top-level DIAL Core `features` JSON and an empty or absent `application_properties`
- **THEN** the response's `applicationDetails.customAppFeatures` carries that JSON and
  `applicationDetails.applicationProperties` is `undefined` (or omits `features` entirely) —
  matching what `CustomAppEditor.tsx`'s Features textarea now reads

#### Scenario: An application's own application_properties round-trips through read, edit, and save unchanged
- **WHEN** a Quick App's `applicationDetails.applicationProperties` is read via `GET
  .../details`, sent back unmodified as the `applicationProperties` body of a `PATCH
  .../applications/:applicationName` update, and then read again via `GET .../details`
- **THEN** the second read's `applicationDetails.applicationProperties` is identical to the
  first, including any `features` key it carries

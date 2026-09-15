# deployment-details-api Delta

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
  - `applicationProperties?: Record<string, unknown>` — non-secret custom properties only (function-level secrets excluded per the allowlist)
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
- `DeploymentFeaturesDetailsDto` — shared feature-flag shape reused by all three detail types (DIAL Core's runtime `features` payload extends one common schema): `rate`, `mcp`, `tokenize`, `truncatePrompt`, `hasConfigurationSchema` (named to avoid an OpenAPI-generator collision with the generated client's own `Configuration` runtime class — the raw field is `configuration`), `systemPrompt`, `tools`, `seed`, `urlAttachments`, `folderAttachments`, `allowResume`, `accessibleByPerRequestKey`, `contentParts`, `temperature`, `cache`, `autoCaching`, `parallelToolCalls`, `assistantAttachmentsInRequest`, `chatCompletion`, `responsesApi`, `skillsSupported` (from DIAL Core's `skills_supported`, PR #1976 — whether the deployment accepts custom skills), `maxTokensSupported`, `maxCompletionTokensSupported`, `customTemperatureSupported`, `reasoningEfforts?: string[]` — all read defensively off the raw untyped payload (`mapDeploymentFeatures` in `deployments/utils/deployment-mapper.util.ts`) since the SDK's typed `DeploymentFeatures` shape declares fewer flags than DIAL Core actually returns. `skillsSupported` follows the same defensive boolean rule as its neighbors: absent or non-boolean source values map to `undefined`, never throw.

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

#### Scenario: skills_supported maps to features.skillsSupported in details

- **WHEN** a deployment's raw `features` payload includes `skills_supported: true`
- **THEN** the detail type's `features.skillsSupported` is `true` in the response

#### Scenario: Absent or non-boolean skills_supported omits the field in details

- **WHEN** a deployment's raw `features` payload has no `skills_supported` field, or a non-boolean value there
- **THEN** the detail type's `features.skillsSupported` is `undefined` and the request still succeeds

# Spec: deployment-details-api

## Requirements

### Requirement: GET /api/v1/deployments/{deployment}/details endpoint

The system SHALL expose `GET /api/v1/deployments/{deployment}/details` on the existing `DeploymentsController` (`apps/chat-api/src/deployments/deployments.controller.ts`), following the same `:deployment` single-path-segment param convention already used by `:deployment/configuration` and `:deployment/limits`. The endpoint fetches full per-entity data for one deployment id and returns it as `DeploymentDetailsDto`.

The endpoint:
- MUST require authentication via `SessionGuard`; respond 401 when no valid session is present.
- SHALL resolve the deployment's type from the `deployment` id prefix, mirroring the `toolsets/`/`applications/` prefix convention already relied on by the frontend (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`'s `TOOLSETS_PREFIX`/`APPLICATIONS_PREFIX`), rather than calling `listDeployments` — avoids an expensive full-catalog fetch just to classify one id:
  - `deployment` starting with `toolsets/` → call `getToolset` directly.
  - `deployment` starting with `applications/` → call `getApplication` directly.
  - otherwise (ambiguous — root-level applications and root-level toolsets, e.g. a copied toolset without a `toolsets/` prefix, are indistinguishable from a model id by shape alone) → call `getModel` first, then `getApplication`, then `getToolset` in turn, falling through to the next on a 404.
- SHALL treat a resolved-type call that succeeds with no response body the same as a 404 (throws `NotFoundException` rather than forwarding an empty/malformed detail object), so the id-resolution fallback chain above continues correctly.
- SHALL respond 404 when none of the applicable calls (direct call, or for ambiguous ids, `getModel` → `getApplication` → `getToolset` in sequence) find the deployment.
- SHALL call, based on resolved type: `this.client.getModel(deployment, { headers })` for models, `this.client.getApplication(deployment, { headers })` for applications, or `this.client.getToolset(deployment, { headers })` for toolsets — using the `@epam/ai-dial-typescript-sdk` client already shared via `AppService`/`this.client`.
- SHALL map the SDK response into `DeploymentDetailsDto` using an explicit allowlist (see `DeploymentDetailsDto shape` requirement below); fields not on the allowlist MUST NOT be forwarded, even if present on the raw SDK response.
- SHALL respond 200 with `DeploymentDetailsDto` on success.
- SHALL respond 502 when DIAL Core returns a non-2xx response for the detail call.
- SHALL respond 503 when DIAL Core is unreachable or times out.
- SHALL apply `@Throttle({ default: { limit: 60, ttl: 60000 } })`, matching `GET /api/v1/deployments`.
- SHALL cache the mapped `DeploymentDetailsDto` under key `deployments:details:<deploymentId>` for 60 000 ms; the TTL is time-based only — there is no write path for deployments in this app, so no explicit invalidation event exists beyond expiry.
- SHALL set response header `Cache-Control: private, max-age=60`.
- SHOULD log, at debug level, the raw DIAL Core toolset response (redacting `auth_settings.client_secret`/`code_verifier`) and the final mapped `DeploymentDetailsDto` sent to the frontend, to aid diagnosing field-mapping gaps.
- MUST NOT log the session access token.
- MUST NOT forward `function.env`, `function.source_folder`, `function.target_folder`, `auth_settings.client_secret`, `auth_settings.code_verifier`, `editor_url`, or raw `reference` fields.

#### Scenario: Model detail returned

- **WHEN** an authenticated user calls `GET /api/v1/deployments/gpt-4/details` and `gpt-4` resolves to type `model`
- **THEN** the endpoint responds 200 with `DeploymentDetailsDto` whose `type` is `'model'` and `modelDetails` is populated from `getModel`

#### Scenario: Application detail returned

- **WHEN** an authenticated user calls `GET /api/v1/deployments/my-app/details` and `my-app` resolves to type `application`
- **THEN** the endpoint responds 200 with `DeploymentDetailsDto` whose `type` is `'application'` and `applicationDetails` is populated from `getApplication`, excluding `function.env`, `function.source_folder`, `function.target_folder`, and `editor_url`

#### Scenario: Toolset detail returned

- **WHEN** an authenticated user calls `GET /api/v1/deployments/my-toolset/details` and `my-toolset` resolves to type `toolset`
- **THEN** the endpoint responds 200 with `DeploymentDetailsDto` whose `type` is `'toolset'` and `toolsetDetails` is populated from `getToolset`, with `authSettings` forwarding every non-secret field DIAL Core returns (never `client_secret`/`code_verifier`)

#### Scenario: Unprefixed toolset id resolved via fallback

- **WHEN** an authenticated user calls `GET /api/v1/deployments/OauthToolset-copy/details` for a root-level toolset with no `toolsets/` prefix
- **THEN** `getModel` and `getApplication` both 404, `getToolset` succeeds, and the endpoint responds 200 with `type: 'toolset'`

#### Scenario: Unknown deployment id

- **WHEN** `GET /api/v1/deployments/{id}/details` is called with an id that does not exist in DIAL Core
- **THEN** the direct call (or, for an ambiguous unprefixed id, the full `getModel` → `getApplication` → `getToolset` fallback chain) returns 404 and the endpoint responds 404

#### Scenario: Success response with no body is treated as not found

- **WHEN** the resolved SDK call (e.g. `getModel`) resolves without an error flag but with an empty/undefined response body
- **THEN** the endpoint treats this the same as a 404 (continuing the fallback chain for ambiguous ids, or responding 404 directly) rather than throwing an unhandled error

#### Scenario: Cache hit avoids upstream detail call

- **WHEN** `deployments:details:<id>` is present in cache and not yet expired
- **THEN** the service returns the cached `DeploymentDetailsDto` without calling `getModel`/`getApplication`/`getToolset`

#### Scenario: Concurrent requests for the same uncached id share one upstream call

- **WHEN** two requests for the same uncached `deployment` id arrive before the first has resolved
- **THEN** only one upstream detail call is made; the second request awaits and receives the same result as the first (via the in-memory `pendingDetailsRequests` map keyed by cache key)

#### Scenario: DIAL Core unreachable

- **WHEN** DIAL Core does not respond within the SDK timeout for the detail call
- **THEN** the endpoint responds 503

#### Scenario: DIAL Core returns error

- **WHEN** DIAL Core returns a non-2xx response to the underlying `getModel`/`getApplication`/`getToolset` call
- **THEN** the endpoint responds 502

#### Scenario: Unauthenticated request rejected

- **WHEN** `GET /api/v1/deployments/{id}/details` is called without a valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Rate limit exceeded

- **WHEN** the request rate exceeds 60 per minute for the client
- **THEN** the endpoint responds 429

#### Scenario: List endpoint response shape is unchanged

- **WHEN** `GET /api/v1/deployments` is called
- **THEN** the response is `{ deployments: DeploymentItemDto[] }` exactly as before this change — `DeploymentItemDto` gains no new fields as part of this change

---

### Requirement: DeploymentDetailsDto shape

`DeploymentDetailsDto` SHALL be a strongly typed Swagger DTO, structurally aligned with `apps/chat/src/types/entity-details.ts`'s `ModelEntityDetails` / `AgentEntityDetails` / `ToolsetEntityDetails` split so the frontend mapping step is a field-by-field transcription. It deliberately excludes fields already returned by the list endpoint's `DeploymentItemDto` (`description`, `displayName`, `iconUrl`, `displayVersion`, `interfaces`, `topics`, `updatedAt`) — those are supplied to the UI via the already-loaded `CatalogItem`, not duplicated here.

- `id: string` — the requested deployment id
- `type: 'model' | 'application' | 'toolset'` — resolved discriminator
- `modelDetails?: ModelDetailsDto` — present only when `type === 'model'`:
  - `capabilities?: { completion?: boolean; chatCompletion?: boolean; embeddings?: boolean; fineTune?: boolean; inference?: boolean; scaleTypes?: string[] }` — from `ModelOpenAi.capabilities`
  - `lifecycleStatus?: string`
  - `tokenizerModel?: string`
  - `limits?: { maxTotalTokens?: number; maxPromptTokens?: number; maxCompletionTokens?: number }`
  - `pricing?: { unit?: string; prompt?: string; completion?: string }`
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
  - `authSettings?: ToolsetAuthSettingsDto` — `{ authenticationType?, globalAuthStatus?, appLevelAuthStatus?, userLevelAuthStatus?, scopesSupported?, authorizationEndpoint?, tokenEndpoint?, apiKeyHeader?, clientId?, redirectUri?, tokenEndpointAuthMethod?, codeChallenge?, codeChallengeMethod? }` — every field DIAL Core's `auth_settings` payload exposes except `client_secret`/`code_verifier`, which are never read or forwarded. Read defensively off the raw untyped payload (`mapToolsetAuthSettings` in `deployments.service.ts`), mirroring `mapDeploymentFeatures`, since the SDK's typed `ResourceAuthSettingsData` shape declares fewer fields than DIAL Core actually returns (e.g. it omits `token_endpoint`/`token_endpoint_auth_method` even though DIAL Core sends them).
  - `owner?: string`
  - `features?: DeploymentFeaturesDetailsDto`
  - `createdAt?: number`
- `DeploymentFeaturesDetailsDto` — shared feature-flag shape reused by all three detail types (DIAL Core's runtime `features` payload extends one common schema): `rate`, `mcp`, `tokenize`, `truncatePrompt`, `hasConfigurationSchema` (named to avoid an OpenAPI-generator collision with the generated client's own `Configuration` runtime class — the raw field is `configuration`), `systemPrompt`, `tools`, `seed`, `urlAttachments`, `folderAttachments`, `allowResume`, `accessibleByPerRequestKey`, `contentParts`, `temperature`, `cache`, `autoCaching`, `parallelToolCalls`, `assistantAttachmentsInRequest`, `chatCompletion`, `responsesApi`, `maxTokensSupported`, `maxCompletionTokensSupported`, `customTemperatureSupported`, `reasoningEfforts?: string[]` — all read defensively off the raw untyped payload (`mapDeploymentFeatures` in `deployments.service.ts`) since the SDK's typed `DeploymentFeatures` shape declares fewer flags than DIAL Core actually returns.

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

# Spec: deployment-details-api

## Purpose

`GET /api/v1/deployments/{deployment}/details` and the shape of its response DTO.
## Requirements
### Requirement: GET /api/v1/deployments/{deployment}/details endpoint

The system SHALL expose `GET /api/v1/deployments/{deployment}/details` on the existing `DeploymentsController` (`apps/chat-api/src/deployments/deployments.controller.ts`), following the same encoded `:deployment` path-param convention already used by `:deployment/configuration` and `:deployment/limits`. The decoded value may contain structural `/` separators for DIAL resource identifiers. The endpoint fetches full per-entity data for one deployment id and returns it as `DeploymentDetailsDto`.

The endpoint:
- MUST require authentication via `SessionGuard`; respond 401 when no valid session is present.
- MUST reject an identifier longer than 2048 characters, an empty segment, a `.` or `..` segment, or an ASCII control character with 400 before calling DIAL Core; spaces and URL-reserved characters remain valid when percent-encoded by the caller.
- MUST percent-encode every validated `/`-separated segment independently before passing the identifier to any DIAL SDK detail method, preserving structural `/` separators.
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
- SHALL cache the mapped `DeploymentDetailsDto` under key `deployments:details:<userSub>:<deployment>` for 60 000 ms, so entries and in-flight request deduplication are isolated by authenticated user and deployment.
- SHALL invalidate the affected `deployments:details:<userSub>:<deployment>` entry after a successful toolset create, update, delete, login, or logout, and after a successful application update (`ApplicationsService.updateApplication`, using the same `applicationName` string as the cache key), before the next details fetch is treated as fresh.
- SHALL ensure an in-flight `getDeploymentDetails` fetch that was dispatched before an invalidation for the same key never repopulates the cache with its (pre-invalidation) result, and is never joined by a request made after that invalidation — see the dedicated requirement below.
- SHALL set response header `Cache-Control: private, no-store`; client and intermediary caches MUST NOT reuse the response, while the user-scoped BFF cache remains active.
- SHALL preserve OpenAPI `operationId: getDeploymentDetails`, path parameter `deployment: string`, response `DeploymentDetailsDto`, and normal generated `DeploymentsApi.getDeploymentDetails({ deployment })` usage; no `Raw` generated call is required because frontend callers do not consume the response header.
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

#### Scenario: Unsafe deployment id is rejected at the BFF boundary

- **WHEN** the decoded `deployment` parameter contains `../`, an empty path segment, or an ASCII control character
- **THEN** the endpoint responds 400 without calling `getModel`, `getApplication`, `getToolset`, or `getToolSetTools`

#### Scenario: Success response with no body is treated as not found

- **WHEN** the resolved SDK call (e.g. `getModel`) resolves without an error flag but with an empty/undefined response body
- **THEN** the endpoint treats this the same as a 404 (continuing the fallback chain for ambiguous ids, or responding 404 directly) rather than throwing an unhandled error

#### Scenario: Cache hit avoids upstream detail call

- **WHEN** `deployments:details:<userSub>:<deployment>` is present in cache and not yet expired
- **THEN** the service returns the cached `DeploymentDetailsDto` without calling `getModel`/`getApplication`/`getToolset`

#### Scenario: Concurrent requests for the same uncached user and deployment share one upstream call

- **WHEN** two concurrent requests for the same authenticated user and uncached `deployment` arrive before the first has resolved
- **THEN** only one upstream detail call is made; the second request awaits and receives the same result through the in-memory map keyed by `deployments:details:<userSub>:<deployment>`

#### Scenario: Different users do not share deployment details

- **WHEN** two authenticated users request the same deployment id within the 60-second server cache window
- **THEN** each user resolves through a distinct `deployments:details:<userSub>:<deployment>` cache key and cannot receive the other user's detail snapshot

#### Scenario: Toolset write invalidates cached details

- **WHEN** a toolset create, update, delete, login, or logout succeeds for a user and toolset
- **THEN** the affected `deployments:details:<userSub>:<deployment>` entry is deleted before a subsequent details request can reuse it

#### Scenario: Application update invalidates cached details

- **WHEN** `PATCH /api/v1/applications/:applicationName` succeeds for an application whose `deployments:details:<userSub>:<applicationName>` entry is currently cached
- **THEN** that cache entry is deleted before a subsequent `GET .../details` request for the same id can reuse it, so the request re-fetches the just-updated `application_properties` from DIAL Core instead of returning the pre-update snapshot

#### Scenario: A request in flight when a logout invalidates its key does not resurrect stale data

- **WHEN** a `getDeploymentDetails` request for a toolset is still awaiting DIAL Core when a login/logout for that same toolset invalidates its cache key, and a second `getDeploymentDetails` request for the same key arrives after that invalidation
- **THEN** the second request fires its own upstream call rather than joining the first (still-pending) one, and once the first request resolves it does not overwrite the cache with its pre-invalidation result — the cache ends up holding only the second, post-change result

This closes a race observed as an unstable toolset login/logout indicator: a details fetch dispatched right before a logout could otherwise be joined by the post-logout refetch, or could win the cache write after the invalidation had already run, leaving `authSettings.userLevelAuthStatus` stuck on the pre-logout value for up to the 60 s TTL even though `GET /api/v1/toolsets` already reflected the change. The service tracks a per-cache-key generation counter, bumped by every invalidation; `invalidateDetailsCache` also drops any in-flight request from the pending-request map so a later caller cannot join it, and a fetch only writes its result to cache if the key's generation is unchanged since the fetch started.

#### Scenario: Client-side caching is disabled

- **WHEN** an authenticated deployment-details request succeeds
- **THEN** the response contains `Cache-Control: private, no-store`, while the BFF may still serve the body from its user-scoped server cache

#### Scenario: DIAL Core unreachable

- **WHEN** DIAL Core does not respond within the SDK timeout for the detail call
- **THEN** the endpoint responds 503

#### Scenario: DIAL Core returns error

- **WHEN** DIAL Core returns a non-2xx response to the underlying `getModel`/`getApplication`/`getToolset` call
- **THEN** the endpoint responds 502

#### Scenario: Unauthenticated request rejected

- **WHEN** `GET /api/v1/deployments/{id}/details` is called without a valid session cookie
- **THEN** the endpoint responds 401

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
  matching what `CustomAppEditor.tsx`'s Features textarea now reads

#### Scenario: An application's own application_properties round-trips through read, edit, and save unchanged
- **WHEN** a Quick App's `applicationDetails.applicationProperties` is read via `GET
  .../details`, sent back unmodified as the `applicationProperties` body of a `PATCH
  .../applications/:applicationName` update, and then read again via `GET .../details`
- **THEN** the second read's `applicationDetails.applicationProperties` is identical to the
  first, including any `features` key it carries


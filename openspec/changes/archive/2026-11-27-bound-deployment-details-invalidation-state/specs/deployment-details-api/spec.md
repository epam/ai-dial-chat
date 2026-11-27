# Spec Delta

## MODIFIED Requirements

### Requirement: GET /api/v1/deployments/{deployment}/details endpoint

The system SHALL expose `GET /api/v1/deployments/{deployment}/details` on the existing `DeploymentsController` (`apps/chat-api/src/deployments/deployments.controller.ts`), implemented by `DeploymentsDetailsService` (`apps/chat-api/src/deployments/details/deployments-details.service.ts`) behind the `DeploymentsService` facade, following the same encoded `:deployment` path-param convention already used by `:deployment/configuration` and `:deployment/limits`. The decoded value may contain structural `/` separators for DIAL resource identifiers. The endpoint fetches full per-entity data for one deployment id and returns it as `DeploymentDetailsDto`.

The endpoint:
- MUST require authentication via `SessionGuard`; respond 401 when no valid session is present.
- MUST reject an identifier longer than 2048 characters, an empty segment, a `.` or `..` segment, or an ASCII control character with 400 before calling DIAL Core; spaces and URL-reserved characters remain valid when percent-encoded by the caller.
- MUST percent-encode every validated `/`-separated segment independently before passing the identifier to any DIAL SDK detail method, preserving structural `/` separators.
- SHALL resolve the deployment's type from the `deployment` id prefix, mirroring the `toolsets/`/`applications/` prefix convention already relied on by the frontend (`libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`'s `TOOLSETS_PREFIX`/`APPLICATIONS_PREFIX`), rather than calling `listDeployments` — avoids an expensive full-catalog fetch just to classify one id:
  - `deployment` starting with `toolsets/` → call `getToolset` directly.
  - `deployment` starting with `applications/` → call `getApplication` directly.
  - otherwise (ambiguous — root-level applications and root-level toolsets, e.g. a copied toolset without a `toolsets/` prefix, are indistinguishable from a model id by shape alone) → call `getModel` first, then `getApplication`, then `getToolset` in turn, falling through to the next on a 404.
- SHALL treat a resolved-type call that succeeds with no response body the same as a 404 (throws `NotFoundException` rather than forwarding an empty/malformed detail object), so the id-resolution fallback chain above continues correctly.
- SHALL respond 404 when none of the applicable calls (direct call, or for ambiguous ids, `getModel` → `getApplication` → `getToolset` in sequence) find the deployment.
- SHALL call, based on resolved type: `this.dialClient.client.getModel(encodeDialResourcePath(deployment), …)` for models, `this.dialClient.client.getApplication(…)` for applications (plus `getCustomApplication` for `applications/{bucket}/{path}` ids), or `this.dialClient.client.getToolset(…)` for toolsets — using the `@epam/ai-dial-typescript-sdk` client shared via `DialClientService` (`apps/chat-api/src/dial/dial-client.service.ts`).
- SHALL map the SDK response into `DeploymentDetailsDto` using an explicit allowlist (see `DeploymentDetailsDto shape` requirement below); fields not on the allowlist MUST NOT be forwarded, even if present on the raw SDK response.
- SHALL respond 200 with `DeploymentDetailsDto` on success.
- SHALL respond 502 when DIAL Core returns a non-2xx response for the detail call.
- SHALL respond 503 when DIAL Core is unreachable or times out.
- SHALL cache the mapped `DeploymentDetailsDto` under key `deployments:details:<userSub>:<deployment>` for 60 000 ms, so entries and in-flight request deduplication are isolated by authenticated user and deployment.
- SHALL invalidate the affected `deployments:details:<userSub>:<deployment>` entry after a successful toolset update, delete, login, or logout, and after a successful application update (`ApplicationsService.updateApplication`, using the same `applicationName` string as the cache key), before the next details fetch is treated as fresh.
- SHALL ensure an in-flight `getDeploymentDetails` fetch that was dispatched before an invalidation for the same key never repopulates the cache with its (pre-invalidation) result, and is never joined by a request made after that invalidation began — see the requirements "Deployment details invalidation fences older fetches before any asynchronous step" and "Deployment details invalidation state is reclaimed once no older fetch can write" below.
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

- **WHEN** a toolset update, delete, login, or logout succeeds for a user and toolset
- **THEN** the affected `deployments:details:<userSub>:<deployment>` entry is deleted before a subsequent details request can reuse it

#### Scenario: Toolset create leaves the details cache untouched

- **WHEN** a toolset create succeeds
- **THEN** `invalidateCaches(userSub)` runs without a toolset name, so no `deployments:details` entry is deleted
- **AND** this is safe because a newly created toolset has no cached details entry yet

#### Scenario: Application update invalidates cached details

- **WHEN** `PATCH /api/v1/applications/:applicationName` succeeds for an application whose `deployments:details:<userSub>:<applicationName>` entry is currently cached
- **THEN** that cache entry is deleted before a subsequent `GET .../details` request for the same id can reuse it, so the request re-fetches the just-updated `application_properties` from DIAL Core instead of returning the pre-update snapshot

#### Scenario: A request in flight when a logout invalidates its key does not resurrect stale data

- **WHEN** a `getDeploymentDetails` request for a toolset is still awaiting DIAL Core when a login/logout for that same toolset invalidates its cache key, and a second `getDeploymentDetails` request for the same key arrives after that invalidation
- **THEN** the second request fires its own upstream call rather than joining the first (still-pending) one, and once the first request resolves it does not overwrite the cache with its pre-invalidation result — the cache ends up holding only the second, post-change result

This closes a race observed as an unstable toolset login/logout indicator: a details fetch dispatched right before a logout could otherwise be joined by the post-logout refetch, or could win the cache write after the invalidation had already run, leaving `authSettings.userLevelAuthStatus` stuck on the pre-logout value for up to the 60 s TTL even though `GET /api/v1/toolsets` already reflected the change. Each details fetch is fenced by the identity of its own in-flight record in the service's pending-request map (`pendingDetailsRequests`): invalidation removes the key's record, so a later caller cannot join the older fetch, and a fetch writes its result to cache only while its own record is still the key's current one. No per-key counter survives the fetch.

#### Scenario: Client-side caching is disabled

- **WHEN** an authenticated deployment-details request succeeds
- **THEN** the response contains `Cache-Control: private, no-store`, while the BFF may still serve the body from its user-scoped server cache

#### Scenario: DIAL Core unreachable

- **WHEN** the HTTP transport times out the detail call — no explicit SDK deadline is configured; the undici `headersTimeout`/`bodyTimeout` defaults apply
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

## ADDED Requirements

### Requirement: Deployment details invalidation fences older fetches before any asynchronous step

Invalidating `deployments:details:<userSub>:<deployment>` SHALL fence every older fetch for that key before its first asynchronous step, then delete the cached details and `deployments:interfaces:<userSub>:<deployment>`. An older fetch SHALL NOT cache its result, and no caller arriving after invalidation began SHALL join it. If an invalidation runs while a fenced fetch's cache write is in flight, the entry SHALL be deleted again.

#### Scenario: An older fetch settles while the invalidation's cache delete is still pending

- **WHEN** a details fetch is awaiting DIAL Core, an invalidation for the same key starts, and the fetch resolves before the invalidation's cache delete has completed
- **THEN** the fetch returns its result to its own callers but does not write it to `deployments:details:<userSub>:<deployment>`, and the next details request fetches from DIAL Core

#### Scenario: A caller arriving during the invalidation's cache delete does not join the older fetch

- **WHEN** an invalidation has started for a key with a pending fetch and a new details request for the same key arrives before the invalidation's cache delete has completed
- **THEN** the new request starts its own upstream call and returns its own result

#### Scenario: Invalidation overlaps an older fetch's cache write

- **WHEN** a fetch has passed its fence check and its cache write is still in flight when an invalidation for the same key runs
- **THEN** after both settle, `deployments:details:<userSub>:<deployment>` does not hold that fetch's result; at worst the next request is a cache miss

#### Scenario: Old and new fetches settle in either order

- **WHEN** an older fetch is invalidated, a newer fetch for the same key starts, and the two resolve in either order
- **THEN** the cache holds only the newer fetch's result, and each fetch returns its own result to its own callers

#### Scenario: A failed fetch on either side of an invalidation

- **WHEN** the older or the newer fetch rejects (502, 503 or 404 as mapped today)
- **THEN** the rejecting fetch's callers receive the same error as before this change, nothing is cached for it, and the other fetch is unaffected

#### Scenario: A request still reading the cache when invalidation starts counts as post-invalidation

- **WHEN** a details request has started but is still reading the cache, without having called DIAL Core, when an invalidation for the same key runs
- **THEN** its upstream call is sent after the fence, so it reads the post-write state; callers arriving after the invalidation may join it, and its result may be cached

#### Scenario: Companion interfaces entry is still invalidated

- **WHEN** `deployments:details:<userSub>:<deployment>` is invalidated
- **THEN** `deployments:interfaces:<userSub>:<deployment>` is deleted as well, so the next `getDeploymentInterfaces` call re-reads DIAL Core

### Requirement: Deployment details invalidation state is reclaimed once no older fetch can write

`DeploymentsDetailsService` SHALL keep per-key invalidation and coalescing state only in its pending-request map, at most one record per `deployments:details:<userSub>:<deployment>` key with a current fetch. A record SHALL be removed when that fetch settles or the key is invalidated. A key with no current fetch SHALL retain no state, however often it was invalidated. No hard count SHALL evict a current record.

#### Scenario: Many distinct keys invalidated while idle retain nothing

- **WHEN** invalidations run for many distinct user × deployment keys with no details fetch in flight
- **THEN** the service holds no per-key state for any of them afterwards

#### Scenario: Repeated invalidation during one live request

- **WHEN** the same key is invalidated several times while one older fetch is still awaiting DIAL Core, and that fetch then settles
- **THEN** the fetch does not cache its result, and once it settles no state remains for the key

#### Scenario: State is reclaimed after success and after rejection

- **WHEN** a current fetch for a key resolves or rejects
- **THEN** its record is removed from the pending-request map in both cases, and only if it is still the key's current record

#### Scenario: Coalesced callers share one record

- **WHEN** several callers request the same uncached key in the same epoch while its fetch is pending
- **THEN** they all join one upstream call and one record, and that record is removed once the call settles

#### Scenario: An older fetch's cleanup does not remove a newer record

- **WHEN** an older, invalidated fetch settles after a newer fetch has registered its own record for the same key
- **THEN** the newer record stays in place, and callers arriving afterwards still join the newer fetch

### Requirement: Retention for details fetches that never settle

A details fetch whose upstream call never settles SHALL keep at most its own record, and only until the key is invalidated. After that it SHALL hold no map entry: only its own promise chain retains it. The service SHALL NOT claim an absolute bound, because detail calls carry no explicit deadline and rely on the HTTP transport's default timeouts.

#### Scenario: A hung current fetch keeps one record until invalidation

- **WHEN** a details fetch's upstream call neither resolves nor rejects
- **THEN** exactly one record remains for its key, callers in the same epoch join it, and an invalidation of that key removes the record so the next caller starts a new fetch

#### Scenario: A hung invalidated fetch holds no map entry

- **WHEN** a fetch that has already been invalidated never settles
- **THEN** the pending-request map holds no entry for it, and when it eventually settles the fence rejects its cache write

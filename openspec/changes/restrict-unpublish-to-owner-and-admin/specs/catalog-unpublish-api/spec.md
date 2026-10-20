## ADDED Requirements

### Requirement: Unpublish access is limited to administrators and the copy's publisher

`apps/chat-api` SHALL decide whether the caller may request removal of a catalog entity with one rule, `PublishService.canUnpublish(user, entityType, entityId)` in `apps/chat-api/src/publish/publish.service.ts`, used by both the unpublish endpoint and the access endpoint below. The caller may unpublish when **any** of these holds, checked in this order (later checks are skipped once one passes):

1. **Administrator** — the caller is an administrator by exactly the rule `GET /api/v1/auth/me` reports as `isAdmin`: the provider's configured `adminRoles` intersect the session's roles claim. That rule SHALL live in one provider, `AdminRoleService.isAdmin(user)` in `apps/chat-api/src/auth/admin-role.service.ts`, exported from `AuthModule`; `AuthController.getCurrentUser` SHALL call it instead of its own private copy, so the two answers cannot drift. A provider with no `adminRoles`, or an unknown `providerId`, yields `false`.
2. **Own resource** — `entityId` lives in the caller's own session bucket (`getResourceBucket(entityId) === bucket`). The bucket comes from the session only, never from the request.
3. **Publisher of the public copy** — the caller's own publications (`getPublications` with `getPublicationsListScope(bucket)`, each `APPROVED` candidate re-read with `getPublication`, the same resolution publish history performs) contain a publishing (`ADD`/default-action) resource whose `targetUrl` equals `entityId` after percent-decoding, and no `APPROVED` `DELETE` for the same folder and `targetUrl` created at or after it cancels it (the cancellation rule `resolvePublicationsForSource` already applies). The matching helper SHALL live in `apps/chat-api/src/publish/publication.util.ts` as `publishesCopy(publications, copyUrl)`.

Ownership SHALL NOT be inferred from `displayAuthor`, `author`, or any other name field: `displayAuthor` is free text the publisher chooses (see `catalog-publish-api`). Group/team ownership is not modelled — DIAL Core records one publishing bucket per publication.

The decision SHALL be cached under `unpublish-access:{bucket}:{entityType}:{entityId}` for 60 seconds (only the publisher check is cached; the admin and own-resource checks are cheap and always evaluated). There is no event-driven invalidation: an approval that changes ownership happens in DIAL Core's Admin Panel, which `chat-api` is not told about, so the TTL bounds staleness. The key carries the bucket, so one caller's answer is never served to another.

Failure is closed: when the publication list cannot be read (Core error, network error), the check SHALL throw the mapped exception (`mapDialHttpStatus` / `BadGatewayException`) rather than answer `true` or `false`, and no cache entry is written. An individual publication that cannot be re-read is dropped, as publish history already does; if that leaves no match the answer is `false`.

#### Scenario: Administrator may unpublish any copy
- **GIVEN** the session's roles claim contains one of the provider's `adminRoles`
- **WHEN** access is checked for any public copy
- **THEN** the answer is `true` and no `getPublications` call is made

#### Scenario: Publisher may unpublish their own public copy
- **GIVEN** the caller's bucket holds an `APPROVED` publication whose `ADD` resource has `targetUrl: "applications/public/Org/my-app__1.0.0"`
- **WHEN** access is checked for `entityId: "applications/public/Org/my-app__1.0.0"`
- **THEN** the answer is `true`

#### Scenario: Another user's public copy is refused
- **GIVEN** the caller is not an administrator and none of their publications targets the copy
- **WHEN** access is checked for a public copy someone else published
- **THEN** the answer is `false`

#### Scenario: Percent-encoding does not defeat the match
- **GIVEN** the `ADD` resource's `targetUrl` is `applications/public/New%20Folder/my-app__1.0.0`
- **WHEN** access is checked for `applications/public/New Folder/my-app__1.0.0`
- **THEN** the answer is `true`

#### Scenario: An approved removal ends ownership of that copy
- **GIVEN** the caller's `ADD` of the copy is followed by an `APPROVED` `DELETE` of the same folder and `targetUrl`, with no later `ADD`
- **WHEN** access is checked for that copy
- **THEN** the answer is `false`

#### Scenario: A pending publish confers no ownership
- **GIVEN** the caller's only publication targeting the copy is `PENDING`
- **WHEN** access is checked
- **THEN** the answer is `false`

#### Scenario: Own-bucket entity needs no lookup
- **WHEN** access is checked for `toolsets/{caller-bucket}/tool-abc__1.0.0`
- **THEN** the answer is `true` and no `getPublications` call is made

#### Scenario: Display author is ignored
- **GIVEN** a publication of the copy from another bucket whose `displayAuthor` equals the caller's display name
- **WHEN** access is checked
- **THEN** the answer is `false`

#### Scenario: The publication list cannot be read
- **WHEN** `getPublications` fails with a 5xx
- **THEN** the check throws `BadGatewayException`, nothing is cached, and no `createPublication` call follows

#### Scenario: The answer is cached per caller
- **WHEN** the same caller checks the same entity twice within 60 seconds
- **THEN** `getPublications` is called once
- **WHEN** a different caller checks the same entity
- **THEN** their own lookup runs

#### Scenario: auth/me and the unpublish check agree on admin status
- **WHEN** a session is evaluated by `GET /api/v1/auth/me` and by the unpublish check
- **THEN** both read `AdminRoleService.isAdmin` and return the same administrator answer

### Requirement: Catalog unpublish access endpoint reports whether the caller may unpublish

The backend SHALL expose `GET /api/v1/catalog/{entityType}/{entityId}/unpublish-access` on `PublishController`, returning the result of `PublishService.canUnpublish` for the session user. Path params reuse `CatalogEntityParamsDto` unchanged. The endpoint makes no write and creates no publication.

Request:
```
GET /api/v1/catalog/application/applications%2Fpublic%2FOrg%2Fmy-app__1.0.0/unpublish-access
```

Response (200):
```json
{ "canUnpublish": true }
```

| Status | When |
|---|---|
| 200 | Always when the check completes — `canUnpublish: false` is a successful answer, not a 403 |
| 400 | Invalid `entityType` / `entityId` (`CatalogEntityParamsDto`) |
| 401 | No valid session (session guard) |
| 502 | Core returned an error for the publication list, or was unreachable |
| 503 | The session bucket could not be resolved because DIAL Core is unavailable (session authentication) |

Generated-client impact: OpenAPI `operationId: getCatalogUnpublishAccess`; no request body; response DTO `UnpublishAccessDto` (`apps/chat-api/src/publish/dto/unpublish-access.dto.ts`, a class with `@ApiProperty() canUnpublish: boolean`). The controller documents every status above with `@ApiResponse`. Frontend callers use the normal (non-`Raw`) generated method through a `getCatalogUnpublishAccess(entityType, entityId)` wrapper added to `createPublishApiClient` in `libs/chat-hooks/src/catalog/create-publish-api.ts` and re-exported from `apps/chat/src/server-api/publish.api.ts`.

#### Scenario: Owner asks
- **WHEN** the publisher of a public copy calls the endpoint
- **THEN** it returns 200 `{ "canUnpublish": true }`

#### Scenario: Unrelated user asks
- **WHEN** a non-admin who did not publish the copy calls the endpoint
- **THEN** it returns 200 `{ "canUnpublish": false }`

#### Scenario: Unknown entity type
- **WHEN** `entityType` is not a `CatalogEntityType` member
- **THEN** it returns 400 and no Core call is made

## MODIFIED Requirements

### Requirement: Unpublish authorization and error mapping match publish

The caller SHALL be authenticated by the existing session guard. In addition, before any DIAL Core write, the service SHALL evaluate `PublishService.canUnpublish` (see "Unpublish access is limited to administrators and the copy's publisher") and, when it answers `false`, SHALL throw `ForbiddenException` with the generic message `You can only unpublish resources you published` and SHALL NOT call `createPublication`. The rejection is logged at `warn` naming the entity type and id only — no token, no request body, no claims.

This is a local check of *who may ask*, not a replacement for DIAL Core's own enforcement: Core still applies its folder write-access rules when `createPublication` runs, and an approved request still requires an administrator in the Admin Panel. When the access check itself cannot complete (the publication list is unreadable), its mapped exception (`BadGatewayException` for a Core 5xx or a thrown SDK/network error) propagates and no publication is created.

Core failures of the `createPublication` call SHALL be mapped through the same helpers publish uses — `mapDialHttpStatus` with `extractDialErrorMessage(result.error)` whenever the response is not ok or carries `result.error`, so the client sees Core's own reason for statuses whose upstream text may be exposed (401/403/404 deliberately carry a generic message instead); a thrown SDK/network error SHALL be logged (stack only, never the request body) and surfaced as `BadGatewayException`.

| Outcome | Thrown exception |
|---|---|
| Caller is neither administrator nor publisher (local check) | `ForbiddenException` (`You can only unpublish resources you published`) |
| Access check cannot read the caller's publications | per `mapDialHttpStatus`, or `BadGatewayException` when thrown |
| Core 403 (no write access to the target folder) | `ForbiddenException` (generic message) |
| Core 404 (unknown entity or target) | `NotFoundException` (`Resource not found`) |
| other Core 4xx with a mapped status (400, 409, 413, 429, …) | per `mapDialHttpStatus`, carrying Core's message |
| Core 5xx | `BadGatewayException`, carrying Core's message |
| thrown SDK/network error (including unreachable / timeout) | `BadGatewayException` |

The controller's 403 `@ApiResponse` description SHALL read `Caller is neither an administrator nor the publisher of this copy, or lacks write access to the target folder`.

#### Scenario: Unauthenticated caller
- **WHEN** a request arrives without a valid session cookie
- **THEN** the session guard rejects it with 401 and no Core call is made

#### Scenario: Non-owner, non-admin is rejected before Core
- **GIVEN** the caller is not an administrator, the entity is not in their bucket, and none of their publications targets it
- **WHEN** they `POST` an unpublish request for it
- **THEN** the endpoint returns 403 with `You can only unpublish resources you published` and `createPublication` is never called

#### Scenario: Owner request reaches Core
- **GIVEN** the caller published the public copy
- **WHEN** they `POST` an unpublish request for it
- **THEN** `createPublication` is called with one `DELETE` resource and the endpoint returns 200

#### Scenario: Administrator request reaches Core
- **GIVEN** the caller is an administrator who did not publish the copy
- **WHEN** they `POST` an unpublish request for it
- **THEN** `createPublication` is called and the endpoint returns 200

#### Scenario: Caller lacks write access to the folder
- **GIVEN** the caller passes the local access check
- **WHEN** Core returns 403 for the `createPublication` call
- **THEN** the service throws `ForbiddenException` with its generic message, not Core's upstream text

#### Scenario: Core returns a structured error
- **WHEN** `createPublication` resolves with `result.error`
- **THEN** `mapDialHttpStatus` is called with `result.error` and `extractDialErrorMessage(result.error)`, so the thrown exception's message is Core's reason rather than a placeholder

#### Scenario: Failure logging omits the request body
- **WHEN** the Core call throws
- **THEN** the logged message names the entity and the error stack, and contains no access token and no request body

#### Scenario: A rejected request leaves the history cache intact
- **WHEN** the local access check rejects the request
- **THEN** `publish-history:{entityType}:{entityId}` is not deleted

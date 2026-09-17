## ADDED Requirements

### Requirement: Get one skill's own metadata

The system SHALL expose authenticated `GET /api/v1/skills/metadata` accepting
`bucket` (required) and `path` (required) query parameters, validate both,
resolve the single skill resource through DIAL Core `listSkillMetadata`
(`GET /v2/metadata/skills/{bucket}/{path}`) under the caller's own session, and
return `200 OK` with one `SkillMetadataItemDto`.

This endpoint exists because `GET /api/v1/skills` structurally cannot serve it.
`SkillsListingService.listSkills` maps its upstream response through
`mapListing`, which reads `data.items ?? []`; when `path` addresses a skill item
DIAL Core returns that item's own metadata rather than a container with `items`,
so `SkillListResponseDto` answers `items: []` and the requested resource's own
`author` and `updatedAt` never appear in the response — even though the
underlying Core operation returns them (as `SkillsLookupService.resolveSkillItem`
demonstrates on the invitation path).

- **operationId**: `getSkillMetadata`.
- **Request DTO**: the existing `SkillResourceQueryDto`
  (`bucket`: `BUCKET_NAME_PATTERN`, `MaxLength(256)`; `path`:
  `@IsValidFilePath()`, `MaxLength(1024)`). No request body.
- **Response DTO**: `SkillMetadataItemDto`.
- **Rate limiting**: none. `apps/chat-api` declares no `ThrottlerModule` and no
  existing skills endpoint carries `@Throttle`; this endpoint matches its
  siblings. Introducing rate limiting for the skills domain is a separate change.
- **Caching**: none. The response is not cached — no cache key, TTL, or
  invalidation event is introduced, and no per-skill result is memoized
  server-side.
- **Observability**: none beyond the existing `MetricsInterceptor` and the
  service `Logger` already applied to every skills route.
- **Feature gating**: none of its own. It is reachable only from the skill
  details surfaces, which are already gated by the existing Skills feature flag;
  the endpoint itself adds no `ENABLED_FEATURES` key.

The resolution SHALL live on `SkillsListingService` (bound through the
`SkillsService` facade), which already owns every `listSkillMetadata` call, and
SHALL reuse `parseSkillResourceUrl`-equivalent identity handling,
`encodeDialResourcePath` for the path, and `mapToSkillMetadataItem` for
normalization. `SkillsLookupService` SHALL NOT be reused or bound on the facade
for this endpoint: its `resolveSkillItem` folds invitation-granted permissions
into `canEdit`, which is correct for `ShareService.acceptInvitation` and wrong
for a provenance read.

The response SHALL carry provenance and identity only: `name`, `path`, `url`,
`bucket`, `nodeType`, `parentPath`, `permissions` (the resource's own, as Core
reports them), `etag`, `author`, `createdAt`, `updatedAt`, and `description`.
It SHALL omit `isMy`, `canEdit`, and `sharedWithMe` entirely, so fetching
provenance can never grant ownership or editing rights and no invitation-derived
permission can reach it. Ownership and editability remain owned by
`GET /api/v1/skills/catalog`.

The endpoint SHALL resolve against the `bucket` given in the request, never the
caller's session bucket, so a skill owned by another user resolves against the
owner's bucket. DIAL Core enforces access with the caller's own access token.

Status mapping:

- `400` — invalid `bucket` or `path` per DTO validation, or the resolved
  metadata is a `nodeType: folder`. A grouping folder has no skill provenance,
  and returning its fields would render folder metadata as a skill's, so this
  mirrors `downloadSkill`'s existing grouping-folder rule.
- `401` — no valid session cookie, before any upstream call.
- `403` — DIAL Core denies the caller access to the resource.
- `404` — DIAL Core returns 404, or the upstream metadata cannot be normalized
  by `mapToSkillMetadataItem` (missing `bucket`, `name`, or a recognizable
  `nodeType`). Unlike `resolveSkillItem`, which returns `null` so the invitation
  flow can degrade, this endpoint SHALL raise `NotFoundException`.
- `502` / `503` — upstream error response / unavailable or timed out, through
  the existing `handleDialSdkError` mapper.

**Generated-client impact**: the endpoint SHALL appear in
`libs/chat-api-client/openapi.json` with full `@ApiOperation` / `@ApiResponse`
typing (`npm run openapi`, verified by `npm run openapi:check`). Frontend callers
SHALL use the **normal** (non-`Raw`) generated `skillsApi.getSkillMetadata`
method — the response is JSON with no stream or header semantics to preserve —
through the existing singleton in `apps/chat/src/server-api/api-client.ts`, with
a thin wrapper in `apps/chat/src/server-api/skills.api.ts`. No `base.ts` helper
and no direct `fetch` is introduced.

Example request:

```http
GET /api/v1/skills/metadata?bucket=owner-bucket&path=team-a%2Fdocs-helper
Cookie: <session>
```

Example response:

```json
{
  "name": "docs-helper",
  "path": "team-a/docs-helper",
  "url": "skills/owner-bucket/team-a/docs-helper",
  "bucket": "owner-bucket",
  "nodeType": "item",
  "parentPath": "team-a/",
  "permissions": ["READ"],
  "etag": "\"a1b2c3\"",
  "author": "jane.doe@example.com",
  "createdAt": 1749000000000,
  "updatedAt": 1752100000000,
  "description": "Explains our docs"
}
```

#### Scenario: Metadata for a skill in the caller's own bucket

- **WHEN** an authenticated caller requests
  `GET /api/v1/skills/metadata?bucket=my-bucket&path=docs-helper`
- **THEN** the system calls DIAL Core `listSkillMetadata` with the encoded path
  and returns `200 OK` with that skill's `author`, `updatedAt`, `createdAt`,
  `etag`, and `permissions`

#### Scenario: Metadata for a skill owned by another user

- **WHEN** the caller requests
  `bucket=owner-bucket&path=team-a/docs-helper` for a skill shared with them
- **THEN** the lookup is issued against `owner-bucket`, not the caller's session
  bucket, and the response's `url` is `skills/owner-bucket/team-a/docs-helper`

#### Scenario: Nested and encoded paths round-trip

- **WHEN** the requested `path` contains nested segments or characters requiring
  percent-encoding
- **THEN** the path is encoded with `encodeDialResourcePath` before the SDK call
  and the returned `path`/`url` describe the same resource that was requested

#### Scenario: Ownership fields are never returned

- **WHEN** any caller receives a `200 OK` from this endpoint
- **THEN** the payload contains no `isMy`, `canEdit`, or `sharedWithMe` field,
  regardless of who owns the skill or what permissions they hold

#### Scenario: Read-only shared skill stays read-only

- **WHEN** a caller with `READ` only fetches metadata for a skill shared with
  them
- **THEN** the response's `permissions` array reflects `READ` only and no
  WRITE-implying field is present, so calling this endpoint cannot make the
  skill appear editable

#### Scenario: Grouping folder path rejected

- **WHEN** the requested `path` resolves to a `nodeType: FOLDER` upstream
- **THEN** the system returns `400 Bad Request` rather than folder metadata

#### Scenario: Unknown skill

- **WHEN** DIAL Core returns `404` for the requested bucket/path
- **THEN** the system returns `404 Not Found`

#### Scenario: Unnormalizable upstream metadata

- **WHEN** DIAL Core returns metadata with no recognizable `nodeType`, or with
  no `bucket` or `name`
- **THEN** the system returns `404 Not Found` rather than a partially populated
  `200`

#### Scenario: Invalid path rejected before any upstream call

- **WHEN** `path` fails `IsValidFilePath` validation, or `bucket` fails the
  bucket-name pattern
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Unauthenticated request

- **WHEN** the request carries no valid session cookie
- **THEN** the system returns `401 Unauthorized` before calling DIAL Core

#### Scenario: Access denied upstream

- **WHEN** DIAL Core rejects the caller's token for the resource
- **THEN** the system returns `403 Forbidden`

#### Scenario: Upstream failure maps to a typed status

- **WHEN** DIAL Core returns a `5xx`, or the call times out
- **THEN** `handleDialSdkError` maps it to `502 Bad Gateway` or
  `503 Service Unavailable` and the upstream body is not leaked

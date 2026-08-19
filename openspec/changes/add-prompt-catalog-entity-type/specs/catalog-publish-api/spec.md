## MODIFIED Requirements

### Requirement: Publish endpoint proxies DIAL Core's Publication API

The backend SHALL expose authenticated `POST /api/v1/catalog/{entityType}/{entityId}/publish` through the existing `apps/chat-api/src/publish/` domain. The controller remains thin and delegates to `PublishService`, which calls `DialClientService.client.createPublication` and stores no publish records locally. DIAL Core remains the authorization and persistence authority.

`entityType` SHALL accept `model | toolset | application | prompt | skill`. `entityId` SHALL be the entity's DIAL Core resource path; Prompt remains the existing bucket-relative exception that `PublishService` qualifies against the caller's bucket. A Skill SHALL use its whole `skills/{bucket}/{path}` resource URL, never an individual file URL.

`PublishCatalogEntityDto` SHALL contain:

- required `folderPath: string`, validated with `IsValidFilePath`;
- optional `version?: string`, validated with `@IsOptional()` and `@IsString()`;
- optional validated `rules?: PublishRuleDto[]` under the existing maximum and nested-validation constraints.

Existing callers MAY continue sending `version`. When it is absent or empty, `PublishService` SHALL recover it from a versioned `{name}__{version}` resource id. An unversioned Prompt or Skill SHALL use an empty string in `PublishResultDto.version`, and the Core publication title SHALL contain only the decoded resource name without a synthetic version or trailing space.

Example unversioned skill request:

```http
POST /api/v1/catalog/skill/skills%2Fbucket-123%2Fteam-a%2Fdocs-helper/publish
Content-Type: application/json

{
  "folderPath": "Organization/Data Science",
  "rules": []
}
```

The Core call SHALL use `targetFolder: public/Organization/Data%20Science/`, `sourceUrl: skills/bucket-123/team-a/docs-helper`, and `targetUrl: skills/public/Organization/Data%20Science/docs-helper`. Folder segments SHALL remain encoded through `encodeDialResourcePath`; publishing to the public root SHALL continue to use `public/`.

A successful request SHALL return 201 with the existing `PublishResultDto` shape. For the request above it includes:

```json
{
  "entityId": "skills/bucket-123/team-a/docs-helper",
  "entityType": "skill",
  "folderPath": "Organization/Data Science",
  "version": "",
  "publishedAt": "2026-07-13T10:00:00.000Z",
  "publishedBy": "user@example.com"
}
```

The endpoint SHALL return 400 for invalid path/body input, 401 for an unauthenticated caller, 403 when Core denies target-folder write access, 429 after the 10 requests/minute write throttle, 502 for an upstream non-OK response, and 503 when Core is unavailable. Structured Core errors SHALL continue through `mapDialHttpStatus` with the upstream message. A successful publish SHALL invalidate `publish-history:{entityType}:{entityId}`.

OpenAPI operation `publishCatalogEntity` SHALL expose `PublishCatalogEntityDto.version?: string` and the unchanged `PublishResultDto`; frontend callers SHALL use the normal generated method through `apps/chat/src/server-api/publish.api.ts`.

#### Scenario: Owned skill is published without version

- **WHEN** an authenticated user with target-folder write access publishes `skills/{bucket}/{path}` without `version`
- **THEN** the BFF calls Core for the whole skill resource, returns 201, and reports `version: ""`

#### Scenario: Versioned entity remains backward compatible

- **WHEN** an existing client publishes an application or toolset with `version: "1.2.0"`
- **THEN** the request succeeds unchanged and the response retains `version: "1.2.0"`

#### Scenario: Version is recovered when omitted

- **WHEN** a versioned `{name}__{version}` resource is published without the optional field
- **THEN** the BFF derives the publication title and response version from `entityId`

#### Scenario: Invalid request is rejected before Core

- **WHEN** `entityType`, `entityId`, `folderPath`, `version`, or `rules` fails DTO validation
- **THEN** the request returns 400 without calling Core

#### Scenario: Core rejects publication

- **WHEN** Core denies access or returns a structured upstream failure
- **THEN** the BFF maps it to the documented 403/502/503 response without logging tokens or request bodies

### Requirement: Skill publication uses the whole-skill resource URL; no version recovery is required

Skill publication SHALL always target the whole skill (`skills/{bucket}/{path}`), and SHALL NOT invent or require a skill version. The resource does not follow the application/toolset `{name}__{version}` convention, so an omitted publish-request version and every skill publish-history entry SHALL use an empty string.

An older caller MAY still supply a version; the immediate `PublishResultDto` SHALL echo that value for backward compatibility, while publish history remains empty-versioned because DIAL Core metadata has no durable skill version field.

The app adapter SHALL omit `version` when `CatalogItem.version` is empty and expose the existing Publish control only for an owned personal skill. Shared-with-me and public skills SHALL not expose Publish even when metadata reports write permission. The surface remains gated by `OverlayFeature.Skills`. No new labels, layout, directional icon, focus behavior, telemetry, or hand-authored library API are introduced; the existing Publish button and panel retain their keyboard, mobile, and RTL behavior.

#### Scenario: Personal skill exposes Publish

- **WHEN** an owned personal skill is opened in the catalog details panel
- **THEN** Publish is available and submission omits the empty version field

#### Scenario: Shared and public skills cannot start publication

- **WHEN** a skill is shared-with-me or public
- **THEN** the catalog does not render its Publish action even if metadata reports write permission or ownership

#### Scenario: Skill history remains unversioned

- **WHEN** publish history is requested for a skill id without a `__{version}` suffix
- **THEN** every `PublishHistoryEntryDto.version` is an empty string

## RENAMED Requirements

FROM: ### Requirement: Skill publication uses the whole-skill resource URL; version recovery is an open question
TO: ### Requirement: Skill publication uses the whole-skill resource URL; no version recovery is required

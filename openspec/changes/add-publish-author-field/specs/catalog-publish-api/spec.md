## MODIFIED Requirements

### Requirement: Publish endpoint proxies DIAL Core's Publication API

The backend SHALL expose authenticated `POST /api/v1/catalog/{entityType}/{entityId}/publish` through the existing `apps/chat-api/src/publish/` domain. The controller remains thin and delegates to `PublishService`, which calls `DialClientService.client.createPublication` and stores no publish records locally. DIAL Core remains the authorization and persistence authority.

`entityType` SHALL accept `model | toolset | application | prompt | skill`. `entityId` SHALL be the entity's full DIAL Core resource path. A Prompt SHALL use its whole `prompts/{bucket}/{path}` resource URL, exactly like a Skill uses its whole `skills/{bucket}/{path}` resource URL — neither requires bucket qualification by `PublishService`, since `PromptResponseDto.id` (see `prompts-api`) is already the full path. Neither Skill nor Prompt SHALL ever use an individual file URL.

`PublishCatalogEntityDto` SHALL contain:

- required `folderPath: string`, validated with `IsValidFilePath`;
- optional `version?: string`, validated with `@IsOptional()` and `@IsString()`;
- optional `author?: string`, validated with `@IsOptional()`, `@IsString()`, `@MaxLength(200)`, and `@Matches(/^[^\p{Cc}]*$/u)`;
- optional validated `rules?: PublishRuleDto[]` under the existing maximum and nested-validation constraints.

Existing callers MAY continue sending `version`. When it is absent or empty, `PublishService` SHALL recover it from a versioned `{name}__{version}` resource id. An unversioned Prompt or Skill SHALL use an empty string in `PublishResultDto.version`, and the Core publication title SHALL contain only the decoded resource name without a synthetic version or trailing space.

`author` SHALL be the display author recorded on the publication. `PublishController.publish` SHALL resolve the effective value as `author?.trim() || getUserDisplayName(claims)` and pass that single string to `PublishService.publish`, whose signature and its `displayAuthor: author` line on the `createPublication` body SHALL remain unchanged. A request that omits `author`, or sends it blank or whitespace-only, SHALL therefore behave exactly as it did before this change.

`author` SHALL NOT affect authorization or the recorded actor. DIAL Core continues to derive the publication's `author` from the caller's bearer token and to enforce target-folder write access against it; `displayAuthor` is presentation only. `PublishResultDto.publishedBy` SHALL continue to prefer `publication.author` over `publication.displayAuthor`, so the response and publish history keep reporting the real publisher even when a different display author was submitted.

Example versioned toolset request with a custom author:

```http
POST /api/v1/catalog/toolset/toolsets%2Fbucket-123%2Fteam-a%2Fjira__1.2.0/publish
Content-Type: application/json

{
  "folderPath": "Organization/Data Science",
  "version": "1.2.0",
  "author": "DIAL Team",
  "rules": []
}
```

The Core call for that request SHALL carry `displayAuthor: "DIAL Team"`.

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

OpenAPI operation `publishCatalogEntity` SHALL expose `PublishCatalogEntityDto.version?: string` and `PublishCatalogEntityDto.author?: string` alongside the unchanged `PublishResultDto`; frontend callers SHALL use the normal generated method through `apps/chat/src/server-api/publish.api.ts`. Because `author` is optional, the regenerated client SHALL stay source-compatible with request literals that omit it.

#### Scenario: Owned skill is published without version

- **WHEN** an authenticated user with target-folder write access publishes `skills/{bucket}/{path}` without `version`
- **THEN** the BFF calls Core for the whole skill resource, returns 201, and reports `version: ""`

#### Scenario: Owned prompt is published using its own full resource id

- **WHEN** an authenticated user with target-folder write access publishes their own prompt using its `entityId: 'prompts/{bucket}/{path}'`
- **THEN** the BFF calls Core with that `sourceUrl` unmodified — no bucket qualification step runs — returns 201, and reports `version: ""`

#### Scenario: Versioned entity remains backward compatible

- **WHEN** an existing client publishes an application or toolset with `version: "1.2.0"`
- **THEN** the request succeeds unchanged and the response retains `version: "1.2.0"`

#### Scenario: Version is recovered when omitted

- **WHEN** a versioned `{name}__{version}` resource is published without the optional field
- **THEN** the BFF derives the publication title and response version from `entityId`

#### Scenario: Custom author is forwarded to Core as displayAuthor

- **WHEN** an authenticated user publishes with `author: "DIAL Team"`
- **THEN** the `createPublication` body sent to Core carries `displayAuthor: "DIAL Team"` instead of the session-derived display name

#### Scenario: Author is trimmed before it reaches Core

- **WHEN** a request sends `author: "  DIAL Team  "`
- **THEN** the `createPublication` body carries `displayAuthor: "DIAL Team"`

#### Scenario: Omitted author falls back to the session display name

- **WHEN** a request body has no `author` field at all (an older client, or a client not using the new UI)
- **THEN** the controller passes `getUserDisplayName(claims)` to the service and Core receives exactly the `displayAuthor` it received before this change

#### Scenario: Blank author falls back to the session display name

- **WHEN** a request sends `author: "   "`
- **THEN** the trimmed value is empty, the controller falls back to `getUserDisplayName(claims)`, and Core never receives an empty `displayAuthor`

#### Scenario: Custom author does not change the recorded publisher

- **WHEN** a user publishes with an `author` different from their own display name and the publication is read back
- **THEN** `PublishResultDto.publishedBy` reports Core's own `publication.author` (the authenticated identity), not the submitted display author

#### Scenario: Over-long author is rejected before Core

- **WHEN** `author` exceeds 200 characters
- **THEN** the `ValidationPipe` returns 400 without calling Core

#### Scenario: Author containing control characters is rejected before Core

- **WHEN** `author` contains a control character such as a newline or a NUL byte
- **THEN** the `ValidationPipe` returns 400 without calling Core

#### Scenario: Invalid request is rejected before Core

- **WHEN** `entityType`, `entityId`, `folderPath`, `version`, `author`, or `rules` fails DTO validation
- **THEN** the request returns 400 without calling Core

#### Scenario: Core rejects publication

- **WHEN** Core denies access or returns a structured upstream failure
- **THEN** the BFF maps it to the documented 403/502/503 response without logging tokens or request bodies

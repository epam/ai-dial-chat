# catalog-publish-api Specification

## Purpose
Lets a user with write access to a target folder publish a catalog entity (model, toolset, or application) to the shared public catalog, and retrieve that entity's publish history, via BFF endpoints that proxy DIAL Core's Publication API. `chat-api` holds no durable publish state of its own — DIAL Core's Publication API is the sole source of truth.
## Requirements

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

---

### Requirement: Publish request accepts optional, validated access rules
`PublishCatalogEntityDto` SHALL gain an optional `rules?: PublishRuleDto[]` field (`@IsOptional`, `@IsArray`, `@ArrayMaxSize(20)`, `@ValidateNested({ each: true })`, `@Type(() => PublishRuleDto)`). `PublishRuleDto` (new, `apps/chat-api/src/publish/dto/publish-rule.dto.ts`) SHALL validate:
- `source: string` — `@IsString`, `@IsNotEmpty`, `@MaxLength(200)`.
- `function: PublishRuleFunction` — `@IsEnum(PublishRuleFunction)`, where `PublishRuleFunction` has exactly the members `Equal = 'EQUAL'`, `Contain = 'CONTAIN'`, `Regex = 'REGEX'`.
- `targets: string[]` — `@IsArray`, `@ArrayMinSize(1)`, `@ArrayMaxSize(20)`, `@IsString({ each: true })`, `@IsNotEmpty({ each: true })`, `@MaxLength(200, { each: true })`.

`source` values SHALL NOT be validated against `publish.publicationFilterSources` (or any other allowlist) at the DTO layer — DIAL Core's own `Rule.source` field is untyped `string`, and Core treats an unrecognized source as "never matches" rather than a validation error; enforcing an allowlist here would require the DTO layer to read live, operator-configurable config-registry state, which is a layering violation for a pure request-shape validator. The frontend still only ever offers the configured sources in its selector, so an out-of-allowlist `source` reaching this endpoint can only come from a deliberately hand-crafted request, which Core already neutralizes harmlessly.

`function: REGEX` rules are not required to have `targets.length === 1` at the DTO layer (the same `@ArrayMaxSize(20)` applies uniformly); the UI enforces "exactly one pattern for REGEX" before submission, and a non-UI client sending more than one target under `REGEX` is harmless (Core would only ever evaluate meaningfully against the rule as DIAL Core's own semantics define, and is not a security concern this backend needs to additionally police).

`publish.service.ts`'s `requestBody` SHALL replace the hardcoded `rules: []` (previously at `publish.service.ts:99`) with `rules: dto.rules ?? []`, passed through unchanged to `createPublication`.

#### Scenario: Valid EQUAL rule is accepted
- **WHEN** a publish request includes `rules: [{ source: 'title', function: 'EQUAL', targets: ['Internal Tools'] }]`
- **THEN** the request passes validation and Core receives that exact rule object

#### Scenario: Valid multi-target CONTAIN rule is accepted
- **WHEN** a publish request includes `rules: [{ source: 'roles', function: 'CONTAIN', targets: ['engineering', 'support'] }]`
- **THEN** the request passes validation and Core receives that exact rule object

#### Scenario: Valid REGEX rule with one target is accepted
- **WHEN** a publish request includes `rules: [{ source: 'dial_roles', function: 'REGEX', targets: ['^eng-.*$'] }]`
- **THEN** the request passes validation and Core receives that exact rule object

#### Scenario: Missing rules field defaults to an empty array
- **WHEN** a publish request omits `rules` entirely
- **THEN** validation passes and `dto.rules` resolves to `undefined`, and `publish.service.ts` sends Core `rules: []`

#### Scenario: Empty rules array is accepted
- **WHEN** a publish request includes `rules: []`
- **THEN** validation passes and Core receives `rules: []`

#### Scenario: Invalid function enum value is rejected with 400
- **WHEN** a publish request includes a rule with `function: 'MATCHES'` (not a member of `PublishRuleFunction`)
- **THEN** the `ValidationPipe` rejects the request with 400 before it reaches the service or Core

#### Scenario: Empty source string is rejected with 400
- **WHEN** a publish request includes a rule with `source: ''`
- **THEN** the `ValidationPipe` rejects the request with 400

#### Scenario: Empty targets array is rejected with 400
- **WHEN** a publish request includes a rule with `targets: []`
- **THEN** the `ValidationPipe` rejects the request with 400 (`@ArrayMinSize(1)`)

#### Scenario: A target that is an empty string is rejected with 400
- **WHEN** a publish request includes a rule with `targets: ['engineering', '']`
- **THEN** the `ValidationPipe` rejects the request with 400 (`@IsNotEmpty({ each: true })`)

#### Scenario: More than 20 rules is rejected with 400
- **WHEN** a publish request includes 21 rule objects
- **THEN** the `ValidationPipe` rejects the request with 400 (`@ArrayMaxSize(20)` on `PublishCatalogEntityDto.rules`)

#### Scenario: More than 20 targets in one rule is rejected with 400
- **WHEN** a publish request includes a rule with 21 entries in `targets`
- **THEN** the `ValidationPipe` rejects the request with 400 (`@ArrayMaxSize(20)` on `PublishRuleDto.targets`)

#### Scenario: A source or target string longer than 200 characters is rejected with 400
- **WHEN** a publish request includes a rule with a `source` or a `targets` entry longer than 200 characters
- **THEN** the `ValidationPipe` rejects the request with 400 (`@MaxLength(200)`)

#### Scenario: Malformed nested rule object is rejected with 400
- **WHEN** a publish request includes `rules: [{ source: 123, function: 'CONTAIN', targets: 'engineering' }]` (wrong types, not arrays/strings as required)
- **THEN** the `ValidationPipe` rejects the request with 400, since `@ValidateNested` + `@Type(() => PublishRuleDto)` validates the nested object's own decorators

#### Scenario: An unrecognized source is accepted, not rejected
- **WHEN** a publish request includes a rule with `source: 'not_a_configured_source'` that is not present in `publish.publicationFilterSources`
- **THEN** the request still passes DTO validation and is forwarded to Core unchanged — the backend does not enforce source-allowlist membership

---

### Requirement: Publish history endpoint derives history from Core publications, not chat-api storage
The backend SHALL expose `GET /api/v1/catalog/{entityType}/{entityId}/publish-history` returning publish entries for the given entity **across every folder it has ever been published to** (folder-scoping happens client-side, in `PublishPanel`), most recent first. It SHALL call DIAL Core's `getPublications` with a `ResourceLink` body scoped to `entityId` itself (the entity's own resource url, not a folder), filtered to publications whose `resources[].sourceUrl` reference `entityId`, mapped to `PublishHistoryEntryDto[]`. Each entry's `folderPath` SHALL have Core's `public/` prefix and trailing slash stripped back off before being returned, so it matches the plain folder-path form the frontend sends when publishing and uses for `selectedFolderPath` comparisons. Each entry's `version` SHALL be recovered from `entityId`'s own `{name}__{version}` suffix (the same value for every entry in a single call, since `entityId` — and therefore its version — is fixed for the whole request), never from `Publication.name`.

Response (200):
```json
[
  {
    "entityId": "toolsets/bucket-123/tool-abc123__1.2.0",
    "entityType": "toolset",
    "folderPath": "Organization/Data Science/Published models",
    "version": "1.2.0",
    "publishedAt": "2026-07-13T10:00:00.000Z",
    "publishedBy": "user@example.com"
  }
]
```

Generated-client impact: OpenAPI `operationId: getCatalogPublishHistory`; response DTO `PublishHistoryEntryDto[]`. Frontend caller: `apps/chat/src/server-api/publish.api.ts`, normal generated method.

Caching: this endpoint MAY cache the mapped Core response with key `publish-history:{entityType}:{entityId}`, TTL 60 seconds, invalidated immediately on a successful publish for the same `entityType`/`entityId` (cache entry deleted synchronously after the publish endpoint commits). This caches a read of Core's own source of truth — it is a performance optimization, not a persistence layer, and losing the cache (e.g. on restart) SHALL NOT lose any data since Core remains authoritative.

**Known open issue (task 6.8 in `tasks.md`, unresolved)**: this requirement's `getPublications` call is scoped by `{ url: entityId }` (the entity's own resource url). DIAL Core's own OpenAPI spec defines `getPublications`'s `url` field as the list **scope** (`publications/{bucket}/` for a user's own submissions, `publications/public/` for admins), not a resource filter — so the current call likely does not match Core's contract and may return no results in practice, even though the publish endpoint itself works end-to-end. This has not yet been fixed or confirmed against a live Core instance; the scenarios below describing history retrieval should be treated as unverified until it is.

Rate limiting: default global throttle applies (read endpoint, no stricter override needed).

#### Scenario: History returned for entity with prior publishes
- **WHEN** a caller requests history for an entity that has been published before
- **THEN** the endpoint returns 200 with entries mapped from matching Core publications, ordered by `publishedAt` descending

#### Scenario: History returned for entity with no prior publishes
- **WHEN** a caller requests history for an entity that has never been published
- **THEN** the endpoint returns 200 with an empty array

#### Scenario: History folderPath strips the public-bucket prefix and trailing slash
- **WHEN** Core returns a publication with `targetFolder: "public/Organization/Data Science/"`
- **THEN** the mapped `PublishHistoryEntryDto.folderPath` is `"Organization/Data Science"` (or `""` when Core's `targetFolder` is the bare string `"public/"`)

#### Scenario: Cache invalidation on new publish
- **WHEN** a publish request for `{entityType}/{entityId}` succeeds
- **THEN** the next history request for the same `{entityType}/{entityId}` bypasses the stale cache entry and re-reads Core, reflecting the new entry

#### Scenario: Unknown entity
- **WHEN** `entityId` does not correspond to an existing catalog entity of `entityType`
- **THEN** the service throws `NotFoundException` (404)

#### Scenario: Upstream failure
- **WHEN** the Core `getPublications` call fails unexpectedly
- **THEN** the service throws `BadGatewayException` or `ServiceUnavailableException` (per `handleDialSdkError`)

#### Scenario: Core rejects the history request with a structured error
- **WHEN** `getPublications` resolves with a structured error response (`result.error`)
- **THEN** the service calls `mapDialHttpStatus` with `result.error` and `extractDialErrorMessage(result.error)`, so the thrown exception's `message` is Core's own reason instead of a generic placeholder

---

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

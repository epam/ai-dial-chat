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
The backend SHALL expose `GET /api/v1/catalog/{entityType}/{entityId}/publish-history` returning publish entries for the given entity **across every folder it has ever been published to** (folder-scoping happens client-side, in `PublishPanel`), most recent first. It SHALL call DIAL Core's `getPublications` with a `ResourceLink` body scoped to the caller's own-bucket publication list (`{ url: "publications/{bucket}/" }`, built by `getPublicationsListScope`), then narrow the response to publications whose `resources[].sourceUrl` reference the entity's own resource url, mapped to `PublishHistoryEntryDto[]`. Core exposes no per-resource publication filter, so a bucket-wide scan plus a local narrowing is the only available shape.

That narrowing SHALL NOT read `resources` off the list response. Core's `getPublications` returns publication **metadata only** — `url`, `status`, `targetFolder`, `createdAt`, `author` — with no `resources` array, so filtering the list on `resources[].sourceUrl` matches nothing: a live Core returned 60 publications and history still came back empty, hiding `Unpublish` on an entity that was demonstrably published. Each candidate SHALL therefore be re-read through Core's `getPublication` (`{ url: publication.url }`) and matched on that detailed record. Only publications whose `status` is `APPROVED` SHALL be candidates — a `PENDING` request has not created a published copy yet and a `REJECTED` one never will, so neither describes a folder the entity is published to, and skipping them keeps the number of detail lookups proportional to real publications. A publication that already carries `resources` SHALL be matched without a round trip. The lookups SHALL be batched rather than issued all at once, and a failed lookup SHALL drop that one publication rather than fail the request: history is informational, and one unreadable publication must not take down the publish panel for the whole entity.

The `getPublications` response SHALL be accepted both as the bare array the SDK types (`ListPublication = Publication[]`) and as the `{ publications: [...] }` envelope a live Core returns. Calling `.filter` straight on the envelope threw `TypeError: (result.data ?? []).filter is not a function`, which `handleDialFetchError` reported as "DIAL Core is currently unavailable" (503) — this, not a Core outage, is what [GH #7897](https://github.com/epam/ai-dial-chat/issues/7897) actually was, and what led to both frontend publish-history fetches being stubbed out. An unrecognised shape SHALL degrade to an empty list with a warning, never a throw.

Resource-url comparison SHALL tolerate a percent-encoding difference between the url Core echoes and the url the service built, so an encoded `sourceUrl` cannot silently produce an empty history for a working publication. `entityId` SHALL be resolved to that resource url through the same `toSourceUrl` helper the publish path uses, so a prompt's bucket-relative id (`Work/AI/summarize`) is qualified with the caller's bucket before it is compared. Each entry's `folderPath` SHALL have Core's `public/` prefix and trailing slash stripped back off before being returned, so it matches the plain folder-path form the frontend sends when publishing and uses for `selectedFolderPath` comparisons. Each entry's `version` SHALL be recovered from `entityId`'s own `{name}__{version}` suffix (the same value for every entry in a single call, since `entityId` — and therefore its version — is fixed for the whole request), never from `Publication.name`; an unversioned Prompt or Skill yields an empty version.

A publication whose matching resource carries `action: 'DELETE'` SHALL be excluded from the result. Such a publication is a pending removal request submitted by the unpublish endpoint (see `catalog-unpublish-api`), not a publication of the entity. Including it would list the same folder twice — once for the original `ADD`, once for the pending `DELETE` — and would read as a second publish to that folder. Until an administrator approves the removal the entity genuinely is still published there, so the folder SHALL continue to appear exactly once, sourced from its `ADD` publication.

This filter is what makes the endpoint safe to use as the visibility source for the Unpublish action (see `catalog-unpublish-flow`): the folder list it returns is the set of folders a published copy currently exists in.

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

Caching: this endpoint MAY cache the mapped Core response with key `publish-history:{entityType}:{entityId}`, TTL 60 seconds, invalidated immediately on a successful publish **or unpublish** for the same `entityType`/`entityId` (cache entry deleted synchronously after the endpoint commits). This caches a read of Core's own source of truth — it is a performance optimization, not a persistence layer, and losing the cache (e.g. on restart) SHALL NOT lose any data since Core remains authoritative.

This supersedes the requirement's earlier `{ url: entityId }` call shape, which was recorded here as an unresolved open issue (task 6.8 of the `add-catalog-publish` change): Core's OpenAPI spec defines `getPublications`'s `url` as the list **scope**, not a resource filter, and passing the resource's own url there was rejected with a 400. `PublishService.getPublishHistory` now passes the list scope and filters locally, and `getPublicationsListScope`'s own doc comment records the confirmation against Core's spec. That open issue is closed, and the history scenarios below are no longer to be read as unverified.

The endpoint is load-bearing beyond the publish panel: the Unpublish action's visibility derives from it, so an empty or failed result hides that action entirely (see `catalog-unpublish-flow`). Its frontend caller SHALL therefore actually issue the call rather than resolving to a frozen empty list — see `catalog-publish-flow`, which lifts that workaround.

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

#### Scenario: A pending removal does not duplicate or drop the folder
- **GIVEN** the entity has an approved `ADD` publication and a pending `DELETE` publication for the same folder
- **WHEN** history is requested
- **THEN** the folder appears exactly once, sourced from the `ADD` publication

#### Scenario: An entity whose only publication is a pending removal
- **GIVEN** the entity's only matching publication carries `action: 'DELETE'`
- **WHEN** history is requested
- **THEN** the endpoint returns an empty array

#### Scenario: The list response carries no resources
- **GIVEN** Core's `getPublications` returns publications with `url`, `status` and `targetFolder` but no `resources` array
- **WHEN** history is requested
- **THEN** each `APPROVED` publication is re-read through `getPublication` and the entity's own publications are returned, rather than an empty array

#### Scenario: Pending and rejected publications are never re-read
- **GIVEN** the bucket's publication list contains `PENDING` and `REJECTED` publications
- **WHEN** history is requested
- **THEN** no `getPublication` call is made for them and they contribute no entries

#### Scenario: One unreadable publication does not fail the request
- **GIVEN** one candidate's `getPublication` call fails while another succeeds and matches
- **WHEN** history is requested
- **THEN** the endpoint returns 200 with the matching entry and omits the unreadable publication

#### Scenario: Core returns the publication list as an envelope
- **GIVEN** Core answers `getPublications` with `{ "publications": [...] }` rather than a bare array
- **WHEN** history is requested
- **THEN** the endpoint reads the publications out of the envelope and returns 200, never a 503

#### Scenario: Cache invalidation on new publish
- **WHEN** a publish request for `{entityType}/{entityId}` succeeds
- **THEN** the next history request for the same `{entityType}/{entityId}` bypasses the stale cache entry and re-reads Core, reflecting the new entry

#### Scenario: Cache invalidation on unpublish
- **WHEN** an unpublish request for `{entityType}/{entityId}` succeeds
- **THEN** the next history request for the same pair bypasses the stale cache entry and re-reads Core

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

#### Scenario: Skill publish still records the caller-supplied version for the publish call itself

- **WHEN** a skill publish request supplies `version: "2.1.0"`
- **THEN** the immediate `PublishResultDto` response for that call echoes `version: "2.1.0"`, because the value comes from the request body rather than from `entityId` parsing

#### Scenario: Skill history remains unversioned

- **WHEN** publish history is requested for a skill id without a `__{version}` suffix
- **THEN** every `PublishHistoryEntryDto.version` is an empty string

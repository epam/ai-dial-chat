# catalog-publish-api Specification

## Purpose
Lets a user with write access to a target folder publish a catalog entity (model, toolset, or application) to the shared public catalog, and retrieve that entity's publish history, via BFF endpoints that proxy DIAL Core's Publication API. `chat-api` holds no durable publish state of its own — DIAL Core's Publication API is the sole source of truth.
## Requirements
### Requirement: Publish endpoint proxies DIAL Core's Publication API
The backend SHALL expose `POST /api/v1/catalog/{entityType}/{entityId}/publish` in a new `apps/chat-api/src/publish/` domain (`publish.controller.ts`, `publish.service.ts`, `publish.module.ts`, `dto/`), following `apps/chat-api/AGENTS.md` (thin controller, `@ApiTags`/`@ApiOperation`/`@ApiResponse` per status code, Logger + ConfigService in the service, validated DTOs).

`publish.service.ts` SHALL NOT persist publish records itself. `apps/chat-api` has no database/ORM dependency; the only durable source of truth for publish state is DIAL Core's Publication API, already typed in `@epam/ai-dial-typescript-sdk` (`createPublication`, `getPublications`, `getPublication`). The service SHALL call `DialClientService` (`apps/chat-api/src/dial/dial-client.service.ts`) the same way `ShareService` (`apps/chat-api/src/share/share.service.ts`) proxies DIAL Core's resource-sharing API — injecting `DialClientService` and calling `this.dialClient.client.createPublication({...})` directly, never persisting a copy of the result.

`entityId` is treated as the entity's DIAL Core resource path, the same assumption `ShareService.createShareLink`'s `itemId` already makes — only resource-backed, user-owned/editable entities (Toolset, Application, **and Skill**) are publishable, consistent with `isPublishVisible` in `catalog-publish-flow`.

`entityType` is a path param restricted to an allowlist enum, now `model | toolset | application | skill` (`CatalogEntityType`, `apps/chat-api/src/publish/dto/catalog-entity-params.dto.ts`, gains a `Skill = 'skill'` member). Unlike `toolset`/`application` entity ids, a `skill` `entityId` (`skills/{bucket}/{path}`, possibly nested under one or more grouping-folder segments) does **not** end in `{name}__{version}` — that convention comes from how `applications.service.ts`/`toolsets.service.ts` name resources at creation time, and skills carry no equivalent naming rule. See the "Skill publication uses the whole-skill resource URL; version recovery is an open question" requirement below for the resulting name/version-recovery gap this creates for skill publish-history, which this change does not resolve.

Request:
```
POST /api/v1/catalog/toolset/toolsets%2Fbucket-123%2Ftool-abc123__1.2.0/publish
Content-Type: application/json

{
  "folderPath": "Organization/Data Science/Published models",
  "version": "1.2.0",
  "rules": [
    {
      "source": "roles",
      "function": "CONTAIN",
      "targets": ["engineering", "support"]
    }
  ]
}
```
(`entityId` here is `toolsets/bucket-123/tool-abc123__1.2.0` — the entity's full DIAL Core resource path, URL-encoded as a single path segment by the generated client. Catalog entity IDs for `toolset`/`application` always end in `{name}__{version}`, e.g. `tool-abc123__1.2.0` — see `applications.service.ts`/`toolsets.service.ts`; `skill` entity ids do not. `rules` is optional; omitting it is equivalent to `rules: []`.)

Core call made by the service (via `DialClientService.client.createPublication`):
```json
{
  "name": "tool-abc123 1.2.0",
  "targetFolder": "public/Organization/Data Science/Published models/",
  "resources": [
    {
      "action": "ADD",
      "sourceUrl": "toolsets/bucket-123/tool-abc123__1.2.0",
      "targetUrl": "toolsets/public/Organization/Data Science/Published models/tool-abc123__1.2.0"
    }
  ],
  "displayAuthor": "Test User",
  "rules": [
    {
      "source": "roles",
      "function": "CONTAIN",
      "targets": ["engineering", "support"]
    }
  ]
}
```
This shape is confirmed against DIAL Core's own published OpenAPI spec (https://dialx.ai/dial_api#tag/Publications/operation/createPublication), whose documented example is `targetFolder: public/folder/` and `targetUrl: conversations/public/folder/conversation`. DIAL Core's Publication API has no opaque per-org bucket-id hash for the shared Organization/public area — it is addressed by the **literal path segment `public`**. `targetFolder` is `public/{folderPath}/` and **requires a trailing slash** (bare `public/` when `folderPath` is empty, i.e. publishing to the public root). `resources[].targetUrl` **is** a full destination file path: `{resourceTypePrefix}/{targetFolder}{resourceName}`, where `resourceTypePrefix` is `entityId`'s first path segment (e.g. `toolsets`, or `skills`) and `resourceName` is its **last** segment — never the full `entityId` nested wholesale, and never folder-shaped with a trailing slash. For a skill nested under one or more grouping folders, this means only the skill's own leaf name survives into `targetUrl`, not its grouping-folder subpath — see the open-question requirement below for the collision risk this creates. `folderPath`'s segments SHALL be percent-encoded (`encodeDialResourcePath`) before being interpolated into `targetFolder`/`targetUrl` — it arrives as plain, unencoded text from the request body, and Core rejects a raw space or other special character with `Bad resource url: public/{folderPath}/`. Core's `Publication`/`PublicationResource` schema has no version field: `name` is a free-text request title, built as `"{entity name} {version}"` (never the bare version alone, and never the author — `displayAuthor` carries that). For `toolset`/`application`, both the entity name and version are recovered from `entityId`'s own `{name}__{version}` suffix; for `skill`, there is no such suffix to recover a version from, so `entityName` resolves to the skill's bare leaf path segment and the caller-supplied `version` (already a required request field) is the only source of the version string used in the title. `displayAuthor` is the caller's human display name, resolved from the session's allowlisted OIDC claims (`getUserDisplayName`: `name` → `preferred_username` → email local-part → `'Unknown Author'`); `rules` is the caller-supplied, validated array of access-restriction rules (`dto.rules ?? []`), passed through to Core unchanged — the service does not interpret or re-map rule contents, only validates their shape (see the "Publish request accepts optional access rules" requirement below).

Response (201):
```json
{
  "entityId": "toolsets/bucket-123/tool-abc123__1.2.0",
  "entityType": "toolset",
  "folderPath": "Organization/Data Science/Published models",
  "version": "1.2.0",
  "publishedAt": "2026-07-13T10:00:00.000Z",
  "publishedBy": "user@example.com"
}
```
`folderPath` in the response is the plain path the caller sent (not Core's `public/`-qualified `targetFolder`); `publishedAt`/`publishedBy` are read back from the Core `Publication` response (`createdAt`/`author`), not generated or stored by `apps/chat-api`. The response SHALL NOT echo back `rules` — the caller already has the value it sent, and no other field in this response echoes request input either.

`entityId` and `folderPath` are validated with `class-validator` reusing the existing `IsValidFilePath` decorator (`apps/chat-api/src/files/dto/file-path.validator.ts`) to block path traversal (`..`, absolute-path escapes) before being forwarded to Core. `version` is required — Core has no way to derive it, so the caller (which already has `item.version`, or for a skill the version the caller itself displayed from wherever it sourced skill metadata) always supplies it. `rules` is optional and validated per the requirement below.

Generated-client impact: OpenAPI `operationId: publishCatalogEntity`; request DTO `PublishCatalogEntityDto` (unchanged shape — only `CatalogEntityParamsDto.entityType`'s enum widens); response DTO `PublishResultDto` (unchanged). Frontend caller uses the normal (non-`Raw`) generated method via the existing `apps/chat/src/server-api/publish.api.ts` thin wrapper.

Rate limiting: `@Throttle` at a stricter-than-default limit (write endpoint) — e.g. 10 requests/minute per user, matching `ShareController`'s write-endpoint throttle profile. Unchanged by this requirement.

Authorization: caller SHALL be authenticated (existing session guard). Write access to `folderPath` is enforced by DIAL Core itself when `createPublication` is called — the backend does not duplicate that check locally; a Core 403 SHALL map to `ForbiddenException` via `handleDialSdkError`/`mapDialHttpStatus`. This is unchanged by adding `rules` or the `skill` entity type: the backend does not validate `rules[].source` against any allowlist, since DIAL Core itself treats an unrecognized source as "never matches" rather than an error (see the requirement below for the full rationale).

(An in-memory-stub interim fallback was considered in case Core's Publication API wiring proved unavailable; Core integration succeeded directly, so no such stub was built and none exists in the shipped code.)

#### Scenario: Successful publish
- **WHEN** an authenticated user with write access to the target folder submits a valid publish request
- **THEN** the service calls Core's `createPublication`, returns 201 with `PublishResultDto`, and the entry becomes retrievable via the publish-history endpoint

#### Scenario: Publish targets the public bucket, not the entity's own source bucket
- **WHEN** `entityId` is `toolsets/{bucket}/{name}` and `folderPath` is `Organization/Data Science`
- **THEN** `targetFolder` sent to Core is `public/Organization/Data Science/` and `targetUrl` is `toolsets/public/Organization/Data Science/{name}` — qualified with the literal `public` segment and the resource's own type prefix and name, never the full `entityId`

#### Scenario: Publish to the public root with no subfolder
- **WHEN** `folderPath` is empty (publishing to the public/Organization root)
- **THEN** `targetFolder` sent to Core is `public/` and `targetUrl` is `{resourceTypePrefix}/public/{name}`

#### Scenario: Unknown entity
- **WHEN** `entityId` does not correspond to an existing catalog entity of `entityType`
- **THEN** Core returns 404 and the service throws `NotFoundException` (404) via `handleDialSdkError`

#### Scenario: No write access to target folder
- **WHEN** the caller lacks write access to `folderPath`
- **THEN** Core returns 403 and the service throws `ForbiddenException` (403) via `handleDialSdkError`

#### Scenario: Invalid folder path
- **WHEN** `folderPath` fails the `IsValidFilePath` validation (e.g. contains `..`)
- **THEN** the request is rejected at the `ValidationPipe` with 400 before reaching the service or Core

#### Scenario: Upstream failure
- **WHEN** the Core `createPublication` call fails unexpectedly (network error, 5xx, timeout)
- **THEN** the service throws `BadGatewayException` or `ServiceUnavailableException` (per `handleDialSdkError`) and logs the failure without logging request bodies containing tokens

#### Scenario: Request omitting rules behaves exactly as before this change
- **WHEN** a request body has no `rules` field at all (an older client, or a client not using the new UI)
- **THEN** the DTO normalizes the missing field to `rules: []`, Core receives `rules: []`, and the request succeeds exactly as it did before this change

#### Scenario: Skill entityType is accepted
- **WHEN** an authenticated user submits `POST /api/v1/catalog/skill/skills%2Fbucket-123%2Fteam-a%2Fdocs-helper/publish` with a valid `folderPath` and `version`
- **THEN** `entityType: 'skill'` passes `CatalogEntityParamsDto`'s `@IsEnum(CatalogEntityType)` validation, `sourceUrl` is `skills/bucket-123/team-a/docs-helper`, `targetUrl` is `skills/public/{folderPath}/docs-helper` (leaf name only — grouping-folder subpath `team-a/` is not preserved), and the service returns 201 with the caller-supplied `version` echoed in the response

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

### Requirement: Skill publication uses the whole-skill resource URL; version recovery is an open question
Skill publication SHALL always target the whole skill (`skills/{bucket}/{path}`) — no per-file skill publish path exists, matching the whole-resource-unit rule sharing already follows for skills (see `catalog-unshare`). The service SHALL NOT assume a skill `entityId` ends in `{name}__{version}`; that convention is specific to how `applications.service.ts`/`toolsets.service.ts` name resources and does not apply to skills.

This change does **not** invent a replacement version-recovery strategy for skills. `PublishService.getPublishHistory`'s existing `splitEntityNameAndVersion(entityId)` version-extraction (used to populate `PublishHistoryEntryDto.version` for every history entry of a given `entityId`) relies on the `__{version}` suffix and SHALL return an empty string for any skill `entityId`, since no such suffix exists to recover from. This is recorded as an explicit open question — not resolved by this change — because skill versioning belongs in `SKILL.md` frontmatter content, which the verified DIAL Core metadata schema does not expose (`ResourceItemMetadata`/`ResourceFolderMetadata` carry no `version` field), and inventing a parsing rule against unverified content would misrepresent what this change actually validated.

#### Scenario: Skill publish-history version field is empty pending a resolved strategy
- **WHEN** `GET /api/v1/catalog/skill/{entityId}/publish-history` is called for a skill `entityId` with no `__{version}` suffix
- **THEN** every returned `PublishHistoryEntryDto.version` is an empty string, and this is documented behavior (not a bug to silently patch) until a skill-specific version-recovery strategy is decided in a follow-up change

#### Scenario: Skill publish still records the caller-supplied version for the publish call itself
- **WHEN** a skill publish request supplies `version: "2.1.0"`
- **THEN** the immediate `PublishResultDto` response for that call echoes `version: "2.1.0"` correctly (this value comes from the request body, not from `entityId` parsing, so it is unaffected by the open question above)


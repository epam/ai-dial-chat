## MODIFIED Requirements

### Requirement: Publish history endpoint derives history from Core publications, not chat-api storage
The backend SHALL expose `GET /api/v1/catalog/{entityType}/{entityId}/publish-history` returning publish entries for the given entity **across every folder it has ever been published to** (folder-scoping happens client-side, in `PublishPanel`), most recent first. It SHALL call DIAL Core's `getPublications` with a `ResourceLink` body scoped to `entityId` itself (the entity's own resource url, not a folder), filtered to publications whose `resources[].sourceUrl` reference `entityId`, mapped to `PublishHistoryEntryDto[]`. Each entry's `folderPath` SHALL have Core's `public/` prefix and trailing slash stripped back off before being returned, so it matches the plain folder-path form the frontend sends when publishing and uses for `selectedFolderPath` comparisons. Each entry's `version` SHALL be recovered from `entityId`'s own `{name}__{version}` suffix (the same value for every entry in a single call, since `entityId` — and therefore its version — is fixed for the whole request), never from `Publication.name`.

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

**Known open issue (task 6.8 in the `add-catalog-publish` change's `tasks.md`, unresolved)**: this requirement's `getPublications` call is scoped by `{ url: entityId }` (the entity's own resource url). DIAL Core's own OpenAPI spec defines `getPublications`'s `url` field as the list **scope** (`publications/{bucket}/` for a user's own submissions, `publications/public/` for admins), not a resource filter — so the current call likely does not match Core's contract and may return no results in practice, even though the publish endpoint itself works end-to-end. This has not yet been fixed or confirmed against a live Core instance; the scenarios below describing history retrieval should be treated as unverified until it is. It is now load-bearing beyond the publish panel: the Unpublish action's visibility derives from this endpoint, so an empty result hides that action entirely (see `catalog-unpublish-flow`).

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

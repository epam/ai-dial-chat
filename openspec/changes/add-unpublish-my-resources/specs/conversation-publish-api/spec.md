## MODIFIED Requirements

### Requirement: Shared publish-target utilities are extracted, not duplicated, between catalog and conversation publish services

`apps/chat-api/src/publish/publish-target.util.ts` SHALL export the pure functions currently private to `publish.service.ts` — the `public/{folderPath}/` target-folder builder, its inverse (stripping the prefix/trailing-slash back off), and the resource-type-prefix/resource-name extraction from a full DIAL resource path — with no behavior change to their existing catalog-publish call sites. The new conversation publish service SHALL import and reuse these same functions rather than re-implementing equivalent logic.

It SHALL additionally export `getPublishedTargetUrl(resourceTypePrefix, folderPath, resourceName)`, returning `{resourceTypePrefix}/{publicTargetFolder}{resourceName}` — the published copy's full path under `public/`. All four call sites that need this string SHALL go through it: catalog publish, catalog unpublish, conversation publish, conversation unpublish. The string SHALL NOT be assembled inline in any service.

This matters more for unpublish than for publish. A publish whose `targetUrl` is subtly wrong fails loudly, because Core has to create the resource at that path. A `DELETE` resource whose `targetUrl` does not match an existing published copy is a request to remove nothing — it can be accepted and approved while changing nothing observable. One shared derivation, unit-tested against the folder paths that stress it (the public root, names containing spaces and non-ASCII characters, and a nested skill grouping folder), is what keeps the two operations addressing the same path.

The published `targetUrl` SHALL be reconstructed from `folderPath` rather than read back from `Publication.resources[].targetUrl`, because the publish-history DTOs deliberately do not carry Core resource urls to the client.

#### Scenario: Catalog publish behavior is unchanged after extraction
- **WHEN** the existing catalog publish and publish-history tests run after `publish-target.util.ts` is extracted
- **THEN** all existing `catalog-publish-api` test scenarios continue to pass unmodified

#### Scenario: Publish and unpublish derive the same targetUrl
- **GIVEN** any `resourceTypePrefix`, `folderPath`, and `resourceName`
- **WHEN** the publish path and the unpublish path each build their `targetUrl`
- **THEN** both call `getPublishedTargetUrl` and produce identical strings

#### Scenario: Folder names needing encoding round-trip identically
- **WHEN** `folderPath` is `"test 14.04/Ünïcode"`
- **THEN** `getPublishedTargetUrl` percent-encodes each segment, and the resulting `targetUrl` is the same one the publish call for that folder produced

### Requirement: Publish history endpoint derives history from Core publications, scoped by conversation path

The backend SHALL expose `GET /api/v1/conversations/publish-history?path=<conversation-path>` returning every publication this conversation path has ever been published to, most recent first. It SHALL call Core's `getPublications` with the caller's own-bucket list scope (`{ url: "publications/{bucket}/" }`) and filter the response to `resources[].sourceUrl === "conversations/{bucket}/{normalizedPath}"`, matching `PublishService.getPublishHistory`'s corrected list-scope behavior. Each entry's `folderPath` SHALL have the `public/` prefix and trailing slash stripped, matching the existing `stripPublicTargetFolder` behavior.

A publication whose matching resource carries `action: 'DELETE'` SHALL be excluded from the result. Such a publication is a pending removal request, not a publication — including it would list the folder twice (once for the original ADD, once for the pending DELETE) and would read as "published here again". Until an administrator approves the removal the conversation genuinely is still published to that folder, so the folder SHALL continue to appear exactly once, from its ADD publication.

Response (200):
```json
[
  {
    "path": "conversations/bucket-123/my-conversation-abc",
    "folderPath": "Organization/Data Science/Shared chats",
    "publishedAt": "2026-07-15T10:00:00.000Z",
    "publishedBy": "Test User"
  }
]
```

Generated-client impact: OpenAPI `operationId: getConversationPublishHistory`; response DTO `PublishConversationResultDto[]`. Frontend caller: `apps/chat/src/server-api/conversation-publish.api.ts`, normal generated method.

Caching: cache key `conversation-publish-history:{path}`, TTL 60 seconds, invalidated synchronously immediately after a successful publish **or unpublish** for the same `path` — same pattern as the catalog publish-history cache.

Rate limiting: default global throttle (read endpoint, no stricter override).

#### Scenario: History returned for a conversation with a prior publish
- **WHEN** a caller requests history for a conversation path that has been published before
- **THEN** the endpoint returns 200 with entries mapped from matching Core publications, ordered by `publishedAt` descending

#### Scenario: History returned for a never-published conversation
- **WHEN** a caller requests history for a conversation path that has never been published
- **THEN** the endpoint returns 200 with an empty array

#### Scenario: A pending removal does not duplicate or drop the folder
- **GIVEN** the conversation has an approved ADD publication and a pending DELETE publication for the same folder
- **WHEN** history is requested
- **THEN** the folder appears exactly once, sourced from the ADD publication

#### Scenario: Cache invalidation on new publish
- **WHEN** a publish request for a given conversation `path` succeeds
- **THEN** the next history request for that same `path` bypasses the stale cache entry and re-reads Core

#### Scenario: Cache invalidation on unpublish
- **WHEN** an unpublish request for a given conversation `path` succeeds
- **THEN** the next history request for that same `path` bypasses the stale cache entry and re-reads Core

#### Scenario: Upstream failure
- **WHEN** the Core `getPublications` call fails unexpectedly
- **THEN** the service throws `BadGatewayException` or `ServiceUnavailableException` (per `handleDialSdkError`)

#### Scenario: Core rejects the history request with a structured error
- **WHEN** `getPublications` resolves with a structured error response (`result.error`)
- **THEN** the service calls `mapDialHttpStatus` with `result.error` and `extractDialErrorMessage(result.error)`, so the thrown exception's `message` is Core's own reason instead of a generic placeholder

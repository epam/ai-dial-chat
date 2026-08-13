# conversation-publish-api Specification

## Purpose

Conversation publish and publish-history endpoints proxying DIAL Core's Publication API.

## ADDED Requirements

### Requirement: Publish endpoint proxies DIAL Core's Publication API for conversations

The backend SHALL expose `POST /api/v1/conversations/publish` in `apps/chat-api/src/conversations/` (a new `conversation-publish.controller.ts` + `conversation-publish.service.ts`, or methods added to the existing `ConversationController`/`ConversationService` if file size allows — decided at implementation time), following `apps/chat-api/AGENTS.md` (thin controller, `@ApiTags`/`@ApiOperation`/`@ApiResponse` per status code, Logger + ConfigService, validated DTOs).

Unlike `PublishController`'s catalog endpoint (which takes `entityType`/`entityId` as URL path segments), this endpoint takes the conversation path as a **query parameter**, matching every existing conversation endpoint (`GET`, `PUT`, `PATCH`, `duplicate`, `DELETE` on `ConversationController` all use `ConversationPathDto { path: string }` as a query param) — a conversation path contains `/` and is not representable as a single clean URL segment the way a pre-encoded catalog `entityId` is.

The service SHALL NOT persist publish records itself — DIAL Core's Publication API (`createPublication`) is the sole source of truth, identical in this respect to `apps/chat-api/src/publish/publish.service.ts`. Shared target-folder construction logic (`public/{folderPath}/` with trailing slash, `encodeDialResourcePath` segment-encoding, stripping the `public/` prefix back off for responses) SHALL be extracted into `apps/chat-api/src/publish/publish-target.util.ts` and imported by both the existing `PublishService` and this new service — not duplicated.

Request:
```
POST /api/v1/conversations/publish?path=bucket-123%2Fmy-conversation-abc
Content-Type: application/json

{
  "folderPath": "Organization/Data Science/Shared chats",
  "rules": [
    {
      "source": "role",
      "function": "CONTAIN",
      "targets": ["engineering"]
    }
  ]
}
```
(`rules` is optional; omitting it is equivalent to `rules: []`.)

Core call made by the service (via `DialClientService.client.createPublication`):
```json
{
  "name": "Q3 planning notes",
  "targetFolder": "public/Organization/Data Science/Shared chats/",
  "resources": [
    {
      "action": "ADD",
      "sourceUrl": "conversations/bucket-123/my-conversation-abc",
      "targetUrl": "conversations/public/Organization/Data Science/Shared chats/my-conversation-abc"
    }
  ],
  "displayAuthor": "Test User",
  "rules": [
    {
      "source": "role",
      "function": "CONTAIN",
      "targets": ["engineering"]
    }
  ]
}
```
`name` SHALL be the conversation's current title, re-fetched server-side via `ConversationService` at publish time (not accepted from the request body) so a stale or client-forged title cannot be sent to Core — see design.md's Open Questions for the rationale. `targetUrl`'s final segment SHALL be the conversation resource path's own last segment (its resource name), not its title, so the destination path stays stable across renames. `displayAuthor` is resolved from the session's OIDC claims via the existing `getUserDisplayName` helper, identical to catalog publish. `rules` is the caller-supplied, validated array of access-restriction rules (`dto.rules ?? []`), passed through to Core unchanged, using the same `PublishRuleDto`/`PublishRuleFunction` shared with catalog publish (see `catalog-publish-api`'s "Publish request accepts optional access rules" requirement — the validation rules, limits, and source-allowlist rationale are identical and not repeated here).

`folderPath` is validated with `class-validator` reusing `IsValidFilePath` (blocks `..`/absolute-path escapes) exactly as `PublishCatalogEntityDto` does. `path` (the conversation path) reuses `ConversationPathDto`'s existing validation. `rules` is validated exactly as in `PublishCatalogEntityDto` (same `PublishRuleDto`, same limits).

Response (201):
```json
{
  "path": "conversations/bucket-123/my-conversation-abc",
  "folderPath": "Organization/Data Science/Shared chats",
  "publishedAt": "2026-07-15T10:00:00.000Z",
  "publishedBy": "Test User"
}
```
(`PublishConversationResultDto` — no `version`, no `entityType`/`entityId` pair, since there is exactly one resource kind and no version dimension. The response SHALL NOT echo back `rules`, matching `catalog-publish-api`'s response contract.)

Generated-client impact: OpenAPI `operationId: publishConversation`; request DTO `PublishConversationDto` (now including optional `rules?: PublishRuleDto[]`, reusing the same `PublishRuleDto`/`PublishRuleFunction` as `PublishCatalogEntityDto`); response DTO `PublishConversationResultDto` (unchanged). Frontend caller: `apps/chat/src/server-api/conversation-publish.api.ts` thin wrapper using the normal (non-`Raw`) generated method.

Rate limiting: `@Throttle({ default: { limit: 10, ttl: 60000 } })`, matching the catalog publish endpoint's write-endpoint throttle profile. Unchanged by this requirement.

Authorization: caller SHALL be authenticated (existing session guard). The service SHALL resolve the bucket exclusively from the authenticated session and SHALL never accept a bucket from the request. Consequently, a path that exists only in another user's bucket is indistinguishable from a missing path and returns 404, avoiding disclosure of another user's resources. Write access to `folderPath` is enforced by DIAL Core itself when `createPublication` is called. A Core 403 SHALL map to `ForbiddenException` via `handleDialSdkError`/`mapDialHttpStatus`. This is unchanged by adding `rules`.

#### Scenario: Successful publish
- **WHEN** an authenticated user with write access to the target folder submits a valid publish request for their own conversation
- **THEN** the service calls Core's `createPublication`, returns 201 with `PublishConversationResultDto`, and the entry becomes retrievable via the publish-history endpoint

#### Scenario: Publish targets the public bucket with the conversation's resource name, not its title
- **WHEN** `path` is `bucket-123/my-conversation-abc` and `folderPath` is `Organization/Data Science`
- **THEN** `targetFolder` sent to Core is `public/Organization/Data Science/` and `targetUrl` is `conversations/public/Organization/Data Science/my-conversation-abc`

#### Scenario: Conversation not owned by the caller
- **WHEN** `path` does not resolve to a conversation in the caller's own bucket
- **THEN** the own-bucket Core lookup returns 404 and the service throws `NotFoundException` without disclosing whether the path exists in another bucket

#### Scenario: Unknown conversation
- **WHEN** `path` does not correspond to an existing conversation
- **THEN** Core returns 404 and the service throws `NotFoundException` (404) via `handleDialSdkError`

#### Scenario: No write access to target folder
- **WHEN** the caller lacks write access to `folderPath`
- **THEN** Core returns 403 and the service throws `ForbiddenException` (403) via `handleDialSdkError`

#### Scenario: Invalid folder path
- **WHEN** `folderPath` fails `IsValidFilePath` validation (e.g. contains `..`)
- **THEN** the request is rejected at the `ValidationPipe` with 400 before reaching the service or Core

#### Scenario: Upstream failure
- **WHEN** the Core `createPublication` call fails unexpectedly (network error, 5xx, timeout)
- **THEN** the service throws `BadGatewayException` or `ServiceUnavailableException` (per `handleDialSdkError`) and logs the failure without logging request bodies containing tokens

#### Scenario: Core rejects the request with a structured error
- **WHEN** `createPublication` resolves with a structured error response (`result.error`), e.g. a 400 for an invalid destination
- **THEN** the service calls `mapDialHttpStatus` with `result.error` as `errorBody` and `extractDialErrorMessage(result.error)` as `upstreamMessage`, so the thrown exception's `message` is Core's own reason instead of a generic placeholder — matching `catalog-publish-api`'s equivalent behavior for `PublishService.publish`

#### Scenario: Request omitting rules behaves exactly as before this change
- **WHEN** a request body has no `rules` field at all (an older client, or a client not using the new UI)
- **THEN** the DTO normalizes the missing field to `rules: []`, Core receives `rules: []`, and the request succeeds exactly as it did before this change

#### Scenario: Invalid rules payload is rejected with 400
- **WHEN** a request includes a malformed `rules` entry (invalid `function` enum value, empty `source`, or empty `targets`)
- **THEN** the `ValidationPipe` rejects the request with 400 before reaching the service or Core, per the same validation contract defined in `catalog-publish-api`'s "Publish request accepts optional access rules" requirement

### Requirement: Publish history endpoint derives history from Core publications, scoped by conversation path

The backend SHALL expose `GET /api/v1/conversations/publish-history?path=<conversation-path>` returning every publication this conversation path has ever been published to, most recent first. It SHALL call Core's `getPublications` with the caller's own-bucket list scope (`{ url: "publications/{bucket}/" }`) and filter the response to `resources[].sourceUrl === "conversations/{bucket}/{normalizedPath}"`, matching `PublishService.getPublishHistory`'s corrected list-scope behavior. Each entry's `folderPath` SHALL have the `public/` prefix and trailing slash stripped, matching the existing `stripPublicTargetFolder` behavior.

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

Caching: cache key `conversation-publish-history:{path}`, TTL 60 seconds, invalidated synchronously immediately after a successful publish for the same `path` — same pattern as the catalog publish-history cache.

Rate limiting: default global throttle (read endpoint, no stricter override).

#### Scenario: History returned for a conversation with a prior publish
- **WHEN** a caller requests history for a conversation path that has been published before
- **THEN** the endpoint returns 200 with entries mapped from matching Core publications, ordered by `publishedAt` descending

#### Scenario: History returned for a never-published conversation
- **WHEN** a caller requests history for a conversation path that has never been published
- **THEN** the endpoint returns 200 with an empty array

#### Scenario: Cache invalidation on new publish
- **WHEN** a publish request for a given conversation `path` succeeds
- **THEN** the next history request for that same `path` bypasses the stale cache entry and re-reads Core

#### Scenario: Upstream failure
- **WHEN** the Core `getPublications` call fails unexpectedly
- **THEN** the service throws `BadGatewayException` or `ServiceUnavailableException` (per `handleDialSdkError`)

#### Scenario: Core rejects the history request with a structured error
- **WHEN** `getPublications` resolves with a structured error response (`result.error`)
- **THEN** the service calls `mapDialHttpStatus` with `result.error` and `extractDialErrorMessage(result.error)`, so the thrown exception's `message` is Core's own reason instead of a generic placeholder

### Requirement: Shared publish-target utilities are extracted, not duplicated, between catalog and conversation publish services

`apps/chat-api/src/publish/publish-target.util.ts` SHALL export the pure functions currently private to `publish.service.ts` — the `public/{folderPath}/` target-folder builder, its inverse (stripping the prefix/trailing-slash back off), and the resource-type-prefix/resource-name extraction from a full DIAL resource path — with no behavior change to their existing catalog-publish call sites. The new conversation publish service SHALL import and reuse these same functions rather than re-implementing equivalent logic.

#### Scenario: Catalog publish behavior is unchanged after extraction
- **WHEN** the existing catalog publish and publish-history tests run after `publish-target.util.ts` is extracted
- **THEN** all existing `catalog-publish-api` test scenarios continue to pass unmodified

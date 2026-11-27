## MODIFIED Requirements

### Requirement: Publish endpoint proxies DIAL Core's Publication API for conversations

The backend SHALL expose `POST /api/v1/conversations/publish` in `apps/chat-api/src/conversations/` via a dedicated `ConversationPublishController` (`conversation-publish.controller.ts`, a sibling of `ConversationController` on the same `conversations` v1 path) and `ConversationPublishService` (`conversation-publish.service.ts`), following `apps/chat-api/AGENTS.md` (thin controller, `@ApiTags`/`@ApiOperation`/`@ApiResponse` per status code, Logger + ConfigService, validated DTOs).

Unlike `PublishController`'s catalog endpoint (which takes `entityType`/`entityId` as URL path segments), this endpoint takes the conversation path as a **query parameter**, matching every existing conversation endpoint (`GET`, `PUT`, `PATCH`, `duplicate`, `DELETE` on `ConversationController` all use `ConversationPathDto { path: string }` as a query param) — a conversation path contains `/` and is not representable as a single clean URL segment the way a pre-encoded catalog `entityId` is.

The service SHALL NOT persist publish records itself — DIAL Core's Publication API (`createPublication`) is the sole source of truth, identical in this respect to `apps/chat-api/src/publish/publish.service.ts`. Shared target-folder construction logic (`public/{folderPath}/` with trailing slash, `encodePlainDialResourcePath` segment-encoding — not the idempotent, pre-decoding `encodeDialResourcePath`, so a folder name containing a literal percent escape survives — stripping the `public/` prefix back off for responses) SHALL be extracted into `apps/chat-api/src/publish/publish-target.util.ts` and imported by both the existing `PublishService` and this new service — not duplicated.

Request:
```
POST /api/v1/conversations/publish?path=bucket-123%2Fmy-conversation-abc
Content-Type: application/json

{
  "folderPath": "Organization/Data Science/Shared chats",
  "author": "DIAL Team"
}
```
(`author` is optional; omitting it, or sending it blank, is equivalent to the pre-existing session-derived behavior.)

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
  "displayAuthor": "DIAL Team"
}
```
`name` SHALL be the conversation's current title, re-fetched server-side via `ConversationService` at publish time (not accepted from the request body) so a stale or client-forged title cannot be sent to Core — see design.md's Open Questions for the rationale. `targetUrl`'s final segment SHALL be the conversation resource path's own last segment (its resource name), not its title, so the destination path stays stable across renames. `displayAuthor` SHALL be resolved by `ConversationPublishController.publish` through `resolveDisplayAuthor(author, claims)` (`apps/chat-api/src/common/utils/user-display-name.ts`, i.e. `author?.trim() || getUserDisplayName(claims)`) and passed as the existing single `author` string parameter to `ConversationPublishService.publish`, whose signature and its `displayAuthor: author` line SHALL remain unchanged — identical in shape to catalog publish (see `catalog-publish-api`). The `createPublication` body SHALL NOT contain a `rules` key, so DIAL Core leaves the target folder's existing publication rules untouched.

`folderPath` is validated with `class-validator` reusing `IsValidFilePath` (blocks `..`/absolute-path escapes) exactly as `PublishCatalogEntityDto` does. `path` (the conversation path) reuses `ConversationPathDto`'s existing validation. `PublishConversationDto` SHALL NOT declare `rules`; a body that still sends it is rejected with 400 by the `forbidNonWhitelisted` pipe. `author` is validated exactly as in `PublishCatalogEntityDto`, through the shared constants in `apps/chat-api/src/publish/dto/publish-author.ts`: `@IsOptional()`, `@IsString()`, `@MaxLength(DISPLAY_AUTHOR_MAX_LENGTH)` (200), `@Matches(NO_CONTROL_CHARACTERS)` (`/^[^\p{Cc}]*$/u`).

Before creating the publication the service SHALL reject a conversation that still has a pending background-generated message (`findPendingBackgroundMessage`) with `ConflictException` (409, `PUBLISH_WHILE_GENERATING_MESSAGE`), because Core copies the stored file and the published copy would keep a `pending` message no viewer can resolve.

`author` SHALL NOT affect authorization or the recorded actor. Core continues to derive the publication's `author` from the caller's bearer token, and `PublishConversationResultDto.publishedBy` SHALL report the publication's display author, reading `publication.displayAuthor` before `publication.author` (`readPublicationDisplayAuthor`), exactly as catalog publish does.

Response (201):
```json
{
  "path": "conversations/bucket-123/my-conversation-abc",
  "folderPath": "Organization/Data Science/Shared chats",
  "publishedAt": "2026-07-15T10:00:00.000Z",
  "publishedBy": "Test User"
}
```
(`PublishConversationResultDto` — no `version`, no `entityType`/`entityId` pair, since there is exactly one resource kind and no version dimension. The response SHALL NOT echo back `author`, matching `catalog-publish-api`'s response contract.)

Generated-client impact: OpenAPI `operationId: publishConversation`; request DTO `PublishConversationDto` (optional `author?: string`; no `rules` field); response DTO `PublishConversationResultDto` (unchanged). Frontend caller: `apps/chat/src/server-api/conversation-publish.api.ts` thin wrapper using the normal (non-`Raw`) generated method, whose `publishConversation` helper SHALL take the author as a fourth positional parameter and omit the field from the request body when it is empty after trimming. Because `author` is optional, the regenerated client SHALL stay source-compatible with request literals that omit it.

Authorization: caller SHALL be authenticated (existing session guard). The service SHALL resolve the bucket exclusively from the authenticated session and SHALL never accept a bucket from the request. Consequently, a path that exists only in another user's bucket is indistinguishable from a missing path and returns 404, avoiding disclosure of another user's resources. Write access to `folderPath` is enforced by DIAL Core itself when `createPublication` is called. A Core 403 SHALL map to `ForbiddenException` via `handleDialSdkError`/`mapDialHttpStatus`. This is unchanged by `author`.

#### Scenario: Successful publish
- **WHEN** an authenticated user with write access to the target folder submits a valid publish request for their own conversation
- **THEN** the service calls Core's `createPublication`, returns 201 with `PublishConversationResultDto`, and the entry becomes retrievable via the publish-history endpoint

#### Scenario: Publish targets the public bucket with the conversation's resource name, not its title
- **WHEN** `path` is `bucket-123/my-conversation-abc` and `folderPath` is `Organization/Data Science`
- **THEN** `targetFolder` sent to Core is `public/Organization/Data Science/` and `targetUrl` is `conversations/public/Organization/Data Science/my-conversation-abc`

#### Scenario: Custom author is forwarded to Core as displayAuthor
- **WHEN** an authenticated user publishes a conversation with `author: "DIAL Team"`
- **THEN** the `createPublication` body sent to Core carries `displayAuthor: "DIAL Team"` instead of the session-derived display name

#### Scenario: Request omitting author behaves exactly as before this change
- **WHEN** a request body has no `author` field at all, or sends it blank or whitespace-only
- **THEN** the controller passes `getUserDisplayName(claims)` to the service and Core receives exactly the `displayAuthor` it received before this change

#### Scenario: Invalid author payload is rejected with 400
- **WHEN** `author` exceeds 200 characters or contains a control character
- **THEN** the `ValidationPipe` rejects the request with 400 before reaching the service or Core

#### Scenario: Conversation not owned by the caller
- **WHEN** `path` does not resolve to a conversation in the caller's own bucket
- **THEN** the own-bucket Core lookup returns 404 and the service throws `NotFoundException` without disclosing whether the path exists in another bucket

#### Scenario: Publish while an answer is still generating
- **WHEN** the re-fetched conversation contains a pending background message
- **THEN** the service throws `ConflictException` (409) with `PUBLISH_WHILE_GENERATING_MESSAGE` and does not call `createPublication`

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
- **WHEN** the Core `createPublication` call throws unexpectedly (network error, timeout)
- **THEN** the service logs the failure (message and stack, without request bodies or tokens) and throws `BadGatewayException`

#### Scenario: Core rejects the request with a structured error
- **WHEN** `createPublication` resolves with a structured error response (`result.error`), e.g. a 400 for an invalid destination
- **THEN** the service calls `mapDialHttpStatus` with `result.error` as `errorBody` and `extractDialErrorMessage(result.error)` as `upstreamMessage`, so the thrown exception's `message` is Core's own reason instead of a generic placeholder — matching `catalog-publish-api`'s equivalent behavior for `PublishService.publish`

#### Scenario: Core request carries no rules
- **WHEN** a valid conversation publish request reaches `ConversationPublishService.publish`
- **THEN** the `createPublication` body has no `rules` key, and the folder's existing Core rules are unchanged

#### Scenario: A request still sending rules is rejected with 400
- **WHEN** a request body includes a `rules` field
- **THEN** the `ValidationPipe` rejects it with 400 before reaching the service or Core

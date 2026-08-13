## ADDED Requirements

### Requirement: Conversation unpublish endpoint submits a DELETE-action publication

The backend SHALL expose `POST /api/v1/conversations/unpublish?path=<conversation-path>` in `apps/chat-api/src/conversations/` (`conversation-publish.controller.ts`, `conversation-publish.service.ts`, new `dto/unpublish-conversation.dto.ts`), mirroring the existing `POST /api/v1/conversations/publish` shape: the conversation is addressed by the bucket-relative `path` query param (no `conversations/` prefix — the same convention rename/delete/duplicate use), and the body carries only `folderPath`.

The service SHALL call Core's `createPublication` through `DialClientService` with a single `DELETE` resource and persist nothing:

```json
{
  "name": "My conversation",
  "targetFolder": "public/Organization/Shared chats/",
  "resources": [
    {
      "action": "DELETE",
      "sourceUrl": "conversations/bucket-123/my-conversation-abc",
      "targetUrl": "conversations/public/Organization/Shared chats/my-conversation-abc"
    }
  ],
  "displayAuthor": "Test User"
}
```

`sourceUrl` SHALL be built from the caller's own session bucket and the encoded `path`, exactly as `ConversationPublishService.publish` builds it — never from a client-supplied resource url, and never resolved cross-bucket. Unpublish, like publish, has no shared-conversation case: the copy being removed was published from the caller's own bucket.

`name` SHALL be the conversation's current title, re-fetched server-side via `getConversation(bucket, encodedPath)` the same way publish fetches it, so the admin queue shows a readable title. When that fetch fails, the error SHALL be mapped through `handleDialSdkError` and no publication is created.

Response (200):
```json
{
  "path": "conversations/bucket-123/my-conversation-abc",
  "folderPath": "Organization/Shared chats",
  "requestedAt": "2026-08-13T10:00:00.000Z",
  "requestedBy": "Test User"
}
```

Generated-client impact: OpenAPI `operationId: unpublishConversation`; request DTO `UnpublishConversationDto`; response DTO `UnpublishConversationResultDto`. Frontend caller: a thin wrapper in `apps/chat/src/server-api/conversation-publish.api.ts`.

Rate limiting: `@Throttle` at the publish endpoint's write profile. Authorization, error mapping, and logging discipline are identical to the catalog unpublish endpoint (see `catalog-unpublish-api`): authenticated session only, Core enforces folder write access, `mapDialHttpStatus` carries Core's own message, and no request body or token is ever logged.

#### Scenario: Successful conversation unpublish request
- **WHEN** an authenticated user submits a valid unpublish request for a folder the conversation is published to
- **THEN** the service re-fetches the title, calls `createPublication` with one `DELETE` resource, and returns 200

#### Scenario: targetUrl matches what conversation publish sent
- **GIVEN** the conversation was published to `Organization/Shared chats`
- **WHEN** it is unpublished from that folder
- **THEN** the DELETE resource's `targetUrl` is character-for-character the `targetUrl` the publish call sent

#### Scenario: Title fetch failure aborts the request
- **WHEN** `getConversation` fails for the caller's own bucket and path
- **THEN** `handleDialSdkError` maps the failure, no `createPublication` call is made, and no cache entry is invalidated

#### Scenario: Path traversal is rejected
- **WHEN** `path` or `folderPath` fails `IsValidFilePath` validation
- **THEN** the `ValidationPipe` rejects the request with 400 before the service runs

### Requirement: A successful conversation unpublish request invalidates the publish-history cache

On success the service SHALL synchronously delete `conversation-publish-history:{sourceUrl}` — the same key `publish` invalidates — so the next history read re-queries Core.

#### Scenario: Next history read bypasses the stale cache
- **WHEN** an unpublish request for a conversation `path` succeeds
- **THEN** the next publish-history request for that path re-reads Core

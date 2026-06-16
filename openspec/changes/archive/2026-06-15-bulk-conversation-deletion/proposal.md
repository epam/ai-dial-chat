## Why

Users have no way to clear multiple conversations at once. The current `DELETE /api/v1/conversations?path=...` endpoint deletes exactly one conversation per request. Removing a large history requires issuing one request per conversation, which is slow, exposes the browser to partial-success states, and makes "clear all" impractical for users with hundreds of conversations.

Adding bulk-deletion endpoints lets the client remove any number of owned conversations in a single round-trip, and lets "clear all" drain the user's bucket in one request.

## What Changes

- **New `POST /api/v1/conversation-deletions` endpoint** — accepts a JSON body `{ ids: string[] }` of up to 100 stable DIAL Core conversation IDs. The service validates that every ID belongs to the authenticated user's bucket, calls `deleteConversation` per ID in parallel against DIAL Core, and returns a typed result that distinguishes *deleted*, *already-absent*, and *failed* items. Already-absent IDs are treated as success (idempotent retry support). Partial failures are reported per-item with a stable application error code rather than a raw upstream error.

- **New `POST /api/v1/conversation-deletions/all` endpoint** — requires an explicit `{ confirm: true }` body to guard against accidental collection deletion. The service lists every conversation in the authenticated user's bucket (paginated fan-out to DIAL Core metadata), then calls the same per-item deletion path. Returns the same typed result DTO. The two endpoints share the service implementation and are impossible to confuse because they are distinct resources.

- **Pin cleanup** — both deletion paths fire a fire-and-forget `userConfigService.updatePin(id, false, ...)` for each successfully deleted conversation, matching the cleanup behaviour of `deleteConversation` for single deletions.

- **Frontend wrappers** — after the OpenAPI client is regenerated, `apps/chat/src/server-api/conversations.api.ts` gains two thin wrappers (`deleteConversations`, `deleteAllConversations`) over the generated `ConversationsApi` methods. No manual edits to the generated client.

## Non-Goals

- No UI work is in scope. Bulk-delete surfaces (confirmation dialogs, multi-select UI, "Clear All" button) are a separate concern.
- Deleting conversations owned by other users, public conversations, or shared conversations is explicitly out of scope; the service rejects such IDs with `403 Forbidden`.
- No new conversation ID format is introduced. IDs remain the existing DIAL Core resource URLs (`conversations/{bucket}/{path}`).
- No asynchronous job queue. Both operations complete synchronously. Timeouts from DIAL Core surface as per-item failures in the result DTO.
- `DELETE /api/v1/conversations?path=...` (single-delete) is unchanged and remains the canonical path for single-item deletion.

## Capabilities

### New Capabilities

- `bulk-conversation-deletion`: Delete a selected set of owned conversations in one request.
- `clear-all-conversations`: Delete every conversation in the authenticated user's bucket in one request.

## Impact

- `apps/chat-api/src/conversations/` — `ConversationController` gains two new handlers; `ConversationService` gains `deleteConversations(ids, token, bucket)` and `deleteAllConversations(token, bucket)`; new DTOs `DeleteConversationsBodyDto` and `DeleteAllConversationsBodyDto`; new response DTO `ConversationDeletionResultDto` (with `ConversationDeletionFailureDto`).
- `libs/chat-api-client/` — regenerated via `npm run openapi` and `npm run openapi:check`; new methods `deleteConversations` and `deleteAllConversations` on `ConversationsApi`.
- `apps/chat/src/server-api/conversations.api.ts` — two thin wrappers added; `api-client.ts` unchanged (reuses existing `conversationsApi` singleton).
- No changes to `libs/chat-shared`, `libs/conversation-input`, or any other library.
- No i18n keys. Both endpoints return structured data consumed programmatically; no user-visible strings are added on the backend.

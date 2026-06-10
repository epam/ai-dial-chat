## Context

Conversations fall into three sources: My Chats, Shared (sharedWithMe), and Organization (publishedWithMe). Shared and Organization conversations are read-only because their path prefix belongs to a different bucket than the current user's. The current UI renders a `<DialNotification>` info banner where the input would be, but provides no actionable escape path.

The DIAL Core SDK exposes `copyResource` (`POST /v1/ops/resource/copy`) which copies a resource from any bucket (including shared/org) into a destination bucket — the same API that `moveResource` uses but without deleting the source. No duplicate endpoint exists yet in the NestJS backend or the generated API client.

## Goals / Non-Goals

**Goals:**
- Add `POST /api/conversations/duplicate` NestJS endpoint backed by `client.copyResource`.
- Add `duplicateConversation` to the Swagger spec so the generated client includes it.
- Expose `duplicateConversation(id)` via `ConversationsContext`.
- Add a Duplicate item to the conversation row three-dot dropdown for all conversations.
- Replace the `<DialNotification>` read-only banner in `ConversationView` with a centered action button (duplicate icon + i18n label) that calls `onDuplicateConversation`.
- Navigate to the newly created conversation after duplication.

**Non-Goals:**
- Deep cloning of attached files or referenced assets.
- Recursive folder duplication.
- Undo/rollback of the duplicate operation.

## Decisions

### Use `client.copyResource` from DIAL SDK
The SDK already provides `POST /v1/ops/resource/copy` with `{ sourceUrl, destinationUrl, overwrite }` — the same body shape as `moveResource`. This handles auth, error propagation, and all DIAL Core concerns without a custom HTTP fetch. Alternative (fetch conversation JSON then re-save) would duplicate logic and miss server-side attachment handling.

### New dedicated `POST /api/conversations/duplicate` endpoint
Following the existing controller pattern, `@Post('duplicate')` is the cleanest addition. The source path is taken from a `?path=` query param (consistent with existing `getConversation`, `deleteConversation`, `saveConversation`). The destination is always the user's own bucket, with a unique name resolved via `resolveUniqueConversationName`.

### Full source path (includes source bucket) is passed as-is
The frontend has the full conversation ID (e.g., `shared-bucket/path/to/chat.json`). The controller passes it directly to the service which builds `conversations/<sourcePath>` for the DIAL Core `sourceUrl`. This avoids any bucket-stripping/re-prefixing logic.

### `onDuplicateConversation` prop on `ConversationView`
The `Conversation` page owns navigation and context; `ConversationView` is a pure presentational component. Adding an `onDuplicateConversation?: () => void` prop keeps the library side clean. The page calls `duplicateConversation`, then navigates to the new conversation ID.

### Centered button replaces `DialNotification`
A `DialNotification` is passive — users read it but can't act. A button with duplicate icon + "Duplicate the conversation to be able to edit it" fulfills the intent and matches the request. Use `DialButton` with an appropriate variant (`secondary` or `primary`) so the call-to-action is visually distinct.

## Risks / Trade-offs

- **Name collision**: `resolveUniqueConversationName` already handles this by appending a numeric suffix (same as rename). Risk is low.
- **Shared resource permissions**: If DIAL Core denies `copyResource` for a particular shared item, the endpoint returns a 502 and the UI should surface the error. Needs error handling in the context method.
- **Swagger regeneration**: Adding the endpoint requires regenerating `libs/chat-api-client` via the project OpenAPI scripts. This is a required step in the task list.

## Migration Plan

No database migration. The feature is purely additive:
1. Backend endpoint added under feature branch.
2. Swagger regenerated → `libs/chat-api-client` updated.
3. Frontend wired end-to-end.
4. Rolled back by reverting the branch — no persistent state changes.

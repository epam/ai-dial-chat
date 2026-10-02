## Why

### Problem

Blocking the browser's terminal conversation GET currently labels an already saved reply as unsaved. Both the initiating stream and attach recovery conflate read failure with persistence failure, and the displayed Try again action regenerates the answer.

## What Changes

### Solution

- Keep received text and custom content when a terminal GET fails, and expose a separate transient reload error with a read-only retry.
- Render a localized conversation reload notification in the app; retry only the GET and retain the notification while retrying or after another read failure.
- Preserve explicit `conversation_save_failed` handling, empty-placeholder protection, successful server enrichment, and pending background recovery.
- Update main OpenSpec specifications and documentation alongside the implementation.

### Non-goals

No server write retries, new endpoints, storage schemas, durable browser cache, or changes to proxy-agent setup. Existing generation-error regeneration remains unchanged.

### Acceptance criteria

- A failed terminal GET retains the received answer without adding a persistence or generation error.
- Retry reads the conversation without invoking completion or save; successful reads apply server enrichment and clear the notification.
- Repeated clicks do not overlap reads; navigation, unmount, and newer generations prevent stale UI writes.
- Explicit save failures and successful reads of unresolved empty placeholders still preserve output and warn.
- Both initiating and attached streams satisfy these cases, including stages-only output and background responses.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `backend-owned-generation-persistence`: distinguish terminal read failure from persistence failure and retain the live buffer for read retry.
- `generation-live-replay`: apply the same separation to attach/watch terminal reconciliation.
- `stream-error-banner`: specify a separate transient reload notification whose action reads rather than regenerates.

## Impact

The reference paths are `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts:591`, `generation-resume.ts:347` in the same directory, and `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx:695`. The shared hook and both app consumers (conversation page and application preview) are in scope. No new context is needed. Library isolation is preserved through `ConversationStreamTransport`; UI, translated text, endpoint knowledge, and logging remain host-owned.

Alternatives: simply suppressing the error hides a failed reconciliation; changing only its text leaves regeneration attached to a read error. A separate transient state and GET retry addresses both problems.

New i18n keys describe the reload failure and retry action in supported locales. The hook result additions and view props are additive; rollback is code-only, with no API or persisted-data migration.

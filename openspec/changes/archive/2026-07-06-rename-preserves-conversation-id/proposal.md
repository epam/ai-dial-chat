## Why

Renaming a conversation currently moves the underlying DIAL Core resource to a new path derived from the new title, and because `conversation.id` is the storage path, the id changes on every rename. This breaks any reference, bookmark, pin, or external system that treats `conversation.id` as a stable identifier ([#7612](https://github.com/epam/ai-dial-chat/issues/7612)). A manual rename should change only the display title, never the identifier.

## What Changes

- **BREAKING (internal contract): rename no longer changes `conversation.id`.** The backend rename flow stops calling `moveResource` (which changes the filename and therefore the path/id) and instead saves the conversation body at the **same path**, updating only `name` (and `llmNamingDone`). The storage filename stays as-is; the display title lives in `name`.
- **BREAKING (HTTP contract): `PATCH /api/v1/conversations` response changes from `{ newPath }` to `{ name }`.** The response no longer implies a path change; it returns the sanitised stored display name so the client can reconcile the exact persisted value. `RenameConversationResponseDto.newPath` is removed and replaced by `name`.
- **Manual rename marks the conversation as finally named (`llmNamingDone: true`).** This makes the manual title authoritative: it wins any race with the async LLM naming pass, prevents later client saves from clobbering it (via the existing `preserveLlmDisplayName` guard), and stops future automatic re-naming.
- **Remove the compensating logic that only existed to absorb the path change:** the `syncStoredDisplayNameAfterPathRename` step and the `migratePin` call in the rename flow are deleted, since the id (and therefore the pin id) no longer changes.
- **Frontend: remove the id swap and post-rename `navigate()`.** `ConversationsContext.renameConversation` no longer replaces the item's `id` with a returned path, and `ConversationPanelView` no longer navigates to a new route after rename. The optimistic title update stays; the pinned-conversation re-pin dance is removed.
- **Fix `resolveListDisplayTitle` so it reflects the manually-set `name` even when filename and `name` legitimately diverge.** After a manual rename the filename stays `gpt-4o__Old Title__uuid` while `name` becomes "New Title"; the display title must follow `name`, not the stale filename-derived title.

## Capabilities

### New Capabilities

_None — this change modifies existing rename behavior only._

### Modified Capabilities

- `conversation-rename`: the frontend `ConversationsContext.renameConversation` requirement changes — no id swap on success, no pin migration, `renameConversation` returns/uses the stored `name` rather than a new path; `ConversationPanelView` drops the post-rename navigation.
- `conversations-api`: the `PATCH /api/v1/conversations` requirement changes — the service saves at the same path instead of `moveResource`, sets `llmNamingDone: true`, and returns `{ name }`; the display-name resolution requirement changes so a manually-set `name` is trusted for list/GET titles even when the filename diverges.
- `llm-conversation-naming`: a manual rename is added as a source of the `llmNamingDone` marker, so a pending or future automatic naming pass is suppressed once the user has renamed.

## Impact

- **Backend** (`apps/chat-api/src/conversations/`):
  - `conversation.service.ts` — `renameConversation` (replace `moveResource` + `migratePin` + `syncStoredDisplayNameAfterPathRename` with a same-path `saveConversation` setting `name` + `llmNamingDone`); `resolveListDisplayTitle` (trust manual `name`); remove `syncStoredDisplayNameAfterPathRename`.
  - `conversation.controller.ts` — `@Patch()` response type/Swagger docs.
  - `dto/rename-conversation.dto.ts` — `RenameConversationResponseDto` (`newPath` → `name`).
  - `user-config.service.ts` — `migratePin` becomes unused by the rename flow (retain only if used elsewhere; otherwise remove).
  - Tests: `conversations/tests/conversation.service.spec.ts`, controller e2e, naming service specs.
- **API client** (`libs/chat-api-client`): regenerate — `renameConversation` response schema changes to `{ name }`. Run `npm run openapi`, `npm run openapi:check`, then build/lint the client.
- **Frontend** (`apps/chat/src/`):
  - `context/ConversationsContext.tsx` — `renameConversation` signature/behavior (return `name`, drop id swap and re-pin logic).
  - `components/ConversationPanel/ConversationPanelView.tsx` — `handleConfirmRename` (drop `navigate`).
  - `server-api/conversations.api.ts` — `renameConversation` wrapper return type.
  - Tests co-located with the above.
- **Docs**: update the conversation/rename behavior in `docs/` if the id-immutability contract is documented there.
- **Migration note**: existing conversations previously renamed via `moveResource` keep their current (already-migrated) filename and id; no data migration is required. Their filename may already match the old title — the new logic simply trusts `name` going forward.

## Context

`conversation.id` in this app is the DIAL Core storage path (`<bucket>/<deploymentId>__<title>__<uuid>`). The rename flow today calls `client.moveResource` to rename the file to a title-derived path, which necessarily changes the id ([conversation.service.ts:357](../../../apps/chat-api/src/conversations/conversation.service.ts)). Two pieces of compensating logic exist purely to absorb that change: `migratePin` (rewrites the pinned id after the move) and `syncStoredDisplayNameAfterPathRename` (rewrites the stored `name` to match the new filename). The frontend then swaps the item's `id` to the returned `newPath` and navigates to the new route.

A key observation from the codebase: the **LLM naming pass already updates only `name` + `llmNamingDone` at the same path** — it explicitly does not call `moveResource` ([llm-conversation-naming spec](../../specs/llm-conversation-naming/spec.md), `conversation-naming.service.ts:242-246`). So the pattern for "change the display title without moving the file" already exists and is proven; manual rename should adopt it. This also means filename↔`name` divergence is already a normal, handled state, resolved by `resolveListDisplayTitle`.

Constraints: DIAL Core is the source of truth (accessed via `@epam/ai-dial-typescript-sdk`); the HTTP contract is a generated OpenAPI client (`libs/chat-api-client`) so response shape changes require regeneration; frontend state is React Context.

## Goals / Non-Goals

**Goals:**
- `conversation.id` is immutable across manual renames.
- A manual rename changes only the display title (`name`) and marks the conversation finally named.
- List and detail views show the manual title even though the filename retains the old title.
- Remove the now-unnecessary path-change compensations (pin migration, display-name sync) and frontend id-swap/navigation.

**Non-Goals:**
- Changing how LLM naming works (it already uses the same-path approach — we only add manual rename as another source of `llmNamingDone`).
- Retroactively normalising filenames of conversations that were renamed via the old `moveResource` flow (no data migration).
- Changing the identifier scheme itself (id remains the storage path; we just stop mutating it on rename).
- Renaming folders/files in the file manager (separate `moveResource` caller, out of scope).

## Decisions

### Decision 1: Rename saves at the same path instead of `moveResource`

`renameConversation` loads the stored body via the existing `getStoredConversation` helper, then calls the existing `saveConversation` persistence path with `{ ...stored, name: sanitisedTitle, llmNamingDone: true }` at the unchanged path. This mirrors the LLM naming service exactly.

- **Why:** Keeps the id stable, reuses a proven code path, and removes an entire class of compensating logic.
- **Alternative considered — keep `moveResource` but return the old id:** impossible; the move changes the filename which *is* the id.
- **Alternative considered — decouple id from path (introduce a stable synthetic id field):** far larger blast radius (every id consumer, URL scheme, pin storage, matching utils). Rejected as out of scope; the same-path save achieves id stability without a new id scheme.

### Decision 2: Response contract becomes `{ name }`

`RenameConversationResponseDto` drops `newPath` and returns `name` (the server-sanitised title).

- **Why:** The path no longer changes, so `newPath` is meaningless. Returning `name` lets the client reconcile the exact persisted value (sanitisation may alter what the user typed). Cleaner than an empty 200 (client would otherwise show an unsanitised optimistic title) and lighter than returning a full summary DTO.
- **Alternative considered — 200 with empty body:** rejected — client can't observe server-side sanitisation.
- **Alternative considered — full conversation summary:** rejected — larger payload and unnecessary coupling for a title edit.

### Decision 3: Manual rename sets `llmNamingDone: true`

- **Why:** A user-chosen title is authoritative. Setting the marker (a) makes the async naming pass skip this conversation (existing guard at `conversation-naming.service.ts:67`), winning the race when rename happens before naming completes; (b) engages the existing `preserveLlmDisplayName` guard so later stale client saves don't clobber the title; (c) lets `resolveListDisplayTitle` trust `name`.
- **Alternative considered — leave `llmNamingDone` untouched:** a pending naming pass could later overwrite the manual title, and the display logic would need a separate "manually renamed" flag. Rejected as more state for less safety. Confirmed with the requester.

### Decision 4: `resolveListDisplayTitle` trusts an authoritative `name`

The current heuristic returns the filename-derived title when the stored `name` differs from the message-derived title — a rule that assumed manual renames changed the filename. With same-path renames that assumption is inverted. The function is simplified so that when `llmNamingDone === true` and `name` is non-empty, `name` is returned regardless of the filename-derived title. The existing "`name` empty → filename" and "`name` === filename title → `name`" branches stay for the in-progress/unnamed case.

- **Why:** Both LLM and manual renames now write `name` at the same path with `llmNamingDone: true`; `name` is the single source of truth for the display title in that state.
- **Alternative considered — add a distinct `manuallyRenamed` flag:** unnecessary; `llmNamingDone` already means "the stored name is final."

### Decision 5: Frontend drops id-swap, re-pin, and post-rename navigation

`ConversationsContext.renameConversation` returns `Promise<void>` (or the reconciled `name`), keeps the optimistic title update, reconciles `title` from the response, and no longer touches `id` or pins. `ConversationPanelView.handleConfirmRename` no longer calls `navigate`.

- **Why:** Nothing about the identity or route changes, so these steps are dead weight and a source of the bug.

## Risks / Trade-offs

- **Stale-filename confusion in DIAL Core storage** → The on-disk filename keeps the old title after a manual rename (only `name` reflects the new title). This already happens for LLM-named conversations, and the UI always uses `name`. Mitigation: none needed; documented as expected behavior.
- **Generated-client / OpenAPI drift** → Response shape change must be regenerated or the frontend type breaks. Mitigation: run `npm run openapi`, `npm run openapi:check`, then build/lint `chat-api-client`; update the `conversations.api.ts` wrapper in the same change.
- **`migratePin` may have other callers** → Removing it from the rename flow is safe, but the function itself should only be deleted if unused elsewhere. Mitigation: grep call sites before removal; leave the function if referenced elsewhere.
- **Conversations renamed under the old flow** → Their filename already matches their (already-migrated) title and id; the new logic simply trusts `name` going forward. Mitigation: no migration required; verify with a spec test that a filename-matching `name` still resolves correctly.
- **Concurrent manual rename + in-flight LLM naming** → Both write `name` at the same path. Setting `llmNamingDone: true` on rename makes the naming pass skip on its `llmNamingDone` re-check after refresh (`conversation-naming.service.ts:235`). Residual risk is a narrow interleave where naming already passed the check; acceptable and no worse than today.

## Migration Plan

1. Backend: change DTO + service + `resolveListDisplayTitle`; remove `syncStoredDisplayNameAfterPathRename` and the rename-flow `migratePin` call. Update/adjust specs and unit + e2e tests.
2. Regenerate the OpenAPI client (`npm run openapi && npm run openapi:check`), build/lint `chat-api-client`.
3. Frontend: update `conversations.api.ts` wrapper, `ConversationsContext.renameConversation`, and `ConversationPanelView.handleConfirmRename`; update co-located tests.
4. Update `docs/` if id immutability / rename behavior is documented there.
5. Deploy backend and frontend together (contract change). Rollback: revert the change set; no data migration was performed, so no data rollback is needed. Conversations renamed while the new code was live keep their old filename + new `name`, which the old code also renders correctly via list enrichment.

## Resolved Decisions

- **Response DTO name:** Keep `RenameConversationResponseDto` as-is; only change the field from `newPath` to `name` (field-only change, no rename).
- **`migratePin`:** Only remove the rename-flow *call* to `migratePin`. Leave the `migratePin` function itself in `user-config.service.ts` intact (do not delete it or its tests), regardless of whether other callers exist.

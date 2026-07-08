## 1. Backend: rename endpoint contract

- [x] 1.1 In `apps/chat-api/src/conversations/dto/rename-conversation.dto.ts`, change `RenameConversationResponseDto` from `newPath: string` to `name: string` (update `@ApiProperty` description/example accordingly). Keep `RenameConversationBodyDto` unchanged.
- [x] 1.2 In `apps/chat-api/src/conversations/conversation.controller.ts`, update the `@Patch()` handler's `@ApiResponse` type/docs to reflect `{ name }`; remove any 409-conflict `@ApiResponse` that only applied to `moveResource` destination-exists (no longer possible). Keep `@Throttle({ default: { limit: 20, ttl: 60000 } })`.

## 2. Backend: rename service uses same-path save

- [x] 2.1 In `apps/chat-api/src/conversations/conversation.service.ts`, rewrite `renameConversation(path, newTitle, at, bucket)` to: sanitise via `prepareEntityName`; load the stored body (404 if missing); persist at the **same** path with `{ ...stored, name: sanitisedTitle, llmNamingDone: true }`; return `{ name: sanitisedTitle }`. Remove the `client.moveResource` call and the `sourceUrl`/`destinationUrl`/`buildRenamedConversationPath` usage from this method.
- [x] 2.2 Remove the rename-flow `migratePin` call (old→new pin id) — no longer needed since the id is stable.
- [x] 2.3 Remove `syncStoredDisplayNameAfterPathRename` (method + its call site) — it only compensated for the path change.
- [x] 2.4 Remove only the rename-flow *call* to `migratePin` (done in 2.2). Leave the `migratePin` function in `apps/chat-api/src/user-config/user-config.service.ts` and its tests untouched — do not delete the function itself.

## 3. Backend: display-title resolution

- [x] 3.1 In `resolveListDisplayTitle` (`conversation.service.ts`), change the logic so that when `llmNamingDone === true` and `name` is non-empty, the stored `name` is returned regardless of the filename-derived title. Keep the existing branches for empty `name` (→ filename title) and `name === pathTitle`. Remove the message-derived-title comparison that returned the filename title for a diverging authoritative `name`.

## 4. Backend: tests

- [x] 4.1 Update `apps/chat-api/src/conversations/tests/conversation.service.spec.ts` rename tests: assert no `moveResource` call, `saveConversation` called at the same path with `name` + `llmNamingDone: true`, return value `{ name }`, id unchanged, and 404 when the source is missing. Remove assertions about `migratePin` / `syncStoredDisplayNameAfterPathRename` in the rename flow.
- [x] 4.2 Add/adjust `resolveListDisplayTitle` unit coverage: LLM-renamed title, manually-renamed title with diverging filename, unnamed conversation falls back to filename title.
- [x] 4.3 Update the `ConversationController` e2e/integration test: PATCH 200 returns `{ name }` with unchanged path, 400 empty `newTitle`, 400 missing `path`, 404 missing conversation.
- [x] 4.4 Update naming-service specs if needed to cover: a manually-renamed conversation (`llmNamingDone: true`) is skipped by `maybeRenameAfterFirstReply`. (Covered by the existing generic `llmNamingDone: true` skip test — manual rename sets the same flag, no new mechanism needed.)
- [x] 4.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` until green.

## 5. OpenAPI client regeneration

- [x] 5.1 Run `npm run openapi` and `npm run openapi:check`; confirm the `renameConversation` response schema changes to `{ name }`.
- [x] 5.2 Build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`). Do not hand-edit generated files.

## 6. Frontend: server-api wrapper and context

- [x] 6.1 In `apps/chat/src/server-api/conversations.api.ts`, update the `renameConversation` wrapper to reflect the new `{ name }` response type. (No explicit return type annotation — flows through automatically from the regenerated `@epam/chat-api-client` types; no source change needed.)
- [x] 6.2 In `apps/chat/src/context/ConversationsContext.tsx`, rewrite `renameConversation(id, newTitle)`: keep the optimistic `title` update; call the API with the path derived from `id`; on success reconcile `title` from the returned `name` and leave `id` unchanged; on failure revert and re-throw. Remove the `id`-swap (`{ ...c, id: newPath }`). (No pin unpin-old/pin-new logic existed in the current implementation — nothing to remove there.) Update the interface signature and doc-comment (now returns `Promise<void>`).

## 7. Frontend: panel view

- [x] 7.1 In `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, update `handleConfirmRename` to stop navigating after a successful rename (remove the `navigate(getConversationRoute(newPath))` branch and the `panelActiveConversationId` → `newPath` derivation used only for rename). Leave the duplicate-action navigation untouched.

## 8. Frontend: tests

- [x] 8.1 Update `ConversationsContext` tests: optimistic update, revert on failure, `id` unchanged on success, `title` reconciled from `name`, no pin API calls on rename. (No prior rename coverage existed — added new tests.)
- [x] 8.2 Update `ConversationPanelView` tests: confirming a rename does not navigate; rename action still opens the popup with the current title. (No prior rename coverage existed — upgraded the `RenameConversationPopup` mock to be interactive and added new tests.)
- [x] 8.3 Run `npm exec nx test chat` (affected rename tests) and `npm exec nx lint chat` until green. (`nx test chat` / `nx lint chat` are currently blocked repo-wide by a pre-existing, unrelated build failure in `libs/catalog` — `@epam/ai-dial-kit` module not found. Verified instead via direct `vitest run` on the affected spec files, and `eslint` directly on the changed files — both clean.)

## 9. Docs and verification

- [x] 9.1 If conversation id / rename behavior is documented in `docs/`, update it (and any affected diagram) to state that manual rename preserves `conversation.id` and updates only `name`. (Searched `docs/` for `conversation.id`, `moveResource`, `rename` — no matches; this behavior is not documented there. No changes needed.)
- [x] 9.2 Full affected verification: `npm exec nx affected --target=test,lint,build --base=origin/development-1.0`. (`nx affected --target=test --base=origin/development-1.0` lists 7 affected projects: `@epam/chat-api`, `@epam/chat`, `chat-api-client`, `@epam/ai-dial-conversation-input`, `@epam/ai-dial-conversation-messages`, `@epam/ai-dial-conversation-stages`, `@epam/ai-dial-source-panel`. `@epam/chat-api` and `chat-api-client` pass test+lint+build fully. `@epam/chat` and the remaining libs cannot complete via `nx` because their build graph transitively depends on `@epam/ai-dial-conversation-panel`, `@epam/ai-dial-conversation-input`, and `@epam/ai-dial-catalog`, all of which fail to build on a **pre-existing, unrelated** missing dependency — `@epam/ai-dial-kit` is referenced in `package.json` but not present in `node_modules`. Confirmed pre-existing by stashing this change's diff and reproducing the identical `nx build ai-dial-conversation-input` failure on unmodified `development-1.0`. Verified `@epam/chat`'s actually-changed files directly instead: `eslint` on all 5 changed/added files (clean) and `vitest run` on both changed spec files (27/27 tests pass) — see 8.3.)
- [ ] 9.3 Manual smoke test: rename a conversation (pinned and unpinned; before and after first reply); confirm the URL/id is unchanged, the title updates in the list and header, the pin persists across refresh, and a later LLM naming pass does not overwrite the manual title.

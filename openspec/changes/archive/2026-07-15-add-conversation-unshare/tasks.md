## 1. Backend: widen discard validation

- [x] 1.1 Widen `CATALOG_RESOURCE_PATH_PATTERN` in `apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts` to also allow a `conversations/` prefix; update its `@ApiProperty` description/example if helpful.
- [x] 1.2 Update `ShareController`'s `@ApiOperation` description for the discard endpoint to mention conversations.
- [x] 1.3 Add/extend `apps/chat-api/src/share/tests/share.controller.spec.ts` and `share.service.spec.ts` `discard`/`discardShared` blocks with cases for a valid `conversations/...` itemId (accepted) and an invalid conversation-shaped itemId (traversal, missing segments — still 400).
- [x] 1.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 2. OpenAPI / generated client

- [x] 2.1 Run `npm run openapi` to regenerate the OpenAPI spec and `npm run openapi:check` to verify it's committed correctly.
- [x] 2.2 Build/lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`) and confirm `discardSharedCatalogItem`'s generated signature is unchanged (no new operation, no DTO shape change).

## 3. i18n keys

- [x] 3.1 Add `UnshareLabel`, `UnshareConfirmTitle`, `UnshareConfirmMessage`, `UnshareSuccessTitle`, `UnshareSuccess`, `UnshareErrorTitle`, `UnshareError` to `ConversationPanelI18nKeys` in `apps/chat/src/constants/translation-keys.ts` under a `conversationPanel.unshare.*` key namespace.
- [x] 3.2 Add the matching English strings to `apps/chat/src/i18n/locales/en.json` under `conversationPanel.unshare`.

## 4. Frontend: ConversationPanelView unshare flow

- [x] 4.1 Add `pendingUnshareId`, `isUnsharing`, `unshareError` state to `ConversationPanelView`, mirroring the existing `pendingDeleteId`/`isDeleting`/`deleteError` triplet.
- [x] 4.2 In `getActions`, branch on `rawItem?.sharedWithMe` (independent of the existing `isReadonlyItem` branch) to append a Delete `DropdownItem` (`IconTrashX`, `t(ConversationPanelI18nKeys.UnshareLabel)`) that calls `setPendingUnshareId(contextId)`, for shared-with-me rows only.
- [x] 4.3 Compute `pendingUnshareTitle` from `items` the same way `pendingDeleteTitle` is derived.
- [x] 4.4 Implement `handleConfirmUnshare`: call `discardSharedCatalogItem(pendingUnshareId)` (import from `apps/chat/src/server-api/share.api.ts`), then `refreshConversations()` (swallow its rejection per the "refresh failure after success" spec requirement), show success notification, close popup, and `navigate(ROUTES.Root)` if `conversationIdsMatch` matches `panelActiveConversationId`. On a rejected discard call, set `unshareError` and keep the popup open; do not call `refreshConversations()` or navigate.
- [x] 4.5 Implement `handleCloseUnshareDialog` (no-op while `isUnsharing`, otherwise clear `pendingUnshareId`/`unshareError`).
- [x] 4.6 Render a second `DialConfirmationPopup` for the unshare confirmation with the copy/props specified in `conversation-unshare-flow/spec.md`.
- [x] 4.7 Verify `getActions`'s `useCallback` dependency array includes any newly referenced values (`refreshConversations`, `panelActiveConversationId`'s existing dependency already covers navigation; add `discardSharedCatalogItem`'s import doesn't need to be in deps since it's a module-level function).

## 5. Frontend tests

- [x] 5.1 Add a `describe('ConversationPanelView — unshare (shared-with-me delete)', ...)` block to `apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx` per the scenarios listed in `conversation-unshare-flow/spec.md`'s "Tests" requirement.
- [x] 5.2 Run `npm exec nx test chat` (or the project's scoped test target) and fix any failures.
- [x] 5.3 Run `npm exec nx lint chat`.

## 6. Verification

- [ ] 6.1 Manually verify in the running app: a shared-with-me conversation row shows Delete; confirming it removes the row and (if it was open) navigates to root; cancel/Escape leave it untouched; a forced failure (e.g. stub a 403) keeps the row and shows the error.
- [ ] 6.2 Verify RTL: open the app with `dir="rtl"` and confirm the menu item position and icon are unaffected.
- [x] 6.3 Run the `code-review-and-quality` five-axis review before merge.

## 7. OpenSpec archive

- [ ] 7.1 Once merged, run `/opsx:archive` (or the archive skill) to fold `catalog-unshare`'s delta and the two new capability specs into `openspec/specs/`.

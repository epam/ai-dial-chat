Slicing: one extraction per slice. After each slice, `ConversationPanelView.spec.tsx` and `ConversationPanelViewSidebar.spec.tsx` pass unedited, and ESLint on `apps/chat/src/components/ConversationPanel` and `apps/chat/src/hooks/conversation-panel` is clean. Branch: `refactor/split-conversation-views`.

Per-slice verification: `npm run test:file -- apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx apps/chat/src/components/ConversationPanel/tests/ConversationPanelViewSidebar.spec.tsx`

## 1. Baseline

- [x] 1.1 Record the line count of `ConversationPanelView.tsx`, the `it` count of both specs, and the server-api imports.

## 2. Transfer

- [x] 2.1 `hooks/conversation-panel/useConversationTransfer.ts`: move the following verbatim (design D1–D3):
  - `classifyTransferError`, `resolveErrorTraceId`, `normalizeConversationPath`;
  - the export and import toasts;
  - `useConversationExport` and `useConversationImport`;
  - `handleExportAll`, `handleFileSelected`, `useImportFilePicker`;
  - the queue titles, labels and items.

## 3. Dialogs

- [x] 3.1 `hooks/conversation-panel/useConversationEditDialogs.ts`: the delete and rename dialogs, `pendingDeleteTitle`, `renameLabels`, and their confirm, close and AI-rename handlers.
- [x] 3.2 `hooks/conversation-panel/useConversationSharingDialogs.ts`:
  - the unshare, revoke and unpublish dialogs;
  - `selectedUnpublishFolder`, the share and publish state;
  - `useShareRecipientsCount`, `useConversationPublishHistory`, `usePublishErrorNotification`;
  - the pending titles, `publishPanelHistory`, `unpublishFolders`;
  - their confirm and close handlers.

  The view no longer imports `share.api` or `conversation-publish.api`.

## 4. Row actions

- [x] 4.1 `hooks/conversation-panel/useConversationRowActions.tsx`: move `panelActiveConversationIdRef` and its effect, `rowActionsTriggerRef`, `handleMoveConversation`, `handleActionMenuOpen` and `getActions`, with the same dependency arrays (spec requirement 2).

## 5. Overlays

- [x] 5.1 `components/ConversationPanel/ConversationPanelOverlays.tsx`: move the `overlays` JSX and the lazy `PublishConversationPanelContainer`. The view keeps `createPortal(<ConversationPanelOverlays …/>, document.body)`.

## 6. Close

- [x] 6.1 Confirm the line counts and the absence of server-api imports in the view. Each module has a JSDoc summary. Actual: the view has 437 lines (was 1697) and no server-api import. `ConversationPanelOverlays` has 349, `useConversationTransfer` 308, `useConversationEditDialogs` 157, `useConversationSharingDialogs` 313 and `useConversationRowActions` 575. The last is over the 450 cap: about 360 lines are `getActions` moved verbatim and about 70 are its typed parameter list. Shrinking it means reshaping `getActions`, which is a non-goal.
- [x] 6.2 Confirm both specs are unedited and the `it` counts match the baseline. Both are unedited, with 124 and 15 `it` cases. The vitest run reports 149 tests before and after.
- [x] 6.3 `nx run-many -t test lint build typecheck -p @epam/chat` passes, pinned to the worktree. `npm run validate:docs` and `npm run validate:specs` pass. Results: lint (0 errors) and build pass. `@epam/chat:typecheck` in Nx is a no-op: it echoes that the target is disabled, because `apps/chat/tsconfig.spec.json` sets `noEmit`. This is true on `development` too. Types were therefore checked with `tsc -p apps/chat/tsconfig.app.json --noEmit` run directly. It reports no error in any file this change touches. The 72 remaining errors are in untouched files and in libs that the worktree resolves through the junctioned `node_modules`. That direct run found one real error in this change, which is now fixed: `useConversationRowActions` typed `selectedItemId` as `string | undefined`, while the deployments context gives `string | null`. In the full test run, 4111 of 4113 passed. The two failures were `CelebrationHost.integration.spec.tsx` and `ConversationMessageItem.spec.tsx`, which this change does not touch. Both pass when run alone (102 of 102), so they are load flakes. The validators pass.
- [ ] 6.4 Run `npm run verify:full` once.

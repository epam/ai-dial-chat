## 1. Slice 1 — Import/Export Queue UI

- [x] 1.1 Move `ConversationTransferJobStatus`, `ConversationTransferSubjectKind`,
  `ConversationTransferSubject`, `ConversationTransferJob` from
  `libs/chat-hooks/src/conversation/conversation-transfer/types.ts` to
  `libs/chat-shared/src/models/conversation-transfer.ts` (or equivalent); export from
  `libs/chat-shared/src/index.ts`.
- [x] 1.2 Replace the moved declarations in `libs/chat-hooks` with re-exports from
  `@epam/ai-dial-chat-shared`; keep `libs/chat-hooks/src/index.ts`'s barrel exporting the same names.
- [x] 1.3 Update `libs/chat-hooks/src/conversation/conversation-transfer/queue.ts` and
  `useConversationExport`/`useConversationImport` imports to the new type location; run
  `npm exec nx test chat-hooks` to confirm no behavior change.
- [x] 1.4 Create `libs/conversation-panel/src/components/ImportExportQueue/ImportExportQueue.tsx`
  (and its `models/import-export-queue-props.ts` or equivalent for
  `ImportExportQueueProps`/`ImportExportQueueLabels`), porting the current
  `apps/chat/src/components/ImportExportQueue/ImportExportQueue.tsx` logic — auto-close timer,
  close-confirmation, progress calculation, collapse/expand, per-status trailing slot — replacing every
  `t()` call with a `labels.*` field per `conversation-panel-transfer-queue-ui`.
- [x] 1.5 Export `ImportExportQueue`, `ImportExportQueueProps`, `ImportExportQueueLabels` from
  `libs/conversation-panel/src/index.ts`.
- [x] 1.6 Move `apps/chat/src/components/ImportExportQueue/tests/ImportExportQueue.spec.tsx` to
  `libs/conversation-panel`'s test conventions, adapting mocks to the new `labels`-prop API; verify every
  scenario in `conversation-panel-transfer-queue-ui` passes.
- [x] 1.7 Update `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` to import
  `ImportExportQueue` from `@epam/ai-dial-conversation-panel`, build the `labels` object via
  `useTranslation`, and delete the old app-level component file.
- [x] 1.8 Add a thin app-level wiring test asserting the real component renders with translated labels
  and is wired to `useConversationExport`/`useConversationImport`.
- [x] 1.9 Update `libs/conversation-panel/README.md` and `libs/chat-hooks/README.md` for the new/changed
  exports; run `npm run validate:docs`.
- [x] 1.10 Verify: `npm exec nx affected --target=lint,test,build --base=origin/development` covers
  `conversation-panel`, `chat-hooks`, `chat-shared`, `chat`.

## 2. Slice 2 — Rename Conversation Popup UI

- [x] 2.1 Move `sanitizeConversationName` and `stripTrailingDots` from
  `libs/chat-hooks/src/shared/string-utils.ts` to `libs/chat-shared/src/utils/string-utils.ts`; delete
  the duplicate `getUtf8ByteLength` from `chat-hooks` and re-export the `chat-shared` one instead.
- [x] 2.2 Update `libs/chat-hooks/src/shared/string-utils.ts` to re-export
  `sanitizeConversationName`/`stripTrailingDots`/`getUtf8ByteLength` from `@epam/ai-dial-chat-shared`;
  confirm `libs/chat-hooks/src/index.ts`'s barrel still exposes the same names.
- [x] 2.3 Create `libs/conversation-panel/src/components/RenameConversationPopup/RenameConversationPopup.tsx`
  (with `RenameConversationPopupProps`/`RenameConversationPopupLabels`), porting
  `apps/chat/src/components/RenameConversationPopup/RenameConversationPopup.tsx`'s logic — validation,
  sanitization-on-type, AI-generation guard/spinner/error, save/cancel, Enter-to-save — replacing every
  `t()` call with a `labels.*` field per `conversation-panel-rename-popup-ui`.
- [x] 2.4 Export `RenameConversationPopup`, `RenameConversationPopupProps`,
  `RenameConversationPopupLabels` from `libs/conversation-panel/src/index.ts`.
- [x] 2.5 Move `apps/chat/src/components/RenameConversationPopup/tests/RenameConversationPopup.spec.tsx`
  to `libs/conversation-panel`'s test conventions; verify every scenario in
  `conversation-panel-rename-popup-ui` passes.
- [x] 2.6 Update `ConversationPanelView.tsx` to import `RenameConversationPopup` from
  `@epam/ai-dial-conversation-panel`, build the `labels` object via `useTranslation`, wire
  `onGenerateWithAi` to `generateConversationTitle`, and delete the old app-level component file.
- [x] 2.7 Add a thin app-level wiring test for the rename popup's real save/AI-generation wiring.
- [x] 2.8 Update `libs/conversation-panel/README.md`, `libs/chat-hooks/README.md`,
  `libs/chat-shared/README.md`; run `npm run validate:docs`.
- [x] 2.9 Verify: `npm exec nx affected --target=lint,test,build --base=origin/development`.

## 3. Slice 3 — Prompts, Skills, and Favorites state hooks

- [x] 3.1 Add `usePromptsState` to `libs/chat-hooks/src/prompt/` (or a new `usePromptsState/` folder per
  the hook-folder-naming convention), matching `chat-hooks-prompts-state`'s contract; port
  `PromptsContext.tsx`'s fetch/cancellation/refetch logic unchanged.
- [x] 3.2 Refactor `apps/chat/src/context/PromptsContext.tsx` to call `usePromptsState({ listPrompts })`
  and expose the result through the unchanged `PromptsContextType`; adapt
  `apps/chat/src/context/tests/PromptsContext.spec.tsx` as needed (mock target may move from
  `listPrompts` module mock to the same mock, verify still passes).
- [x] 3.3 Add a `usePromptsState` unit test suite in `libs/chat-hooks` covering
  `chat-hooks-prompts-state`'s scenarios.
- [x] 3.4 Add `FavoriteEntityType` and `useFavoriteEntitiesState` to `libs/chat-hooks/src/`, matching
  `chat-hooks-favorites-state`'s contract; port `FavoriteApplicationsContext.tsx`'s
  load/optimistic-toggle/rollback logic unchanged.
- [x] 3.5 Refactor `apps/chat/src/context/FavoriteApplicationsContext.tsx` to compute `loadFavorites`
  (wrapping `getUserConfig`) and `updateFavorite` (the existing `INSTALL_BY_ENTITY_TYPE` dispatch), call
  `useFavoriteEntitiesState`, and expose the result through the unchanged
  `FavoriteApplicationsContextType`; keep `FavoriteEntityType` re-exported from the app module if any
  consumer imports it from there today.
- [x] 3.6 Add a `useFavoriteEntitiesState` unit test suite in `libs/chat-hooks` covering
  `chat-hooks-favorites-state`'s scenarios; adapt
  `apps/chat/src/context/tests/FavoriteApplicationsContext.spec.tsx`.
- [x] 3.7 Add `useSkillsState` to `libs/chat-hooks/src/skill/`, matching `chat-hooks-skills-state`'s
  contract (accepting `enabled`/`ready`), including `mergeSharedSkill`; port `SkillsContext.tsx`'s
  gated-fetch logic unchanged, with no `OverlayFeature`/`useUiFeature`/`UserContext` import.
- [x] 3.8 Refactor `apps/chat/src/context/SkillsContext.tsx` to compute
  `enabled = useUiFeature(OverlayFeature.Skills)` and
  `ready = useUser().status !== AuthStatus.Loading`, call `useSkillsState`, and expose the result
  through the unchanged `SkillsContextType`.
- [x] 3.9 Add a `useSkillsState` unit test suite in `libs/chat-hooks` covering
  `chat-hooks-skills-state`'s scenarios; adapt `apps/chat/src/context/tests/SkillsContext.spec.tsx`.
- [x] 3.10 Verify `apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx` and every other consumer
  listed in the design (`CatalogView`, `usePromptSelectorOverlay`, `PromptEditor`, `SkillEditor`,
  `useSkillArchiveImport`, `useDeploymentSelectorOverlay`, `useDeploymentSelectorFieldOverlay`) still
  compile and pass unchanged.
- [x] 3.11 Update `libs/chat-hooks/README.md`; run `npm run validate:docs`.
- [x] 3.12 Verify: `npm exec nx affected --target=lint,test,build --base=origin/development`.

## 4. Slice 4 — ConversationPanelView controller hooks and utilities

- [x] 4.1 Add `getConversationSource` and `useConversationPanelItems` to `libs/chat-hooks/src/conversation/`
  per `chat-hooks-conversation-panel-controller`; port the DTO→`ConversationItem` mapping logic from
  `ConversationPanelView.tsx` and `get-conversation-source.ts`, injecting `resolveIconUrl`/
  `resolveIconTooltip`/`resolveHref`/`resolveTaskBadge`; place the canonical `FilterTab` enum in
  `chat-shared` and re-export it from `conversation-panel` so all consumers use one contract identity.
- [x] 4.2 Add `useConversationLookupMaps` to `libs/chat-hooks`, replacing the inlined
  `panelToContextId`/raw-item lookups in `ConversationPanelView.tsx`.
- [x] 4.3 Add `useActiveConversationSync` to `libs/chat-hooks`, porting the two active-conversation
  effects with their dependency-array rationale preserved in JSDoc.
- [x] 4.4 Add `useAsyncConfirmDialog<T>` to `libs/chat-hooks`; replace the delete, unshare, revoke,
  rename, and unpublish pending/loading/error triads in `ConversationPanelView.tsx`, and the delete-all
  triad in `ConversationPanelMenu.tsx`, with instances of this hook, keeping each call site's
  domain-specific success/navigation/notification logic in the app layer.
- [x] 4.5 Add `deriveConversationRowActionState` to `libs/chat-hooks`; extract the readonly/publish/
  unpublish/revoke decision logic out of `getActions` in `ConversationPanelView.tsx`, keeping
  `DropdownItem`/icon/label construction and `t()` calls in the app.
- [x] 4.6 Add `useImportFilePicker` to `libs/chat-hooks`; replace the hidden `<input type="file">`
  ref/handler logic in `ConversationPanelView.tsx`, keeping the `IMPORT_FILE_ACCEPT`/mobile-accept
  decision in the app.
- [x] 4.7 After each of 4.1–4.6, re-run `apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`
  and the `ConversationPanelMenu` tests before moving to the next extraction, per the design's
  migration-plan verification order.
- [x] 4.8 Add unit test suites in `libs/chat-hooks` for each new hook/utility, covering every scenario in
  `chat-hooks-conversation-panel-controller`.
- [x] 4.9 Confirm `libs/chat-hooks` gains no new dependency on `@epam/ai-dial-conversation-panel`
  (`FilterTab` comes from `chat-shared` and `ConversationItem` remains structurally compatible); confirm
  `libs/conversation-panel` gains no new dependency on `@epam/ai-dial-chat-hooks`.
- [x] 4.10 Update `libs/chat-hooks/README.md` and `docs/architecture.md` for the new controller-hook
  exports; run `npm run validate:docs`.
- [x] 4.11 Verify: `npm exec nx affected --target=lint,test,build --base=origin/development`.

## 5. Slice 5 — Deployment limits mapping utility

- [x] 5.1 Add `DeploymentLimitsLabels` and `mapDeploymentLimitsDtoToCatalogLimits` to
  `libs/chat-hooks/src/catalog/` (or an equivalent existing catalog-domain folder), porting the stat
  filtering, display-order, currency/number formatting, and unlimited-total logic from
  `apps/chat/src/utils/map-deployment-limits-to-catalog.ts` unchanged, replacing the `TFunction`/
  `CatalogI18nKeys` parameter with the injected `labels` object and its two formatter callbacks per
  `chat-hooks-deployment-limits-mapping`.
- [x] 5.2 Export `mapDeploymentLimitsDtoToCatalogLimits` and `DeploymentLimitsLabels` from
  `libs/chat-hooks/src/index.ts`.
- [x] 5.3 Move `apps/chat/src/utils/tests/map-deployment-limits-to-catalog.spec.ts` to `libs/chat-hooks`'s
  test conventions, replacing the mocked `TFunction` with a literal `DeploymentLimitsLabels` object;
  verify every scenario in `chat-hooks-deployment-limits-mapping` passes.
- [x] 5.4 Update `apps/chat/src/components/CatalogView/CatalogView.tsx` to build a
  `DeploymentLimitsLabels` object via `useTranslation` (mapping each `CatalogI18nKeys` entry to its
  flat field, wrapping `DetailsLimitsValue`/`DetailsLimitsProgressAriaLabel` in the two formatter
  callbacks) and call the relocated function from `@epam/ai-dial-chat-hooks`.
- [x] 5.5 Delete `apps/chat/src/utils/map-deployment-limits-to-catalog.ts` and its old test file.
- [x] 5.6 Update `libs/chat-hooks/README.md`; run `npm run validate:docs`.
- [x] 5.7 Verify: `npm exec nx affected --target=lint,test,build --base=origin/development` covers
  `chat-hooks` and `chat`.

## 6. Final verification

- [x] 6.1 Run the full affected suite once more from a clean `development` diff:
  `npm exec nx affected --target=lint,test,build,typecheck --base=origin/development`.
- [x] 6.2 Confirm the dependency graph (`npm run graph`) shows `conversation-panel → chat-shared` and
  `chat-hooks → chat-shared` with no `conversation-panel → chat-hooks` edge, matching the design's
  dependency-graph decision.
- [x] 6.3 Confirm no deep-import regression: grep the repo for
  `chat-hooks/src/conversation/conversation-transfer/types` and `chat-hooks/src/shared/string-utils`
  outside `libs/chat-hooks` itself to ensure nothing bypassed the barrel re-exports.
- [x] 6.4 Review `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`'s resulting line
  count and responsibility list against the design's before/after expectations; confirm routing, i18n,
  feature flags, contexts, and publish/share policy all remain in the app.
- [x] 6.5 Confirm `apps/chat/src/utils/map-deployment-limits-to-catalog.ts` no longer exists and
  `CatalogView.tsx` imports the mapping function from `@epam/ai-dial-chat-hooks`.

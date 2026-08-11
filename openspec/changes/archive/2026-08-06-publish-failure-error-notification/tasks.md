## 1. Surface the rejection reason out of the publish flow hook

- [x] 1.1 Add `onPublishError?: (item, folderPath, error: unknown) => void` to `UsePublishFlowOptions` in `libs/publish-panel/src/utils/use-publish-flow.ts`, with JSDoc stating the host owns the notification and the hook only sets `hasSubmitError`.
- [x] 1.2 Bind the rejection in `handleSubmit`'s `catch (error)`, call `onPublishError`, and add it to the `useCallback` dependency list.
- [x] 1.3 Update the `usePublishFlow` example in `libs/publish-panel/README.md` to show the `onPublishSuccess`/`onPublishError` pair.
- [x] 1.4 Tests: `onPublishError` receives `(item, folderPath, rejection)` on failure and is not called on success (`use-publish-flow.spec.ts`).

## 2. Thread the callback through the catalog library

- [x] 2.1 Add `onPublishError` to `CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) and `DetailsPanelProps` (`libs/catalog/src/models/item-details-props.ts`).
- [x] 2.2 Forward it in `Catalog.tsx` and pass it to `usePublishFlow` in `DetailsPanel.tsx`.
- [x] 2.3 Test: `DetailsPanel` forwards the rejection reason to `onPublishError` (`DetailsPanel.spec.tsx`).

## 3. Shared error notification in the app

- [x] 3.1 Add `PublishI18nKeys` (`publish.failedTitle`, `publish.failedMessage`, `publish.networkErrorMessage`, `publish.submitErrorCallout`) to `apps/chat/src/constants/translation-keys.ts` and the matching `publish` block to `apps/chat/src/i18n/locales/en.json`.
- [x] 3.2 Add `apps/chat/src/hooks/publish/usePublishErrorNotification.ts`: error-variant notification, `requestId` from `getApiErrorDetails`, offline branch using `navigator.onLine` with connection-specific copy and no `requestId`, plus `console.error` for diagnostics.
- [x] 3.3 Tests for the hook: offline copy without `requestId`, backend error with the trace ID extracted from `traceparent`, error without a trace ID, and the diagnostic log.

## 4. Wire both publish hosts

- [x] 4.1 `PublishConversationPanelContainer`: call `usePublishErrorNotification`, pass `onPublishError`, and pass `panelLabels.submitError` from `PublishI18nKeys.SubmitErrorCallout`.
- [x] 4.2 `CatalogView`: memoized `handlePublishError`, pass `onPublishError` to `Catalog`, and add `submitError` to `publishLabels`.
- [x] 4.3 Update `PublishConversationPanelContainer.spec.tsx`'s failure test: panel stays open, inline callout shown, `onClose` not called, and the error handler receives the rejection.

## 5. Verification

- [x] 5.1 `npx vitest run` in `libs/publish-panel` (178 tests), `libs/catalog` `DetailsPanel.spec.tsx` (32), `apps/chat` `src/hooks/publish` + `PublishConversationPanelContainer` (20) and `src/components/CatalogView` (52) all pass. Note: `npm exec nx test @epam/ai-dial-publish-panel` fails to collect any suite in this environment — reproduced on a clean tree, so it is unrelated to this change.
- [x] 5.2 `npx eslint` clean on every touched path.
- [x] 5.3 `npm exec nx run-many -t typecheck -p @epam/ai-dial-publish-panel @epam/ai-dial-catalog @epam/chat` passes.

## 6. Follow-ups (not in this change)

- [ ] 6.1 A failed `onCreateFolder` sets `hasSubmitError`, so a folder-creation failure renders the "Publishing failed" callout. Give folder creation its own error state and message.
- [ ] 6.2 `PublishPanelLabels.noAccessError` is still on the library's hardcoded English default at both call sites; route it through i18n.

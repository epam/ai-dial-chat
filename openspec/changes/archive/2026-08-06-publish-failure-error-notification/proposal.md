## Why

When a publish request fails, the user gets almost no feedback ([GitHub issue #7898](https://github.com/epam/ai-dial-chat/issues/7898)). `usePublishFlow.handleSubmit` catches the rejection with a bindingless `catch {}`, discards the error entirely, and only flips `hasSubmitError`. The single resulting signal is an inline section-message callout inside the panel, rendered from the library's **hardcoded English** default (`'Publishing failed. Please try again.'`) because neither host passed `PublishPanelLabels.submitError`. Nothing is logged, no trace ID is surfaced, and no notification appears — so a publish that fails while the connection is down looks to the user like a button that simply did nothing.

Every other failing operation in the app (export, import, unshare, file upload) surfaces an error notification via `NotificationContext`, and `conversation-publish-flow` already specs the success half of this pair.

## What Changes

- `usePublishFlow` binds the rejection reason and reports it through a new optional `onPublishError?: (item, folderPath, error) => void` option — the symmetric counterpart of the existing `onPublishSuccess`. The library still shows no notification itself (no i18n in libs); it only hands the error to the host.
- `libs/catalog` threads `onPublishError` from `CatalogProps` → `Catalog` → `DetailsPanel` → `usePublishFlow`, the same way `onPublishSuccess` already flows.
- A new shared `usePublishErrorNotification` hook (`apps/chat/src/hooks/publish/`) turns a rejected publish into an error notification: title + message from i18n, plus `requestId` resolved from the response's `traceparent` via the existing `getApiErrorDetails`, matching `useConversationExport`'s established pattern. It logs the error to `console.error` for diagnostics.
- An offline failure (`navigator.onLine === false`) gets connection-specific copy and no `requestId`, because the request never reached the backend so no trace ID exists — mirroring the attachment-upload network-error notification.
- Both publish hosts wire the hook: `PublishConversationPanelContainer` and `CatalogView`.
- Both hosts now also pass a translated `PublishPanelLabels.submitError`, so the inline callout stops rendering the library's hardcoded English default.
- New shared `publish.*` i18n namespace (`PublishI18nKeys`) with `failedTitle`, `failedMessage`, `networkErrorMessage`, and `submitErrorCallout` — shared rather than duplicated per host, per the project's duplicate-value convention.
- The panel still stays open on failure and the inline callout is still shown; the notification is additive, not a replacement.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `conversation-publish-flow`: a failed publish now shows an error notification in addition to keeping the panel open with the inline callout. This reverses the previous explicit "no notification SHALL occur" clause, which is the defect reported in #7898.
- `catalog-publish-flow`: the catalog publish host surfaces the same failure notification through `onPublishError`.
- `publish-panel-library`: `UsePublishFlowOptions` gains `onPublishError`, and the library no longer discards the rejection reason.

## Impact

- `libs/publish-panel/src/utils/use-publish-flow.ts` — new `onPublishError` option; `catch` now binds the error.
- `libs/publish-panel/README.md` — `usePublishFlow` example shows the success/error callback pair.
- `libs/catalog/src/models/catalog-props.ts`, `libs/catalog/src/models/item-details-props.ts`, `libs/catalog/src/components/Catalog/Catalog.tsx`, `libs/catalog/src/components/Details/DetailsPanel.tsx` — `onPublishError` threaded through.
- `apps/chat/src/hooks/publish/usePublishErrorNotification.ts` — new hook.
- `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`, `apps/chat/src/components/CatalogView/CatalogView.tsx` — wire `onPublishError` and the translated `submitError` callout label.
- `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json` — new `publish.*` namespace.
- Tests: `libs/publish-panel/src/utils/use-publish-flow.spec.ts`, `libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx`, `apps/chat/src/components/PublishConversationPanelContainer/tests/PublishConversationPanelContainer.spec.tsx`, new `apps/chat/src/hooks/publish/tests/usePublishErrorNotification.spec.ts`.
- No backend change. `conversation-publish-api` and `catalog-publish-api` contracts are untouched.

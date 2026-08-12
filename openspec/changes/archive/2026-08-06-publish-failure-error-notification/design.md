## Context

`usePublishFlow.handleSubmit` (`libs/publish-panel/src/utils/use-publish-flow.ts`) wrapped `onPublish` in `try { … } catch { setHasSubmitError(true); return false; }`. The bindingless `catch` meant the rejection reason — including any server message and the response's `traceparent` header — was unrecoverable by the time the host learned about the failure, and the host only learned about it as a `false` return value.

Both hosts (`PublishConversationPanelContainer`, `CatalogView` via `DetailsPanel`) already pass an `onPublishSuccess` that calls `showNotification`, so the success path had a notification and the failure path did not. The failure path's only signal was `PublishCalloutKind.SubmitError`'s inline callout, whose text came from the library's hardcoded English default because neither host supplied `PublishPanelLabels.submitError`.

## Goals / Non-Goals

**Goals:**

- A failed publish always produces a user-visible notification, including when the failure is a lost connection (the reproduction in #7898).
- The notification carries a `requestId` when the backend responded, so a support request can be correlated (reusing `notification-request-id`'s existing mechanism).
- Keep the library i18n-free and notification-agnostic: it reports the error, the host decides what to show.
- The inline callout text becomes translatable instead of falling back to the library's English default.

**Non-Goals:**

- Retry, queueing, or offline buffering of the publish request. The panel stays open so the user can retry manually.
- Showing the raw server message in the toast. The established pattern (`useConversationExport`) is a translated message plus `requestId`; a raw upstream string is unlocalizable and often unhelpful.
- Fixing the sibling defect where a failed `onCreateFolder` reuses `hasSubmitError` and therefore renders the "Publishing failed" text. That is a separate mislabeling bug, untouched here.
- Translating `PublishPanelLabels.noAccessError`, which is still on its library English default at both call sites.

## Decisions

- **Add `onPublishError` to `usePublishFlow` rather than having each host wrap its own `onPublish` in try/catch/rethrow.** The rethrow variant needs no library change but duplicates the boilerplate in both hosts and makes "rethrow so the hook still sets `hasSubmitError`" a subtle, easily-broken contract. An explicit callback is symmetric with the existing `onPublishSuccess`, discoverable in the props/JSDoc, and testable at the hook level.
- **The callback is fire-and-forget (`=> void`), invoked before `handleSubmit` returns `false`.** The hook does not await the host, so `isSubmitting` clears immediately in `finally` and the submit button never stays in its pending state while the host parses a response body to extract a trace ID.
- **Offline is detected with `navigator.onLine`, not by inspecting the error.** A dropped connection surfaces as a `TypeError: Failed to fetch` with no response attached, which is indistinguishable from several other fetch-layer failures. `useAttachmentUpload` already uses `navigator.onLine` for exactly this decision, so the publish flow follows it. Offline notifications omit `requestId` because no request reached the server.
- **One shared `publish.*` namespace and one shared `usePublishErrorNotification` hook for both hosts,** instead of per-host `conversationPublish.*` / `catalog.*` failure keys. The copy is identical for a conversation and a catalog entity, and the project's duplicate-value convention prefers a single shared key over two identical feature-scoped ones.
- **The notification is additive to the inline callout, not a replacement.** The callout is the in-context explanation next to the destination picker (and carries `role="alert"`); the notification is the out-of-context signal that survives the user having scrolled the panel or looked away. Removing either would leave a gap.

## Risks / Trade-offs

- [Two simultaneous signals for one failure (callout + notification) could read as two separate errors] → Accepted: they use the same wording family, and the callout is scoped inside the panel while the notification is global — the same pairing the app already uses for file-manager operations.
- [`navigator.onLine` reports `true` on a captive portal or a dead upstream] → In that case the user gets the generic failed-message notification with a `requestId` when available, which is still correct, just less specific.
- [`onPublishError` is optional, so a future host could silently reintroduce the defect] → Mitigated by hook-level tests plus per-host tests asserting the handler is wired.

## Migration Plan

- No data migration; ship as a normal frontend change. `onPublishError` is optional, so no existing caller breaks.
- Rollback: dropping the `onPublishError` wiring in the two hosts restores the previous behavior without touching the library.

## Open Questions

- None.

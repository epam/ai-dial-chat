## 1. Backend: trace context in JSON error bodies

- [x] 1.1 Add a shared helper (or export a reusable function from
      `apps/chat-api/src/telemetry/traceparent.middleware.ts`) that reads the active span via
      `trace.getSpan(context.active())` + `isSpanContextValid` and returns the current
      `traceparent` string, so both the header middleware and the new filter use one source of
      truth.
- [x] 1.2 Add a global Nest exception filter (e.g.
      `apps/chat-api/src/common/filters/traceparent-error.filter.ts`) that delegates to
      `HttpException`'s existing status/body (or a generic 500 body for unmapped errors) and
      appends `traceparent` to the JSON body only when a valid active span exists and
      `res.headersSent` is `false`.
- [x] 1.3 Register the filter globally in `apps/chat-api/src/main.ts` alongside the existing
      `app.use(traceparentMiddleware)` registration.
- [x] 1.4 Add/extend tests under `apps/chat-api/src/common/filters/` (or
      `apps/chat-api/src/telemetry/tests/`) proving: `HttpException` responses gain a
      body-`traceparent` equal to the header value; DIAL-mapped errors (via
      `common/dial/dial-error.mapper.ts`) keep their mapped status and gain `traceparent`;
      validation/auth/rate-limit failures gain `traceparent`; excluded/untraced routes and disabled
      telemetry produce no `traceparent` property; successful responses and already-started
      responses are untouched.
- [x] 1.5 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, and
      `npm exec nx build chat-api`; update `apps/chat-api/README.md` if the observability section
      documents the response contract.

## 2. Frontend: normalized API error details

- [x] 2.1 Add a W3C `traceparent` shape validator (version `00`, 32 lowercase-hex trace ID not all
      zero, 16 lowercase-hex span ID not all zero, 2-hex flags) and a trace-ID extractor to
      `apps/chat/src/server-api/api-error.ts`.
- [x] 2.2 Add `getApiErrorDetails(error: unknown): Promise<ApiErrorDetails>` to the same file,
      resolving `{ status?, message, traceId? }` from the JSON body first, then the response
      header, using `response.clone()` so no caller double-consumes the response stream. Keep
      `getApiErrorMessage`/`getApiErrorStatus` exported and working unchanged.
- [x] 2.3 Add unit tests covering: generated-client `ResponseError` with a body `traceparent`;
      raw `base.ts`-shaped error with only a header `traceparent`; malformed/all-zero/truncated
      values rejected without throwing; message resolution order unchanged when no trace ID exists.
- [x] 2.4 Run `npm exec nx test chat` and `npm exec nx lint chat` for this slice.

## 3. Frontend: notification model and rendering

- [x] 3.1 Add `requestId?: string` to `NotificationItem`/`ShowNotificationOptions` in
      `apps/chat/src/context/NotificationContext.tsx`.
- [x] 3.2 Add the i18n keys (`notification.requestId.label`, `.copyAriaLabel`, `.copiedStatus`,
      `.copyFailedStatus`) to `apps/chat/src/i18n/locales/en.json` and the matching enum members in
      `apps/chat/src/constants/translation-keys.ts`; check `ButtonsI18nKeys` first in case a "Copy"
      label already exists to reuse.
- [x] 3.3 In `apps/chat/src/components/Notification/NotificationContainer.tsx`, compose (via
      `useMemo` keyed on `item.message`/`item.requestId`) the Request ID row — label, `dir="ltr"`
      hex value, Copy button — appended to `item.message` only when `item.requestId` is set, and
      pass the composed node into `Notification`'s `message` prop.
- [x] 3.4 Implement the Copy control: `navigator.clipboard.writeText(requestId)` with
      feature-detection, a stable translated `aria-label` on the button, and a separate
      `role="status" aria-live="polite"` region announcing copied/failed feedback.
- [x] 3.5 Change `NotificationEntry`'s auto-dismiss `useEffect` to skip arming the timer when
      `item.requestId` is set, leaving the existing fixed-delay behavior for all other
      notifications unchanged.
- [x] 3.6 Add/update tests in `apps/chat/src/components/Notification/tests/` covering: no
      `requestId` renders unchanged; `requestId` present renders the row with LTR-forced value;
      Copy writes exactly the trace ID and announces success; clipboard failure announces failure
      without dismissing the notification; keyboard activation (`Enter`/`Space`) triggers copy;
      trace-bearing notifications do not auto-dismiss while others still do.
- [x] 3.7 Run `npm exec nx test chat` and `npm exec nx lint chat` for this slice; verify in the
      running app (light/dark, LTR/RTL) via the `run` skill or manual check.

## 4. Frontend: migrate API-failure call sites

- [x] 4.1 Audit and update the existing `showNotification` call sites that report API failures to
      resolve `{ message, traceId }` via `getApiErrorDetails` and pass `requestId: traceId`,
      including: `hooks/useConversationImport.ts`, `hooks/useConversationExport.ts`,
      `hooks/useRequestApiKey/useRequestApiKey.ts`, `hooks/useReportIssue/useReportIssue.ts`,
      `hooks/attachment/useAttachmentValidation.ts`,
      `hooks/conversation/useChatSettingsFormConfig.ts`,
      `components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`,
      `components/CatalogView/CatalogView.tsx`, `components/NewConversationComposer/*`,
      `components/ConversationView/ConversationView.tsx`,
      `components/ConversationPanel/ConversationPanelView.tsx`,
      `components/ConversationPanel/ConversationPanelMenu.tsx`,
      `components/DialFileManagerModal/DialFileManagerModal.tsx`,
      `pages/ToolsetEditor/ToolsetEditor.tsx`, `pages/ToolsetEditor/EditorForm/AuthSection.tsx`,
      `pages/Conversation/Conversation.tsx`, `pages/ConversationRoute/ConversationRoute.tsx`,
      `pages/AppsEditor/AppPreviewChat.tsx`, `pages/ScheduledTaskCreatePage/*`,
      `pages/SharedInvitation/SharedInvitation.tsx`, `context/UserConfigContext.tsx`,
      `context/DeploymentsContext.tsx`.
- [x] 4.2 For call sites that already aggregate multiple failed operations (bulk/batch flows),
      resolve `getApiErrorDetails` only for the first failing operation in existing iteration order
      and pass just that trace ID.
- [x] 4.3 Leave call sites whose errors are purely client-side/validation (no server response)
      without a `requestId`.
- [x] 4.4 Run `npm exec nx test chat` and `npm exec nx lint chat` after the migration; spot-check a
      representative failure (e.g. a forced API error in the running app) end-to-end: response
      header + JSON body carry the same `traceparent`, the notification shows the Request ID, and
      Copy places the exact ID on the clipboard.

## 5. Final verification

- [x] 5.1 Run `npm exec nx affected --target=lint --base=origin/development-1.0`,
      `--target=test`, and `--target=build` for the affected projects (`chat`, `chat-api`).
- [x] 5.2 Confirm WCAG 2.1 AAA checks pass for the new Copy control and status region (focus-visible
      parity, keyboard operability, `aria-live` behavior) and that RTL/Arabic rendering keeps the
      Request ID value LTR.
- [x] 5.3 Run the five-axis code-review-and-quality pass before merge.

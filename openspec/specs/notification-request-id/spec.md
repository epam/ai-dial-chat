# notification-request-id Specification

## Purpose

Carrying a request/trace ID on error notifications, and the copy control that surfaces it accessibly.

## ADDED Requirements

### Requirement: Notification model carries an optional request ID
`NotificationItem` and `ShowNotificationOptions` in
`apps/chat/src/context/NotificationContext.tsx` SHALL gain an optional `requestId?: string` field,
holding the validated 32-hex trace ID resolved via `getApiErrorDetails`. Callers that do not have a
valid trace ID (client-only/validation errors, or any non-error notification) SHALL omit this
field, and existing calls to `showNotification` that don't pass `requestId` SHALL continue to work
unchanged.

#### Scenario: Existing notification calls remain valid
- **WHEN** an existing call site invokes `showNotification({ variant, title, message })` without a
  `requestId`
- **THEN** the notification renders exactly as it did before this change, with no Request ID row

#### Scenario: A failed API call attaches its resolved trace ID
- **WHEN** a call site catches an API error, resolves `{ message, traceId }` via
  `getApiErrorDetails`, and calls `showNotification({ variant: Error, message, requestId: traceId })`
  with a defined `traceId`
- **THEN** the resulting `NotificationItem` carries that `requestId`

### Requirement: Error notifications with a request ID render a Copy row
`apps/chat/src/components/Notification/NotificationContainer.tsx` SHALL render, only when
`item.requestId` is set, a row below the existing message containing: a localized "Request ID"
label, the hexadecimal ID forced to LTR direction regardless of the active locale, and a Copy
button. This row is composed into the `ReactNode` passed to the ui-kit `Notification`'s `message`
prop — no new ui-kit component is introduced. Notifications without `requestId` render exactly as
before (title/message/close only).

i18n keys (added to `apps/chat/src/i18n/locales/en.json` and referenced through
`translation-keys.ts`, not as raw string literals):
- `notification.requestId.label` — "Request ID"
- `notification.requestId.copyAriaLabel` — "Copy request ID"
- `notification.requestId.copiedStatus` — "Request ID copied"
- `notification.requestId.copyFailedStatus` — "Couldn't copy request ID"

RTL/direction impact: the label and Copy button follow normal logical-property layout (`ms-*`/
`me-*`, `text-start`), but the hexadecimal ID itself is rendered with a forced LTR direction
(e.g. `dir="ltr"` on the value span) in both LTR and RTL locales, since a mixed-direction hex string
would otherwise reorder visually in `ar`/other RTL locales. The Copy icon is symmetric and is not
mirrored.

Feature flag: this UI is not gated behind `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` — it renders
automatically whenever a notification carries a `requestId`, matching the always-on trace/log
correlation behavior it surfaces.

#### Scenario: Request ID row renders for a trace-bearing error notification
- **WHEN** an error `NotificationItem` has `requestId` set to a valid 32-hex trace ID
- **THEN** the rendered notification shows "Request ID: <hex value>" and a Copy button below the
  message text

#### Scenario: Request ID renders LTR inside an RTL locale
- **WHEN** the active locale is Arabic (`dir="rtl"` on `<html>`) and a notification has a
  `requestId`
- **THEN** the hexadecimal value is rendered left-to-right and stays visually contiguous, while the
  label position still follows the RTL layout direction

#### Scenario: Request ID value can wrap or truncate without altering the copied value
- **WHEN** the notification renders on a narrow viewport
- **THEN** the visible Request ID text may wrap or be visually truncated, but the value written to
  the clipboard on Copy is always the complete, untruncated trace ID

### Requirement: Copy control writes only the trace ID and confirms accessibly
Activating the Copy control (by pointer or keyboard) SHALL write exactly the 32-hex trace ID to the
clipboard via the Clipboard API — not the label, the error message, or the full `traceparent`. The
Copy button SHALL have a stable, translated `aria-label`
(`notification.requestId.copyAriaLabel`) that does not change on copy; a separate
`role="status" aria-live="polite"` region SHALL announce
`notification.requestId.copiedStatus` on success or
`notification.requestId.copyFailedStatus` on failure, per the repository's `aria-live` pattern for
transient feedback kept apart from a control's stable name.

#### Scenario: Successful copy announces confirmation without a new notification
- **WHEN** the user activates the Copy button and `navigator.clipboard.writeText` resolves
- **THEN** the clipboard contains exactly the 32-hex trace ID
- **AND** the `aria-live` status region announces the copied confirmation
- **AND** no additional `NotificationItem` is created

#### Scenario: Copy is keyboard accessible
- **WHEN** a keyboard-only user tabs to the Copy button and activates it with `Enter` or `Space`
- **THEN** the same clipboard write and accessible confirmation occur as with a pointer click

#### Scenario: Clipboard failure does not dismiss the original notification
- **WHEN** the Clipboard API is unavailable or `writeText` rejects
- **THEN** the `aria-live` status region announces the copy-failed message
- **AND** the original error notification remains visible and unaffected

### Requirement: Trace-bearing error notifications require manual dismissal
`NotificationEntry` SHALL NOT arm its automatic dismiss timer for a notification whose
`requestId` is set; such notifications SHALL be dismissed only via the existing close control
(`closable`, wired to `onClose`/`dismissNotification`). Notifications without a `requestId` SHALL
keep the existing fixed auto-dismiss behavior unchanged.

#### Scenario: Trace-bearing notification does not auto-dismiss
- **WHEN** a `NotificationItem` with `requestId` set is shown
- **THEN** it remains visible indefinitely until the user activates its close control

#### Scenario: Non-trace notifications keep the existing auto-dismiss timing
- **WHEN** a `NotificationItem` without `requestId` is shown
- **THEN** it auto-dismisses after the existing fixed delay, unchanged by this feature

### Requirement: Notification entry composition is memoized
The composed message (base message plus the Request ID row) SHALL be derived with `useMemo`, keyed
on `item.message` and `item.requestId`, so re-renders of the notification list do not rebuild the
composed `ReactNode` for entries whose content hasn't changed.

#### Scenario: Unrelated notification list re-render does not recompute unaffected entries
- **WHEN** a new notification is added to the list
- **THEN** existing `NotificationEntry` instances whose `item.message`/`item.requestId` are
  unchanged do not recompute their composed message node

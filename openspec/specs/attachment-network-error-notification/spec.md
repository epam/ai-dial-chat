# attachment-network-error-notification Specification

## Purpose

Specifies the "Network unavailable" notification shown when attachment uploads fail because the device is offline.

## Requirements

### Requirement: Show "Network unavailable" notification when uploads fail offline

When one or more attachment uploads fail and `navigator.onLine` is `false` at the time of failure, the app SHALL show a single top-center `DialNotification` (variant `Error`) listing all filenames that failed in the same burst (debounced within 100 ms).

The notification SHALL have:
- **title**: i18n key `attachments.networkError.title` → "Network unavailable"
- **message**: i18n key `attachments.networkError.message` — intro text followed by a bulleted list of failed filenames. Long filenames are truncated with ellipsis.

The app SHALL collect failed attachment names in a `useRef` per conversation view instance and flush them via `showNotification` after a 100 ms debounce. Each flush produces exactly one notification; a subsequent offline failure burst creates a new notification.

Failed cards SHALL retain their retry and remove buttons so the user can reattempt once the connection is restored.

The network error path covers both the existing-conversation page (`Conversation.tsx` via `useConversationHandlers`) and the new-conversation page (`ConversationRoute.tsx`).

**i18n keys added:**
- `attachments.networkError.title`
- `attachments.networkError.message`

**Feature flag**: none — always active.

**RTL**: the notification renders inside the existing `NotificationContainer` (top-center portal with `start-1/2 -translate-x-1/2`); no directional changes needed.

**Accessibility**: `DialNotification` already carries `role="alert"` / `aria-live`; no additional ARIA required.

#### Scenario: Single upload fails while offline

- **WHEN** `onUploadAttachment` rejects for one attachment AND `navigator.onLine` is `false`
- **THEN** the attachment card enters `status: RequestStatus.Error` with `errorReason: AttachmentErrorReason.Network`
- **AND** a "Network unavailable" `DialNotification` appears listing that attachment's filename

#### Scenario: Multiple simultaneous uploads fail while offline

- **WHEN** `onUploadAttachment` rejects for three attachments within 100 ms AND `navigator.onLine` is `false`
- **THEN** exactly one "Network unavailable" notification appears listing all three filenames

#### Scenario: Upload fails while online (non-network error)

- **WHEN** `onUploadAttachment` rejects AND `navigator.onLine` is `true`
- **THEN** the attachment card enters `status: RequestStatus.Error` with no `errorReason`
- **AND** no "Network unavailable" notification is shown (existing generic error behaviour)

#### Scenario: Retry succeeds after going back online

- **WHEN** the user activates retry on a card with `errorReason: AttachmentErrorReason.Network`
- **THEN** `onUploadAttachment` is called again for that attachment
- **AND** on success the card transitions to `status: RequestStatus.Idle`

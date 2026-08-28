# attachment-network-error-notification Specification

## Purpose

Specifies the "Network unavailable" notification shown when attachment uploads fail because the device is offline.

## Requirements

### Requirement: Show "Network unavailable" notification when uploads fail offline

When one or more attachment uploads fail and `navigator.onLine` is `false` at the time of failure, the app SHALL show a single top-center error notification listing every filename that failed in the same burst. The burst is coalesced by a debounce owned by the upload hook, defaulting to 700 ms and overridable per host through its `debounceMs` option.

The notification SHALL have:
- **title**: i18n key `attachments.networkError.title` → "Network unavailable"
- **message**: i18n key `attachments.networkError.message` — intro text followed by a bulleted list of failed filenames. Long filenames are truncated with ellipsis.

Collecting and coalescing the failures SHALL be the upload hook's job, not each page's: `useAttachmentUpload` (`libs/chat-hooks`) accumulates the offline filenames in a ref, restarts its debounce timer on every further failure, and then flushes the whole batch to the host through a single `onNetworkError(filenames)` callback. Each flush produces exactly one notification; a subsequent offline failure burst creates a new one.

The hook SHALL also tag the rejected error with `errorReason: AttachmentErrorReason.Network` before re-throwing, so the tile can render its network-specific error state and offer retry. A failure while `navigator.onLine` is `true` SHALL be re-thrown untouched.

The host turns the callback into UI: `buildNetworkUploadErrorNotification(filenames, t)` (`apps/chat/src/utils/attachment-network-error-notification.tsx`) builds the title and the bulleted message, and the page passes it to `showErrorNotification` — the variant-specific helper, never `showNotification` with an explicit variant.

Failed cards SHALL retain their retry and remove buttons so the user can reattempt once the connection is restored.

Every surface that uploads attachments SHALL wire the callback: the existing-conversation page (`Conversation.tsx`), the new-conversation composer (`NewConversationComposer.tsx`), and the Apps-editor preview chat (`AppPreviewChat.tsx`). Each supplies its own `handleNetworkUploadError`, so a surface that mounts its own composer cannot silently drop the notification.

**i18n keys added:**
- `attachments.networkError.title`
- `attachments.networkError.message`

**Feature flag**: none — always active.

**RTL**: the notification renders inside the existing `NotificationContainer` (top-center portal with `start-1/2 -translate-x-1/2`); no directional changes needed.

**Accessibility**: `Notification` already carries `role="alert"` / `aria-live`; no additional ARIA required.

#### Scenario: Single upload fails while offline

- **WHEN** `onUploadAttachment` rejects for one attachment AND `navigator.onLine` is `false`
- **THEN** the attachment card enters `status: RequestStatus.Error` with `errorReason: AttachmentErrorReason.Network`
- **AND** a "Network unavailable" `Notification` appears listing that attachment's filename

#### Scenario: Multiple simultaneous uploads fail while offline

- **WHEN** `onUploadAttachment` rejects for three attachments inside the debounce window AND `navigator.onLine` is `false`
- **THEN** `onNetworkError` fires once with all three filenames and exactly one "Network unavailable" notification appears listing them

#### Scenario: Upload fails while online (non-network error)

- **WHEN** `onUploadAttachment` rejects AND `navigator.onLine` is `true`
- **THEN** the attachment card enters `status: RequestStatus.Error` with no `errorReason`
- **AND** no "Network unavailable" notification is shown (existing generic error behaviour)

#### Scenario: Retry succeeds after going back online

- **WHEN** the user activates retry on a card with `errorReason: AttachmentErrorReason.Network`
- **THEN** `onUploadAttachment` is called again for that attachment
- **AND** on success the card transitions to `status: RequestStatus.Idle`

## Why

Users who lose network connectivity mid-upload or who select unsupported file types receive no actionable feedback today — the upload silently fails or the card shows a generic error with no explanation. This change introduces two distinct, discoverable error flows so users know exactly what went wrong and what to do next.

## What Changes

- **Network-error notification**: when one or more attachment uploads fail because the network is unavailable, a top-center `DialNotification` appears with header "Network unavailable" and an unordered list of the failed filenames; the failed cards retain their retry button.
- **Unsupported-type notification**: when the user adds a file whose extension is not present in the selected deployment's `inputAttachmentTypes`, a top-center `DialNotification` appears with header "File extension not supported" and a sentence listing the accepted formats; the file is shown as an error card **without** a retry button.
- **Error card layout redesign**: in the error state, the attachment card is reorganised — icon + file-type label move to the top row (ellipsable with `DialEllipsisTooltip`), and the file name becomes the header below, taking all available card width with multiline `DialEllipsis`.
- The `DisplayAttachment` model gains an optional `errorReason` discriminant (`'network' | 'unsupported-type'`) so the app and card can branch on the cause without prop-drilling booleans through unrelated callsites.

## Capabilities

### New Capabilities

- `attachment-network-error-notification`: show a "Network unavailable" top-center notification listing the failed filenames when one or more uploads fail due to network error; existing retry flow on the card is unchanged.
- `attachment-unsupported-type-error`: pre-upload validation against `inputAttachmentTypes`; files that fail validation are added as `RequestStatus.Error` with `errorReason: 'unsupported-type'`; the app shows a "File extension not supported" notification and does not pass `onRetry` to those cards.
- `attachment-error-card-layout`: redesign the non-image attachment card layout in the error state so that icon + type label occupy the top row and the file name occupies the remaining vertical space below.

### Modified Capabilities

- `conversation-input-attachments`: `DisplayAttachment` gains `errorReason?: AttachmentErrorReason`; the retry action is omitted for `errorReason === AttachmentErrorReason.UnsupportedType`; error scenarios are extended to cover both failure subtypes.

## Impact

- `libs/chat-shared/src/types/attachment.ts` — add `AttachmentErrorReason` enum (alongside existing `AttachmentType`).
- `libs/chat-shared/src/models/chat.ts` — add `errorReason?: AttachmentErrorReason` field on `DisplayAttachment`.
- `libs/conversation-input/src/components/AttachmentCard/AttachmentCard.tsx` — error-state layout rearrangement; hide retry when `errorReason === AttachmentErrorReason.UnsupportedType`.
- `libs/conversation-input/src/utils/getAttachmentCardState.ts` — propagate `errorReason` into `AttachmentCardState`.
- `libs/conversation-input/src/models/AttachmentCard.ts` — no structural change; `AttachmentCardProps.onRetry` continues to be optional (no new props needed at the lib level because the app controls retry by not supplying the callback).
- `apps/chat/src/hooks/conversation/useConversationHandlers.ts` — detect network errors in `handleUploadAttachment` and set `errorReason: 'network'`; trigger notification.
- `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` and `apps/chat/src/components/ConversationView/ConversationView.tsx` — validate attachment extensions against `inputAttachmentTypes` before calling `onUploadAttachment`; set `errorReason: 'unsupported-type'`; trigger notification.
- `apps/chat/src/i18n/locales/en.json` — add i18n keys for both notification texts.
- No backend changes required.

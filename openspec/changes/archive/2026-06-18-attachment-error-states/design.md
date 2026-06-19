## Context

`AttachmentCard` in `libs/conversation-input` currently renders a single generic error state (red border, retry + remove buttons) whenever an upload rejects. No error reason is stored; no user notification is shown. Per-file MIME type validation against the deployment's `inputAttachmentTypes` does not exist — the flag is used only to decide whether the attachment button appears at all, not to gate individual files.

The `NotificationContext` / `showNotification` already exists in `apps/chat/src/context/NotificationContext.tsx` and renders top-center stacked `DialNotification` banners.

`DisplayAttachment` (in `libs/chat-shared`) carries `status: RequestStatus` but no error-reason field, so consumers cannot branch on the cause without adding bespoke boolean props.

## Goals / Non-Goals

**Goals:**
- Show a "Network unavailable" top-center notification listing failed filenames when uploads fail because the device is offline.
- Show a "File extension not supported" top-center notification listing accepted formats when a file's MIME type is not in `inputAttachmentTypes`.
- Display files that fail unsupported-type validation as error cards, with no retry button.
- Redesign the non-image error card layout: icon + type label on top, filename below.

**Non-Goals:**
- Backend MIME-type validation (the BFF already returns 400 for bad content; the frontend short-circuits before calling upload for unsupported types).
- Retry for unsupported-type errors.
- Batch progress UI or upload queuing changes.
- Persisting error state across page reload.

## Decisions

### 1. `AttachmentErrorReason` enum on the shared model

Add `enum AttachmentErrorReason { Network = 'network', UnsupportedType = 'unsupported-type' }` to `libs/chat-shared/src/types/attachment.ts` (alongside the existing `AttachmentType` enum) and an optional `errorReason?: AttachmentErrorReason` field on `DisplayAttachment` in `libs/chat-shared/src/models/chat.ts`.

The lib reads `errorReason` to conditionally suppress the retry button. The app sets it when it knows the cause. The field is optional — existing consumers are unaffected.

**Alternative rejected — `isRetryable?: boolean` prop on `AttachmentCard`**: A boolean prop would need the host to manually sync it from attachment state on every render. The reason travels with the data model naturally; putting it on the model is a single source of truth. The lib already imports from `@epam/ai-dial-chat-shared`, so the enum is already in scope.

### 2. `validateAttachment` lib prop for pre-upload type checking

Add `validateAttachment?: (attachment: Attachment) => AttachmentErrorReason | undefined` to `ConversationInputProps` and `InputProps` in `libs/conversation-input`. When provided and it returns a reason, the lib immediately sets the attachment to `{ status: RequestStatus.Error, errorReason: reason }` without calling `onUploadAttachment`.

The app supplies this callback and implements the MIME-to-`inputAttachmentTypes` check there, keeping host knowledge outside the lib.

**Alternative rejected — app wraps `onUploadAttachment` and throws a typed error**: The lib's catch handler cannot safely distinguish app-domain typed errors from generic network errors without coupling to app-side error classes.

**Alternative rejected — app intercepts the file picker before files reach the lib**: The lib owns file-picker and drag-and-drop integration internally; duplicating that at the app level would be fragile and violate the boundary.

### 3. Network-error detection

When `onUploadAttachment` rejects, check `navigator.onLine` at the point of failure. If `false` → `errorReason: AttachmentErrorReason.Network` and trigger the network-error notification path. If `true` → retain existing generic error behaviour (card error state, no notification). `navigator.onLine` is synchronous and universally supported; no event listener is needed.

### 4. Notification aggregation

- **Unsupported-type errors** (synchronous, detected in `validateAttachment`): all invalid files in a single pick/drop batch are known before any async call. The app collects them into an array and shows one notification after processing the batch.
- **Network errors** (async, parallel uploads): failures arrive on independent Promise rejections. The app collects failed attachment names in a `useRef` and uses a short debounce (100 ms) to flush them into a single notification per failure burst.

**Alternative rejected — one notification per file**: Noisy when several files fail at once. The user requirement explicitly shows a list in one notification.

### 5. Error card layout

In `AttachmentCard.tsx`, guard the render branches on `isError`:

- **Error state**: top row = `BottomIcon` + `DialEllipsisTooltip` for the file-type label; bottom row (`flex-1`) = `DialEllipsisTooltip` with `multiline` for the filename.
- **Normal state**: unchanged (filename top, icon + label bottom).

No new SCSS tokens needed; existing `styles.meta` and `styles.name` continue to apply to the same semantic content in the swapped positions.

### 6. MIME-to-display-label utility

A pure function `mimeTypesToExtensionLabels(types: string[]): string` in `apps/chat/src/utils/` converts `inputAttachmentTypes` MIME strings (including wildcards such as `image/*`) to user-facing format labels (e.g., `"PDF, CSV, JPEG"`). Used only in the notification message body. App-level knowledge; never enters a lib.

### 7. Notification message format for file lists

`NotificationItem.message` is typed as `string`. For the network-error notification the file list is rendered as a comma-separated inline string within the message, e.g., `"Some files were not uploaded… try again: file1.jpg, file2.pdf"`. If the design system's `DialNotification` supports `ReactNode` messages in future, the format can be upgraded to a `<ul>` without spec changes.

## Risks / Trade-offs

- **Debounce window (100 ms) for network-error batching**: failures that arrive after 100 ms (e.g., slow timeout) open a second notification rather than joining the first. Mitigation: each failed card is still visually marked in the tray; users can retry individually regardless of notification granularity.
- **`navigator.onLine` false positives**: some environments report `online` even when the network is unreachable (e.g., connected to a LAN with no internet). In this case the failure silently lands on the generic error card (no network notification). Mitigation: acceptable fallback; the card still shows an error state and the retry button remains.
- **Wildcard MIME matching** (`audio/*`, `image/*`): the validation utility must support prefix matching, not only exact string equality. Mitigation: `validateAttachment` in the app performs a `startsWith` check on the major MIME type before the `/`.

## Migration Plan

1. Add `AttachmentErrorReason` and `errorReason` field (optional, non-breaking).
2. Add `validateAttachment` lib prop (optional, non-breaking).
3. Update card layout in `AttachmentCard.tsx`.
4. Wire `validateAttachment` in `ConversationView` and `ConversationRoute`.
5. Wrap `handleUploadAttachment` in `useConversationHandlers` for network-error detection.
6. Add i18n keys and notification calls.

No backend changes, no data migration, no feature flag required.

## Open Questions

- Should the notification list use the original filename (before extension stripping) or the display name (without extension)? **Decision pending**: use the original `attachment.name` (filename with extension) for clarity.
- Should unsupported-type cards be auto-removed (since retrying is pointless)? **Decision pending**: keep them visible so the user sees which files were rejected, but omit the retry button.

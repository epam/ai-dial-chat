## Context

`libs/conversation-input` exposes `ConversationInput` → `Input` → `AttachmentTray`/`AttachmentCard`. Attachments are currently added exclusively via the `+` menu file picker. Each attachment is an `Attachment` record (from `libs/chat-shared`) with a required `File` field. The `Input` component owns the attachment list state and calls `onAttachmentsChange` on every mutation. `AttachmentType.Pasted` already exists in `libs/chat-shared/src/types/attachment.ts` but is not yet rendered by `AttachmentCard`.

The change adds two new entry points for attachments — drag-and-drop onto the container, and clipboard paste inside the textarea — without touching the existing file-picker flow.

## Goals / Non-Goals

**Goals:**
- Drag one or more files from the OS onto `ConversationInput`; they land in the attachment list.
- Paste an image (screenshot) from the clipboard into `Input`; it becomes an `AttachmentType.Image` attachment.
- Paste long text from the clipboard into `Input`; if length exceeds `pasteTextThreshold` it becomes an `AttachmentType.Pasted` card instead of inserting into the textarea.
- `AttachmentCard` renders a distinct variant for `AttachmentType.Pasted` (text icon, "Pasted text" label, no extension badge).
- No changes to the existing file-picker, `AttachmentTray`, or send/clear flows.

**Non-Goals:**
- Drag-and-drop reordering of attachment cards.
- Pasting arbitrary HTML or rich text as an attachment.
- File-type filtering or MIME validation (left to the consuming app / upload flow).
- Mobile drag-and-drop (not supported natively in most mobile browsers).

## Decisions

### 1. Drop zone owned by `ConversationInput`, not `Input`

`ConversationInput` is the outermost visible container and provides the largest drop surface. Placing drag handlers there avoids threading multiple refs/callbacks into `Input`. Files collected at the container level are forwarded to `Input` via a new `pendingDropFiles` prop, which `Input` processes through the same `filesToAttachments` pipeline used by the file picker.

*Alternative considered*: attaching drag handlers to `Input`'s root div. Rejected because `Input` is already complex and the drop target should be the whole panel.

### 2. No drag-and-drop library — native HTML5 DragEvent API

The requirements are simple (files only, no reordering). `DragEvent.dataTransfer.files` is a `FileList` that feeds directly into the existing `filesToAttachments` pipeline. Adding a library for this would be unnecessary complexity.

`dragenter`/`dragleave` fire on every child crossing, so the drop-zone highlight uses a ref counter (`dragDepth`) rather than a boolean to avoid flicker on child transitions.

### 3. Synthetic `File` objects — no `Attachment` model change

For clipboard images: `new File([blob], 'Screenshot.png', { type: blob.type })`.
For pasted text: `new File([text], 'Pasted text', { type: 'text/plain' })`.

Both produce a proper `File` instance that satisfies the existing `Attachment.file: File` field. This avoids making `file` optional in `libs/chat-shared`, which would ripple through the attachment-mapper and serialisation utilities.

### 4. `pasteTextThreshold` prop defaults to 2000 characters

2000 characters (~400 words) is the crossover point where inline text starts to dominate the textarea rather than being a quick message. Below the threshold, paste behaves normally. The consuming app can tune or disable the feature by passing `Infinity`.

### 5. Hook decomposition inside `libs/conversation-input`

Two private hooks keep component JSX clean:

- `useDragDrop(onFiles: (files: File[]) => void)` → returns `{ dragHandlers, isDragOver }`. Owned by `ConversationInput`.
- `useClipboardPaste(onAttachments: (a: Attachment[]) => void, threshold: number)` → returns `{ handlePaste }`. Owned by `Input`.

These are internal implementation details and are not exported from the lib's public index.

### 6. Drop-zone visual feedback via a full-cover overlay

When `isDragOver` is true, `ConversationInput` renders a sibling `<div>` with `absolute inset-0 pointer-events-none` containing a dashed border and a label string supplied via a `dropLabel` prop (default `"Drop files here"`). This avoids mutating the layout of child components and keeps styling within Tailwind utility classes.

### 7. `AttachmentCard` — no changes needed

`getAttachmentCardState` already handles `AttachmentType.Pasted`: it returns `IconClipboard` as the bottom icon, `'Pasted'` as the label, and applies the `cardPasted` CSS class. No `AttachmentCard` or `getAttachmentCardState` changes are required by this feature.

## Risks / Trade-offs

- **`dragLeave` counter on fast drags** — if `dragenter` fires on a child before `dragleave` fires on the parent the counter could go negative; clamping to `Math.max(0, count - 1)` mitigates.
- **Clipboard API availability** — `ClipboardEvent.clipboardData` may be `null` in sandboxed iframes. Guard with a null check and degrade silently (normal paste).
- **Screenshot naming** — clipboard image items carry no filename; `'Screenshot.png'` is a reasonable default. Consuming apps can rename before upload.
- **`pasteTextThreshold = Infinity`** disables the feature cleanly without a separate boolean flag.

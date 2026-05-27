## Why

Users have no way to attach files or images to a message except through the `+` menu file picker — a cumbersome path for common actions like dropping a file from the desktop, pasting a screenshot, or sharing a large code snippet. Adding drag-and-drop, clipboard paste, and long-text-as-attachment support brings the input up to the standard of modern chat interfaces and removes friction for the most frequent attachment workflows.

## What Changes

- The `ConversationInput` wrapper becomes a drag-and-drop target: dragging one or more files over it highlights the zone; dropping adds them as `Attachment`s via the same pipeline used by the file picker.
- The `Input` component listens for `paste` events: pasting an image (e.g. a screenshot) creates an `AttachmentType.Image` attachment; pasting text longer than a configurable threshold creates an `AttachmentType.Pasted` attachment (rendered as a card) instead of inserting it into the textarea.
- A new `pasteTextThreshold` prop (default `2000` characters) on `ConversationInput` and `Input` controls when text paste is treated as an attachment vs. inline.
- `AttachmentCard` gains a `pasted`-type rendering variant: a text-document icon, a "Pasted text" label, and no format extension badge.

## Capabilities

### New Capabilities

- `drag-drop-file-upload`: Drag one or more files from the OS onto the `ConversationInput` to add them as attachments, with a visible drop-zone highlight and accessible feedback.
- `clipboard-paste-attachment`: Paste an image or a block of text from the clipboard into the `Input`; images become `AttachmentType.Image` attachments, long text becomes `AttachmentType.Pasted` attachments.

### Modified Capabilities

None. `AttachmentCard` already renders `AttachmentType.Pasted` via `getAttachmentCardState` (`IconClipboard`, `'Pasted'` label, `cardPasted` class).

## Impact

- `libs/conversation-input` — `ConversationInput`, `Input`, `AttachmentCard` components; `ConversationInputProps` and `InputProps` model types.
- `libs/chat-shared` — `Attachment` interface: `file` field must become optional (`file?: File`) to accommodate `Pasted` attachments created from `Blob`/text with no backing `File` object. `AttachmentType.Pasted` already exists.
- No backend changes required; pasted-text attachments are sent as inline `File`-backed data the same way uploaded files are.
- No new npm dependencies; uses native browser `DragEvent`, `ClipboardEvent`, and `DataTransfer` APIs.

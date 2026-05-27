## Why

Users need to attach files (images, documents, CSVs, etc.) to messages before sending them. Today the input only supports plain text, blocking multimodal workflows.

This phase delivers the UI layer only — file picking, per-attachment card rendering with all states (default, hover, selected, focus, loading, error), and removal. Upload and send integration are follow-on work.

## What Changes

- New `AttachmentCard` component in `libs/conversation-input` renders a single attachment with states: default, hover, selected, focus, loading, error; supports types: file, image, prompt, pasted.
- `AttachmentTray` renders the horizontal list of `AttachmentCard`s above the textarea.
- `Input` gains an "attach" (+) button that opens a native file picker; selected files are held in local state as `Attachment[]`.
- `InputProps` / `ConversationInputProps` gain `onAttachmentsChange?: (attachments: Attachment[]) => void` so the parent can observe the list.
- Each card has a remove (×) button that deletes it from the list; error cards additionally show a retry (↺) icon.
- Images render a thumbnail preview; other file types show a file-type icon + format label.
- `libs/chat-shared` gains an `Attachment` interface (id, name, contentType, file, status, previewUrl?) and a shared `RequestStatus` enum.
- No upload, no backend changes, no `onSend` signature change in this phase.

## Capabilities

### New Capabilities

- `conversation-input-attachments`: The full attachment flow inside the conversation input — add menu (`+` dropdown), file picking, attachment card rendering (all states and types), horizontal tray, and `onAttachmentsChange` callback.

### Modified Capabilities

- (none — no existing spec requirements change in this phase)

## Impact

- `libs/chat-shared`: new `Attachment` interface, `AttachmentType` enum, and shared `RequestStatus` enum (`idle | loading | error`).
- `libs/conversation-input`: new `AttachmentCard`, `AttachmentTray` components; `Input` updated with (+) button and tray; `InputProps` + `ConversationInputProps` extended.
- `apps/chat`: `ConversationView` wires `onAttachmentsChange` (optional, no behaviour change yet).
- No backend (`apps/chat-api`) changes.
- No new npm dependencies required.

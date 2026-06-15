## Why

The current drag-and-drop experience shows a small overlay only within the conversation input box, making it easy for users to miss when dragging files anywhere on the page. A full-screen overlay with clear visual affordance makes the drop target obvious regardless of where the user drags files.

## What Changes

- Replace the local input-scoped DnD overlay in `ConversationInput` with a full-screen blurry overlay that covers the entire page
- The overlay renders a centered icon, an "Attach files" heading, and a "Drop files here to attach them to message" subtitle
- The overlay is triggered when files are dragged anywhere on the page (not just over the input)
- The same overlay applies across all three input scenarios: new chat, active conversation input, and edit-message mode
- The existing per-input `dropLabel` / `dropOverlayClassName` customization props become unused and can be removed

## Capabilities

### New Capabilities

- `file-dnd-fullscreen-overlay`: Full-screen drag-and-drop overlay that activates on page-level `dragenter` with files, blurs the background, and shows a centered icon + "Attach files" / "Drop files here to attach them to message" copy; drops still route to the active input for attachment processing.

### Modified Capabilities

- `conversation-input-attachments`: The DnD drop zone scope changes from input-element-only to the full page; the internal overlay rendering within `ConversationInput` is removed and replaced by the new page-level overlay.

## Impact

- `libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx` — remove internal overlay, expose or lift drag-active state to page level
- `libs/conversation-input/src/components/ConversationInput/ConversationInput.module.scss` — remove `.dropOverlay` styles
- New component: `FileDndOverlay` (location TBD in `libs/conversation-input` or `apps/chat`)
- `apps/chat/src/components/ConversationView/ConversationView.tsx` — wire page-level drag state
- `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` — wire page-level drag state for new-chat scenario
- `libs/conversation-input/src/components/EditMessageInput/EditMessageInput.tsx` — wire page-level drag state for edit scenario
- Tests in `ConversationInput.spec.tsx` need updating for new overlay behavior

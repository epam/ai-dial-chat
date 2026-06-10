## Why

Attachment cards in `ConversationSourcesPanel` are currently inert — clicking one does nothing. Users expect to be able to act on files they see listed, and downloading is the natural first action. The implementation must be structured now so that additional per-type behaviours (preview, custom handler, MIME-based routing) can be added later without rewriting the click logic.

## What Changes

- `AttachmentCard` in `libs/conversation-input` gains an optional `onClick?: (id: string) => void` prop; when supplied the card becomes keyboard-accessible and activates the handler on click or Enter/Space.
- A `useAttachmentAction` hook is introduced in `apps/chat` to resolve the correct action for a given `DisplayAttachment`; initially all attachments resolve to a download action using the existing BFF endpoint (`GET /api/v1/files/download`).
- `FilesSection` accepts an `onAttachmentClick` callback prop and forwards it to each `AttachmentCard`.
- `ConversationSourcesPanel` instantiates `useAttachmentAction` and passes the resolved handler down to both `FilesSection` instances.

## Capabilities

### New Capabilities

- `attachment-card-click`: Clicking an `AttachmentCard` in `ConversationSourcesPanel` triggers a resolved action (initially: file download). The action resolver is extensible — new handlers can be registered by attachment type, MIME type, or metadata without touching card rendering or the panel layout.

### Modified Capabilities

- `conversation-sources-sidebar`: The files section cards gain an interaction callback. No requirement-level behaviour changes beyond this addition; the overall panel structure and filtering logic are unchanged.

## Impact

- **`libs/conversation-input`** — `AttachmentCardProps` gains `onClick`; the card root becomes a button when `onClick` is provided (mirrors the existing `onExpand` pattern).
- **`apps/chat/src/components/ConversationSourcesPanel/sections/FilesSection`** — new `onAttachmentClick` prop threaded through to cards.
- **`apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel`** — wires `useAttachmentAction` result into `FilesSection`.
- **`apps/chat/src/hooks/`** — new `useAttachmentAction` hook; no new external dependencies.
- **BFF (`apps/chat-api`)** — no changes required; `GET /api/v1/files/download` already exists per `openspec/specs/file-download/spec.md`.
- **`libs/chat-api-client`** — no changes; `filesApi.downloadFileRaw()` already generated.

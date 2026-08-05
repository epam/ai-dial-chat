## Context

`libs/conversation-input` currently provides a text-only `Input` component with a send button. There is no concept of attachments anywhere in the codebase — `Message.content` is `string`, `InputProps` has no file-related props, and `libs/chat-shared` has no attachment types.

The Figma designs define an `AttachmentCard` component with four type variants (File, Image, Prompt, Pasted) and six visual states (Default, Hover, Selected, Focus, Loading, Error). Cards render above the textarea in a horizontal `AttachmentTray`. This phase is UI-only: picking, previewing, and removing attachments. Upload and send wiring are explicitly deferred.

## Goals / Non-Goals

**Goals:**

- Add `Attachment` interface, `AttachmentType` enum, and shared `RequestStatus` enum (`idle | loading | error`) to `libs/chat-shared`.
- Implement `AttachmentCard` in `libs/conversation-input` matching all Figma states and types.
- Implement `AttachmentTray` (horizontal scroll list of cards) in `libs/conversation-input`.
- Add a `+` (attach) button to `Input` that opens a hidden `<input type="file" multiple>` and adds selected files to an `Attachment[]` state.
- Support removing any card from the tray via its `×` button.
- Expose `onAttachmentsChange?(attachments: Attachment[]) => void` from `InputProps` and `ConversationInputProps`.
- Generate `previewUrl` (via `URL.createObjectURL`) for image files; revoke it on removal or unmount.

**Non-Goals:**

- File upload to DIAL Core / backend — deferred to phase 2.
- Modifying `onSend` signature or `MessageBubble` — deferred to phase 2.
- "Dial file system", "Prompt library", "Add files from cloud" menu items — separate features.
- Drag-and-drop reordering of attachments.
- Multi-page PDF preview.
- Any backend (`apps/chat-api`) changes.

## Decisions

### 1 — `Attachment` lives in `libs/chat-shared`

The type will be reused by `libs/conversation-input` (produced) and `apps/chat` (consumed for send). `chat-shared` is the only lib allowed to have zero dependencies, making it the correct home.

**Alternative considered:** define in `libs/conversation-input`. Rejected because `apps/chat` would then need to import a UI lib just to type-check the attachment list, violating the module boundary intent.

### 2 — State stays inside `Input`, surfaced via callback

`Attachment[]` is owned by `Input`'s local `useState`. The parent receives updates via `onAttachmentsChange`. This avoids lifting state into `ConversationView` before it is needed for send.

**Alternative considered:** lift state to `ConversationView` immediately. Rejected as premature — the parent has no use for the list in this phase.

### 3 — `AttachmentCard` and `AttachmentTray` are new components inside `libs/conversation-input`

They are co-located with the input feature rather than placed in `libs/conversation-messages`. They will never be reused for rendering received messages (different design treatment applies there). Following the existing folder pattern: each component gets its own PascalCase subfolder under `libs/conversation-input/src/components/`.

### 4 — Image preview via `URL.createObjectURL`, not FileReader/base64

`createObjectURL` is synchronous, memory-efficient, and integrates cleanly with `useEffect` cleanup (`URL.revokeObjectURL`). Base64 encoding at preview time is wasteful and irrelevant since no upload happens in this phase.

### 5 — File type icon mapped from `contentType` via a lookup, `@tabler/icons-react`

A small `getFileTypeIcon(contentType: string): TablerIcon` utility maps MIME prefixes to icons (e.g. `text/csv` → `IconCsv`, `image/*` → `IconPhoto`, fallback → `IconFile`). No inline SVGs per project rules.

### 6 — Shared `RequestStatus` enum, not an attachment-specific one

`Attachment.status` uses a shared `RequestStatus` enum (`idle | loading | error`) defined in `libs/chat-shared`. The same enum is available for other async operations (uploads, fetches) across the codebase. The card renders the correct visual state from this prop. In phase 1 all new attachments default to `RequestStatus.Idle`; loading/error will be set by the upload hook in phase 2.

### 7 — Attach trigger uses `DialDropdown` + `+` button, not a direct paperclip button

The attach entry point is a `GhostIconButton` (`IconPlus`, 40×40, 18px icon) that opens a `DialDropdown` (`placement="bottom-start"`) with a single "Attach file" item. Clicking the item triggers the hidden `<input type="file">`.

**Why a dropdown instead of a direct button:** Phase 2 will add further attachment sources (DIAL file system, prompt library, pasted content). A dropdown accommodates additional items without changing the trigger affordance or the surrounding layout. Switching from a direct-action button to a dropdown later would require a visible layout change and a spec update; establishing the pattern in phase 1 avoids that churn.

**Why `IconPlus` instead of `IconPaperclip`:** The `+` icon signals "add something" generically, matching the dropdown metaphor. The paperclip icon is preserved as the icon on the "Attach file" dropdown item, keeping its conventional meaning at the point of action.

## Risks / Trade-offs

- **Object URL leak** → Mitigate by calling `URL.revokeObjectURL` in the remove handler and in a `useEffect` cleanup that iterates all image attachments on unmount.
- **No file-type or size validation in phase 1** → Accept; validation belongs to the upload step (phase 2). In phase 1 any file can be picked but nothing is transmitted.
- **`<input type="file">` cannot be fully styled** → Use a visually-hidden input triggered by a `<button>` (via `ref.current.click()`), which is the standard accessible pattern.
- **`noUnusedParameters` in tsconfig strict** → `onAttachmentsChange` will be optional; when omitted the callback simply doesn't fire — no unused variable issue.

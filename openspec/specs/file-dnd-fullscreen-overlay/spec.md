# file-dnd-fullscreen-overlay Specification

## Purpose
TBD - created by archiving change file-dnd-overlay. Update Purpose after archive.
## Requirements
### Requirement: Full-screen drag overlay activates on page-level file drag

The `FileDndOverlay` component in `libs/conversation-input` SHALL render as a full-screen fixed overlay (`fixed inset-0 z-[9999]`) with a blurred, semi-transparent backdrop when its `isVisible` prop is `true`.

The overlay SHALL display, centered vertically and horizontally:
1. `IconFileDescription` from `@epam/ai-dial-ui-kit` in accent color (`text-accent-primary`)
2. A title with default text `'Attach files'` (configurable via `title` prop)
3. A subtitle with default text `'Drop files here to attach them to message'` (configurable via `subtitle` prop)

When `isAttachmentsAllowed` is `true` (default), the overlay SHALL be `pointer-events-none` so that the underlying drop zone continues to receive drop events.

The overlay SHALL apply backdrop blur and use `--bg-blackout` (or equivalent semi-transparent background token) as its background.

Typography classes SHALL be configurable via `titleClassName` (default `'dial-subheader2-bold-text'`) and `subtitleClassName` (default `'dial-body-text'`) props. Icon color SHALL be configurable via `iconClassName` (default `'text-accent-primary'`) for the allowed state and `deniedIconClassName` (default `'text-error'`) for the denied state.

#### Scenario: Overlay is hidden by default

- **WHEN** `FileDndOverlay` is rendered with `isVisible={false}`
- **THEN** no overlay element is rendered in the DOM

#### Scenario: Overlay appears when files are dragged over the page

- **WHEN** `FileDndOverlay` is rendered with `isVisible={true}`
- **THEN** a full-screen overlay is visible
- **AND** the overlay contains the title "Attach files"
- **AND** the overlay contains the subtitle "Drop files here to attach them to message"

#### Scenario: Overlay uses custom title and subtitle

- **WHEN** `FileDndOverlay` is rendered with `isVisible={true}`, `title="Add attachments"`, and `subtitle="Drop here"`
- **THEN** the overlay shows "Add attachments" as the title
- **AND** the overlay shows "Drop here" as the subtitle

#### Scenario: Overlay shows denied state when attachments are not allowed

- **WHEN** `FileDndOverlay` is rendered with `isVisible={true}` and `isAttachmentsAllowed={false}`
- **THEN** the overlay displays `IconFileX` (not `IconFileDescription`)
- **AND** the icon is rendered in error color (`text-error`)
- **AND** the title is `'No attachments allowed'`
- **AND** the subtitle is `"Attachments can't be added to message"`
- **AND** the overlay has `cursor-not-allowed` styling
- **AND** the overlay is `pointer-events-auto` (intercepts rather than passes through drag events)
- **AND** a `drop` event fired on the overlay does NOT propagate to the document drop handler (no files are added)

---

### Requirement: `usePageFileDrag` hook detects page-level file drags

A `usePageFileDrag` hook in `apps/chat/src/hooks/usePageFileDrag.ts` SHALL attach `dragenter`, `dragleave`, `dragover`, and `drop` event listeners to `document` when mounted, and remove them on unmount.

The hook SHALL return `{ isDragging: boolean, pendingFiles: File[], onFilesConsumed: () => void }`.

`isDragging` SHALL be `true` when a drag containing the `'Files'` MIME kind is active over the document, and `false` otherwise.

The hook SHALL use a ref-counted counter (`enterCount`) to handle browser-native child-element `dragleave`/`dragenter` pairs without flickering: increment on `dragenter`, decrement on `dragleave`, set `isDragging` based on `enterCount > 0`.

The hook SHALL call `event.preventDefault()` on `dragover` and `drop` to prevent the browser from opening dropped files.

On `drop`, the hook SHALL set `pendingFiles` to the array of dropped `File` objects and reset `isDragging` to `false`.

`onFilesConsumed` SHALL clear `pendingFiles` and reset state to idle.

The hook SHALL NOT activate for drags that do not contain the `'Files'` MIME kind (e.g., text or link drags).

#### Scenario: isDragging becomes true on dragenter with files

- **WHEN** a `dragenter` event fires on `document` with `dataTransfer.types` containing `'Files'`
- **THEN** `isDragging` is `true`

#### Scenario: isDragging remains false for non-file drags

- **WHEN** a `dragenter` event fires on `document` with `dataTransfer.types` containing only `'text/plain'`
- **THEN** `isDragging` is `false`

#### Scenario: isDragging returns to false after dragleave resets counter

- **WHEN** `dragenter` fires once and then `dragleave` fires once with no remaining enter count
- **THEN** `isDragging` is `false`

#### Scenario: pendingFiles populated on drop

- **WHEN** a `drop` event fires on `document` with two files
- **THEN** `pendingFiles` contains those two files
- **AND** `isDragging` is `false`

#### Scenario: onFilesConsumed clears pendingFiles

- **WHEN** `onFilesConsumed` is called after files have been dropped
- **THEN** `pendingFiles` is empty

---

### Requirement: Page-level DnD is wired in ConversationView and ConversationRoute

`ConversationView` and `ConversationRoute` SHALL each use `usePageFileDrag` and render `<FileDndOverlay isVisible={isDragging} isAttachmentsAllowed={isAttachmentsAllowed} />`.

`isAttachmentsAllowed` SHALL be derived from the currently selected deployment's `inputAttachmentTypes`: `true` only when `inputAttachmentTypes` is a defined, non-empty array (e.g. `['image/png']`); `false` when `inputAttachmentTypes` is `undefined` or an empty array `[]`.

When no edit is active in `ConversationView`, dropped `pendingFiles` SHALL be passed to `<ConversationInput pendingDropFiles={pendingFiles} onDropFilesConsumed={onFilesConsumed} />`.

When an edit is active (`editingMessageIndexes.size > 0`), dropped `pendingFiles` SHALL be passed through `ConversationMessageItem` to the `EditMessageInput` for the currently edited message.

`ConversationRoute` (new chat) SHALL always pass `pendingFiles` to its `<ConversationInput>`.

#### Scenario: Overlay shows denied state when selected model has empty input_attachment_types

- **WHEN** the selected deployment has `inputAttachmentTypes: []`
- **AND** a file drag is active over the page
- **THEN** `isAttachmentsAllowed` is `false`
- **AND** the `FileDndOverlay` renders the denied state

#### Scenario: Overlay shows denied state when selected model has undefined input_attachment_types

- **WHEN** the selected deployment has `inputAttachmentTypes: undefined`
- **AND** a file drag is active over the page
- **THEN** `isAttachmentsAllowed` is `false`
- **AND** the `FileDndOverlay` renders the denied state

#### Scenario: Dropped files reach ConversationInput in conversation view (no edit active)

- **WHEN** a user drops files anywhere on the ConversationView page with no edit active
- **THEN** the dropped files appear as pending attachments in the main ConversationInput

#### Scenario: Dropped files reach EditMessageInput when edit is active

- **WHEN** a user is editing a message and drops files anywhere on the page
- **THEN** the dropped files appear as pending attachments in the EditMessageInput

#### Scenario: Dropped files reach ConversationInput in new-chat view

- **WHEN** a user drops files anywhere on the ConversationRoute (new chat) page
- **THEN** the dropped files appear as pending attachments in the ConversationInput


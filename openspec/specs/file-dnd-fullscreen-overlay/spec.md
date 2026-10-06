# file-dnd-fullscreen-overlay Specification

## Purpose
Defines the page-level file drag-and-drop experience: the full-screen `FileDndOverlay` from `@epam/ai-dial-attachment-input`, the `usePageFileDrag` hook from `@epam/ai-dial-chat-hooks/viewport-layout`, and how `ConversationView` and `NewConversationComposer` route dropped files to the main or edit input.
## Requirements
### Requirement: Full-screen drag overlay activates on page-level file drag

The `FileDndOverlay` component in `libs/attachment-input` (exported from `@epam/ai-dial-attachment-input`) SHALL render as a full-screen fixed overlay (`fixed inset-0 z-[9999]`, `backdrop-blur-sm`) with a semi-transparent backdrop when its `isVisible` prop is `true`. Its props are `isVisible`, `isAttachmentsAllowed?` (default `true`), `labels?: FileDndOverlayLabels`, and `styles?: FileDndOverlayStyles`. The root element carries `role="status"` and `aria-live="polite"`.

The overlay SHALL display, centered vertically and horizontally:
1. `IconFileDescription` from `@tabler/icons-react` (size `100`, `stroke={1}`, `aria-hidden`) in the accent color. The glyph is an illustration, so it takes the empty-state `stroke={1}` rather than `DIAL_KIT_ICON_STROKE`; the denied-state `IconFileX` follows the same rule
2. A title with default text `'Attach files'` (configurable via `labels.title`)
3. A subtitle with default text `'Drop files here to attach them to message'` (configurable via `labels.subtitle`)

When `isAttachmentsAllowed` is `true` (default), the overlay SHALL be `pointer-events-none` so that the underlying drop zone continues to receive drop events.

The overlay SHALL apply backdrop blur and take its background from the `FileDndOverlay.module.scss` `.overlay` class: `var(--ai-fd-bg, var(--bg-backdrop, #161b2d4d))`.

Typography classes SHALL be configurable via `styles.typography.titleClassName` (default `'dial-h3-text'`) and `styles.typography.subtitleClassName` (default `'dial-small-text'`). Colors SHALL be configurable via `styles.colors` (`background`, `icon`, `deniedIcon`), applied with `buildCssVars` as the `--ai-fd-bg`, `--ai-fd-icon`, and `--ai-fd-denied-icon` custom properties, which fall back to `--bg-backdrop`, `--text-accent`, and `--text-error` respectively.

#### Scenario: Overlay is hidden by default

- **WHEN** `FileDndOverlay` is rendered with `isVisible={false}`
- **THEN** no overlay element is rendered in the DOM

#### Scenario: Overlay appears when files are dragged over the page

- **WHEN** `FileDndOverlay` is rendered with `isVisible={true}`
- **THEN** a full-screen overlay is visible
- **AND** the overlay contains the title "Attach files"
- **AND** the overlay contains the subtitle "Drop files here to attach them to message"

#### Scenario: Overlay uses custom title and subtitle

- **WHEN** `FileDndOverlay` is rendered with `isVisible={true}` and `labels={{ title: "Add attachments", subtitle: "Drop here" }}`
- **THEN** the overlay shows "Add attachments" as the title
- **AND** the overlay shows "Drop here" as the subtitle

#### Scenario: Overlay shows denied state when attachments are not allowed

- **WHEN** `FileDndOverlay` is rendered with `isVisible={true}` and `isAttachmentsAllowed={false}`
- **THEN** the overlay displays `IconFileX` (not `IconFileDescription`)
- **AND** the icon is rendered in the error color (the `.deniedIcon` class)
- **AND** the default title is `'No attachments allowed'`
- **AND** the default subtitle is `"Attachments can't be added to message"`

#### Scenario: Overlay illustration uses the empty-state stroke

- **WHEN** `FileDndOverlay` is rendered with `isVisible={true}`, with `isAttachmentsAllowed` either `true` or `false`
- **THEN** the rendered icon has `stroke-width="1"` and `aria-hidden="true"`
- **AND** the overlay has `cursor-not-allowed` styling
- **AND** the overlay is `pointer-events-auto` (intercepts rather than passes through drag events)
- **AND** the overlay calls `preventDefault()` on `dragover` and `drop`, and because `usePageFileDrag` was given `isAttachmentsAllowed=false` its document `drop` handler adds no files

---

### Requirement: `usePageFileDrag` hook detects page-level file drags

A `usePageFileDrag(isAttachmentsAllowed = true, isEnabled = true)` hook in `libs/chat-hooks/src/usePageFileDrag/usePageFileDrag.ts` (exported from `@epam/ai-dial-chat-hooks` and its `viewport-layout` entry) SHALL attach `dragenter`, `dragleave`, `dragover`, and `drop` event listeners to `document` when mounted, and remove them on unmount.

The hook SHALL return `UsePageFileDragResult` `{ isDragging: boolean, pendingFiles: File[], onFilesConsumed: () => void }`.

While `isEnabled` is `false` the hook SHALL ignore `dragenter`, `dragleave`, and `drop`, and SHALL reset its counter and `isDragging` to `false`.

`isDragging` SHALL be `true` when a drag containing the `'Files'` MIME kind is active over the document, and `false` otherwise.

The hook SHALL use a ref-counted counter (`enterCountRef`) to handle browser-native child-element `dragleave`/`dragenter` pairs without flickering: increment on `dragenter`, decrement on `dragleave`, set `isDragging` based on `enterCount > 0`.

The hook SHALL call `event.preventDefault()` on `dragover` and `drop` of file drags to prevent the browser from opening dropped files.

On `drop`, the hook SHALL reset the counter and `isDragging` to `false` and, only when `isAttachmentsAllowed` is `true`, append the dropped `File` objects to `pendingFiles`.

`onFilesConsumed` SHALL remove the files that were pending when it was created from `pendingFiles`, keeping any appended afterwards.

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

### Requirement: Page-level DnD is wired in ConversationView and NewConversationComposer

`ConversationView` and `NewConversationComposer` (the new-chat view rendered by `ConversationRoute`) SHALL each call `usePageFileDrag(isAttachmentsAllowed, !isDialFileManagerOpen)` and render `<FileDndOverlay isVisible={isDragging} isAttachmentsAllowed={isAttachmentsAllowed} labels={...} />` with translated labels: `BasicI18nKeys.AttachFiles` / `FileDndI18nKeys.OverlaySubtitle` when allowed and `FileDndI18nKeys.OverlayDeniedTitle` / `FileDndI18nKeys.OverlayDeniedSubtitle` when denied.

`isAttachmentsAllowed` SHALL be derived by `useAttachmentValidation` from the currently selected deployment's `inputAttachmentTypes`: `true` only when `inputAttachmentTypes` is a defined, non-empty array (e.g. `['image/png']`); `false` when `inputAttachmentTypes` is `undefined` or an empty array `[]`.

When no edit is active in `ConversationView`, dropped `pendingFiles` SHALL be passed through `useMessageSelectionReply` (`droppedFiles` / `onDroppedFilesConsumed`) and reach `<ConversationInput pendingDropFiles={reply.pendingFiles} onDropFilesConsumed={reply.onFilesConsumed} />`.

When an edit is active (`editingMessageIndexes.size > 0`), dropped `pendingFiles` SHALL be passed through `ConversationMessageItem` to the `EditMessageInput` for the currently edited message.

`NewConversationComposer` (new chat) SHALL always pass `pendingFiles` and `onFilesConsumed` to its `<ConversationInput>`.

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

- **WHEN** a user drops files anywhere on the new-chat page rendered by `NewConversationComposer`
- **THEN** the dropped files appear as pending attachments in the ConversationInput


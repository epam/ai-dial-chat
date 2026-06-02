# conversation-input-attachments Specification

## Purpose

Specifies all attachment entry points for the conversation input: file picker via add menu, drag-and-drop from the OS, clipboard paste (images and long text), and the attachment tray UI that manages pending attachments before send.

---

### Requirement: Add menu button

The `Input` component SHALL include a `+` button (`DialGhostIconButton`, 40×40, icon 18px `BASE_ICON_SIZE`) that opens a `DialDropdown` positioned below the trigger (`placement="bottom-start"`). The menu lists available content sources; in phase 1 it contains a single item: "Attach file". Items are extensible — future phases add more sources without changing the trigger or surrounding layout.

#### Scenario: Plus button opens dropdown

- **WHEN** the user clicks the `+` button
- **THEN** a dropdown menu appears below it

#### Scenario: Dropdown closes on outside click

- **WHEN** the dropdown is open and the user clicks outside it
- **THEN** the dropdown closes

#### Scenario: Plus button aria-label

- **WHEN** the `+` button is rendered
- **THEN** it has `aria-label` sourced from i18n key `conversationInput.addMenu.ariaLabel`

#### Scenario: Plus button keyboard activation

- **WHEN** the `+` button has focus and the user presses Enter or Space
- **THEN** the dropdown menu opens

#### Scenario: Attach file item

- **WHEN** the dropdown is open
- **THEN** an "Attach file" item is present, labelled from i18n key `conversationInput.attach.label`, with a paperclip icon

#### Scenario: Attach file item triggers file picker

- **WHEN** the user clicks the "Attach file" item
- **THEN** the native file picker opens

---

### Requirement: File picking and Attachment creation

The `Input` component SHALL include a visually-hidden `<input type="file" multiple>` triggered programmatically by the "Attach file" menu item. Each selected file SHALL be converted to an `Attachment` (`id`, `name`, `contentType`, `file`, `status: RequestStatus.Idle`). Image files additionally receive a `previewUrl` via `URL.createObjectURL`.

#### Scenario: Multiple files selectable

- **WHEN** the file picker opens
- **THEN** the user can select one or more files simultaneously

#### Scenario: Non-image file added

- **WHEN** the user selects a non-image file (e.g. `.csv`)
- **THEN** an `Attachment` with `type: AttachmentType.File` and no `previewUrl` is added to the list

#### Scenario: Image file added with preview

- **WHEN** the user selects an image file (MIME type starts with `image/`)
- **THEN** an `Attachment` with `type: AttachmentType.Image` and a valid `previewUrl` is added

#### Scenario: Object URL revoked on removal

- **WHEN** an `Attachment` with a `previewUrl` is removed
- **THEN** `URL.revokeObjectURL` is called with that URL

#### Scenario: Object URLs revoked on unmount

- **WHEN** the `Input` component unmounts while image attachments are present
- **THEN** `URL.revokeObjectURL` is called for every `previewUrl` in the list

---

### Requirement: `onAttachmentsChange` callback

`Input` and `ConversationInput` SHALL accept an optional `onAttachmentsChange?: (attachments: Attachment[]) => void` called whenever the attachment list changes.

#### Scenario: Callback fired on add

- **WHEN** files are selected and converted to `Attachment`s
- **THEN** `onAttachmentsChange` is called with the full updated list

#### Scenario: Callback fired on remove

- **WHEN** the user removes an attachment from the tray
- **THEN** `onAttachmentsChange` is called with the remaining list

#### Scenario: No callback — no error

- **WHEN** `onAttachmentsChange` is not provided
- **THEN** the component operates normally without throwing

---

### Requirement: AttachmentCard renders pending attachments

The system SHALL render a card component for each pending attachment, displaying the file name **without its extension**, format label, and a type-appropriate icon. `type: image` shows a thumbnail; all other types show a file-type icon from `getAttachmentIcon`.

The file name SHALL be derived by stripping everything from the last `.` to the end of `name` (using `name.lastIndexOf('.')`); if no `.` is found or it is at position 0, the full name is used. The name SHALL be wrapped in a `DialTooltip` that shows the **full name including extension** on hover. The name span SHALL use `line-clamp-3 break-words` to allow up to three lines of wrapping.

#### Scenario: File card default state

- **WHEN** an attachment of type `file` with status `idle` is rendered
- **THEN** the card displays the file name without extension, the format extension label, and the matching `@tabler/icons-react` file icon

#### Scenario: Name without extension shown

- **WHEN** an attachment with name `report.final.pdf` is rendered
- **THEN** the visible name is `report.final` (only the last extension is stripped)

#### Scenario: Name with no extension unchanged

- **WHEN** an attachment with name `README` (no dot) is rendered
- **THEN** the full name `README` is displayed unchanged

#### Scenario: Tooltip shows full name including extension

- **WHEN** the user hovers over a file card
- **THEN** a `DialTooltip` shows the full original name including the extension (e.g. `report.final.pdf`)

#### Scenario: Name wraps up to three lines

- **WHEN** the file name without extension is longer than one line at 76 px width
- **THEN** the name wraps to up to three lines before being clipped

#### Scenario: Image card shows thumbnail

- **WHEN** an attachment of type `image` with a valid `previewUrl` is rendered
- **THEN** the card displays the image thumbnail instead of an icon

#### Scenario: Card in loading state

- **WHEN** an attachment has status `loading`
- **THEN** the card displays a spinner overlay and the remove button is hidden

#### Scenario: Card in error state

- **WHEN** an attachment has status `error`
- **THEN** the card displays a red border, a retry button (↺), and the remove button (×)

#### Scenario: Remove button on hover

- **WHEN** the user hovers over a card with status `idle` or `error`
- **THEN** a remove button (×) becomes visible

#### Scenario: Remove via keyboard

- **WHEN** the remove button has focus and the user presses Enter or Space
- **THEN** the attachment is removed

#### Scenario: Remove button aria-label

- **WHEN** the card is rendered
- **THEN** the remove button has `aria-label` sourced from i18n key `conversationInput.attachment.remove`

#### Scenario: Retry button aria-label

- **WHEN** a card in error state is rendered
- **THEN** the retry button has `aria-label` sourced from i18n key `conversationInput.attachment.retry`

---

### Requirement: AttachmentTray renders the pending list

The system SHALL render a horizontally scrollable row of `AttachmentCard` components above the textarea when the list is non-empty. The tray returns `null` when the list is empty.

#### Scenario: Tray visible with attachments

- **WHEN** one or more attachments are pending
- **THEN** the `AttachmentTray` is rendered with one card per attachment

#### Scenario: Tray hidden when empty

- **WHEN** the pending list is empty
- **THEN** the tray is not rendered

#### Scenario: Tray scrolls horizontally

- **WHEN** cards exceed the available width
- **THEN** the tray scrolls horizontally

#### Scenario: Last card removed hides tray

- **WHEN** the user removes the last remaining card
- **THEN** the tray is no longer rendered

#### Scenario: Tray ARIA label

- **WHEN** the tray is rendered
- **THEN** it has `role="list"` and `aria-label` sourced from i18n key `conversationInput.attachmentTray.label`

---

### Requirement: `Input` clears attachments after successful send

After `onSend` resolves successfully, the `Input` component SHALL clear the internal attachment list, returning the tray to its empty (hidden) state.

#### Scenario: Tray clears after send

- **WHEN** the user sends a message with attachments and the send completes without error
- **THEN** the `AttachmentTray` is no longer rendered and the attachment list is empty

#### Scenario: Tray retained on send error

- **WHEN** the send fails (e.g. `onSend` rejects or `attachmentsToDtos` throws)
- **THEN** the attachment list is unchanged so the user can retry

---

### Requirement: Drop zone on ConversationInput

The `ConversationInput` component SHALL act as a drag-and-drop target for OS files. While one or more files are dragged over the component, a full-cover overlay SHALL be rendered over the `Input` area (excluding the welcome heading and outer padding) with a 1 px dashed border in `--stroke-accent-primary`, a semi-transparent `--bg-blackout` background, label text in `--text-secondary` using `dial-tiny-text`, sourced from the `dropLabel` prop (default `"Drop files here"`). Dropping the files SHALL add them to the attachment list using the same pipeline as the file picker.

#### Scenario: Drag enter shows overlay

- **WHEN** the user drags one or more files over the `ConversationInput` area
- **THEN** the drop-zone overlay becomes visible

#### Scenario: Drag leave hides overlay

- **WHEN** the user drags files out of the `ConversationInput` area without dropping
- **THEN** the drop-zone overlay is hidden

#### Scenario: Overlay does not block child interaction during normal use

- **WHEN** no drag is in progress
- **THEN** the overlay is not rendered and all child elements are fully interactive

#### Scenario: Drop adds files as attachments

- **WHEN** the user drops one or more files onto the `ConversationInput`
- **THEN** each file is converted to an `Attachment` and added to the tray, and the overlay is hidden

#### Scenario: Drop of image file creates image attachment

- **WHEN** the user drops an image file (MIME type starting with `image/`)
- **THEN** an `Attachment` with `type: AttachmentType.Image` and a valid `previewUrl` is added

#### Scenario: Drop of non-image file creates file attachment

- **WHEN** the user drops a non-image file (e.g. `.pdf`)
- **THEN** an `Attachment` with `type: AttachmentType.File` and no `previewUrl` is added

#### Scenario: Drop of multiple files adds all

- **WHEN** the user drops three files simultaneously
- **THEN** all three attachments are added to the tray

#### Scenario: `onAttachmentsChange` fired after drop

- **WHEN** files are dropped and converted to attachments
- **THEN** `onAttachmentsChange` is called with the full updated attachment list

#### Scenario: Non-file drag items are ignored

- **WHEN** the user drags text or a browser element (no `files` in `dataTransfer`) over the component and releases
- **THEN** no attachments are added and the drop-zone overlay is not shown

#### Scenario: Overlay is scoped to the Input area only

- **WHEN** the drag-over overlay is shown
- **THEN** it covers only the `Input` component area and does not extend over the welcome heading or outer padding

#### Scenario: `dropLabel` prop customises overlay text

- **WHEN** `dropLabel="Drag files here to attach"` is passed
- **THEN** the overlay displays that string

---

### Requirement: `dropLabel` prop on `ConversationInput`

`ConversationInput` SHALL accept an optional `dropLabel?: string` prop (default `"Drop files here"`) that supplies the text shown inside the drag-over overlay.

#### Scenario: Default label rendered

- **WHEN** `dropLabel` is not provided
- **THEN** the overlay shows `"Drop files here"`

#### Scenario: Custom label rendered

- **WHEN** `dropLabel="Release to attach"` is provided
- **THEN** the overlay shows `"Release to attach"`

---

### Requirement: Paste image from clipboard as attachment

The `Input` component SHALL intercept `paste` events that contain image data (e.g. a screenshot copied to the clipboard). Each image item in `ClipboardEvent.clipboardData.items` with a MIME type starting with `image/` SHALL be converted to an `AttachmentType.Image` attachment. The paste event SHALL be prevented from inserting content into the textarea.

#### Scenario: Pasting a screenshot creates an image attachment

- **WHEN** the user presses Ctrl+V (or Cmd+V) while the input has focus and the clipboard contains an image
- **THEN** an `Attachment` with `type: AttachmentType.Image`, a synthetic filename `"Screenshot.png"`, and a valid `previewUrl` is added to the tray

#### Scenario: Pasted image does not insert text into textarea

- **WHEN** the clipboard contains an image and the user pastes
- **THEN** the textarea content is unchanged

#### Scenario: `onAttachmentsChange` fired after image paste

- **WHEN** a clipboard image is pasted
- **THEN** `onAttachmentsChange` is called with the updated attachment list

#### Scenario: Null clipboardData degrades silently

- **WHEN** `ClipboardEvent.clipboardData` is `null` (e.g. sandboxed iframe)
- **THEN** the paste event proceeds normally with no attachment created and no error thrown

---

### Requirement: Paste long text as a Pasted attachment

The `Input` component SHALL intercept `paste` events containing plain text whose length exceeds `pasteTextThreshold`. When the threshold is exceeded, the pasted text SHALL be wrapped in a synthetic `File` (`type: 'text/plain'`) and added as an `AttachmentType.Pasted` attachment with a preview name showing the first 80 characters of the text (trimmed, with `…` appended if truncated). The paste event SHALL be prevented from inserting the text into the textarea.

#### Scenario: Short text paste inserts inline

- **WHEN** the user pastes text whose length is less than or equal to `pasteTextThreshold`
- **THEN** the text is inserted into the textarea normally and no attachment is created

#### Scenario: Long text paste creates Pasted attachment

- **WHEN** the user pastes text whose length exceeds `pasteTextThreshold`
- **THEN** an `Attachment` with `type: AttachmentType.Pasted` and `contentType: "text/plain"` is added to the tray

#### Scenario: Preview name shows first 80 chars with ellipsis

- **WHEN** the pasted text is longer than 80 characters
- **THEN** the attachment name is the first 80 characters of the trimmed text followed by `…`

#### Scenario: Long text does not insert into textarea

- **WHEN** the pasted text exceeds the threshold
- **THEN** the textarea content is unchanged after the paste

#### Scenario: `onAttachmentsChange` fired after long text paste

- **WHEN** a long-text paste creates an attachment
- **THEN** `onAttachmentsChange` is called with the updated attachment list

#### Scenario: Default threshold is 4000 characters

- **WHEN** `pasteTextThreshold` is not provided and the pasted text is exactly 2001 characters
- **THEN** it is treated as an attachment, not inline text

---

### Requirement: `pasteTextThreshold` prop on `ConversationInput` and `Input`

Both `ConversationInput` and `Input` SHALL accept an optional `pasteTextThreshold?: number` prop (default `4000`) that controls the character count above which a pasted plain-text string is converted into an `AttachmentType.Pasted` attachment. `ConversationInput` SHALL forward this value to `Input`.

#### Scenario: Prop forwarded from ConversationInput to Input

- **WHEN** `pasteTextThreshold={1000}` is set on `ConversationInput`
- **THEN** `Input` uses 1000 as the threshold for paste handling

---

### Requirement: Pasted attachment expand

Clicking or keyboard-activating a card of `type: AttachmentType.Pasted` SHALL read the file content and append it as plain text into the textarea (separated by a newline if the textarea already contains text), then remove the card from the tray.

#### Scenario: Click expands pasted card into textarea

- **WHEN** the user clicks a pasted attachment card
- **THEN** the card's text is appended to the textarea and the card is removed

#### Scenario: Expand appends with newline when textarea has content

- **WHEN** the textarea already contains text and the user expands a pasted card
- **THEN** the text is appended with a `\n` separator

#### Scenario: Enter or Space activates expand

- **WHEN** a pasted card has focus and the user presses Enter or Space
- **THEN** the same expand behaviour fires

#### Scenario: Remove button does not trigger expand

- **WHEN** the user clicks the remove button on a pasted card
- **THEN** only the card is removed; no text is inserted into the textarea

---

### Requirement: Input component accepts initial attachments
The `Input` component SHALL accept an optional `initialAttachments` prop that pre-populates the attachment tray on mount.

#### Scenario: Pre-populated attachments on mount
- **WHEN** `Input` is rendered with `initialAttachments` containing one or more attachments
- **THEN** those attachments are displayed in the attachment tray immediately on mount

#### Scenario: No initial attachments (default behaviour unchanged)
- **WHEN** `Input` is rendered without `initialAttachments`
- **THEN** the attachment tray is empty on mount (existing behaviour preserved)

---

### Requirement: Input component accepts a footer actions render prop
The `Input` component SHALL accept an optional `renderFooterActions` render prop that, when provided, replaces the default send/stop/model-selector area with custom content.

The render prop signature is:
```ts
renderFooterActions?: (helpers: { canSend: boolean; onSend: () => void }) => ReactNode
```

- `canSend` — `true` when the textarea has non-empty trimmed content
- `onSend` — triggers the same internal send flow as the default send button

#### Scenario: Custom footer replaces default actions
- **WHEN** `renderFooterActions` is provided
- **THEN** the default Send/Stop buttons and model selector are not rendered
- **THEN** the return value of `renderFooterActions` is rendered in their place

#### Scenario: Default footer rendered when prop is absent
- **WHEN** `renderFooterActions` is not provided
- **THEN** the existing Send/Stop/model-selector area is rendered (existing behaviour preserved)

#### Scenario: canSend reflects textarea content
- **WHEN** the textarea is empty or contains only whitespace
- **THEN** `canSend` passed to `renderFooterActions` is `false`
- **WHEN** the textarea contains at least one non-whitespace character
- **THEN** `canSend` passed to `renderFooterActions` is `true`

---

### Requirement: Input component supports stacked layout
The `Input` component SHALL accept an optional `isStacked` boolean prop. When `true`, the textarea always occupies its own full-width row above the action bar, regardless of whether attachments are present.

#### Scenario: Stacked layout forced by prop
- **WHEN** `Input` is rendered with `isStacked={true}` and no attachments present
- **THEN** the textarea renders on its own row above the action bar (same layout as when attachments are present)

#### Scenario: Default compact layout preserved
- **WHEN** `isStacked` is absent or `false` and no attachments are present
- **THEN** the textarea renders inline within the action bar row (existing behaviour preserved)

---

### Requirement: Input component supports hiding the action bar
The `Input` component SHALL accept an optional `hideActionBar` boolean prop. When `true`, the entire action bar row is not rendered. Only the attachment tray and textarea remain inside the bordered box.

#### Scenario: Action bar hidden
- **WHEN** `hideActionBar={true}`
- **THEN** no action bar row is rendered inside the bordered box
- **THEN** the textarea (and attachment tray if attachments are present) is the sole content of the bordered box

#### Scenario: Default action bar rendered
- **WHEN** `hideActionBar` is absent or `false`
- **THEN** the action bar row is rendered (existing behaviour preserved)

---

### Requirement: Input component supports hiding the add button
The `Input` component SHALL accept an optional `hideAddButton` boolean prop. When `true`, the attach (+) button and its hidden `<input type="file">` are not rendered inside the component.

#### Scenario: Add button hidden
- **WHEN** `hideAddButton={true}`
- **THEN** the attach (+) button is not rendered inside the `Input` component
- **THEN** the action bar footer actions are right-aligned (no left element to justify against)

#### Scenario: Default add button rendered
- **WHEN** `hideAddButton` is absent or `false`
- **THEN** the attach (+) button is rendered on the left of the action bar (existing behaviour preserved)

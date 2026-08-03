## ADDED Requirements

---

### Requirement: Add menu button

The `Input` component SHALL include a `+` button (`GhostIconButton`, 40×40, icon 18px `BASE_ICON_SIZE`) that opens a `DialDropdown` positioned below the trigger (`placement="bottom-start"`). The menu lists available content sources; in phase 1 it contains a single item: "Attach file". Items are extensible — future phases add more sources without changing the trigger or surrounding layout.

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

The system SHALL render a card component for each pending attachment, displaying the file name, format label, and a type-appropriate icon. `type: image` shows a thumbnail; all other types show a file-type icon from `getAttachmentIcon`.

#### Scenario: File card default state

- **WHEN** an attachment of type `file` with status `idle` is rendered
- **THEN** the card displays the file name, format extension, and the matching `@tabler/icons-react` file icon

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

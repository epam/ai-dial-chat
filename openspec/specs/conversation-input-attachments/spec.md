# Spec: conversation-input-attachments

## Requirements

---

### Requirement: Attachment shared types

`libs/chat-shared` SHALL expose two attachment shapes:

- `ApiAttachment` — the wire/storage format that matches DIAL Core's `attachment` schema: `type: string`, `title: string`, `url?: string`, `data?: string`, `reference_type?: string`, `reference_url?: string`, `index?: number`.
- `UiAttachment` — the in-progress browser shape: `id: string`, `name: string`, `contentType: string`, `file: File`, `type: AttachmentType`, `status: RequestStatus`, `previewUrl?: string`, `apiAttachment?: ApiAttachment` (populated after successful upload).

`UiAttachment` is the type that flows through the input's local state during composition. `ApiAttachment` is what travels on the network, persists in DIAL `custom_content`, and is rendered in `MessageAttachmentTray` after reload.

#### Scenario: UiAttachment carries upload state

- **WHEN** a file is picked
- **THEN** the resulting `UiAttachment` has `status: Loading`, no `apiAttachment`, and a browser `File` reference

#### Scenario: UiAttachment becomes Idle with ApiAttachment after upload

- **WHEN** `uploadAttachment` resolves for a card
- **THEN** the `UiAttachment` has `status: Idle` and a populated `apiAttachment`

---

### Requirement: Add menu button

The `Input` component SHALL include a `+` button (`DialGhostIconButton`, 40×40, icon 18px `BASE_ICON_SIZE`) that opens a `DialDropdown` positioned below the trigger (`placement="bottom-start"`). The menu lists available content sources; today it contains a single item: "Attach file". Items are extensible — future phases add more sources without changing the trigger or surrounding layout.

#### Scenario: Plus button opens dropdown

- **WHEN** the user clicks the `+` button
- **THEN** a dropdown menu appears below it

#### Scenario: Dropdown closes on outside click

- **WHEN** the dropdown is open and the user clicks outside it
- **THEN** the dropdown closes

#### Scenario: Plus button aria-label

- **WHEN** the `+` button is rendered
- **THEN** it has an `aria-label` provided by the consumer via the `addMenuLabel` prop (default `"Add"`)

#### Scenario: Plus button keyboard activation

- **WHEN** the `+` button has focus and the user presses Enter or Space
- **THEN** the dropdown menu opens

#### Scenario: Attach file item

- **WHEN** the dropdown is open
- **THEN** an "Attach file" item is present, labelled via the `attachLabel` prop (default `"Attach file"`), with a paperclip icon

#### Scenario: Attach file item triggers file picker

- **WHEN** the user clicks the "Attach file" item
- **THEN** the native file picker opens

---

### Requirement: File picking creates UiAttachment in Loading state

The `Input` component SHALL include a visually-hidden `<input type="file" multiple>` triggered programmatically by the "Attach file" menu item. Each selected `File` SHALL be converted to a `UiAttachment` (`id`, `name`, `contentType`, `file`, `type`). When an `uploadAttachment` prop is provided, the initial `status` is `RequestStatus.Loading`; otherwise the initial `status` is `RequestStatus.Idle`. Image files additionally receive a `previewUrl` via `URL.createObjectURL`.

#### Scenario: Multiple files selectable

- **WHEN** the file picker opens
- **THEN** the user can select one or more files simultaneously

#### Scenario: Non-image file added

- **WHEN** the user selects a non-image file (e.g. `.csv`)
- **THEN** a `UiAttachment` with `type: AttachmentType.File` and no `previewUrl` is added to the list

#### Scenario: Image file added with preview

- **WHEN** the user selects an image file (MIME type starts with `image/`)
- **THEN** a `UiAttachment` with `type: AttachmentType.Image` and a valid `previewUrl` is added

#### Scenario: Object URL revoked on removal

- **WHEN** a `UiAttachment` with a `previewUrl` is removed
- **THEN** `URL.revokeObjectURL` is called with that URL

#### Scenario: Object URLs revoked on unmount

- **WHEN** the `Input` component unmounts while image attachments are present
- **THEN** `URL.revokeObjectURL` is called for every `previewUrl` in the list

---

### Requirement: Input drives the upload lifecycle

The `Input` component SHALL accept an injected `uploadAttachment?: (file: File) => Promise<ApiAttachment>` prop. When files are picked and `uploadAttachment` is provided, the component SHALL start each upload immediately, track per-attachment status, and expose retry for errored uploads. The library SHALL NOT contain any HTTP, `fetch`, or `axios` dependency — the consuming app injects the transport.

#### Scenario: Upload starts on file pick

- **WHEN** the user picks one or more files and `uploadAttachment` is provided
- **THEN** each new card appears in `Loading` state and `uploadAttachment(file)` runs in the background

#### Scenario: Upload success transitions to Idle

- **WHEN** `uploadAttachment` resolves for a card
- **THEN** the card's `status` becomes `Idle` and its `apiAttachment` is filled with the resolved value

#### Scenario: Upload failure transitions to Error

- **WHEN** `uploadAttachment` rejects for a card
- **THEN** the card's `status` becomes `Error` and a retry control is exposed on the card

#### Scenario: Retry restarts the upload

- **WHEN** the user clicks retry on an errored card
- **THEN** the card returns to `Loading` and `uploadAttachment` runs again with the original `File`

#### Scenario: No uploadAttachment — no network call

- **WHEN** `uploadAttachment` is omitted
- **THEN** picked cards stay in `Idle` indefinitely and the library makes no network request

---

### Requirement: AttachmentCard renders all states

The system SHALL render a card component for each attachment, displaying the file name, format label, and a type-appropriate icon. `type: image` shows a thumbnail; all other types show a file-type icon from `getAttachmentIcon`. The card visually reflects the `status` field of its `UiAttachment`.

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
- **THEN** the card displays an error appearance, a retry button (↺), and the remove button (×)

#### Scenario: Remove button on hover

- **WHEN** the user hovers over a card with status `idle` or `error`
- **THEN** a remove button (×) becomes visible

#### Scenario: Remove via keyboard

- **WHEN** the remove button has focus and the user presses Enter or Space
- **THEN** the attachment is removed

#### Scenario: Remove button aria-label

- **WHEN** the card is rendered
- **THEN** the remove button has an `aria-label` sourced from the `removeLabel` prop (default `"Remove attachment"`)

#### Scenario: Retry button aria-label

- **WHEN** a card in error state is rendered
- **THEN** the retry button has an `aria-label` sourced from the `retryLabel` prop (default `"Retry upload"`)

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

#### Scenario: Tray ARIA role

- **WHEN** the tray is rendered
- **THEN** it has `role="list"`

---

### Requirement: Send eligibility considers attachments

`canSend` SHALL be true iff (`message` has non-whitespace text **OR** at least one attachment has a populated `apiAttachment`) **AND** no attachment is currently in `Loading`. The send button is rendered only when `canSend` is true (and the component is not in streaming mode); otherwise it is hidden.

#### Scenario: Send hidden with empty text and no attachments

- **WHEN** the textarea is empty and no attachments are present
- **THEN** the send button is not rendered

#### Scenario: Send hidden while uploading

- **WHEN** any attachment has `status: Loading`
- **THEN** the send button is not rendered, regardless of text content

#### Scenario: Send enabled with attachment only

- **WHEN** the textarea is empty and exactly one attachment has `status: Idle` with a populated `apiAttachment`
- **THEN** the send button is rendered

#### Scenario: Send hidden with errored attachment only

- **WHEN** the textarea is empty and all attachments are in `Error`
- **THEN** the send button is not rendered

---

### Requirement: onSend payload is an object

`InputProps.onSend` and `ConversationInputProps.onSend` SHALL be `(payload: { message: string; attachments?: ApiAttachment[] }) => void`. The `attachments` array SHALL contain only attachments with a populated `apiAttachment`, in pick order. When no uploaded attachments are present, `attachments` SHALL be omitted (`undefined`) from the payload.

#### Scenario: Text-only send

- **WHEN** the user sends `"Hello"` with no attachments
- **THEN** `onSend` is called with `{ message: "Hello", attachments: undefined }`

#### Scenario: Attachment-only send

- **WHEN** the user sends with empty text and one uploaded attachment `a1`
- **THEN** `onSend` is called with `{ message: "", attachments: [a1] }`

#### Scenario: Text-and-attachments send

- **WHEN** the user sends `"Look"` with two uploaded attachments `a1`, `a2`
- **THEN** `onSend` is called with `{ message: "Look", attachments: [a1, a2] }`

#### Scenario: Component resets after send

- **WHEN** `onSend` fires successfully
- **THEN** the textarea is cleared and the attachment list is emptied

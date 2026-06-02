## ADDED Requirements

### Requirement: File picker opens via add menu

The `Input` component SHALL include a visually-hidden `<input type="file" multiple>` triggered programmatically when the "Attach file" item in the add menu is activated (see `add-menu` spec).

#### Scenario: Multiple files selectable

- **WHEN** the file picker opens
- **THEN** the user can select one or more files simultaneously

### Requirement: Selected files become Attachments

Each file selected via the picker SHALL be converted to an `Attachment` with a unique `id`, `name`, `contentType`, `file` reference, and `status: RequestStatus.Idle`. Image files additionally receive a `previewUrl` generated via `URL.createObjectURL`.

#### Scenario: Non-image file added

- **WHEN** the user selects a non-image file (e.g. `.csv`)
- **THEN** an `Attachment` with `type: AttachmentType.File`, `status: RequestStatus.Idle`, and no `previewUrl` is added to the list

#### Scenario: Image file added with preview

- **WHEN** the user selects an image file (MIME type starts with `image/`)
- **THEN** an `Attachment` with `type: AttachmentType.Image` and a valid `previewUrl` (object URL) is added

#### Scenario: Object URL revoked on removal

- **WHEN** an `Attachment` with a `previewUrl` is removed
- **THEN** `URL.revokeObjectURL` is called with that URL to prevent memory leaks

#### Scenario: Object URLs revoked on unmount

- **WHEN** the `Input` component unmounts while image attachments are present
- **THEN** `URL.revokeObjectURL` is called for every `previewUrl` in the attachment list

### Requirement: `onAttachmentsChange` callback

The `Input` and `ConversationInput` components SHALL accept an optional `onAttachmentsChange` prop typed as `(attachments: Attachment[]) => void`. It SHALL be called whenever the attachment list changes (add or remove).

#### Scenario: Callback fired on add

- **WHEN** files are selected and converted to `Attachment`s
- **THEN** `onAttachmentsChange` is called with the full updated list

#### Scenario: Callback fired on remove

- **WHEN** the user removes an attachment from the tray
- **THEN** `onAttachmentsChange` is called with the remaining list

#### Scenario: No callback — no error

- **WHEN** `onAttachmentsChange` is not provided
- **THEN** the component operates normally without throwing

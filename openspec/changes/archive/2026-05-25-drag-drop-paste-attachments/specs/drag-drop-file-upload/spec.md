## ADDED Requirements

---

### Requirement: Drop zone on ConversationInput

The `ConversationInput` component SHALL act as a drag-and-drop target for OS files. While one or more files are dragged over the component, a full-cover overlay SHALL be rendered over the `Input` area (excluding the welcome heading and outer padding) with a 1 px dashed border in `--stroke-accent-primary`, a semi-transparent `--bg-blackout` background, label text in `--text-secondary` using `dial-tiny-text`, sourced from the `dropLabel` prop (default `"Drop files here"`). This matches the `DialEmptyFileArea` drag-over visual style from `@epam/ai-dial-ui-kit`. Dropping the files SHALL add them to the attachment list using the same pipeline as the file picker.

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

#### Scenario: Overlay is scoped to the Input area only

- **WHEN** the drag-over overlay is shown
- **THEN** it covers only the `Input` component area and does not extend over the welcome heading or outer padding

#### Scenario: Overlay visual style matches DialEmptyFileArea

- **WHEN** the drag-over overlay is shown
- **THEN** it has a 1 px dashed border in `--stroke-accent-primary`, a semi-transparent `--bg-blackout` background, and label text in `--text-secondary` with `dial-tiny-text` sizing — matching the `DialEmptyFileArea` drag-over appearance

#### Scenario: Overlay border color is themeable

- **WHEN** `--ci-drop-overlay-border` is set on the root element
- **THEN** the overlay uses that value instead of `--stroke-accent-primary`

#### Scenario: Non-file drag items are ignored

- **WHEN** the user drags text or a browser element (no `files` in `dataTransfer`) over the component and releases
- **THEN** no attachments are added and the drop-zone overlay is not shown

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

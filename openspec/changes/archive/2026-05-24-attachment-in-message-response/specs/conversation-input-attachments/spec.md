## MODIFIED Requirements

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

### Requirement: `Input` clears attachments after successful send

After `onSend` resolves successfully, the `Input` component SHALL clear the internal attachment list, returning the tray to its empty (hidden) state.

#### Scenario: Tray clears after send

- **WHEN** the user sends a message with attachments and the send completes without error
- **THEN** the `AttachmentTray` is no longer rendered and the attachment list is empty

#### Scenario: Tray retained on send error

- **WHEN** the send fails (e.g. `onSend` rejects or `attachmentsToDialAttachments` throws)
- **THEN** the attachment list is unchanged so the user can retry

## ADDED Requirements

### Requirement: AttachmentCard renders file attachments

The system SHALL render a card component for each pending attachment, displaying the file name, format label, and a type-appropriate icon. Card appearance SHALL vary by `AttachmentType`: `file` shows a file-type icon; `image` shows a thumbnail preview; `prompt` shows a prompt icon; `pasted` shows a clipboard icon.

#### Scenario: File card default state

- **WHEN** an attachment of type `file` with status `idle` is rendered
- **THEN** the card displays the file name, the format extension label (e.g. `.csv`), and the appropriate `@tabler/icons-react` file icon

#### Scenario: Image card shows thumbnail

- **WHEN** an attachment of type `image` with a valid `previewUrl` is rendered
- **THEN** the card displays the image thumbnail instead of an icon

#### Scenario: Card in loading state

- **WHEN** an attachment has status `loading`
- **THEN** the card displays a spinner overlay and the remove button is hidden

#### Scenario: Card in error state

- **WHEN** an attachment has status `error`
- **THEN** the card displays a red border, a retry icon (↺), and the remove button (×)

#### Scenario: Card remove button on hover

- **WHEN** the user hovers over a card with status `idle` or `error`
- **THEN** a remove button (×) becomes visible on the card

### Requirement: AttachmentCard is keyboard accessible

The card SHALL be focusable and support keyboard interaction for removal.

#### Scenario: Remove via keyboard

- **WHEN** the card remove button has focus and the user presses Enter or Space
- **THEN** the attachment is removed from the pending list

#### Scenario: Card focus state

- **WHEN** the card or its remove button receives keyboard focus
- **THEN** a visible focus ring is displayed (matching the design's Focus state)

### Requirement: AttachmentCard i18n

All user-visible labels on the card SHALL use i18n keys.

#### Scenario: Remove button aria-label

- **WHEN** the card is rendered
- **THEN** the remove button has `aria-label` sourced from i18n key `conversationInput.attachment.remove`

#### Scenario: Retry button aria-label

- **WHEN** a card in error state is rendered
- **THEN** the retry icon button has `aria-label` sourced from i18n key `conversationInput.attachment.retry`

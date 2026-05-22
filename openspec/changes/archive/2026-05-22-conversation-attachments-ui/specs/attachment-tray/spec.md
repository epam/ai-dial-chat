## ADDED Requirements

### Requirement: AttachmentTray renders the pending attachment list

The system SHALL render a horizontally scrollable row of `AttachmentCard` components above the textarea when `PendingAttachment[]` is non-empty. The tray SHALL be hidden when the list is empty.

#### Scenario: Tray visible with attachments

- **WHEN** one or more attachments are in the pending list
- **THEN** the `AttachmentTray` is rendered above the textarea with one `AttachmentCard` per attachment

#### Scenario: Tray hidden when empty

- **WHEN** the pending attachment list is empty
- **THEN** the `AttachmentTray` is not rendered (returns null or is hidden from the DOM)

#### Scenario: Tray scrolls horizontally

- **WHEN** the number of cards exceeds the available horizontal width
- **THEN** the tray scrolls horizontally and all cards remain accessible via scroll

### Requirement: Removing a card updates the tray

The system SHALL remove the corresponding card from the tray immediately when the user clicks or activates the remove button.

#### Scenario: Remove card

- **WHEN** the user clicks the remove (×) button on an `AttachmentCard`
- **THEN** that card is removed from the tray and the `onAttachmentsChange` callback is called with the updated list

#### Scenario: Last card removed hides tray

- **WHEN** the user removes the last remaining card
- **THEN** the tray is no longer rendered

### Requirement: AttachmentTray accessibility

The tray region SHALL be labelled for screen readers.

#### Scenario: Tray ARIA label

- **WHEN** the tray is rendered
- **THEN** it has `role="list"` and `aria-label` sourced from i18n key `conversationInput.attachmentTray.label`

# edit-message Specification

## Purpose

Specifies inline editing of user messages within a conversation: entering edit mode, modifying text and attachments, submitting (truncates subsequent messages and re-runs the AI), and cancelling.

---

### Requirement: Edit button availability
The edit button on user message bubbles SHALL be visible at all times and disabled while the AI is streaming a response or when the conversation is read-only.

#### Scenario: Edit button visible on user message
- **WHEN** a user message is rendered in the conversation
- **THEN** an edit button is displayed alongside the message actions

#### Scenario: Edit button disabled during streaming
- **WHEN** the AI is actively streaming a response
- **THEN** all edit buttons in the conversation are disabled and not interactive

#### Scenario: Edit button hidden in read-only conversation
- **WHEN** the conversation is read-only (isReadonly flag set or user lacks WRITE permission)
- **THEN** the edit button is not rendered on any user message
- **AND** clicking a user message does not trigger edit mode

---

### Requirement: Entering edit mode
Clicking the edit button on a user message SHALL replace the static message bubble with an inline editable area pre-populated with the original message text and attachments.

#### Scenario: Edit mode activated
- **WHEN** the user clicks the edit button on a user message
- **THEN** the message bubble is replaced by an inline editable input area
- **THEN** the textarea contains the original message text
- **THEN** existing attachments are displayed inside the bordered textarea box, in the same attachment tray as any newly added attachments

#### Scenario: Edit mode on mobile
- **WHEN** the user taps the edit button on a mobile device
- **THEN** the inline edit area appears in-place (same layout as desktop, no bottom sheet)

#### Scenario: Multiple messages in edit mode
- **WHEN** the user clicks the edit button on a second message while another is already in edit mode
- **THEN** both messages are simultaneously in edit mode

---

### Requirement: Edit area layout
The inline edit area consists of two parts stacked vertically:
1. A bordered box containing the attachment tray (pre-existing and newly added attachments shown together) and the textarea below it.
2. An action row below the bordered box: the attach (+) button on the left, Cancel and Save & Submit buttons on the right.

#### Scenario: Action bar layout
- **WHEN** a message is in edit mode
- **THEN** a bordered box is shown containing the attachment tray (when attachments are present) and the textarea
- **THEN** below the bordered box: an attach (+) button is shown on the left
- **THEN** a Cancel button (neutral style) and a Save & Submit button (primary style) are shown on the right of the action row

#### Scenario: Save & Submit button disabled when text is empty
- **WHEN** the user clears all text from the edit textarea
- **THEN** the Save & Submit button is disabled

---

### Requirement: Managing attachments in edit mode
While in edit mode, the user SHALL be able to remove existing attachments and add new ones, subject to the same restrictions as the conversation input.

#### Scenario: Removing an existing attachment
- **WHEN** the user clicks the remove button on an attachment card in the edit area
- **THEN** the attachment is removed from the edit area

#### Scenario: Adding a new attachment
- **WHEN** the user clicks the attach (+) button in the action row
- **THEN** a file picker opens (desktop: dropdown menu; mobile: bottom sheet)
- **WHEN** the user selects a file
- **THEN** the new file appears in the shared attachment tray inside the bordered box, alongside any pre-existing attachments

---

### Requirement: Cancelling an edit
Clicking Cancel SHALL exit edit mode and restore the original message bubble with its original text and attachments unchanged.

#### Scenario: Cancel restores original state
- **WHEN** the user clicks the Cancel button in the edit area
- **THEN** the editable area is replaced by the original static message bubble
- **THEN** the original message text and attachments are displayed unchanged

---

### Requirement: Submitting an edit
Clicking Save & Submit (or pressing Enter in the textarea) SHALL update the message content, discard all subsequent messages, silently cancel any other active edits, and re-run the AI from that message.

#### Scenario: Successful edit submission
- **WHEN** the user modifies the text in the edit area and clicks Save & Submit
- **THEN** the message content is updated to the new text
- **THEN** all messages after the edited message are removed from the conversation
- **THEN** the AI is re-triggered with the updated message and attachments
- **THEN** a new streaming assistant response begins

#### Scenario: Other edits silently cancelled on submit
- **WHEN** the user submits an edit while other messages are also in edit mode
- **THEN** all other edit areas are silently exited without any confirmation or notification
- **THEN** those messages revert to their original content (no change applied)

#### Scenario: Edit with attachment changes
- **WHEN** the user adds or removes attachments and clicks Save & Submit
- **THEN** the updated attachment list is saved with the message
- **THEN** the AI receives the updated attachments in the new stream request

#### Scenario: Enter key submits the edit
- **WHEN** the edit textarea is focused and the user presses Enter (without Shift)
- **THEN** the edit is submitted (equivalent to clicking Save & Submit)

---

### Requirement: i18n keys for edit UI
All user-visible strings in the edit area SHALL use i18n keys.

#### Scenario: Cancel button label
- **WHEN** the edit area is rendered
- **THEN** the Cancel button label uses the i18n key `actions.cancel`

#### Scenario: Save & Submit button label
- **WHEN** the edit area is rendered
- **THEN** the Save & Submit button label uses the i18n key `actions.saveAndSubmit`

---

### Requirement: Accessibility of edit mode
The edit area SHALL be keyboard-navigable and provide appropriate ARIA labels.

#### Scenario: Edit area aria-label
- **WHEN** the inline edit textarea is rendered
- **THEN** it has an `aria-label` identifying it as an edit area (i18n key: `actions.editMessage`)

#### Scenario: Cancel and Save buttons are keyboard-focusable
- **WHEN** the edit area is active
- **THEN** the Cancel and Save & Submit buttons can be reached and activated via keyboard Tab and Enter/Space

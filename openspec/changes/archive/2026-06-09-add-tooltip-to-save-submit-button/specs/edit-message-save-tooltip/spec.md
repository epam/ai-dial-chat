# Specification: Edit Message Save & Submit Tooltip

## Overview

The Save & Submit button, which appears when editing user or assistant messages, SHALL display helpful tooltip explanations that inform users why the button is disabled and what action they should take to enable it.

## ADDED Requirements

### Requirement: Save & Submit tooltip displays when button is disabled

The system SHALL display a tooltip on the Save & Submit button explaining why the button is disabled. The tooltip text SHALL be contextual based on the disable condition.

#### Scenario: Attachment is uploading
- **WHEN** user is editing a message and a file attachment is in the uploading state
- **THEN** the Save & Submit button is disabled and displays tooltip "Wait for attachment to load"

#### Scenario: Message content is empty
- **WHEN** user is editing a message and the message content is empty (no text and no attachments)
- **THEN** the Save & Submit button is disabled and displays tooltip "Please type message"

#### Scenario: Transcription is in progress (user messages only)
- **WHEN** user is editing their own message and transcription is active
- **THEN** the Save & Submit button is disabled and displays tooltip "Wait for transcription to complete"

#### Scenario: Multiple conditions are true
- **WHEN** user is editing a message and multiple disable conditions are simultaneously true (e.g., file uploading AND content empty)
- **THEN** the Save & Submit button displays the highest-priority tooltip (upload takes precedence over empty content, which takes precedence over transcription)

### Requirement: Tooltip is hidden when Save & Submit button is enabled

The system SHALL hide the tooltip when the Save & Submit button is enabled and ready to be clicked.

#### Scenario: Button becomes enabled
- **WHEN** user edits a message so that all disable conditions are resolved (e.g., attachment finishes uploading, user types content)
- **THEN** the Save & Submit button becomes enabled and the tooltip is hidden

#### Scenario: User submits message
- **WHEN** user clicks an enabled Save & Submit button to submit the edited message
- **THEN** the message is submitted and the edit dialog closes (no tooltip visible during submission)

### Requirement: Tooltips apply to all message edit contexts

The system SHALL display tooltips on Save & Submit buttons in both user-initiated edits and assistant message edits.

#### Scenario: User message edit tooltip
- **WHEN** user clicks Edit on their own message in the conversation
- **THEN** the Save & Submit button in the edit dialog displays appropriate tooltips based on message content and upload state

#### Scenario: Assistant message edit tooltip
- **WHEN** user clicks Edit on an assistant message in the conversation
- **THEN** the Save & Submit button in the edit dialog displays appropriate tooltips based on message content and upload state (note: transcription condition not applicable for assistant messages)

### Requirement: Tooltip styling matches existing patterns

The system SHALL display Save & Submit tooltips using the same styling, positioning, and interaction patterns as other tooltips in the chat application.

#### Scenario: Tooltip appearance
- **WHEN** Save & Submit button is disabled
- **THEN** tooltip appears above the button (default top positioning), is clickable on the button element, and uses the same color/font styling as other ui-kit tooltips

#### Scenario: Tooltip dismissal
- **WHEN** user hovers away from the button or closes the edit dialog
- **THEN** the tooltip is dismissed/hidden

### Requirement: Tooltip content uses localized strings

The system SHALL use i18n-localized strings for all tooltip messages.

#### Scenario: Localized wait for attachment message
- **WHEN** file attachment is uploading and tooltip is displayed in a non-English locale
- **THEN** tooltip message is translated to the user's language (e.g., Russian, French)

#### Scenario: Localized empty content message
- **WHEN** message content is empty and tooltip is displayed in a non-English locale
- **THEN** tooltip message is translated to the user's language

#### Scenario: Localized transcription message
- **WHEN** transcription is in progress and tooltip is displayed in a non-English locale
- **THEN** tooltip message is translated to the user's language

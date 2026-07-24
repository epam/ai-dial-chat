## MODIFIED Requirements

### Requirement: Submit always creates a publish request and is not blocked by publication history

The pinned footer's submit button SHALL always show the fixed label "Publish" (i18n key `buttons.publish`) regardless of folder selection — never an "Update version" variant, since conversations have no version to update. Each submission creates a new admin-approval request rather than updating or replacing an existing published conversation. Therefore, prior publication history for the selected folder is informational only and SHALL NOT disable the submit button or show an "already published" or replace-warning callout. When the selected folder is valid and writable and no submission is already in flight, the user SHALL be allowed to submit another publish request for the same conversation and folder.

**Temporary history-visibility exception (tracked in [GitHub issue #7897](https://github.com/epam/ai-dial-chat/issues/7897)):** `PublishConversationPanelContainer` SHALL NOT call the publish-history endpoint while it returns 503 from DIAL Core. For the duration of this exception, `history` SHALL remain empty and no prior requests SHALL be displayed in the panel. This affects history visibility only; publish eligibility is unchanged because publication history is not a deduplication or authorization input. The history fetch and display SHALL be restored when the backend publish-history endpoint (`conversation-publish-api`'s "Publish history endpoint" requirement) is fixed.

#### Scenario: First publish to a folder is allowed
- **GIVEN** the conversation has never been published to the selected folder
- **WHEN** the user selects that folder
- **THEN** the submit button is enabled and reads "Publish"

#### Scenario: Another publish request to a previously used folder is allowed
- **GIVEN** the conversation has a prior publication in the selected folder
- **WHEN** the user selects that folder
- **THEN** the submit button remains enabled and reads "Publish"
- **AND** no "already published" or replace-warning callout is shown
- **WHEN** the user clicks "Publish"
- **THEN** a new admin-approval request is submitted

#### Scenario: Long folder names never appear in the button label
- **WHEN** any folder or the root is selected, regardless of name length
- **THEN** the submit button label remains the fixed "Publish" text, never interpolating the destination name

#### Scenario: Disabling history retrieval does not change publish eligibility
- **GIVEN** the publish-history fetch is disabled per the temporary exception above
- **WHEN** the user selects a valid writable folder
- **THEN** the submit button is enabled and reads "Publish"
- **AND** the user can submit a new admin-approval request regardless of whether that folder was used previously

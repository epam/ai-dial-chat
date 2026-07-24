## MODIFIED Requirements

### Requirement: Submit button always reads "Publish"; already-published-to-folder disables submit instead of offering replace

The pinned footer's submit button SHALL always show the fixed label "Publish" (i18n key `conversationPublish.submitLabel`) regardless of folder selection — never an "Update version" variant, since conversations have no version to update. When the selected folder already has a prior publication of this same conversation (history for that folder is non-empty), the submit button SHALL be disabled and a distinct callout (i18n key `conversationPublish.alreadyPublishedWarning`, NOT the catalog `ReplaceWarning` wording) SHALL be shown, since there is no supported "publish again to the same folder" action in this iteration (see design.md D2).

**Temporary exception (tracked in [GitHub issue #7897](https://github.com/epam/ai-dial-chat/issues/7897)):** `PublishConversationPanelContainer` SHALL NOT call the publish-history endpoint while it returns 503 from DIAL Core. For the duration of this exception, `history` SHALL remain permanently empty, so the "already published" callout and disabled-submit behavior described above SHALL NOT trigger for any folder, even one that genuinely already has a prior publication of the conversation. This exception SHALL be lifted — restoring the fetch and the full requirement above — as soon as the backend publish-history endpoint (`conversation-publish-api`'s "Publish history endpoint" requirement) is fixed; the exception itself is not a permanent relaxation of this requirement.

#### Scenario: First publish to a folder is allowed
- **GIVEN** the conversation has never been published to the selected folder
- **WHEN** the user selects that folder
- **THEN** the submit button is enabled and reads "Publish"

#### Scenario: Republishing to an already-published folder is blocked
- **GIVEN** the conversation has a prior publication in the selected folder
- **WHEN** the user selects that folder
- **THEN** the submit button is disabled and the "already published" callout is shown instead of a replace-warning

#### Scenario: Long folder names never appear in the button label
- **WHEN** any folder or the root is selected, regardless of name length
- **THEN** the submit button label remains the fixed "Publish" text, never interpolating the destination name

#### Scenario: While the temporary exception is active, a genuinely-republished folder still submits successfully
- **GIVEN** the publish-history fetch is disabled per the temporary exception above
- **AND** the conversation has a prior publication in the selected folder (unknown to the frontend, since history is never fetched)
- **WHEN** the user selects that folder
- **THEN** the submit button is enabled and reads "Publish" (the disabled-submit/callout behavior does not trigger), because `history` is always empty while the exception is in effect

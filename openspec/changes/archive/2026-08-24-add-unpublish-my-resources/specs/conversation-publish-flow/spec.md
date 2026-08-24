## MODIFIED Requirements

### Requirement: Submit always creates a publish request and is not blocked by publication history

The pinned footer's submit button SHALL always show the fixed label "Publish" (i18n key `buttons.publish`) regardless of folder selection — never an "Update version" variant, since conversations have no version to update.

Publication history SHALL be fetched for real. `PublishConversationPanelContainer` previously hardcoded `history` to an empty array behind a comment citing a DIAL Core `503` ([GitHub issue #7897](https://github.com/epam/ai-dial-chat/issues/7897)); the backend endpoint exists and is specified by `conversation-publish-api`, and its result is now required by `conversation-unpublish-flow` to know which folders the conversation is published to. The container SHALL therefore receive real history — fetched once per conversation by the conversation panel and handed down, not fetched again here.

Because history is now real, the container's existing `allowReplace={false}` becomes observable, and it SHALL be honoured: when the selected folder already holds a publication of this conversation, `derivePublishState` yields `PublishCalloutKind.ReplaceWarning` and the submit button SHALL be **disabled**, with the callout text supplied by the host as `conversationPublish.alreadyPublishedWarning`. A conversation carries no version, so a second publish to the same folder cannot update or replace the first — it would create a duplicate public copy — which is exactly what `allowReplace: false` exists to prevent.

This reverses this requirement's previous statement that history is informational only and never blocks submission. That statement was written while history was hardcoded empty, so the branch was unreachable and the disagreement with `allowReplace={false}`, its own doc comment in `PublishDerivationInput`, and the already-translated `alreadyPublishedWarning` string was invisible. The code's intent wins; see the change's design.md D6.

Selecting a different, not-yet-used folder SHALL clear the callout and re-enable submit. When the selected folder is valid, writable, unused, and no submission is in flight, the user SHALL be allowed to submit.

While history is loading or has failed to load, submission SHALL NOT be blocked — an unknown history is not evidence of an existing publication, and the panel already surfaces the loading and error states of the history list itself.

#### Scenario: First publish to a folder is allowed
- **GIVEN** the conversation has never been published to the selected folder
- **WHEN** the user selects that folder
- **THEN** the submit button is enabled and reads "Publish"

#### Scenario: A folder already published to blocks re-submission
- **GIVEN** the conversation has a prior publication in the selected folder
- **WHEN** the user selects that folder
- **THEN** the already-published callout is shown with the host-supplied `conversationPublish.alreadyPublishedWarning` text
- **AND** the submit button is disabled

#### Scenario: Choosing another folder re-enables submit
- **GIVEN** the already-published callout is shown for the selected folder
- **WHEN** the user selects a folder the conversation has not been published to
- **THEN** the callout is replaced by the informational callout and the submit button is enabled

#### Scenario: Unknown history does not block submission
- **GIVEN** the publish-history request is still in flight or has failed
- **WHEN** the user selects a valid writable folder
- **THEN** the submit button is enabled and reads "Publish"

#### Scenario: Long folder names never appear in the button label
- **WHEN** any folder or the root is selected, regardless of name length
- **THEN** the submit button label remains the fixed "Publish" text, never interpolating the destination name

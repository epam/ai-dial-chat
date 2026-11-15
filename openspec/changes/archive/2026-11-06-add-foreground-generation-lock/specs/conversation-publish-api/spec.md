## ADDED Requirements

### Requirement: Publish is refused while any generation holds the conversation

`ConversationPublishService` (`apps/chat-api/src/conversations/conversation-publish.service.ts`) SHALL decide "still generating" with `findActiveGeneration` (`foreground-generation-lock`) rather than with `findPendingBackgroundMessage` alone. A conversation whose re-fetched stored version holds either of these SHALL be rejected with `ConflictException` (409, `PUBLISH_WHILE_GENERATING_MESSAGE`) before `createPublication` is called:

- a `pending` background message;
- a live `foregroundGeneration` marker.

Core copies the stored file, so a published copy would keep a marker no viewer can resolve.

An expired foreground marker SHALL NOT block publishing.

The response body and status are the ones the pending-background case already returns, so the frontend's existing publish-error notification shows the same "still being generated" message. No new string, i18n key or generated-client change.

#### Scenario: Publish while a foreground answer is generating

- **WHEN** the re-fetched conversation contains a live `foregroundGeneration` marker
- **THEN** the service throws `ConflictException` (409) with `PUBLISH_WHILE_GENERATING_MESSAGE` and does not call `createPublication`

#### Scenario: An expired marker does not block publishing

- **WHEN** the only marker in the re-fetched conversation is an expired `foregroundGeneration`
- **THEN** the publication is created as for a conversation without a marker

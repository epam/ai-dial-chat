# Spec Delta

## MODIFIED Requirements

### Requirement: Detect an unresolved generation placeholder on conversation load

`apps/chat/src/utils/generation-resume.ts` SHALL export a pure predicate `isAwaitingGenerationResume(conversation)` that returns `true` when the conversation's last message has `role: assistant`, empty `content`, and neither `streamErrorMessage` nor `wasStoppedByUser` set. `Conversation.tsx`'s `loadConversation` SHALL call this predicate for the non-user-last-message branch (the branch that currently just calls `setConversation(result)`) and treat a `true` result as "a generation was still active elsewhere when this page loaded," distinct from a normally finished conversation.

The predicate SHALL also return `true` when any message of the conversation has `backgroundGeneration.status: "pending"`, whatever that message's position or payload (a status message may follow it, and it may already carry a `responseId`), and SHALL return `false` for a conversation whose background messages are all finished and whose last message is not otherwise an unresolved placeholder. For conversations without `backgroundGeneration` the predicate is unchanged.

#### Scenario: Refresh mid-generation loads an unresolved placeholder

- **WHEN** `loadConversation` fetches a conversation whose last message is `{ role: assistant, content: '' }` with no `streamErrorMessage` and no `wasStoppedByUser`
- **THEN** `isAwaitingGenerationResume` returns `true` and the page treats the conversation as awaiting generation resume instead of rendering it as a finished, empty response

#### Scenario: Finished or terminally-stopped conversation is not treated as awaiting resume

- **WHEN** the last message has non-empty `content`, or has a `streamErrorMessage`, or has `wasStoppedByUser: true`
- **THEN** `isAwaitingGenerationResume` returns `false` and the conversation renders normally

#### Scenario: Pending background message followed by a status message

- **WHEN** the conversation's messages are `[user, assistant{backgroundGeneration.status: "pending", responseId}, status(model changed)]`
- **THEN** `isAwaitingGenerationResume` returns `true`

### Requirement: Awaiting-resume state reuses the existing streaming state

`apps/chat/src/hooks/conversation/useConversationStream.ts` SHALL expose a function (e.g. `resumeIfAwaitingGeneration(conversationId, conversation)`) that, when `isAwaitingGenerationResume(conversation)` is `true`, adds the conversation's path to the same `streamingPaths` set that backs `isStreaming`/`isAssistantTyping` for a live generation — without issuing a new completion request. State ownership stays entirely inside `useConversationStream`; no new prop or context is introduced to `ConversationMessageItem` or `useConversationHandlers` — they continue reading `isStreaming`/`isAssistantTyping` as they do today. `ConversationView` MAY receive a separate stop-availability flag so a resumed server-side generation that lacks a local `generationId` can block input like streaming without exposing a non-functional Stop action. A resumed background message supplies its own `generationId` (`backgroundGeneration.generationId`), so for it Stop SHALL be exposed and functional, as `chat-hooks-conversation-stream` "Stop is available for a resumed background generation" defines.

#### Scenario: Typing indicator renders during resume

- **WHEN** `resumeIfAwaitingGeneration` has added the conversation's path to `streamingPaths`
- **THEN** `ConversationView` receives `isAssistantTyping: true` for that conversation and renders the same typing/thinking indicator used during a live generation, instead of a static empty bubble

#### Scenario: Regenerate is a no-op while resuming, not a 409

- **WHEN** the user clicks Regenerate on the placeholder message while the resume watch is active
- **THEN** `useConversationHandlers.handleRegenerateMessage`'s existing `isStreaming` guard short-circuits and no completion request is sent, so no `409 "Generation is already active"` error surfaces

#### Scenario: Edit and starter actions are also suppressed while resuming

- **WHEN** the resume watch is active for the displayed conversation
- **THEN** `handleEditMessage` and starter-submit handlers also no-op via their existing `isStreaming` guards, consistent with their behavior during a live generation

#### Scenario: Stop is not exposed while resuming without a local generation id

- **WHEN** the resume watch is active for the displayed conversation but the current page instance did not start that generation, has no local `generationId`, and the resumed message has no `backgroundGeneration`
- **THEN** the message input remains in streaming/blocked mode but does not render an actionable Stop control, and no `stopCompletion` request is sent for the resumed generation

#### Scenario: Stop is exposed while resuming a background generation

- **WHEN** the resume is active for a conversation whose pending message has `backgroundGeneration.generationId`
- **THEN** an actionable Stop control is rendered and activating it sends `stopCompletion` with that id

# Spec Delta

## MODIFIED Requirements

### Requirement: Awaiting-resume state reuses the existing streaming state

`useConversationStream` (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`) SHALL expose `resumeIfAwaitingGeneration(conversationId, conversation)` (built by `createResumeIfAwaitingGeneration` in `generation-resume.ts`) that, when `isAwaitingGenerationResume(conversation)` is `true`, adds the conversation's path to the same `streamingPaths` set that backs `isStreaming`/`isAssistantTyping` for a live generation — without issuing a new completion request. A path already being resumed (tracked in `resumingPathsRef`) is not resumed a second time. State ownership stays entirely inside `useConversationStream`; no new prop or context is introduced to `ConversationMessageItem` or `useConversationHandlers` (`libs/chat-hooks`) — they continue reading `isStreaming`/`isAssistantTyping` as they do today. `ConversationView` receives the separate stop-availability flag `canStopStreaming` so a resumed server-side generation whose `generationId` is not known can block input like streaming without exposing a non-functional Stop action. A resumed background message supplies its own `generationId` (`backgroundGeneration.generationId`), and a non-background generation resumed through `resumeIfAwaitingGeneration` and served by attach supplies it on the attach `snapshot` event (the conflict handover and stream recovery keep their own Stop behavior) (`generation-live-replay` "A registry-served attach tells the client the generation id"); for both, Stop SHALL be exposed and functional, as `chat-hooks-conversation-stream` "Stop is available for a resumed background generation" and "Stop is available for a resumed foreground generation" define.

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

- **WHEN** the resume watch is active for the displayed conversation but the current page instance did not start that generation, has no local `generationId`, the resumed message has no `backgroundGeneration`, and no attach `snapshot` supplied a `generationId` (attach unavailable, the watch fallback, or a backend that does not send the field)
- **THEN** the message input remains in streaming/blocked mode but does not render an actionable Stop control, and no `stopCompletion` request is sent for the resumed generation

#### Scenario: Stop is exposed while resuming a non-background generation through attach

- **WHEN** the resume is attached to a non-background generation and the attach `snapshot` event carried a `generationId`
- **THEN** an actionable Stop control is rendered and activating it sends `stopCompletion` with that id

#### Scenario: Stop is exposed while resuming a background generation

- **WHEN** the resume is active for a conversation whose pending message has `backgroundGeneration.generationId`
- **THEN** an actionable Stop control is rendered and activating it sends `stopCompletion` with that id

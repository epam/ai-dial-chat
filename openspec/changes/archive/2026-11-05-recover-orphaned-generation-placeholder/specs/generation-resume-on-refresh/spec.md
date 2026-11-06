# Spec Delta

## MODIFIED Requirements

### Requirement: Awaiting-resume state reuses the existing streaming state

`useConversationStream` (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`) SHALL expose `resumeIfAwaitingGeneration(conversationId, conversation)` (built by `createResumeIfAwaitingGeneration` in `generation-resume.ts`) that, when `isAwaitingGenerationResume(conversation)` is `true`, adds the conversation's path to the same `streamingPaths` set that backs `isStreaming`/`isAssistantTyping` for a live generation — without issuing a new completion request. A path already being resumed (tracked in `resumingPathsRef`) is not resumed a second time. State ownership stays entirely inside `useConversationStream`; no new prop or context is introduced to `ConversationMessageItem` or `useConversationHandlers` (`libs/chat-hooks`) — they continue reading `isStreaming`/`isAssistantTyping` as they do today. `ConversationView` receives the separate stop-availability flag `canStopStreaming` so a resumed server-side generation whose `generationId` is not known can block input like streaming without exposing a non-functional Stop action. A resumed background message supplies its own `generationId` (`backgroundGeneration.generationId`), and a non-background generation resumed through `resumeIfAwaitingGeneration` and served by attach supplies it on the attach `snapshot` event (the conflict handover and stream recovery keep their own Stop behavior) (`generation-live-replay` "A registry-served attach tells the client the generation id"); for both, Stop SHALL be exposed and functional, as `chat-hooks-conversation-stream` "Stop is available for a resumed background generation" and "Stop is available for a resumed foreground generation" define.

For a non-background generation this streaming state holds only until the resume learns that nothing is producing the answer here: attach is unavailable and the fallback watch's immediate re-check still returns the unresolved placeholder. At that point the path SHALL be released and the message shown as interrupted (`An unresolved placeholder is shown as interrupted without blocking the chat`), while the watch continues in the background. A pending background message keeps this streaming state until it settles.

#### Scenario: Typing indicator renders during resume

- **WHEN** `resumeIfAwaitingGeneration` has added the conversation's path to `streamingPaths`
- **THEN** `ConversationView` receives `isAssistantTyping: true` for that conversation and renders the same typing/thinking indicator used during a live generation, instead of a static empty bubble

#### Scenario: Regenerate is a no-op while resuming, not a 409

- **WHEN** the user clicks Regenerate on the placeholder message while the resume is attached to a live generation, or before the fallback check has answered
- **THEN** `useConversationHandlers.handleRegenerateMessage`'s existing `isStreaming` guard short-circuits and no completion request is sent, so no `409 "Generation is already active"` error surfaces

#### Scenario: Edit and starter actions are also suppressed while resuming

- **WHEN** the resume is attached to a live generation, or has not yet completed the fallback check, for the displayed conversation
- **THEN** `handleEditMessage` and starter-submit handlers also no-op via their existing `isStreaming` guards, consistent with their behavior during a live generation

#### Scenario: Stop is not exposed while resuming without a local generation id

- **WHEN** the resume is active for the displayed conversation but the current page instance did not start that generation, has no local `generationId`, the resumed message has no `backgroundGeneration`, and no attach `snapshot` supplied a `generationId` (attach not yet answered, or a backend that does not send the field)
- **THEN** the message input remains in streaming/blocked mode but does not render an actionable Stop control, and no `stopCompletion` request is sent for the resumed generation

#### Scenario: Stop is exposed while resuming a non-background generation through attach

- **WHEN** the resume is attached to a non-background generation and the attach `snapshot` event carried a `generationId`
- **THEN** an actionable Stop control is rendered and activating it sends `stopCompletion` with that id

#### Scenario: Stop is exposed while resuming a background generation

- **WHEN** the resume is active for a conversation whose pending message has `backgroundGeneration.generationId`
- **THEN** an actionable Stop control is rendered and activating it sends `stopCompletion` with that id

### Requirement: Resume watch times out and always releases the generating state

The fallback watch path SHALL be bounded by a module-private timeout constant (`GENERATION_RESUME_WATCH_TIMEOUT_MS`, 5 minutes) analogous to `DISPLAY_NAME_WATCH_TIMEOUT_MS`; the attach path deliberately has none, so a long-running generation is not abandoned. For a non-background generation the bound limits only the background wait: the path is already released and the message already shown as interrupted when the watch starts waiting, so the timeout changes nothing the user sees. On timeout, or when the watch stream ends without a qualifying event, the watch SHALL abort the SSE fetch, perform one final `getConversation` call, apply whatever result comes back to local state, and remove the conversation's path from `streamingPaths` unconditionally — also when that final call fails, in which case the hook reports a conversation reload error (`hasConversationReloadError`) instead of applying a result — so Regenerate, edit, and other actions are available even if the placeholder is still unresolved.

#### Scenario: Watch times out without a qualifying event

- **WHEN** `GENERATION_RESUME_WATCH_TIMEOUT_MS` elapses without a qualifying `UPDATE` event
- **THEN** the resume watch aborts, performs one final `getConversation`, updates local state with that result, and removes the conversation's path from `streamingPaths`

## ADDED Requirements

### Requirement: An unresolved placeholder is shown as interrupted without blocking the chat

When a resume of a non-background generation finds that nothing is producing the answer here, the hook SHALL show the unresolved assistant placeholder as interrupted and SHALL NOT keep the chat blocked. "Nothing is producing the answer here" means one of: attach is unavailable (`404`, a network error, or any unexpected response) and the fallback watch's immediate re-check returns the conversation still ending in the unresolved placeholder (the one `isAwaitingGenerationResume` recognises, with no generated payload); the fallback watch has no immediate re-check because it could not be opened and the final reload returns that placeholder; or an attach ended without a terminal event and the reload returns that placeholder.

The hook SHALL show the message as interrupted by setting a local `streamErrorMessage` on the displayed message at the index the resume was started for, using the host-supplied interrupted text (`chat-hooks-conversation-stream` "The hook accepts an interrupted-generation message"), so the existing stream-error card renders with its retry action. It SHALL release the path from `streamingPaths` at the same moment, so Regenerate, edit, starters and sending work. When the fallback watch is open, it SHALL keep watching until its bound, and a qualifying update that returns a saved answer SHALL replace the interrupted message with that answer unless a newer generation has taken over the path. A generation the user starts on the path SHALL supersede the watch, which SHALL then change no displayed state.

The hook cannot tell a generation that is nowhere from one running on another instance, and SHALL NOT claim to: it neither fences nor blocks a retry, consistent with `backend-owned-generation-persistence` "Fencing guarantees are process-local, and storage-side fencing is not claimed". The interrupted text SHALL therefore say the response may have been interrupted, not that it was lost.

This SHALL be display-only: the hook SHALL NOT save the conversation, and the stored placeholder SHALL stay as it is. It SHALL NOT apply while attach is serving a live generation, to a pending background message, to a conversation that settled with a saved answer, or to a placeholder whose content the page retains (that case keeps the persistence warning).

**UI / i18n / RTL / a11y impact:** one new host string (`chat.generationInterrupted`); it renders in the existing stream-error card, so direction handling, the alert semantics and the retry control are reused unchanged. Not gated behind `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`. No new telemetry. State ownership stays inside `useConversationStream`; no context or prop is added to the message components.

#### Scenario: Attach is unavailable and the placeholder is unresolved

- **WHEN** a conversation is loaded whose last message is the unresolved placeholder, attach answers `404`, and the watch's immediate re-check still returns that placeholder
- **THEN** the message shows the interrupted text with its retry action, `isStreaming` is false, the input accepts a new message, no save request is sent, and the watch keeps running

#### Scenario: The answer arrives while the watch runs in the background

- **WHEN** the message is shown as interrupted and the watch receives an update whose reload returns the saved answer
- **THEN** the saved answer replaces the interrupted message

#### Scenario: The user sends while the watch runs

- **WHEN** the message is shown as interrupted and the user sends a new message
- **THEN** the new generation owns the path, a later watch update changes no displayed state, and no interrupted text is applied over the new generation

#### Scenario: Attach is serving a live generation

- **WHEN** attach succeeds and replays the generation
- **THEN** the chat stays in the streaming state and no interrupted text is shown

#### Scenario: Pending background message is not interrupted

- **WHEN** the conversation contains a message with `backgroundGeneration.status` `pending`
- **THEN** the hook resumes it through attach as before and shows no interrupted text

#### Scenario: Reload repeats the resume

- **WHEN** the page is reloaded after the message was shown as interrupted
- **THEN** the stored placeholder is detected again and the resume runs again, because the interrupted display was not persisted

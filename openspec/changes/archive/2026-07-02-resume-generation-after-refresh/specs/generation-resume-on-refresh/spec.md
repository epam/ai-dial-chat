## ADDED Requirements

### Requirement: Detect an unresolved generation placeholder on conversation load

`apps/chat/src/utils/generation-resume.ts` SHALL export a pure predicate `isAwaitingGenerationResume(conversation)` that returns `true` when the conversation's last message has `role: assistant`, empty `content`, and neither `hasStreamError` nor `wasStoppedByUser` set. `Conversation.tsx`'s `loadConversation` SHALL call this predicate for the non-user-last-message branch (the branch that currently just calls `setConversation(result)`) and treat a `true` result as "a generation was still active elsewhere when this page loaded," distinct from a normally finished conversation.

#### Scenario: Refresh mid-generation loads an unresolved placeholder

- **WHEN** `loadConversation` fetches a conversation whose last message is `{ role: assistant, content: '' }` with no `hasStreamError` and no `wasStoppedByUser`
- **THEN** `isAwaitingGenerationResume` returns `true` and the page treats the conversation as awaiting generation resume instead of rendering it as a finished, empty response

#### Scenario: Finished or terminally-stopped conversation is not treated as awaiting resume

- **WHEN** the last message has non-empty `content`, or has `hasStreamError: true`, or has `wasStoppedByUser: true`
- **THEN** `isAwaitingGenerationResume` returns `false` and the conversation renders normally

### Requirement: Awaiting-resume state reuses the existing streaming state

`apps/chat/src/hooks/conversation/useConversationStream.ts` SHALL expose a function (e.g. `resumeIfAwaitingGeneration(conversationId, conversation)`) that, when `isAwaitingGenerationResume(conversation)` is `true`, adds the conversation's path to the same `streamingPaths` set that backs `isStreaming`/`isAssistantTyping` for a live generation — without issuing a new completion request. State ownership stays entirely inside `useConversationStream`; no new prop or context is introduced to `ConversationMessageItem` or `useConversationHandlers` — they continue reading `isStreaming`/`isAssistantTyping` as they do today. `ConversationView` MAY receive a separate stop-availability flag so a resumed server-side generation that lacks a local `generationId` can block input like streaming without exposing a non-functional Stop action.

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

- **WHEN** the resume watch is active for the displayed conversation but the current page instance did not start that generation and has no local `generationId`
- **THEN** the message input remains in streaming/blocked mode but does not render an actionable Stop control, and no `stopCompletion` request is sent for the resumed generation

### Requirement: Resume watch subscribes to the existing conversation-watch SSE channel

`resumeIfAwaitingGeneration` SHALL open a subscription via the existing `watchConversation` (`POST /api/v1/conversations/watch`, per `conversation-watch-sse`) for the awaiting-resume conversation's path, using the same raw-fetch SSE reader pattern as `ConversationsContext.watchForDisplayNameUpdate`. On each `UPDATE` event for that path, it SHALL call `getConversation` once and re-check `isAwaitingGenerationResume` against the fresh result.

#### Scenario: Backend finishes generation while the resume watch is open

- **WHEN** `/watch` emits an `UPDATE` event for the awaiting-resume conversation's path and the subsequent `getConversation` result is no longer awaiting resume (has content, or `hasStreamError`, or `wasStoppedByUser`)
- **THEN** the page replaces its local conversation state with the fetched result, removes the path from `streamingPaths`, and closes the watch connection

#### Scenario: Non-qualifying UPDATE event keeps watching

- **WHEN** `/watch` emits an `UPDATE` event but the refetched conversation is still awaiting resume
- **THEN** the resume watch keeps reading without closing the connection

### Requirement: Resume watch times out and always releases the generating state

The resume watch SHALL be bounded by a timeout constant (`GENERATION_RESUME_WATCH_TIMEOUT_MS`, default 5 minutes) analogous to `DISPLAY_NAME_WATCH_TIMEOUT_MS`. On timeout, it SHALL abort the SSE fetch, perform one final `getConversation` call, apply whatever result comes back to local state, and remove the conversation's path from `streamingPaths` unconditionally — so Regenerate, edit, and other actions become available again even if the placeholder is still unresolved.

#### Scenario: Watch times out without a qualifying event

- **WHEN** `GENERATION_RESUME_WATCH_TIMEOUT_MS` elapses without a qualifying `UPDATE` event
- **THEN** the resume watch aborts, performs one final `getConversation`, updates local state with that result, and removes the conversation's path from `streamingPaths`

### Requirement: Resume watch continues across navigation, gated by the displayed path

Because `ConversationPage` is not remounted when navigating between conversations (`app-level-generation-manager`), the resume watch SHALL NOT be aborted when the user navigates to a different conversation. It keeps running until it resolves or times out, and — like `startStream`'s `onChunk`/`onComplete`/`onError` — applies its result to `conversation`/`conversationRef` state only when `isPathDisplayed(conversationPath)` is still true; it removes the path from `streamingPaths` unconditionally regardless of which conversation is displayed when it resolves.

#### Scenario: Navigating away does not lose resume progress

- **WHEN** the user navigates away from a conversation whose resume watch is still open, and later navigates back to it before the watch resolves
- **THEN** the same watch is still active, `streamingPaths` still contains its path, and the typing indicator / guarded actions resume exactly as if the user had never left

#### Scenario: Resolution while viewing a different conversation does not touch the foreground

- **WHEN** the resume watch resolves (via a qualifying `UPDATE` event or timeout) while the user is viewing a different conversation
- **THEN** `streamingPaths` no longer contains the resolved path, but `conversation`/`conversationRef` state for the currently-displayed conversation is left untouched

---

No new i18n keys — the resumed state reuses the existing, already-translated typing/thinking indicator label. No RTL impact — no new UI markup is introduced. Not gated behind `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` — this is core conversation-loading behavior, always on. No new backend endpoint and no new rate limit — reuses `/api/v1/conversations/watch`'s existing `20/60s` throttle. No new telemetry.

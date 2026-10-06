# Spec: generation-resume-on-refresh

## Purpose

Frontend behavior that detects an in-progress generation on conversation load (including a hard refresh), renders a generating/typing state instead of a static empty message, watches for its completion via the existing conversation-watch SSE channel (with a timeout fallback), and keeps Regenerate/edit disabled for the duration by reusing the existing streaming-state guards.

## Requirements

### Requirement: Detect an unresolved generation placeholder on conversation load

`libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts` SHALL export (through `@epam/ai-dial-chat-hooks`) a pure predicate `isAwaitingGenerationResume(conversation)` that returns `true` when the conversation's last message has `role: assistant`, carries no generated payload (`hasGeneratedPayload` is false: no `content`, no `responseId`, and no `custom_content` attachments, stages, annotations, `form_schema` or `state`), and has neither `streamErrorMessage` nor `wasStoppedByUser` set. `Conversation.tsx`'s `loadConversation` SHALL call this predicate for the non-user-last-message branch (the branch that currently just calls `setConversation(result)`) and treat a `true` result as "a generation was still active elsewhere when this page loaded," distinct from a normally finished conversation.

The predicate SHALL also return `true` when any message of the conversation has `backgroundGeneration.status: "pending"`, whatever that message's position or payload (a status message may follow it, and it may already carry a `responseId`), and SHALL return `false` for a conversation whose background messages are all finished and whose last message is not otherwise an unresolved placeholder. For conversations without `backgroundGeneration` the predicate is unchanged.

#### Scenario: Refresh mid-generation loads an unresolved placeholder

- **WHEN** `loadConversation` fetches a conversation whose last message is `{ role: assistant, content: '' }` with no `streamErrorMessage` and no `wasStoppedByUser`
- **THEN** `isAwaitingGenerationResume` returns `true` and the page treats the conversation as awaiting generation resume instead of rendering it as a finished, empty response

#### Scenario: Finished or terminally-stopped conversation is not treated as awaiting resume

- **WHEN** the last message has non-empty `content` or another generated payload (e.g. only `custom_content.attachments` from an image-generation answer), or has a `streamErrorMessage`, or has `wasStoppedByUser: true`
- **THEN** `isAwaitingGenerationResume` returns `false` and the conversation renders normally

#### Scenario: Pending background message followed by a status message

- **WHEN** the conversation's messages are `[user, assistant{backgroundGeneration.status: "pending", responseId}, status(model changed)]`
- **THEN** `isAwaitingGenerationResume` returns `true`

### Requirement: Awaiting-resume state reuses the existing streaming state

`useConversationStream` (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`) SHALL expose `resumeIfAwaitingGeneration(conversationId, conversation)` (built by `createResumeIfAwaitingGeneration` in `generation-resume.ts`) that, when `isAwaitingGenerationResume(conversation)` is `true`, adds the conversation's path to the same `streamingPaths` set that backs `isStreaming`/`isAssistantTyping` for a live generation — without issuing a new completion request. A path already being resumed (tracked in `resumingPathsRef`) is not resumed a second time. State ownership stays entirely inside `useConversationStream`; no new prop or context is introduced to `ConversationMessageItem` or `useConversationHandlers` (`libs/chat-hooks`) — they continue reading `isStreaming`/`isAssistantTyping` as they do today. `ConversationView` receives the separate stop-availability flag `canStopStreaming` so a resumed server-side generation that lacks a local `generationId` can block input like streaming without exposing a non-functional Stop action. A resumed background message supplies its own `generationId` (`backgroundGeneration.generationId`), so for it Stop SHALL be exposed and functional, as `chat-hooks-conversation-stream` "Stop is available for a resumed background generation" defines.

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

### Requirement: Resume watch subscribes to the existing conversation-watch SSE channel

`resumeIfAwaitingGeneration` SHALL first try to attach to the backend's live replay of the in-flight generation through `transport.attachToGeneration` (`POST /api/v1/conversations/completions/attach`, per `generation-live-replay`), applying its snapshot and chunk events to the resumed message progressively; the attach path has no timeout and ends with a final `getConversation` once a terminal event arrives. Whenever attach cannot open, or its stream ends without a terminal event, it SHALL fall back to a subscription via `transport.watchConversation` (`POST /api/v1/conversations/watch`, per `conversation-watch-sse`) for the awaiting-resume conversation's path, read with the module's `readSseEvents` SSE reader. Right after subscribing it SHALL call `getConversation` once, resolving immediately if the result is no longer awaiting resume (covering a generation that finished before the subscription). On each `UPDATE` event for that path, it SHALL call `getConversation` once and re-check `isAwaitingGenerationResume` against the fresh result.

#### Scenario: Backend finishes generation while the resume watch is open

- **WHEN** the fallback `/watch` subscription emits an `UPDATE` event for the awaiting-resume conversation's path and the subsequent `getConversation` result is no longer awaiting resume (has content, or `streamErrorMessage`, or `wasStoppedByUser`)
- **THEN** the page replaces its local conversation state with the fetched result, removes the path from `streamingPaths`, and closes the watch connection

#### Scenario: Non-qualifying UPDATE event keeps watching

- **WHEN** `/watch` emits an `UPDATE` event but the refetched conversation is still awaiting resume
- **THEN** the resume watch keeps reading without closing the connection

### Requirement: Resume watch times out and always releases the generating state

The fallback watch path SHALL be bounded by a module-private timeout constant (`GENERATION_RESUME_WATCH_TIMEOUT_MS`, 5 minutes) analogous to `DISPLAY_NAME_WATCH_TIMEOUT_MS`; the attach path deliberately has none, so a long-running generation is not abandoned. On timeout, or when the watch stream ends without a qualifying event, it SHALL abort the SSE fetch, perform one final `getConversation` call, apply whatever result comes back to local state, and remove the conversation's path from `streamingPaths` unconditionally — also when that final call fails, in which case the hook reports a conversation reload error (`hasConversationReloadError`) instead of applying a result — so Regenerate, edit, and other actions become available again even if the placeholder is still unresolved.

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

No new i18n keys — the resumed state reuses the existing, already-translated typing/thinking indicator label. No RTL impact — no new UI markup is introduced. Not gated behind `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` — this is core conversation-loading behavior, always on. No new backend endpoint — reuses `/api/v1/conversations/watch`. No new telemetry.

### Requirement: Load-time auto-start joins a generation that is already running

`ConversationPage.loadConversation` (`apps/chat/src/pages/Conversation/Conversation.tsx`) auto-starts a `ContinueLastUser` stream when the loaded conversation's last message is a user message. It SHALL pass `{ resumeOnConflict: true }` to `startStream` for that auto-start, and only for that call.

A load can find a user-last conversation while the backend is still generating its answer. This happens when the page is reloaded after the first message of a new conversation, before the backend has saved its start state. The backend then rejects the auto-start with `409`, and the opted-in handover in `chat-hooks-conversation-stream` joins the running generation. The page SHALL NOT start another completion for the path while that handover runs, and SHALL NOT send a client conversation save built from the conflict placeholder.

State ownership: the decision lives in `ConversationPage`; the handover state lives in `useConversationStream`. No context is added.

User-initiated sends, regenerate, edit, starter submissions and `AppPreviewChat` SHALL NOT pass the option. A `409` for them keeps showing `generationConflictMessage`, as issue #8688 requires.

No new i18n keys, no RTL impact, no new ARIA requirements: the existing typing indicator and conflict text are reused. Not gated by `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES`.

#### Scenario: Reload in the pre-start window shows the persisted answer

- **GIVEN** a new conversation whose stored copy is `[user]` while the backend's generation for it is registered but has not saved its start state
- **WHEN** the page is reloaded and `loadConversation` auto-starts the stream, which the backend rejects with `409`
- **THEN** the typing indicator stays visible, no conflict text is shown, and once the generation finishes the page shows the server copy `[user, assistant answer]`

#### Scenario: No duplicate turn and no stale save

- **WHEN** the reload scenario above completes
- **THEN** exactly one completion request was sent after the reload, the displayed conversation contains the user message once, and no `saveConversation` call was made for the path while the handover ran

#### Scenario: A user-initiated send still shows the conflict

- **WHEN** the user sends a message in a conversation that another tab is already generating, and the backend responds `409`
- **THEN** the placeholder shows `generationConflictMessage`, exactly as before this change

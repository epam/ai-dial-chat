# Spec: generation-resume-on-refresh

## Purpose

Frontend behavior that detects an in-progress generation on conversation load (including a hard refresh), renders a generating/typing state instead of a static empty message, watches for its completion via the existing conversation-watch SSE channel (with a timeout fallback), and keeps Regenerate/edit disabled while a generation is attached by reusing the existing streaming-state guards; when nothing is producing the answer, it releases the chat and shows the placeholder as interrupted.

## Requirements

### Requirement: Detect an unresolved generation placeholder on conversation load

`libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts` SHALL export a pure predicate `isAwaitingGenerationResume(conversation)` through `@epam/ai-dial-chat-hooks`. It returns `true` when the conversation's last message:

- has `role: assistant`;
- carries no generated payload (`hasGeneratedPayload` is false: no `content`, no `responseId`, and no `custom_content` attachments, stages, annotations, `form_schema` or `state`);
- has neither `streamErrorMessage` nor `wasStoppedByUser` set.

`Conversation.tsx`'s `loadConversation` SHALL call this predicate in the non-user-last-message branch, the branch that currently just calls `setConversation(result)`. It SHALL treat a `true` result as "a generation was still active elsewhere when this page loaded", distinct from a normally finished conversation.

The predicate SHALL also return `true` when any message of the conversation, at any position and with any payload, has either of these markers:

- `backgroundGeneration.status: "pending"`. A status message may follow it, and it may already carry a `responseId`.
- a live `foregroundGeneration`, as `chat-hooks-conversation-stream` "A live foreground marker is awaiting resume" defines. A status message may follow it too: a client save can append one while another participant generates.

It SHALL return `false` for a conversation whose background messages are all finished, whose foreground markers are absent or expired, and whose last message is not otherwise an unresolved placeholder. For conversations without either marker the predicate is unchanged.

#### Scenario: Refresh mid-generation loads an unresolved placeholder

- **WHEN** `loadConversation` fetches a conversation whose last message is `{ role: assistant, content: '' }` with no `streamErrorMessage` and no `wasStoppedByUser`
- **THEN** `isAwaitingGenerationResume` returns `true` and the page treats the conversation as awaiting generation resume instead of rendering it as a finished, empty response

#### Scenario: Finished or terminally-stopped conversation is not treated as awaiting resume

- **WHEN** the last message has non-empty `content` or another generated payload (e.g. only `custom_content.attachments` from an image-generation answer), or has a `streamErrorMessage`, or has `wasStoppedByUser: true`
- **THEN** `isAwaitingGenerationResume` returns `false` and the conversation renders normally

#### Scenario: Pending background message followed by a status message

- **WHEN** the conversation's messages are `[user, assistant{backgroundGeneration.status: "pending", responseId}, status(model changed)]`
- **THEN** `isAwaitingGenerationResume` returns `true`

#### Scenario: Live foreground marker followed by a status message

- **WHEN** the conversation's messages are `[user, assistant{foregroundGeneration live}, status(model changed)]`
- **THEN** `isAwaitingGenerationResume` returns `true`

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

### Requirement: Resume watch subscribes to the existing conversation-watch SSE channel

`resumeIfAwaitingGeneration` SHALL first try to attach to the backend's live replay of the in-flight generation through `transport.attachToGeneration` (`POST /api/v1/conversations/completions/attach`, per `generation-live-replay`), applying its snapshot and chunk events to the resumed message progressively; the attach path has no timeout and ends with a final `getConversation` once a terminal event arrives. Whenever attach cannot open, or its stream ends without a terminal event, it SHALL fall back to a subscription via `transport.watchConversation` (`POST /api/v1/conversations/watch`, per `conversation-watch-sse`) for the awaiting-resume conversation's path, read with the module's `readSseEvents` SSE reader. Right after subscribing it SHALL call `getConversation` once, resolving immediately if the result is no longer awaiting resume (covering a generation that finished before the subscription). On each `UPDATE` event for that path, it SHALL call `getConversation` once and re-check `isAwaitingGenerationResume` against the fresh result.

#### Scenario: Backend finishes generation while the resume watch is open

- **WHEN** the fallback `/watch` subscription emits an `UPDATE` event for the awaiting-resume conversation's path and the subsequent `getConversation` result is no longer awaiting resume (has content, or `streamErrorMessage`, or `wasStoppedByUser`)
- **THEN** the page replaces its local conversation state with the fetched result, removes the path from `streamingPaths`, and closes the watch connection

#### Scenario: Non-qualifying UPDATE event keeps watching

- **WHEN** `/watch` emits an `UPDATE` event but the refetched conversation is still awaiting resume
- **THEN** the resume watch keeps reading without closing the connection

### Requirement: Resume watch times out and always releases the generating state

The fallback watch path SHALL be bounded by a module-private timeout constant (`GENERATION_RESUME_WATCH_TIMEOUT_MS`, 5 minutes) analogous to `DISPLAY_NAME_WATCH_TIMEOUT_MS`; the attach path deliberately has none, so a long-running generation is not abandoned. For a non-background generation the bound limits only the background wait: the path is already released and the message already shown as interrupted when the watch starts waiting, so the timeout changes nothing the user sees. On timeout, or when the watch stream ends without a qualifying event, the watch SHALL abort the SSE fetch, perform one final `getConversation` call, apply whatever result comes back to local state, and remove the conversation's path from `streamingPaths` unconditionally — also when that final call fails, in which case the hook reports a conversation reload error (`hasConversationReloadError`) instead of applying a result — so Regenerate, edit, and other actions are available even if the placeholder is still unresolved.

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

### Requirement: An unresolved placeholder is shown as interrupted without blocking the chat

When a resume of a non-background generation finds that nothing is producing the answer here, the hook SHALL show the unresolved assistant placeholder as interrupted and SHALL NOT keep the chat blocked. "Nothing is producing the answer here" means one of:

- attach is unavailable (`404`, a network error, or any unexpected response) and the fallback watch's immediate re-check returns the conversation still ending in the unresolved placeholder (the one `isAwaitingGenerationResume` recognises, with no generated payload);
- the fallback watch has no immediate re-check because it could not be opened, and the final reload returns that placeholder;
- an attach ended without a terminal event and the reload returns that placeholder.

**Exception for a live marker.** This rule SHALL NOT apply while the reloaded copy holds a live `foregroundGeneration` marker. Another tab, device or participant is then known to be generating, and `chat-hooks-conversation-stream` "A live foreground marker is awaiting resume" defines the behavior: the chat stays in the streaming state without interrupted text.

**How the interrupted state is shown.**

- The hook SHALL set a local `streamErrorMessage` on the displayed message at the index the resume was started for, using the host-supplied interrupted text (`chat-hooks-conversation-stream` "The hook accepts an interrupted-generation message"). The existing stream-error card then renders with its retry action.
- It SHALL release the path from `streamingPaths` at the same moment, so Regenerate, edit, starters and sending work.
- When the fallback watch is open, it SHALL keep watching until its bound. A qualifying update that returns a saved answer SHALL replace the interrupted message with that answer, unless a newer generation has taken over the path.
- A generation the user starts on the path SHALL supersede the watch, which SHALL then change no displayed state.

**What the hook can and cannot tell.** For a placeholder without a live marker, the hook cannot tell a generation that is nowhere from one whose marker has expired or that never stored one, and SHALL NOT claim to. It does not block a retry. The backend refuses a retry with `409` while any live marker holds the conversation (`backend-owned-generation-persistence` "Conversation writes are fenced in storage on every generation path"), so such a retry cannot overwrite a running exchange. The interrupted text SHALL therefore say the response may have been interrupted, not that it was lost.

**Display only.** The hook SHALL NOT save the conversation, and the stored placeholder SHALL stay as it is. This rule SHALL NOT apply:

- while attach is serving a live generation;
- to a pending background message;
- to a message with a live foreground marker;
- to a conversation that settled with a saved answer;
- to a placeholder whose content the page retains (that case keeps the persistence warning).

**UI / i18n / RTL / a11y impact:** one host string (`chat.generationInterrupted`). It renders in the existing stream-error card, so direction handling, the alert semantics and the retry control are reused unchanged. Not gated behind `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`. No new telemetry. State ownership stays inside `useConversationStream`; no context or prop is added to the message components.

#### Scenario: Attach is unavailable and the placeholder is unresolved

- **WHEN** a conversation is loaded whose last message is the unresolved placeholder without a live marker, attach answers `404`, and the watch's immediate re-check still returns that placeholder
- **THEN** the message shows the interrupted text with its retry action, `isStreaming` is false, the input accepts a new message, no save request is sent, and the watch keeps running

#### Scenario: A live marker is not shown as interrupted

- **WHEN** attach answers `404` and the watch's immediate re-check returns the placeholder with a live `foregroundGeneration`
- **THEN** no interrupted text is shown and `isStreaming` stays `true` while the watch runs

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

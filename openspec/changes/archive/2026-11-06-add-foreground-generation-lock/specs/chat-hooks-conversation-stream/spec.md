## ADDED Requirements

### Requirement: A live foreground marker is awaiting resume

The hook's awaiting-generation detection SHALL treat a conversation as awaiting resume when it contains a message with a *live* `foregroundGeneration`: one whose `expiresAt` is later than the client's clock. This holds at any position, also when a status message follows the marked message. The resume SHALL seed and update the buffered message at **that** message's index, and its terminal reload check SHALL compare against that index, as for a pending background message. A message whose marker has expired SHALL count only through the existing unresolved-placeholder rule.

The marker is written by the backend while another tab, device or participant generates in the conversation (`foreground-generation-lock`). The resume SHALL run as for any non-background generation:

- attach first, which serves the generation when the same principal runs it on the instance;
- otherwise the watch fallback (`generation-resume-on-refresh`).

While the reloaded copy still holds a live marker, the hook SHALL keep the path in `streamingPaths`, so the typing indicator stays and send, Regenerate and edit stay guarded, and SHALL NOT show the message as interrupted. When the watch fallback reaches `GENERATION_RESUME_WATCH_TIMEOUT_MS` with the marker still live, the hook SHALL release the path as that requirement defines, and SHALL still write no interrupted text. A send then reaches the backend, which answers `409` while the marker is live.

**Liveness.** The `Message` type in `libs/chat-shared/src/models/chat.ts` SHALL declare `foregroundGeneration?: ForegroundGeneration`, with `ForegroundGeneration` `{ generationId: string; startedAt: number; expiresAt: number; stopRequestedAt?: number }` exported from `@epam/ai-dial-chat-shared`. Liveness SHALL be decided by a pure helper in `libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts` that takes the conversation and the current time. The hook SHALL read only this data field and the clock: it SHALL NOT call DIAL Core, read feature flags, or know which caller started the generation.

**State owner:** `useConversationStream` (existing per-path streaming state); no new context, prop or memoised value. **UI / i18n / RTL / a11y impact:** none new — the existing typing indicator, Stop control and stream-error card are reused. Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

#### Scenario: Another participant's generation is shown as generating

- **WHEN** a conversation is loaded whose last assistant message is an empty placeholder with a live `foregroundGeneration`, and attach answers `404`
- **THEN** the conversation is awaiting resume, `isStreaming` stays `true`, the placeholder shows no interrupted text, and the hook keeps watching for the saved answer

#### Scenario: The saved answer replaces the placeholder

- **WHEN** the watch reload returns the message with content and without `foregroundGeneration`
- **THEN** the answer is shown and the path leaves `streamingPaths`

#### Scenario: A status message after the marked message

- **WHEN** the conversation is `[user, assistant{foregroundGeneration live}, status(model changed)]`
- **THEN** it is awaiting resume, and the resume updates the message at index 1

#### Scenario: An expired marker falls back to the placeholder rule

- **WHEN** the last assistant message is an empty placeholder whose `foregroundGeneration.expiresAt` is in the past
- **THEN** it is treated exactly as an unresolved placeholder without a marker

#### Scenario: The watch times out while the marker is live

- **WHEN** `GENERATION_RESUME_WATCH_TIMEOUT_MS` elapses and the final reload still holds a live marker
- **THEN** the path leaves `streamingPaths` and no interrupted text is written

### Requirement: The default conflict text does not assume who is generating

`DEFAULT_GENERATION_CONFLICT_MESSAGE` (`libs/chat-hooks/src/conversation/create-chat-stream-api.ts`) SHALL read `A response is already being generated in this conversation. Wait for it to finish before sending another message.`. A conflict now also comes from another device of the same user, or from another participant of a shared project, so the text SHALL NOT mention a browser tab and SHALL NOT tell the user to stop the generation.

The app fills `generationConflictMessage` with `t(ChatI18nKeys.GenerationConflict)`. The English text of that existing key, `chat.generationConflict` in `apps/chat/src/i18n/locales/en.json`, SHALL change to the same sentence. No key is added or renamed. RTL and accessibility are unchanged: the text renders in the existing stream-error card.

#### Scenario: A conflict from another participant

- **WHEN** a send is rejected with `409` because another participant is generating
- **THEN** the placeholder shows the host's `chat.generationConflict` text, which mentions neither a browser tab nor stopping

## MODIFIED Requirements

### Requirement: Stop is available for a resumed foreground generation

While the hook is resuming a non-background generation, it SHALL make Stop available whenever it knows an id for it. `canStopStreaming` SHALL be `true` for that path and `handleStop` SHALL call `transport.stopCompletion({ generationId, path, content })` with that id when either:

- the resume goes through `transport.attachToGeneration` and the attach `snapshot` event carried a `generationId`;
- the resumed conversation holds a live `foregroundGeneration` marker, whose `generationId` the hook reads from the stored conversation.

This applies only to a resume started through the public `resumeIfAwaitingGeneration` entry point (a page load, a refresh, or navigation back). The resume the hook starts internally — the conflict handover of "A conflict on an opted-in start joins the running generation" and the recovery of `generation-stream-recovery` — SHALL NOT record or act on the attach-supplied id or the marker's id. Their Stop behavior stays exactly as those requirements define it: `canStopStreaming` is `false` throughout a conflict handover, and stays `true` throughout recovery because the local id is known.

**Precedence.** `handleStop` SHALL use the first available of:

1. the page instance's local generation id for the path;
2. a pending background message's `backgroundGeneration.generationId`;
3. the attach-supplied id;
4. a live marker's `foregroundGeneration.generationId`.

Recording and forgetting an id SHALL NOT change the stoppable state of a path that has an active local generation. The hook SHALL only read the ids from the attach stream and the stored conversation; it SHALL NOT decide eligibility or call DIAL Core. The backend authorizes a Stop that names a marker's id by write access to the conversation (`generation-principal-ownership`), so another participant's generation can be stopped from this page.

**Lifecycle of the id.**

- The attach-supplied id SHALL be recorded when the `snapshot` is applied. It SHALL be forgotten when the resume settles for any reason: a terminal event, the attach stream ending without one, or a failed final reload. When the stream ends without a terminal event the hook continues on the watch fallback, where only a live marker's id is known.
- The marker's id SHALL be taken from each reload and forgotten once a reload no longer holds a live marker.

Stop SHALL then settle through the existing terminal handling: the attach `stopped` event, or the watch reload that returns the stopped answer, is followed by the usual `transport.getConversation` reload, and `isStreaming` and `canStopStreaming` become `false`. After the user activates Stop, replayed `chunk` events SHALL NOT be applied to the displayed message, as for a resumed background generation. A `404` from Stop keeps the handling of "Stop is sent once per generation and a 404 is reported only when the generation keeps running".

For a `snapshot` without a `generationId` and no live marker, or a resume that never attached and has no live marker, Stop availability SHALL stay as before this change. State ownership stays inside the hook; no new prop or context is introduced. **UI / i18n / RTL / a11y impact:** none new — the existing Stop control, its label, and its keyboard behavior are reused.

#### Scenario: Stop after a refresh of a non-background generation

- **GIVEN** the page was refreshed during a non-background generation and the hook resumed it through attach, whose `snapshot` carried `generationId` `G`
- **WHEN** the user activates Stop
- **THEN** `transport.stopCompletion` is called once with `generationId: G` and the conversation path, and after the attach `stopped` event the reloaded stopped partial is shown and `isStreaming` and `canStopStreaming` become `false`

#### Scenario: Chunks replayed after Stop are not applied

- **GIVEN** the user activated Stop for the attach-supplied id
- **WHEN** further `chunk` events arrive before the terminal event
- **THEN** the displayed message does not change until the reload applies the stopped partial

#### Scenario: A snapshot without an id keeps Stop hidden

- **WHEN** the resume attaches but the `snapshot` has no `generationId`, and the conversation holds no live marker
- **THEN** `canStopStreaming` is `false` and no `stopCompletion` request can be sent for the resumed generation

#### Scenario: The watch fallback has no id without a marker

- **WHEN** the attach stream ends without a terminal event, the hook continues on `transport.watchConversation`, and the conversation holds no live marker
- **THEN** the recorded id is dropped, `canStopStreaming` is `false`, and the input stays blocked until the watch resolves

#### Scenario: Stop another participant's generation with the marker's id

- **GIVEN** attach answered `404` and the resumed conversation holds a live `foregroundGeneration` with `generationId` `G`
- **WHEN** the user activates Stop
- **THEN** `transport.stopCompletion` is called once with `generationId: G`, and the watch reload that returns the stopped partial ends the streaming state

#### Scenario: A local id and a background marker keep precedence

- **WHEN** the page instance started the generation itself, or the resumed conversation has a pending background message
- **THEN** `handleStop` sends the local id, or the background message's `generationId`, respectively, never the attach-supplied one or a marker's

#### Scenario: A conflict handover keeps Stop hidden

- **GIVEN** a start with `resumeOnConflict: true` was handed over to the resume flow after a `409`
- **WHEN** the attach `snapshot` of the joined generation carries a `generationId`, or the conversation holds a live marker
- **THEN** `canStopStreaming` stays `false`, exactly as "A conflict on an opted-in start joins the running generation" specifies

#### Scenario: Recovery keeps its Stop behavior

- **WHEN** a locally-started generation is recovered through attach and the `snapshot` carries a `generationId`
- **THEN** `canStopStreaming` stays `true` throughout and Stop sends the original local `generationId`, as "Stop remains available during recovery" specifies, and the end of the attach does not clear it before the recovery settles

#### Scenario: A local generation's Stop is never cleared by the attach id lifecycle

- **GIVEN** the path has an active local generation
- **WHEN** an attach-supplied id is recorded and later forgotten for that path
- **THEN** the path's stoppable state for the local generation is unchanged

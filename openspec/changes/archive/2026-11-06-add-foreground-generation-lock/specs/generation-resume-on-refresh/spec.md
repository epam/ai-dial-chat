## MODIFIED Requirements

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

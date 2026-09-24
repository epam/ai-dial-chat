## Context

`streamErrorMessage` on an assistant message has a three-state contract, which the `backend-owned-generation-persistence` and `chat-hooks-conversation-stream` specs define:

| Value | Meaning |
|---|---|
| `null` / `undefined` | no error |
| `''` | error, no displayable detail; the host shows its i18n fallback |
| any non-empty string | error with detail, shown as-is |

The issue exists because two producers put raw JavaScript error messages into the third state.

**Backend.** Three relay implementations return `GenerationRelayOutcome`:
- `ConversationStreamingService.relayModelCompletion`, the live Chat Completions path;
- `chat-completions.adapter.ts`, which mirrors it;
- `responses.adapter.ts`.

Each of them returns `{ outcome: 'error', error }` for two very different causes:
- **Upstream-supplied failures:**
  - an in-band `{error}` chunk: `new Error(streamError.displayMessage ?? streamError.message)`;
  - a Responses `response.failed` / `response.incomplete` / `error` event: `new Error(terminalSignal.message)`.
- **Transport and runtime failures:**
  - the `catch (err)` around the reader loop, where undici's `TypeError: terminated` lands;
  - the Responses "no terminal signal" case: `new Error(GENERIC_TRUNCATED_MESSAGE)`.

`streamCompletion`'s `case 'error'` (`conversation-streaming.service.ts:721-731`) cannot tell the two apart. It persists `error.message` either way, and `finalize` hands the same string to `generationService.error(lease, …)`, which live-replay subscribers receive.

**Frontend.** `createChatStreamApi` raises plain `Error`s for both in-band upstream chunks (`parseSSELine`) and transport failures. `useConversationStream.onError` special-cases only `GenerationConflictError`.

**UI.** `ConversationMessageItem` renders an `ErrorMessageNotification` (UI kit 2.0; `title` and `message` are both `ReactNode`, and it has no action slot). Regenerate lives in the message action bar, via `buildMessageActions` and `MessageActions`.

## Goals / Non-Goals

**Goals:**
- A transport or runtime failure never reaches the user as text, whether freshly streamed, reloaded or live-replayed.
- Upstream text meant for users (rate limits, content filter, model errors) keeps reaching them.
- The error banner is friendly and has an inline "Try again" button.
- Raw detail stays available: chat-api logs on the backend, and the host gets a callback on the frontend.

**Non-Goals:**
- Classifying or rewriting DIAL Core text.
- Automatic retry or resume.
- Back-filling stored conversations.
- Any OpenAPI or DTO change.

## Decisions

### D1. Tag the displayable text on the relay outcome, and persist `''` otherwise

Extend the `'error'` variant of `GenerationRelayOutcome` (`generation/generation.types.ts`, plus the duplicate local type at `conversation-streaming.service.ts:84-93`) with `displayMessage?: string`.

- The upstream-supplied sites set `displayMessage`: the in-band chunk in both Chat Completions relays, and a Responses terminal signal with a message.
- The `catch` and no-terminal-signal sites leave it unset.
- `case 'error'` persists `streamErrorMessage: relayResult.displayMessage ?? ''` and keeps `this.logger.error(…, relayResult.error)` for the full error.

*Alternatives:*
- (a) Persist `''` for every `'error'` outcome. That is simplest, but it regresses in-band DIAL errors such as "Model overloaded", which users see correctly today.
- (b) Split `'error'` into a separate `'upstream-error'` outcome. That is cleaner in theory, but it touches every consumer's `switch`, the metrics and the tests. The optional field gives the same guarantee with a smaller diff.

The Responses `GENERIC_TRUNCATED_MESSAGE` becomes a log-only diagnostic.

### D2. Tag in-band errors on the frontend with `StreamUpstreamError`; the hook allowlists

Add `export class StreamUpstreamError extends Error` next to `GenerationConflictError` in `libs/chat-hooks/src/conversation/create-chat-stream-api.ts`, and export it from `src/index.ts`. `parseSSELine` raises it for `{error:{message}}` chunks. In `useConversationStream.onError`, the message is chosen like this:

```
GenerationConflictError → generationConflictMessage
StreamUpstreamError     → error.message
anything else           → ''
```

This is an allowlist, not a denylist of known technical strings, so a new failure mode cannot leak.

*Alternative:* keep the raw message and let the UI mask known strings. Rejected because it is string matching, it breaks with every undici or browser wording change, and it would also have to run on reload.

**Lib isolation.** The lib decides only which errors carry user-facing text, and that decision is driven by the transport's own error shape. The host still owns the copy: the i18n fallback for `''` and `generationConflictMessage`. It also owns logging, through `onStreamError`.

### D3. `onStreamError` callback instead of logging in the lib

`useConversationStream` gets `onStreamError?: (error: Error) => void`. It is read through a ref, so it does not join the `onError` dependency list and cannot churn the stream callbacks. `Conversation.tsx` and `AppPreviewChat.tsx` pass a `useCallback` that calls `console.error('Conversation stream failed', error)`. That matches the existing app pattern (`ConversationsContext.tsx:324`) and the ESLint `no-console` allowlist.

*Alternative:* `console.error` inside the lib. Rejected, because AGENTS.md forbids a lib from choosing a logging transport.

### D4. The "Try again" button lives in the banner's `message` node and reuses `onRegenerateMessage`

`ErrorMessageNotification` has no action prop, so the button is composed into `message`: a flex row holding the text and the button, with `justify-between`, `gap-*` and a logical-property layout. Its handler is `useCallback(() => onRegenerateMessage?.(messageIndex), …)`. It is:
- hidden under `isRegenerateAssistantMessageHidden` or when there is no handler;
- disabled while `isAssistantTyping`.

These are the same rules `buildMessageActions` applies.

*Alternatives:*
- (a) Add an `action` slot to the UI kit's Notification. That is the better long-term home, but it is a cross-repo release. It is recorded as a follow-up.
- (b) Remove the action-bar Regenerate on errored messages. Rejected: it changes an existing, specced action surface with no need.

### D5. Neutral copy, not the issue's assistant-voice wording

The copy is: title "Couldn't finish this response", message "Something went wrong while generating the response. Try again in a moment.", and the button "Try again".

The issue's "Apologies for the network hiccup. Let me dig in." puts words in the assistant's mouth, and it asserts a network cause that is false for internal errors. Only `en.json` exists today.

## Risks / Trade-offs

- **[Risk] A custom `ConversationStreamTransport` from another host raises plain `Error`s for upstream text, and that text now shows as the fallback.** → Mitigation: document `StreamUpstreamError` in the `libs/chat-hooks` README hook and transport sections. Hosts get the raw error through `onStreamError`. This is a behaviour change for such hosts, and it is called out in the README.
- **[Risk] A generic message makes support harder, because users can no longer quote an error.** → Mitigation: chat-api logs the full error with context (it already does, at `logger.error`). The trace-correlation work (`api-error-trace-correlation`) ties logs to requests.
- **[Trade-off] Conversations stored before this change still show `terminated`.** A render-time mask was rejected (D2), and a data migration is out of scope. The old string disappears once the user regenerates.
- **[Risk] The live-replay `error` event now carries `''`.** `generation-resume.ts` already treats the event as terminal and reloads via `finalCheck()`. It does not render the event's message, so nothing changes there. This is covered by the existing `generation-resume.spec.ts`.

## Migration Plan

This is a pure code change with no data or contract migration. The deploy order is irrelevant: an old frontend with a new backend shows the fallback for `''` (already supported), and a new frontend with an old backend still shows the raw stored text until the backend ships. Rollback is a revert.

## Open Questions

- Whether the product wants per-cause copy (network versus model versus quota). If so, revisit the `streamErrorCode` enum alternative from the proposal. This is not blocking.
- Follow-up: add an `action` slot to the UI kit's `Notification` (in the `ai-dial-ui-kit` repo), then move the button into it.

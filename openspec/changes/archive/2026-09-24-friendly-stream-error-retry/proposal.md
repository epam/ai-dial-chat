## Why

Issue [#8979](https://github.com/epam/ai-dial-chat/issues/8979) (P2 – High, PG chat priority within a month): when a generation dies mid-stream — typically a long PG Agent run with several tool calls — the chat shows a bare red banner reading `terminated`. That string is the `message` of undici's `TypeError` thrown by Node's `fetch` inside chat-api while reading the DIAL Core stream. It is persisted verbatim and rendered verbatim. The user gets a technical token, no explanation, and no retry control next to the error.

## Problem

- **Backend.** When the relay itself throws, `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:721-731` writes `relayResult.error.message` into `streamErrorMessage`. This covers undici `terminated`, `other side closed`, socket resets and any programming error. The Chat Completions and Responses adapters both hit this `'error'` case.
- **Frontend.** `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts:416-419` copies any client-side transport error's `error.message` into `streamErrorMessage`. Examples: `Failed to fetch`, `network error`, `Stream request failed with status 502`, `No response body`.
- **UI.** `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx:884-892` renders `msg.streamErrorMessage || t(ChatI18nKeys.StreamError)`. The friendly fallback only ever shows for `''`. The one retry affordance, Regenerate, sits in the message action bar (`build-message-actions.ts:47-49`), away from the error.

## Solution

1. **Hide transport errors at the source.** The backend persists `streamErrorMessage: ''` when the relay throws, and logs the full error server-side, which it already does. The error then lands in the existing "no upstream text → localized fallback" path, which `backend-owned-generation-persistence` already defines.
2. **Hide transport errors on the client.** In `create-chat-stream-api.ts`, in-band DIAL Core `{error:{message}}` SSE chunks get a new, exported `StreamUpstreamError`. `useConversationStream` shows a raw message only for that class. It keeps the host-supplied message for `GenerationConflictError`. Every other error becomes `''`. The hook also gains an optional `onStreamError(error)` callback, so the host can still see the raw error.
3. **Friendly banner with an inline "Try again".** The error banner gets:
   - a title, "Couldn't finish this response";
   - a message, reworded to "Something went wrong while generating the response. Try again in a moment.";
   - a **Try again** button inside the banner that calls the existing `onRegenerateMessage(index)`, under the same visibility and disabled rules as the action-bar Regenerate.

   DIAL Core-supplied error text (rate limits, content filter, model rejections) still shows as the banner message.

Alternatives considered:
- **Frontend-only masking**, i.e. an allowlist of known technical strings. Rejected: it relies on matching strings, persisted history would still hold raw text, and a new undici message would leak again.
- **An error-code enum on the message DTO**, e.g. `streamErrorCode: 'network' | 'upstream' | …`. Rejected for now: it changes the OpenAPI contract and the generated client for a single UI decision, and `''` already means "no displayable detail". It could be revisited if per-cause copy is ever wanted.
- **The issue's wording, "Apologies for the network hiccup. Let me dig in."** Rejected as the default. It speaks as the assistant, and it claims a network cause even when the failure was internal. We use neutral wording that is true for every cause.

## What Changes

- The chat-api relay-throw outcome persists `''` instead of the thrown error's message.
- `libs/chat-hooks`:
  - adds a new exported `StreamUpstreamError`;
  - `useConversationStream` shows only upstream-supplied or host-supplied error text;
  - the hook gets a new optional `onStreamError` callback.
- `ConversationMessageItem` gets:
  - a banner title;
  - reworded fallback copy;
  - an inline "Try again" button wired to `onRegenerateMessage`.
- Two new i18n keys and one reworded one in `apps/chat/src/i18n/locales/en.json`.
- The `libs/chat-hooks/README.md` hook parameters table and error-class section are updated.

**Not breaking** at the API level: no DTO or OpenAPI change, and `streamErrorMessage` keeps its type and meaning (`null` means no error, `''` means an error with no detail, any other string is displayable detail). Older conversations that already store `"terminated"` keep showing that string. See Non-goals.

## Non-goals

- Rewriting or classifying DIAL Core-supplied error text, whether it arrives as a rejected request or an in-band error chunk.
- Automatic retries, backoff, or resuming the dead generation. "Try again" is today's Regenerate.
- Migrating conversations that already have a raw `streamErrorMessage` stored.
- Changing toasts elsewhere, such as `handleStopError`.
- A PG-specific variant. Both chat products use the same banner.

## Capabilities

### New Capabilities
- `stream-error-banner`: how a failed assistant message is presented. Covers the title, the localized fallback versus upstream text, the inline "Try again" action and its gating, and accessibility.

### Modified Capabilities
- `backend-owned-generation-persistence`: the "relay itself threw" outcome row persists `''` instead of the thrown error's message.
- `chat-hooks-conversation-stream`: a client-side transport error no longer reports its own `error.message`. Only a `StreamUpstreamError` does. There is also the new `onStreamError` callback.

## Impact

- **Backend:**
  - `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts` and its spec.
  - No endpoint, DTO or OpenAPI change.
- **Lib (`libs/chat-hooks`):**
  - `src/conversation/create-chat-stream-api.ts`, `useConversationStream/useConversationStream.ts`, the `src/index.ts` export, the specs, and `README.md`.
  - No host knowledge enters the lib: which copy to show stays with the host (`generationConflictMessage`, i18n fallback), and so does what to do with the raw error (`onStreamError`).
- **App:**
  - `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` and its spec.
  - `apps/chat/src/constants/translation-keys.ts` and `en.json`.
  - The hook call sites in `pages/Conversation/Conversation.tsx` and `pages/AppsEditor/AppPreviewChat.tsx`.
- **i18n:**
  - new `chat.streamErrorTitle` ("Couldn't finish this response") and the shared `buttons.tryAgain` ("Try again");
  - reworded `chat.streamError`.
  - `en.json` is the only locale file today.
- **Rollback:** revert the commit. The data stays compatible both ways, because `''` was already a valid persisted value.

## Acceptance criteria

- A mid-stream upstream abort (undici `terminated`) produces a persisted message with `streamErrorMessage: ''`. The raw error is still logged by chat-api.
- In the UI, that message shows the title "Couldn't finish this response", the fallback message, and a "Try again" button. The text `terminated` appears nowhere.
- Clicking "Try again" regenerates that assistant message, the same way the action-bar Regenerate does.
- A DIAL Core in-band error, or rejected-request text such as a rate-limit message, still shows that text under the same title, with "Try again".
- A generation conflict still shows the host's conflict message.
- The button is hidden when the regenerate UI feature is hidden, and disabled while the assistant is typing.
- The unit tests covering the scenarios in `specs/` pass, and so does `npm run verify:full`.

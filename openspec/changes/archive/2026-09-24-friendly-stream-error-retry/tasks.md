# Tasks — friendly-stream-error-retry

The slicing is risk-first, then vertical. Slice 1 stops a raw error from being stored, which fixes the reported `terminated` on its own. Slice 2 closes the same leak on the client. Slice 3 is the visible UX. Each slice can ship and be verified on its own. Slices 1 and 2 are independent. Slice 3 depends on neither for correctness, but it is only fully meaningful after 1.

## 1. Backend: persist only displayable upstream text (risk-first)

- [x] 1.1 In `apps/chat-api/src/conversations/generation/generation.types.ts`, add `displayMessage?: string` to the `'error'` variant of `GenerationRelayOutcome`, with a JSDoc line: "user-facing upstream text; unset for transport/runtime failures". Mirror the field on the local outcome type at `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:84-93`.
- [x] 1.2 Set `displayMessage` at the upstream-supplied sites only:
  - the in-band `streamError` return in `conversation-streaming.service.ts` (~line 388);
  - the same return in `apps/chat-api/src/conversations/generation/chat-completions.adapter.ts` (~line 271);
  - the `terminalSignal?.message` branch in `apps/chat-api/src/conversations/generation/responses.adapter.ts` (~line 464). Here `displayMessage` is `terminalSignal?.message`, and `GENERIC_TRUNCATED_MESSAGE` stays only as the `error`'s message.

  Leave both `catch (err)` returns untouched.
- [x] 1.3 In `streamCompletion`'s `case 'error'` (`conversation-streaming.service.ts:721-731`), persist `streamErrorMessage: relayResult.displayMessage ?? ''` and keep the `this.logger.error(…, relayResult.error)` call. Scope guard: no change to the `'rejected'` or `'aborted'` cases.
- [x] 1.4 Tests in `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`:
  - a reader that throws `TypeError('terminated')` after one delta persists the partial content with `streamErrorMessage: ''`, calls `generationService.error` with `''`, and calls `logger.error` with the error;
  - an in-band `{error:{message:'Model overloaded'}}` chunk still persists `'Model overloaded'`, and `displayMessage` is preferred over `message`.

  Update any existing assertion that expected the raw thrown message.
- [x] 1.5 Tests in `apps/chat-api/src/conversations/generation/responses.adapter.spec.ts`:
  - no terminal signal gives an `'error'` outcome with `displayMessage` undefined;
  - `response.failed` with a message gives `displayMessage` equal to that message.

**Verification:**
- `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`
- `npm run test:file -- apps/chat-api/src/conversations/generation/responses.adapter.spec.ts`
- then `npm run verify:changed`

No OpenAPI change, so the `openapi:check` diff must stay empty.

## 2. chat-hooks: allowlist displayable client errors

- [x] 2.1 In `libs/chat-hooks/src/conversation/create-chat-stream-api.ts`, add `export class StreamUpstreamError extends Error` (`name = 'StreamUpstreamError'`) next to `GenerationConflictError`. Make `parseSSELine` (line 67) raise it instead of a plain `Error`. Export it from `libs/chat-hooks/src/index.ts` beside `GenerationConflictError`.
- [x] 2.2 In `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`:
  - add the optional `onStreamError?: (error: Error) => void` param to the options interface (~line 137), with JSDoc explaining why: so the host can log the raw error, because the lib shows only upstream text;
  - store it in a ref;
  - in `onError` (~lines 410-420), call the ref once with the error, then choose `streamErrorMessage`: `GenerationConflictError` gives `generationConflictMessage`, `StreamUpstreamError` gives `error.message`, anything else gives `''`.

  Replace the existing multi-line comment with a block comment covering all three cases.
- [x] 2.3 Architecture guard for `libs/chat-hooks`: confirm the diff adds no `console.*`, no `/api` path, no app, i18n or env import, and no generated-client construction. The only new public surface is `StreamUpstreamError` and `onStreamError`.
- [x] 2.4 Tests:
  - `libs/chat-hooks/src/conversation/tests/create-chat-stream-api.spec.ts`:
    - an in-band error line yields a `StreamUpstreamError` with its message;
    - a rejected fetch, a 502 and a missing body each yield an error that is neither a `StreamUpstreamError` nor a `GenerationConflictError`.
  - `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`:
    - update the "leaves a non-conflict error reporting its own message" case (~line 696) to expect `''` for a plain `Error` / `TypeError('Failed to fetch')`;
    - add a case where a `StreamUpstreamError` keeps its message;
    - add a case where `onStreamError` receives the same error object exactly once;
    - add a case where streaming flags reset for a transport error.
- [x] 2.5 Wire the hosts. In `apps/chat/src/pages/Conversation/Conversation.tsx` (~line 313) and `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx` (~line 246), pass `onStreamError` as a `useCallback` that calls `console.error('Conversation stream failed', error)`.
- [x] 2.6 Docs: in `libs/chat-hooks/README.md`, add an `onStreamError` row to the `useConversationStream` parameters table (~line 918). Extend the error-class section (~line 2025) with `StreamUpstreamError`, and add a note for custom transports: raise it for user-facing upstream text, because any other error is shown as the host fallback. Then run `npm run validate:docs`.

**Verification:**
- `npm run test:file -- libs/chat-hooks/src/conversation/tests/create-chat-stream-api.spec.ts`
- `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`
- `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`, as a regression check for the `''` live-replay event
- `npm run validate:docs`
- then `npm run verify:changed`

## 3. UI: friendly banner with inline "Try again"

- [x] 3.1 i18n (a dedicated task):
  - in `apps/chat/src/i18n/locales/en.json`, add `chat.streamErrorTitle` ("Couldn't finish this response") and the shared `buttons.tryAgain` ("Try again"), and reword `chat.streamError` to "Something went wrong while generating the response. Try again in a moment.";
  - add `StreamErrorTitle` to `ChatI18nKeys` and `TryAgain` to `ButtonsI18nKeys` in `apps/chat/src/constants/translation-keys.ts`.
- [x] 3.2 Look up the UI kit 2.0 `Button` with the `getEntityDetails("component", "Button")` MCP tool to get the variant and size for a compact secondary action inside an error section message. Do not use `Dial*`.
- [x] 3.3 In `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` (lines 884-892):
  - pass `title={t(ChatI18nKeys.StreamErrorTitle)}`;
  - build `message` as a flex row: the existing text (`msg.streamErrorMessage || t(ChatI18nKeys.StreamError)`), plus, when `onRegenerateMessage && !isRegenerateAssistantMessageHidden`, a `Button` labelled `t(ButtonsI18nKeys.TryAgain)` with `disabled={isAssistantTyping}` and `onClick` set to a `useCallback` that calls `onRegenerateMessage(messageIndex)`.
- [x] 3.4 RTL (a dedicated task): the banner row uses only `flex`, `gap-*`, `justify-between`, `text-start` and `ms-*`/`me-*`, with no `ml`/`mr`/`left`/`right`. If a refresh icon is added, it is not mirrored and it gets `aria-hidden` and `stroke={DIAL_KIT_ICON_STROKE}`. Add a component test that renders the banner under a `dir="rtl"` wrapper and asserts the "Try again" button is still found by role and name, and that the row uses no physical-direction classes.
- [x] 3.5 Tests in `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`, using role and text queries only:
  - `''` shows the title and the fallback;
  - upstream text shows under the title;
  - no error means no alert;
  - "Try again" is inside `role="alert"`, and clicking it or pressing Enter calls `onRegenerateMessage` with the index;
  - it is hidden under `HideRegenerateAssistantMessage` or without a handler;
  - it is disabled while `isAssistantTyping`.

  Update the fixture (`streamErrorText`, ~line 155) as needed.

**Verification:**
- `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`
- then `npm run verify:changed`

## 4. Close-out

- [x] 4.1 Run `npm run verify:full` once. Run `npm run validate:docs` again if slice 2's README changed after the last run.
- [x] 4.2 Follow-up: add an `action` slot on the UI kit's `Notification`, so the "Try again" button can move out of the `message` node (design D4). Implemented in `ai-dial-ui-kit` on branch `feat/notification-action-slot` (CHANGELOG `[0.15.0]`). Moving `ConversationMessageItem` onto `action` waits for a kit release that contains it, and is a separate chat change.

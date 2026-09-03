## 1. Make the send-time gate unconditional

- [x] 1.1 In `libs/conversation-input/src/components/Input/Input.tsx` (`handleSend`, line 299), drop the `!isAttachmentsEnabled &&` condition so the gate reads `message.length >= maxMessageLength`, and remove `isAttachmentsEnabled` from the check's reasoning comment if it names attachments
- [x] 1.2 In `libs/conversation-input/src/components/EditMessageInput/EditMessageInput.tsx` (line 97), drop the same `!isAttachmentsEnabled &&` condition from the Save & Submit gate
- [x] 1.3 Confirm the paste warning at `Input.tsx:223-227` is left unchanged, including its `!isAttachmentsEnabled` condition, and add a short block comment stating why the warning is deliberately narrower than the send gate
- [x] 1.4 Verify `isAttachmentsEnabled` is still read elsewhere in both files (paste-to-attachment, attach UI) so removing it from these gates does not leave an unused prop or a `noUnusedParameters` error

## 2. Cover the gate with tests

- [x] 2.1 In `libs/conversation-input/src/components/Input/tests/Input.spec.tsx`, add send-gate boundary tests with a small `maxMessageLength` for `isAttachmentsEnabled` false: at the cap → `onMessageTooLong(length, maxMessageLength)` called, `onSend` not called, textarea keeps its text
- [x] 2.2 Add the same boundary tests for `isAttachmentsEnabled` true, which is the case that regressed — a typed message at the cap must now be refused
- [x] 2.3 Add a below-cap test asserting a length at or above `pasteTextThreshold` but below `maxMessageLength` still sends and does not call `onMessageTooLong`, on both values of `isAttachmentsEnabled`
- [x] 2.4 Add an `EditMessageInput` test that Save & Submit is blocked at the cap with `isAttachmentsEnabled` true
- [x] 2.5 Add a paste test asserting no paste-time `onMessageTooLong` when attachments are enabled and the paste converts to an attachment
- [x] 2.6 Confirm each new test fails against the pre-change code (temporarily restore the `!isAttachmentsEnabled &&` condition) so none of them is vacuous

## 3. Update documentation

- [x] 3.1 In `libs/conversation-input/README.md`, update the `pasteTextThreshold` / `maxMessageLength` paragraph to state that the cap blocks sending on every model regardless of attachment support, and that `pasteTextThreshold` only governs paste-to-attachment conversion
- [x] 3.2 Check the JSDoc on `maxMessageLength`, `pasteTextThreshold`, and `onMessageTooLong` in `libs/conversation-input/src/models/Input.ts` and `ConversationInput.ts` and correct any wording that ties the cap to attachment support
- [x] 3.3 Run `npm run validate:docs` and confirm no new failures (one pre-existing failure in `libs/chat-hooks/README.md` about `useGridEditingScroll` is unrelated to this change)

## 4. Verify

- [x] 4.1 `npm exec nx test @epam/ai-dial-conversation-input` — all green
- [x] 4.2 `npm exec nx lint @epam/ai-dial-conversation-input` and `npm exec nx build @epam/ai-dial-conversation-input` — clean, since the props are public API
- [x] 4.3 `npm exec nx test @epam/chat` — confirm no app test depended on an oversized message being sent
- [ ] 4.4 Manually check both composer surfaces on an attachment-enabled model: a typed message at the cap is refused with the notification and the text is retained

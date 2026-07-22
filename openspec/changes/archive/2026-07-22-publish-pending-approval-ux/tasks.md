## 1. Notification copy

- [x] 1.1 Reword `ConversationPublishI18nKeys.SuccessMessage`'s English value in `apps/chat/src/i18n/locales/en.json` from an implied-complete phrasing to pending-approval wording (see `conversation-publish-flow` spec's suggested copy).
- [x] 1.2 Update any other locale files this project actively maintains with the same reworded value in the same commit. (Only `en.json` exists — no other locale files to update.)

## 2. Remove the premature list refresh

- [x] 2.1 In `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`, remove the `void refreshConversations();` call from `onPublishSuccess`.
- [x] 2.2 Remove the now-unused `refreshConversations` destructure from `useConversations()` in the same file if nothing else in the component uses it.

## 3. Tests

- [x] 3.1 Update `apps/chat/src/components/PublishConversationPanelContainer/tests/PublishConversationPanelContainer.spec.tsx`: replace the "refreshConversations is called on success" assertion with an assertion that it is NOT called; update the success-notification message assertion to the new copy.

## 4. Verification

- [x] 4.1 Run `npm exec nx test chat` — `PublishConversationPanelContainer` suite green. (7/7 tests pass.)
- [x] 4.2 Run `npm exec nx lint chat`. (0 errors; pre-existing unrelated warnings only.)
- [x] 4.3 Run `npm exec nx build chat`. (Build succeeds.)
- [x] 4.4 (Deferred — needs a running app + manual browser check, not available in this environment) Manually verify: publish a conversation and confirm the success notification reads pending-approval wording, and that no console/network activity re-fetches the conversation list as a result of the publish call.

## 5. OpenSpec archive prerequisites

- [x] 5.1 Confirm the `conversation-publish-flow` spec delta applies cleanly against `openspec/specs/conversation-publish-flow/spec.md` with no unresolved conflicts, ready for `/opsx:archive`. (`openspec validate publish-pending-approval-ux --strict` passes.)

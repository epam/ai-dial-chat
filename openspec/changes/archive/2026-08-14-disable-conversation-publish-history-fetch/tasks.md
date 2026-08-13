## 1. Disable the frontend history fetch (implemented)

- [x] 1.1 Remove the `getConversationPublishHistory` call and its `useEffect` from `PublishConversationPanelContainer.tsx`; freeze `history` at `[]` and `isHistoryLoading` at `false` via non-updating `useState`.
- [x] 1.2 Remove the now-dead `setHistory([])` call from the panel-close reset effect (state is already permanently `[]`).
- [x] 1.3 Remove the unused `getConversationPublishHistory` import and the now-unused `splitFolderPath` helper from `PublishConversationPanelContainer.tsx`.
- [x] 1.4 Update `PublishConversationPanelContainer.spec.tsx`: drop assertions on the fetch being called/not-called, and replace the history-mapping test with one asserting `hasExistingPublicationInFolder` is always `false`.
- [x] 1.5 Verify: `npm exec nx test chat -- PublishConversationPanelContainer` and `npx eslint apps/chat/src/components/PublishConversationPanelContainer/**/*.tsx` both pass.
- [x] 1.6 Clarify `conversation-publish-flow`: publication history is informational and repeat submissions create new admin-approval requests, so they are not blocked as duplicates (#7896).

## 2. Follow-up once the backend is fixed (#7897)

- [ ] 2.1 Confirm `GET /api/v1/conversations/publish-history` no longer returns 503 in the target environment.
- [ ] 2.2 Restore the `useEffect` fetch in `PublishConversationPanelContainer.tsx` (call `getConversationPublishHistory`, populate `history`/`isHistoryLoading`/`hasHistoryError`, reset on close) using this change's git history as the reference implementation.
- [ ] 2.3 Restore/extend `PublishConversationPanelContainer.spec.tsx` to re-cover fetch-on-open, no-fetch-while-closed, history mapping/display, and repeat submission remaining enabled when the selected folder has prior history.
- [ ] 2.4 Run `openspec archive` (or the equivalent lifecycle step) to retire the temporary history-visibility delta once the fetch is restored; preserve the base requirement that repeat publish requests remain allowed.

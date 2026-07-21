## 1. Preparation

- [x] 1.1 Note that `apps/chat-api/src/conversations/conversation.service.ts` and its test files already have unrelated uncommitted changes (404-handling in `conversationPathExists`, duplicate-name path logic) — confirm those edits don't touch the `listConversations` merge region (~lines 655-790) before starting, so this change can be implemented and committed independently.
- [x] 1.2 Re-read `listConversations`'s current merge logic (`getBucketRelativePath`, `orgPublishedUserIds`, `userItems`, `userItemPaths`, `publicItems`) end to end to confirm line numbers before editing (they may have shifted since the design doc was written).

## 2. Backend fix

- [x] 2.1 In `ConversationService.listConversations`, replace the two-pass "tag personal item as published" + "filter public item out" logic with a single pass: for each user-bucket item whose relative path matches a public-bucket item's relative path, build the resulting list item from the **public-bucket** `MetadataItem` (mapped via `mapItems` with `{ publishedWithMe: true, isReadonly: true }`), not from the user-bucket item.
- [x] 2.2 Ensure the user-bucket item in a matched pair is excluded from `userItems` (it must not additionally appear as a separate, unmerged personal-bucket entry).
- [x] 2.3 Ensure a public-bucket item with no matching user-bucket relative path still appears in `publicItems` exactly as today (unaffected case).
- [x] 2.4 Ensure a user-bucket item with no matching public-bucket relative path still appears in `userItems` with its own id and pass-through `sharedWithMe`/`publishedWithMe` (unaffected case).
- [x] 2.5 Double check pagination/`nextToken` math (`userData.nextToken`, `publicData.nextToken`) is unaffected by moving which array a matched item is mapped into.

## 3. Tests

- [x] 3.1 Update/add unit tests in `apps/chat-api/src/conversations/tests/conversation.service.spec.ts` covering: matched personal+public pair returns one item with the public-bucket `id`, `isReadonly: true`, `publishedWithMe: true`; unmatched personal-only item is unaffected; unmatched public-only item is unaffected.
- [x] 3.2 Update/add an integration test in `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` asserting `GET /api/v1/conversations/list` never returns an item with `publishedWithMe: true` whose `id` bucket segment is the caller's own session bucket. **Adjusted during implementation**: this spec file mocks `ConversationService` entirely, so it can only verify the controller passes the service's response through unchanged (no bucket-swapping/mutation at the controller layer) — it cannot exercise the real dedup logic, which is covered by the unit tests in 3.1.
- [x] 3.3 Run `npm exec nx test chat-api` and confirm all conversations tests pass.

## 4. Verification

- [x] 4.1 Run `npm exec nx lint chat-api` and `npm exec nx build chat-api`.
- [x] 4.2 (Deferred — needs a live DIAL Core backend/user session, not available in this environment) Manually verify: publish a personal conversation to a public folder whose target path matches the personal relative path, call `GET /api/v1/conversations/list`, and confirm the returned item's `id` starts with `conversations/public/...`. To be done before merge.
- [x] 4.3 (Deferred — same reason as 4.2) In the running frontend, open the published conversation from the list and confirm the address bar / "Copy link" both resolve to a `public` bucket URL, not the personal bucket. To be done before merge.
- [x] 4.4 Update `openspec/specs/conversations-api/spec.md` is NOT edited directly — confirm the delta in `specs/conversations-api/spec.md` under this change will be applied by `/opsx:archive` once merged.

## 5. Redesign — stop merging, always return two independent items

Code review of the merge-based fix (section 2 above) found it only engaged for root-bucket publishes (publish-to-folder never matches by relative path) and silently broke the personal copy's pin status when it did engage. Decision: remove the merge/match logic entirely; personal and public copies are always independent list items.

- [x] 5.1 Remove `getBucketRelativePath`/`publicItemPaths`/the cross-bucket filter from `listConversations`; build `userItems` from all of `userData.items` unconditionally and `publicItems` from all of `publicData.items` unconditionally (each with its own overrides, no mutual filtering).
- [x] 5.2 Update `conversation.service.spec.ts`: replace the "returns the public-bucket item (not the personal copy)" test with one asserting both the personal and public copies appear as independent items; add a test asserting the personal copy's `isPinned` survives publishing (public copy's `isPinned` is independently false unless its own id was pinned); remove the now-redundant "keeps personal-only and public-only items unaffected" test (no longer a distinct code path once matching is gone).
- [x] 5.3 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api -- --fix`, `npm exec nx build chat-api` — all green (246 tests).
- [x] 5.4 Rewrite `proposal.md` and `design.md` to describe the "always two independent items" design instead of the merge-based one; rewrite the `specs/conversations-api/spec.md` delta's "Personal/public duplicate resolution" section and its two scenarios accordingly.
- [x] 5.5 (Deferred — needs a live DIAL Core backend/user session) Manually verify: publish a personal conversation to any folder (not just bucket root), confirm the list shows both the personal and public copies with correct, independent ids, and that a previously pinned personal conversation stays pinned after publishing.

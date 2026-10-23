Slicing strategy: vertical, backend-only. Slice 1 changes the listing rule and its tests, which fixes #9501 end to end because the frontend already treats `isScheduledTask: false` as a regular conversation. Slice 2 brings the OpenAPI description and the generated client in line with that rule.

## 1. Listing reports foreign runs as ordinary conversations

- [x] 1.1 In `apps/chat-api/src/conversations/listing/conversation-listing.service.ts`, run `parseScheduledTaskConversationPath` and attach `scheduleId`/`runId`/`isUnread` only for items from the user's own bucket listing. Public-bucket items from `mapItems` (called with the `publishedWithMe`/`isReadonly` overrides) and items from the `getSharedResources` mapping get `isScheduledTask: false` with those three fields omitted. Decide by data source (an explicit option passed to `mapItems`), not by the `sharedWithMe`/`publishedWithMe` flags DIAL Core reports on a user-bucket item. Remove the now-unused `parseScheduledTaskConversationPath`/`viewedSet` use from the shared-resources mapping.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/listing/tests/conversation-listing.service.spec.ts`
- [x] 1.2 Update `apps/chat-api/src/conversations/listing/tests/conversation-listing.service.spec.ts`:
  - change "tags a public-bucket item created by a scheduled task independently of its own path" to assert that a `conversations/public/.scheduler/...` item is listed with `publishedWithMe: true`, `isScheduledTask: false` and no `scheduleId`/`runId`/`isUnread`;
  - change "tags a shared item created by a scheduled task using its own resource id" to the same assertion for a `conversations/other-bucket/.scheduler/...` shared item;
  - add a test that a shared run stays non-scheduled with no `isUnread` even when the viewed-ids set holds the same path under the caller's own bucket;
  - keep the existing user-bucket tests (tagging, unread/viewed, fail-open) unchanged and green.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/listing/tests/conversation-listing.service.spec.ts`
- [x] 1.3 Check that `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` has no assertion that a public or shared item is a scheduled task. Update any it has.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts`
- [x] 1.4 Slice check: `npm run verify:changed`

## 2. OpenAPI description and generated client

- [x] 2.1 In `apps/chat-api/src/conversations/dto/conversation-list.dto.ts`, change the `isScheduledTask` description so it says the flag is true only for a run in the caller's own bucket and is always false for public and shared items. Align the `isUnread` description ("Present only when `isScheduledTask` is true" stays accurate). No type, name or required-ness changes.
- [x] 2.2 Run `npm run openapi`, then `npm run openapi:check`. Commit the regenerated `libs/chat-api-client` output; the diff should be description/doc-comment only. Do not hand-edit generated files.
- [x] 2.3 Build and lint the client: `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`.
- [x] 2.4 Slice check: `npm run verify:changed`

## 3. Specs and close-out

- [x] 3.1 Run `npm run validate:specs` against the delta spec in `openspec/changes/treat-foreign-scheduled-runs-as-regular/specs/conversations-api/spec.md`, and `npm run spec:impact` to see whether other specs reference the changed listing file. Do not edit `openspec/specs/scheduled-task-conversation-grouping/spec.md`: its shared/published exemption describes the pure `collapseScheduledTaskConversations` input contract and stays as defense in depth (proposal Non-goals).
- [x] 3.2 Final gate: `npm run verify:full`

## 4. Follow-ups (out of scope, record only)

- [x] 4.1 Record, without fixing: `ConversationService.markConversationViewed` rebuilds the id with the caller's bucket (`buildConversationUrl(bucket, path)`), so it can never mark a non-own resource. After this change no client calls it for one, but the endpoint still accepts such a path. Hardening or a validation rule needs its own change if wanted.

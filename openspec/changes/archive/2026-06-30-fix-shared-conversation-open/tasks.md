## 1. Backend Fix

- [x] 1.1 In `apps/chat-api/src/conversations/conversation.service.ts`, update `resolveConversationLocation` so that paths not starting with `{sessionBucket}/` or `public/` split on the first `/` and use the left segment as the target bucket and the right segment as the sub-path (instead of falling back to `sessionBucket` with the full path as sub-path)

## 2. Tests

- [x] 2.1 In `apps/chat-api/src/conversations/tests/conversation.service.spec.ts`, add unit tests for `resolveConversationLocation` (via `getConversation`) covering: own-bucket path, public-bucket path, third-party-bucket path (shared conversation), and no-slash fallback path

## 3. Verification

- [x] 3.1 Run `npm exec nx test chat-api` and confirm all tests pass
- [x] 3.2 Run `npm exec nx lint chat-api` and confirm no lint errors

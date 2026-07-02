## 1. Service: remove scan and suffix logic from `duplicateConversation`

- [x] 1.1 In `apps/chat-api/src/conversations/conversation.service.ts`, remove the `fetchAllUserTitles` call, `reservedTitles` set, and `resolveUniqueConversationName` call from `duplicateConversation`; replace with `const uniqueTitle = baseTitle`.
- [x] 1.2 Remove the `fetchAllUserTitles` method from `ConversationService` if it has no remaining callers.
- [x] 1.3 Remove the import of `resolveUniqueConversationName` if it is no longer used.

**Verify slice 1:**
```sh
npm exec nx test chat-api -- --testPathPattern conversation.service
npm exec nx lint chat-api
```

## 2. Remove dead utility

- [x] 2.1 Delete `apps/chat-api/src/conversations/utils/resolve-unique-conversation-name.ts` if no callers remain after slice 1.
- [x] 2.2 Delete `apps/chat-api/src/conversations/utils/resolve-unique-conversation-name.spec.ts` alongside the implementation file.

**Verify slice 2:**
```sh
npm exec nx test chat-api
npm exec nx lint chat-api
```

## 3. Update unit tests for `duplicateConversation`

- [x] 3.1 Update `apps/chat-api/src/conversations/tests/conversation.service.spec.ts` to cover:
  - Duplicate `"hello"` → display name is `"hello"` (no suffix).
  - Duplicate `"hello 1"` → display name is `"hello 1"` (regression: must NOT produce `"hello 1 1"`).
  - Guard: `fetchAllUserTitles` is NOT called during duplicate.
  - Guard: `ConversationNamingService` is NOT called during duplicate.
  - Guard: `createConversation` remains unchanged — does not add a numeric suffix.

**Verify slice 3:**
```sh
npm exec nx test chat-api
npm exec nx lint chat-api
```

## 4. Final verification

- [x] 4.1 Full affected check from the base branch:
  ```sh
  npm exec nx affected --target=test --base=origin/development-1.0
  npm exec nx affected --target=lint --base=origin/development-1.0
  ```

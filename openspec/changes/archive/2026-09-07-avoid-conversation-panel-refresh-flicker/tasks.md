## 1. Preserve the conversation panel during refresh

Slicing strategy: one vertical frontend-state slice covering the context
contract, observable panel behavior, and regression test.

- [x] 1.1 Add deferred-request cases to
  `apps/chat/src/context/tests/ConversationsContext.spec.tsx` proving that an
  explicit refresh preserves loaded conversations and `isLoading=false` while
  pending, replaces the list on success, and preserves the list while setting
  `error` on failure. Verification: run
  `npm run test:file -- apps/chat/src/context/tests/ConversationsContext.spec.tsx`.
- [x] 1.2 Update `refreshConversations()` and its public JSDoc in
  `apps/chat/src/context/ConversationsContext.tsx` so explicit refreshes update
  in the background, while the existing initial/identity effect remains the
  only path that clears the list and toggles blocking loading. Verification:
  run
  `npm run test:file -- apps/chat/src/context/tests/ConversationsContext.spec.tsx`.

## 2. Verify the completed slice

- [x] 2.1 Run `npm run verify:changed` once after the context implementation and
  regression coverage are complete.
- [x] 2.2 Run exactly one final non-mutating `npm run verify:full` and record any
  unrelated pre-existing warnings separately from change failures.

  Result: the command stopped in the repository-wide typecheck on unrelated
  `apps/chat-api` and `mcp-app-sandbox` errors (`TS6305` missing declaration
  outputs plus existing telemetry/skills/toolsets test typing errors). The
  change-specific test and `verify:changed` passed.

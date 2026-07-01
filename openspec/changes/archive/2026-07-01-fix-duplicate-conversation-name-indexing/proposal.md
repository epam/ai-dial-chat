## Why

`duplicateConversation` currently calls `fetchAllUserTitles` (full bucket scan with pagination) and appends a numeric suffix to the display name. This is unnecessary complexity: `createConversation` already works without a title scan, and path uniqueness is guaranteed by a UUID segment when the path is already taken. The duplicate flow should behave the same way — keep the source display name as-is, drop the scan, drop the suffix.

## What Changes

- `duplicateConversation` in `apps/chat-api/src/conversations/conversation.service.ts` sets the new conversation's `name` to the same value as the source title — no numeric suffix appended.
- Remove the `fetchAllUserTitles` call from `duplicateConversation`.
- Remove `resolveUniqueConversationName` and `fetchAllUserTitles` from `ConversationService` if they become dead code.
- Path collision (when `{deploymentId}__{name}` is already taken) is handled by the existing UUID-segment mechanism — same as `createConversation`.
- Update unit tests in `apps/chat-api/src/conversations/tests/conversation.service.spec.ts` and remove `resolve-unique-conversation-name` tests if the utility is deleted.
- Update `openspec/specs/auto-index-duplicate-names/spec.md` to reflect the new duplicate naming contract.

No API contract changes, no frontend changes, no LLM naming changes.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `auto-index-duplicate-names`: Remove the requirement that `duplicateConversation` appends a numeric suffix and fetches all titles. The duplicate display name SHALL equal the source display name. Path uniqueness is handled by the UUID-segment mechanism.

## Impact

- **Backend only**: changes confined to `apps/chat-api/src/conversations/`.
- No API contract changes.
- No frontend changes required.
- `duplicateConversation` no longer paginates through the user bucket — eliminates latency and DIAL Core load.
- No LLM naming flow is touched.
- No new user-visible strings; no feature flag changes.
- Backward compatible: existing conversations are not affected.

## Non-goals

- Any numeric suffix logic in the duplicate flow.
- LLM naming for the duplicate flow.
- Changing `createConversation` naming.
- Frontend-side changes.

## Alternatives Considered

- **Deterministic increment (`hello 1` → `hello 2`)**: rejected — still requires reasoning about numeric suffixes; the simplest correct behaviour is no suffix at all, consistent with create.
- **Keep `fetchAllUserTitles` + fix base extraction**: rejected — expensive, stale-by-design, unnecessary.

## Rollback / Backward Compatibility

Non-breaking. Display names of duplicated conversations will no longer have an auto-appended suffix. Rolling back reverts `conversation.service.ts`; no data migration required.

## References

- Issue: https://github.com/epam/ai-dial-chat/issues/7439
- Related PR (create flow fix): https://github.com/epam/ai-dial-chat/pull/7495
- Reference implementation: `apps/chat-api/src/conversations/conversation.service.ts` — `createConversation` (no title scan, UUID path fallback)

## Context

`duplicateConversation` in `apps/chat-api/src/conversations/conversation.service.ts:502` currently paginates through the user bucket (`fetchAllUserTitles`) and appends a numeric suffix to avoid display-title collisions. `createConversation` was already simplified in PR #7495 to use the source name as-is and handle path uniqueness via a UUID segment. The duplicate flow should follow the same pattern.

## Goals / Non-Goals

**Goals:**
- `duplicateConversation` keeps the source display name unchanged — no suffix appended, no bucket scan.
- Remove `fetchAllUserTitles` and `resolveUniqueConversationName` from the service if they become dead code.
- Path collision handled by the existing UUID-segment mechanism.

**Non-Goals:**
- Any numeric suffix logic.
- Display-title uniqueness guarantees — only path uniqueness is enforced.
- Touching `createConversation`, LLM naming, or API contracts.

## Decisions

### Decision: Use source `name` directly, mirror `createConversation` path logic

In `duplicateConversation`, replace:
```ts
const existingTitles = await this.fetchAllUserTitles(token, sessionBucket);
const reservedTitles = new Set(existingTitles);
reservedTitles.add(baseTitle);
const uniqueTitle = resolveUniqueConversationName(baseTitle, reservedTitles);
```
with:
```ts
const uniqueTitle = baseTitle;
```

Path collision (`{deploymentId}__{uniqueTitle}` already exists) is already handled by the same UUID-segment check used in `createConversation` — no further changes needed there.

`resolveUniqueConversationName` and `fetchAllUserTitles` are removed if no other callers remain.

## Risks / Trade-offs

- **Two conversations may share the same display name**: accepted — was already possible before this change (create never deduplicated titles). Path uniqueness via UUID ensures no data loss.

## Migration Plan

- One commit: update `conversation.service.ts`, delete dead utilities, update tests.
- No database migration, no config change.
- Rollback: revert `conversation.service.ts`.

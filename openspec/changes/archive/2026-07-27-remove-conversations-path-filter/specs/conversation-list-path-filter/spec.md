## REMOVED Requirements

### Requirement: listConversations accepts an optional path parameter to scope the listing

**Reason**: The `path` scoping feature was never fully correct (issue #7927 — the shared-with-me source ignored `path` even after a partial fix) and has no frontend consumer; every call site of `apps/chat/src/server-api/conversations.api.ts`'s `listConversations` wrapper omits `path`. Rather than fix the shared-resources gap for an unused parameter, it is removed entirely.
**Migration**: Callers must not send `path`. `GET /api/v1/conversations/list` always returns the full recursive listing from the bucket root, which is the same result previously obtained by omitting `path` or passing an empty string.

## Why

Opening a shared conversation by URL fails silently: the page redirects to root instead of displaying the conversation. The root cause is that the backend `resolveConversationLocation` helper does not handle a conversation path that begins with a third-party bucket (i.e., a conversation shared with the authenticated user by another user).

## What Changes

- Fix `resolveConversationLocation` in `apps/chat-api/src/conversations/conversation.service.ts` to correctly resolve shared conversations whose path starts with a bucket that is neither the session bucket nor the public bucket.

## Capabilities

### New Capabilities

_(none — this is a bug fix with no new user-facing feature)_

### Modified Capabilities

- `conversations-api`: The GET conversation endpoint now correctly fetches conversations from third-party buckets (shared conversations), instead of always falling back to the session bucket.

## Impact

- **Backend**: `apps/chat-api/src/conversations/conversation.service.ts` — `resolveConversationLocation` method.
- **Tests**: `apps/chat-api/src/conversations/tests/conversation.service.spec.ts` — add coverage for shared-bucket path resolution.
- **No API contract change**: the existing `GET /api/v1/conversations?path=` endpoint signature is unchanged.
- **No frontend change required**: the frontend already passes `{shared-bucket}/{name}` as the path; the backend just needs to handle it.

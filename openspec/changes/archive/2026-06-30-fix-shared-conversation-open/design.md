## Context

`ConversationService.resolveConversationLocation(conversationPath, sessionBucket)` decides which DIAL Core bucket and relative sub-path to use when fetching or watching a conversation. It currently handles two cases:

1. Path starts with `{sessionBucket}/` → fetch from the session bucket.
2. Path starts with `public/` → fetch from the public bucket.
3. Everything else → **fallback: use `sessionBucket` with the full path as sub-path.**

Case 3 is a bug: a shared conversation arrives as `{other-user-bucket}/{name}`. The fallback incorrectly requests `conversations/{sessionBucket}/{other-user-bucket}/{name}` from DIAL Core, which returns 404. The frontend `loadConversation` catch block then silently redirects to root — the user sees no error and the shared conversation never opens.

The frontend already passes the full `{other-bucket}/{name}` string as the `path` query param (set in `loadConversation` via `apiGetConversation(conversationId)`). No frontend change is needed.

## Goals / Non-Goals

**Goals:**
- Shared conversations open correctly when navigated to by URL.
- The fix is backward-compatible: own-bucket and public-bucket paths are unchanged.

**Non-Goals:**
- Changing the frontend URL scheme or the API contract.
- Fixing unrelated display-name watch issues for shared conversations (out of scope for this fix).

## Decisions

**Extract bucket from first path segment for unrecognized paths.**

After the session-bucket and public-bucket checks, split `conversationPath` on the first `/`. The left side is the bucket; the right side is the sub-path. Pass both to the DIAL Core client.

```typescript
// Before (fallback — broken for shared conversations):
return { bucket: sessionBucket, subPath: conversationPath };

// After:
const slashIndex = conversationPath.indexOf('/');
if (slashIndex !== -1) {
  return {
    bucket: conversationPath.slice(0, slashIndex),
    subPath: conversationPath.slice(slashIndex + 1),
  };
}
return { bucket: sessionBucket, subPath: conversationPath };
```

Authorization is enforced by DIAL Core: if the authenticated user's token does not have read access to the third-party bucket, DIAL Core returns 403/404 and the service propagates the error.

The `duplicateConversation` method already uses the same first-slash split logic successfully — this aligns `resolveConversationLocation` with the established pattern.

## Risks / Trade-offs

- **None for authorized access**: DIAL Core is the authority for bucket-level ACL. Passing an arbitrary bucket name to DIAL Core does not bypass any security check — if the user is not authorized, DIAL Core rejects the request.
- **Malformed paths**: A path with no `/` and no recognized bucket falls back to `{ bucket: sessionBucket, subPath: conversationPath }` unchanged — same as before.

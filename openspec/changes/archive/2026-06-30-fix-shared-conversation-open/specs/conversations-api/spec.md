## MODIFIED Requirements

### Requirement: GET /api/v1/conversations fetches a conversation from the correct DIAL Core bucket

The backend SHALL expose `GET /api/v1/conversations` accepting a `path` query parameter (`@IsString @MinLength(1)`). The `path` encodes both the DIAL Core bucket and the resource name as `{bucket}/{conversationName}`. The service MUST extract the bucket as the first `/`-delimited segment and the resource name as the remainder, for ALL paths — including those that begin with a bucket that is neither the session bucket nor the public bucket.

If `path` contains no `/`, the session bucket is used as a fallback (backward-compatible with legacy callers that strip the bucket before sending). This allows users to open their own conversations, as well as public and shared conversations whose bucket differs from the session bucket.

```
path = "userBucket/gpt-4o__title"   →  getConversation("userBucket", "gpt-4o__title")
path = "public/gpt-4o__title"       →  getConversation("public", "gpt-4o__title")
path = "otherBucket/name"           →  getConversation("otherBucket", "name")
path = "name"                       →  getConversation(sessionBucket, "name")  [legacy]
```

DIAL Core's sharing mechanism grants READ access to the resource at its original path using the requesting user's auth token, so no special headers or bucket substitution are needed for shared or public conversations.

`resolveConversationLocation` in `ConversationService` is the single implementation point for this routing logic. It MUST NOT fall back to the session bucket when the first path segment is neither the session bucket nor `public` — it SHALL extract and use that segment as the target bucket.

**Frontend behaviour.** The `Conversation` page passes the full URL wildcard param (`{bucket}/{name}`) directly to `GET /api/v1/conversations?path=...` after `decodeURIComponent`.

#### Scenario: Own conversation is fetched from the session bucket

- **WHEN** the URL param is `"userBucket/gpt-4o__title__uuid"` and the session bucket equals `"userBucket"`
- **THEN** the service calls `client.getConversation("userBucket", "gpt-4o__title__uuid")` and returns 200

#### Scenario: Public conversation is fetched from the public bucket

- **WHEN** the path is `"public/gpt-4o__title__uuid"`
- **THEN** the service calls `client.getConversation("public", "gpt-4o__title__uuid")` and returns 200

#### Scenario: Shared conversation is fetched from the originating bucket

- **WHEN** the path is `"otherUserBucket/gpt-4o__title__uuid"` and the user has been granted access via the sharing mechanism
- **THEN** the service calls `client.getConversation("otherUserBucket", "gpt-4o__title__uuid")` and returns 200

#### Scenario: Path with no slash falls back to session bucket

- **WHEN** the path is `"some-conversation-name"` with no `/`
- **THEN** the service calls `client.getConversation(sessionBucket, "some-conversation-name")` and returns 200

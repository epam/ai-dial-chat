## MODIFIED Requirements

### Requirement: GET /api/v1/conversations lists conversation metadata

The backend SHALL expose `GET /api/v1/conversations` in `apps/chat-api/src/conversations/conversation.controller.ts`. The endpoint SHALL return an array of `ConversationMetadataDto` objects for the current in-memory store. It SHALL accept optional query parameters `limit` (default 20, max 100) and `offset` (default 0) for pagination.

`ConversationMetadataDto` shape:

```ts
class ConversationMetadataDto {
  id: string;       // UUID
  title: string;    // first user message text, truncated to 80 chars
  updatedAt: string; // ISO-8601 — timestamp of last save/create
}
```

Rate limiting: inherits the global 100 req/min default.

Error codes:
- `400 Bad Request` — invalid `limit` or `offset` values

#### Scenario: Returns empty array when no conversations exist
- **WHEN** `GET /api/v1/conversations` is called and the store is empty
- **THEN** the response is 200 with `[]`

#### Scenario: Returns paginated metadata
- **WHEN** `GET /api/v1/conversations?limit=2&offset=0` is called and 5 conversations exist
- **THEN** the response is 200 with an array of 2 `ConversationMetadataDto` objects

#### Scenario: Invalid limit returns 400
- **WHEN** `GET /api/v1/conversations?limit=abc` is called
- **THEN** the response is 400

---

### Requirement: Existing conversation endpoints are unchanged

`POST /api/v1/conversations`, `GET /api/v1/conversations/:path`, `PUT /api/v1/conversations/:path`, and `DELETE /api/v1/conversations/:path` SHALL continue to work as specified in existing requirements. The new list endpoint MUST NOT alter their behaviour or response shapes.

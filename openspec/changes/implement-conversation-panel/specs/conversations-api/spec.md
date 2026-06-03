## REMOVED Requirements

### Requirement: GET /api/v1/conversations lists conversation metadata

**Reason**: Superseded during implementation. The list endpoint was shipped at `GET /api/v1/conversations/list` (using `@Get('list')` to avoid route conflict with the existing `@Get()` handler). Offset-based pagination was replaced with DIAL Core cursor-based pagination (`nextToken`). The in-memory store backing was replaced with DIAL Core metadata queries. See `openspec/changes/conversation-panel-state-and-list-path/specs/conversations-api/spec.md` for the current authoritative spec.

**Migration**: Use `GET /api/v1/conversations/list` with `limit` and `nextToken` query parameters.

---

### Requirement: Existing conversation endpoints are unchanged

`POST /api/v1/conversations`, `GET /api/v1/conversations`, `PUT /api/v1/conversations`, and `DELETE /api/v1/conversations` SHALL continue to work as specified in existing requirements. The list endpoint MUST NOT alter their behaviour or response shapes.

#### Scenario: Existing endpoints are unaffected by the list endpoint

- **WHEN** `POST /api/v1/conversations` is called with a valid body
- **THEN** the response is 201 and behavior is unchanged from before the list endpoint was added

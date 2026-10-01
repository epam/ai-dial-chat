## ADDED Requirements

### Requirement: Stage parent references survive assembly and persistence

The server stage assembler SHALL retain optional `parent_stage_index` on a stage-opening delta and preserve it when subsequent deltas for that stage omit it. Zero SHALL be a valid reference. It SHALL merge stages by their explicit streaming index, preserve the flat representation and existing text/attachment/status behavior, and keep child updates independent of parent status. The existing backend generation service SHALL persist this metadata with the assistant message; completed-message fetch and generation replay SHALL retain the same relationship. No alternate nested persistence representation or stage-specific cache SHALL be introduced.

#### Scenario: Opening-only parent metadata survives later deltas

- **WHEN** a stream opens parent 0 and child 1 with `parent_stage_index: 0`, then sends child content and completion deltas without parent metadata
- **THEN** the assembled child still references parent 0 and contains the concatenated content and explicit final status
- **AND** the parent's status changes only in response to its own delta

#### Scenario: Sparse indexes survive a saved conversation

- **WHEN** a generation with parent 4 and children 7 and 9 referencing 4 completes and the conversation is fetched again
- **THEN** the persisted stages retain those explicit indexes and both parent references
- **AND** frontend normalization does not reinterpret 4 as an array offset

#### Scenario: Flat legacy input remains compatible

- **WHEN** a stream has no `parent_stage_index` on any stage
- **THEN** assembly and persistence retain the existing flat payload without adding synthetic parent metadata

### Requirement: Conversation stage DTOs expose optional parent references

`StageDto` SHALL expose `parent_stage_index?: number` in Swagger as an optional integer with minimum zero and explain streaming-index versus complete-array-position semantics. Existing nested stage validation SHALL accept zero and positive integers, preserve the field during transformation/serialization, and reject present negative, fractional or string values. This SHALL NOT add a graph validator or change the opaque whole-conversation validation policy of `SaveConversationBodyDto.conversation`. Missing stages/parent metadata SHALL remain valid. The frontend renderer's malformed-reference fallback applies to upstream/history data; it does not weaken existing DTO validation.

`libs/chat-api-client/openapi.json` and the generated `StageDto` model SHALL be regenerated from the backend source. No generated file SHALL be hand-edited. Existing frontend wrappers SHALL continue using the configured `conversationsApi` singleton; no new operationId, SDK singleton or endpoint SHALL be introduced.

Existing contract surface affected by the additive model:

| Operation | Request | Success | Generated client |
| --- | --- | --- | --- |
| `GET /api/v1/conversations?path={path}` | `ConversationPathDto`, no body | 200 `ConversationResponseDto` | `ConversationsApi.getConversation`, normal method |
| `PUT /api/v1/conversations?path={path}` | `SaveConversationQueryDto` and `SaveConversationBodyDto` with full `conversation` | 200 `ConversationResponseDto` | `ConversationsApi.saveConversation`, normal method |

Operation IDs remain `getConversation` and `saveConversation`. The optional field is reachable through `ConversationResponseDto.messages[].custom_content.stages[]` and existing nested message DTOs. Streaming endpoints retain their existing SSE transport and methods. No `Raw` access is newly required.

Both routes retain existing session authentication, per-user conversation access and CSRF enforcement for writes. Existing errors remain 400 for invalid requests, 401 for unauthenticated access, 403 where existing access/CSRF guards reject the request, 404 for missing conversations, 502 for upstream errors and 503 for unavailability. No authorization expansion or new error code is part of the field addition. There is no new cache key/TTL/invalidation, feature/role gate, i18n text, RTL behavior or telemetry for this backend change.

Concrete existing save request with nested metadata:

```http
PUT /api/v1/conversations?path=test-bucket%2Fnested.json
Content-Type: application/json
X-CSRF-Token: <current-session-token>
Cookie: <current-session-cookie>
```

```json
{
  "conversation": {
    "id": "test-bucket/nested.json",
    "folderId": "test-bucket",
    "name": "Nested stages",
    "model": { "id": "agent" },
    "prompt": "",
    "temperature": 1,
    "messages": [
      {
        "role": "assistant",
        "content": "Result",
        "timestamp": "2026-09-30T10:00:00.000Z",
        "custom_content": {
          "stages": [
            { "index": 0, "name": "Plan", "status": "completed" },
            { "index": 1, "parent_stage_index": 0, "name": "Search", "status": "completed" }
          ]
        }
      }
    ],
    "lastActivityDate": 1790762400000,
    "updatedAt": 1790762400000,
    "selectedAddons": [],
    "assistantModelId": "agent"
  }
}
```

The 200 save response and subsequent GET response are the conversation object from that envelope, with both stage indexes and `parent_stage_index: 0` retained; existing server-managed metadata may be updated. For an upstream non-streaming snapshot the equivalent stage array is `[ { "name": "Plan", "status": "completed" }, { "name": "Search", "status": "completed", "parent_stage_index": 0 } ]`. Fetch SHALL preserve that representation, and `stage-visualization` defines positional normalization for rendering.

#### Scenario: Parent metadata survives nested validation

- **WHEN** a `ConversationMessageDto` with a child referencing parent 0 passes through the production-style transforming, whitelisting validation pipe
- **THEN** the request is accepted and the nested parent field survives transformation and serialization

#### Scenario: Invalid numeric parent metadata fails validation

- **WHEN** a nested stage DTO supplies a negative number, fraction or string for `parent_stage_index`
- **THEN** that DTO fails the existing request-validation path
- **AND** an omitted parent remains accepted

#### Scenario: Whole-conversation save retains its existing policy

- **WHEN** the example whole-conversation body is saved and fetched through the existing routes
- **THEN** the parent metadata round-trips without introducing new nested validation on the save envelope

#### Scenario: Generated client exposes the added property

- **WHEN** OpenAPI and client generation run from the updated DTO
- **THEN** the generated `StageDto` has optional numeric `parent_stage_index`, existing SDK methods remain unchanged, and `npm run openapi:check` passes

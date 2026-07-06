## MODIFIED Requirements

### Requirement: PATCH /api/v1/conversations renames a conversation by moving it to a new DIAL Core path

The backend SHALL expose `PATCH /api/v1/conversations` in `apps/chat-api/src/conversations/conversation.controller.ts`. The endpoint accepts query parameter `path` (validated by `RenameConversationDto` — `@IsString @MinLength(1) @MaxLength(512)`) and a JSON body `RenameConversationBodyDto`:

```ts
class RenameConversationBodyDto {
  @IsString()
  @MinLength(1)
  @MaxUtf8ByteLength(255)
  newTitle: string;
}
```

The service method `renameConversation(path, newTitle, at, bucket)` SHALL preserve the conversation identity — it MUST NOT change the storage path or filename, and MUST NOT call `client.moveResource`. It SHALL:
1. Sanitise `newTitle` through `prepareEntityName` to strip disallowed characters and truncate to 255 UTF-8 bytes.
2. Load the stored conversation body at the given `path` and `bucket` (404 if it does not exist).
3. Persist the conversation at the **same** `path` with `name` set to the sanitised title and `llmNamingDone: true`, leaving all other fields (including the filename-derived id) unchanged.
4. Return `{ name: string }` — the sanitised stored display name.

Because the path is unchanged, the rename flow MUST NOT perform pin migration (`migratePin`) and MUST NOT run a post-move display-name sync (`syncStoredDisplayNameAfterPathRename`); both existed only to compensate for the previous path change and are removed from this flow.

Response body (200 OK):

```ts
class RenameConversationResponseDto {
  name: string;
}
```

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })` on the handler.

Generated-client impact:
- OpenAPI operationId: `renameConversation`
- SDK method: `ConversationsApi.renameConversation({ path, renameConversationBodyDto })`
- Response type: `RenameConversationResponseDto` (`{ name }`)
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — `path` or `newTitle` fails DTO validation
- `401 Unauthorized` — missing or invalid bearer token
- `404 Not Found` — source conversation does not exist in DIAL Core
- `502 Bad Gateway` — DIAL Core returned an unexpected error
- `503 Service Unavailable` — DIAL Core unreachable

#### Scenario: Valid request returns 200 with name and unchanged path

- **WHEN** `PATCH /api/v1/conversations?path=model__Old+Title__uuid` is called with body `{ "newTitle": "New Title" }`
- **THEN** the response status is 200 and the body is `{ "name": "New Title" }`
- **AND** the conversation remains stored at `model__Old Title__uuid` (path/id unchanged)

#### Scenario: Rename persists name and llmNamingDone at the same path

- **WHEN** a rename succeeds
- **THEN** the stored conversation body has `name` set to the sanitised title and `llmNamingDone: true`
- **AND** no `moveResource` call is made

#### Scenario: Empty newTitle returns 400

- **WHEN** `PATCH /api/v1/conversations?path=...` is called with body `{ "newTitle": "" }`
- **THEN** the response status is 400

#### Scenario: newTitle exceeding 255 UTF-8 bytes returns 400

- **WHEN** `PATCH /api/v1/conversations?path=...` is called with `newTitle` of 256 UTF-8 bytes
- **THEN** the response status is 400

#### Scenario: Non-existent source path returns 404

- **WHEN** the conversation at `path` does not exist in DIAL Core
- **THEN** the response status is 404

#### Scenario: Integration test covers PATCH 200 and 400 paths

- **WHEN** the integration test suite for `ConversationController` runs
- **THEN** it covers: 200 with valid path and newTitle (id unchanged), 400 with empty newTitle, 400 with missing path

---

### Requirement: Conversation list uses stored display name for writable items

`ConversationService.listConversations` SHALL enrich writable user-owned list items with `conversation.name` from `getConversation` when available, so list `title` reflects the stored display name (including LLM-renamed and manually-renamed titles), not only the filename-derived title.

The display-name resolution (`resolveListDisplayTitle`, also used by `getConversation`) SHALL treat a non-empty stored `name` as authoritative for the display title whenever the conversation is finally named (`llmNamingDone === true`), even when the filename-derived title diverges from `name`. A manual rename sets `llmNamingDone: true`, so a manually renamed conversation whose filename still encodes the old title SHALL display the new `name`. The prior heuristic that fell back to the filename-derived title when the stored `name` differed from the message-derived title MUST NOT override an authoritative stored `name`.

#### Scenario: List title reflects LLM-renamed display name

- **GIVEN** a conversation is stored at `gpt-4o__Hello__<uuid>` with `name: "Docker networking basics"` and `llmNamingDone: true`
- **WHEN** `GET /api/v1/conversations` is called
- **THEN** the matching list item `title` is `"Docker networking basics"`

#### Scenario: List title reflects manually-renamed display name when filename diverges

- **GIVEN** a conversation is stored at `gpt-4o__Old Title__<uuid>` with `name: "New Title"` and `llmNamingDone: true` after a manual rename
- **WHEN** `GET /api/v1/conversations` is called
- **THEN** the matching list item `title` is `"New Title"` (not the filename-derived `"Old Title"`)

#### Scenario: GET reflects manually-renamed display name when filename diverges

- **GIVEN** the same manually-renamed conversation
- **WHEN** `GET /api/v1/conversations/:id` is called for it
- **THEN** the returned display title is `"New Title"`

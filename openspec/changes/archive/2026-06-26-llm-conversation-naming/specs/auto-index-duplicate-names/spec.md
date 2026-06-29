## ADDED Requirements

### Requirement: New conversations receive a message-derived display name without numeric deduplication

When `POST /api/v1/conversations` is called, the backend SHALL set `conversation.name` to the **base name** derived from `firstMessage` with **no numeric deduplication suffix**, even when another conversation in the user's bucket already has the same display title.

**Base name derivation** (unchanged): the first non-empty line of `firstMessage`, stripped of disallowed characters via `prepareEntityName`, truncated to 255 UTF-8 bytes; falls back to `"New chat"` when the message is empty or yields no printable characters.

`resolveUniqueConversationName` and `fetchAllUserTitles` SHALL NOT be called from `createConversation`.

**Examples:**

| Existing titles in bucket | `firstMessage` | Resulting `conversation.name` |
|---|---|---|
| (none) | `"Hello"` | `"Hello"` |
| `"Hello"` | `"Hello"` | `"Hello"` |
| `"Hello"`, `"Hello 1"` | `"Hello"` | `"Hello"` |
| `"New chat"` | `""` | `"New chat"` |

#### Scenario: Base name is not taken

- **GIVEN** no conversation exists at path `gpt-4o__My query`
- **WHEN** `POST /api/v1/conversations` is called with `firstMessage: "My query"`
- **THEN** the created conversation has `name: "My query"` and is stored at path `gpt-4o__My query`

#### Scenario: Duplicate display title does not add numeric suffix

- **GIVEN** a conversation titled `"My query"` already exists
- **WHEN** `POST /api/v1/conversations` is called with `firstMessage: "My query"`
- **THEN** the created conversation has `name: "My query"` (no ` 1` suffix)

#### Scenario: Create does not fetch all user titles

- **WHEN** `createConversation` is called
- **THEN** `fetchAllUserTitles` is NOT invoked

---

## MODIFIED Requirements

### Requirement: Conversation path uses `{deploymentId}__{name}` format without a UUID suffix

The DIAL Core storage path for a newly created conversation SHALL be:

```
{deploymentId}__{baseName}
```

when no resource already exists at that path in the user's bucket, where `{baseName}` is the sanitised name derived from `firstMessage`. No UUID segment is appended in this case.

When a resource **already exists** at `{deploymentId}__{baseName}`, the backend SHALL instead persist at:

```
{deploymentId}__{baseName}__{uuid}
```

where `{uuid}` is `crypto.randomUUID()` generated at create time. In both cases `conversation.name` SHALL remain the unsuffixed `{baseName}`.

Collision detection SHALL use a targeted existence check for `{deploymentId}__{baseName}` — not a full-bucket title scan.

#### Scenario: Conversation path is two segments when path is free

- **WHEN** a conversation is created with `deploymentId: "gpt-4o"` and base name `"Hello"` and no collision
- **THEN** the DIAL Core path is `gpt-4o__Hello`
- **AND** `conversation.id` is `{bucket}/gpt-4o__Hello`

#### Scenario: Conversation path gains UUID segment on collision

- **GIVEN** a conversation already exists at `gpt-4o__Hello`
- **WHEN** another conversation is created with the same base name `"Hello"`
- **THEN** the new DIAL Core path is `gpt-4o__Hello__<uuid>`
- **AND** `conversation.name` is `"Hello"` (unsuffixed)

#### Scenario: getConversationTitleFromName extracts unsuffixed title from 3-part path

- **WHEN** the filename is `gpt-4o__Hello__<uuid>`
- **THEN** `getConversationTitleFromName` returns `"Hello"`

---

### Requirement: `resolveUniqueConversationName` is a pure deterministic utility

`resolveUniqueConversationName(base, existingTitles)` in `apps/chat-api/src/conversations/utils/resolve-unique-conversation-name.ts` SHALL:

- Return `base` unchanged when `base` is not in `existingTitles`.
- Return `` `${base} ${n}` `` where `n` is the smallest positive integer whose string is not in `existingTitles`.
- Use a single space as the separator (not underscore, dash, or any other character).
- Be stateless and free of side-effects.

The utility SHALL be used by `duplicateConversation` only. It SHALL NOT be used by `createConversation`.

```typescript
resolveUniqueConversationName('New chat', new Set())         // → 'New chat'
resolveUniqueConversationName('New chat', new Set(['New chat']))  // → 'New chat 1'
resolveUniqueConversationName('New chat', new Set(['New chat', 'New chat 1'])) // → 'New chat 2'
```

#### Scenario: Duplicate conversation still uses numeric suffix

- **GIVEN** a conversation titled `"My query"` exists in the bucket
- **WHEN** `duplicateConversation` is called for a source titled `"My query"`
- **THEN** the duplicate receives a name with a numeric suffix (e.g. `"My query 1"`)

---

### Requirement: All existing titles are fetched with pagination before name resolution

`ConversationService.fetchAllUserTitles(token, bucket)` SHALL:

- Call `getConversationMetadata` with `recursive: true` and `limit: 1000`.
- Follow `nextToken` / `data.nextToken` pagination until the token is absent or empty.
- Collect the human-readable title of every non-folder item via `getConversationTitleFromName(filename)`.
- Return a `Set<string>` of all collected titles.
- Catch any thrown exception and return the partial (possibly empty) set — the method is resilient and never propagates errors.

The method SHALL be called from `duplicateConversation` only. It SHALL NOT be called from `createConversation`.

#### Scenario: Duplicate fetches titles before suffix resolution

- **WHEN** `duplicateConversation` is called
- **THEN** `fetchAllUserTitles` is invoked to build the reserved title set

## REMOVED Requirements

### Requirement: New conversations receive a unique name within the user's bucket

**Reason**: Display names on create are no longer deduplicated with numeric suffixes; path uniqueness uses an optional UUID segment instead.

**Migration**: Existing conversations are unchanged. New creates may share display titles in the sidebar; enable LLM naming or manual rename to differentiate.

## ADDED Requirements

### Requirement: New conversations receive a unique name within the user's bucket

When `POST /api/v1/conversations` is called and the derived base name already exists as a conversation in the user's DIAL Core bucket, the backend SHALL append a space-separated index (` 1`, ` 2`, …) to produce a unique name before persisting. The first free index starting from 1 is used.

**Base name derivation** (unchanged): the first non-empty line of `firstMessage`, stripped of disallowed characters, truncated to 255 UTF-8 bytes; falls back to `"New chat"` when the message is empty or yields no printable characters.

**Examples:**

| Existing titles in bucket | `firstMessage` | Resulting `conversation.name` |
|---|---|---|
| (none) | `"Hello"` | `"Hello"` |
| `"Hello"` | `"Hello"` | `"Hello 1"` |
| `"Hello"`, `"Hello 1"` | `"Hello"` | `"Hello 2"` |
| `"New chat"`, `"New chat 1"`, `"New chat 3"` | `""` | `"New chat 2"` |

#### Scenario: Base name is not taken

- **GIVEN** no conversation titled `"My query"` exists in the bucket
- **WHEN** `POST /api/v1/conversations` is called with `firstMessage: "My query"`
- **THEN** the created conversation has `name: "My query"` and is stored at path `{deploymentId}__My query`

#### Scenario: Base name is already taken

- **GIVEN** a conversation titled `"My query"` already exists
- **WHEN** `POST /api/v1/conversations` is called with `firstMessage: "My query"`
- **THEN** the created conversation has `name: "My query 1"` and is stored at path `{deploymentId}__My query 1`

#### Scenario: Base name and first index are both taken

- **GIVEN** conversations `"My query"` and `"My query 1"` both exist
- **WHEN** `POST /api/v1/conversations` is called with `firstMessage: "My query"`
- **THEN** the created conversation has `name: "My query 2"`

#### Scenario: Fetch fails — fallback to base name

- **WHEN** the call to `getConversationMetadata` throws or returns an error
- **THEN** `createConversation` proceeds with the base name as if no duplicates exist (no error is surfaced to the caller)

---

### Requirement: `resolveUniqueConversationName` is a pure deterministic utility

`resolveUniqueConversationName(base, existingTitles)` in `apps/chat-api/src/conversations/utils/resolve-unique-conversation-name.ts` SHALL:

- Return `base` unchanged when `base` is not in `existingTitles`.
- Return `` `${base} ${n}` `` where `n` is the smallest positive integer whose string is not in `existingTitles`.
- Use a single space as the separator (not underscore, dash, or any other character).
- Be stateless and free of side-effects.

```typescript
resolveUniqueConversationName('New chat', new Set())         // → 'New chat'
resolveUniqueConversationName('New chat', new Set(['New chat']))  // → 'New chat 1'
resolveUniqueConversationName('New chat', new Set(['New chat', 'New chat 1'])) // → 'New chat 2'
```

---

### Requirement: All existing titles are fetched with pagination before name resolution

`ConversationService.fetchAllUserTitles(token, bucket)` SHALL:

- Call `getConversationMetadata` with `recursive: true` and `limit: 1000`.
- Follow `nextToken` / `data.nextToken` pagination until the token is absent or empty.
- Collect the human-readable title of every non-folder item via `getConversationTitleFromName(filename)`.
- Return a `Set<string>` of all collected titles.
- Catch any thrown exception and return the partial (possibly empty) set — the method is resilient and never propagates errors.

---

### Requirement: Conversation path uses `{deploymentId}__{name}` format without a UUID suffix

The DIAL Core storage path for a newly created conversation SHALL be:

```
{deploymentId}__{name}
```

where `{name}` is the unique title resolved by `resolveUniqueConversationName`. No UUID segment is appended.

#### Scenario: Conversation path contains exactly two `__`-delimited segments

- **WHEN** a conversation is created with `deploymentId: "gpt-4o"` and resolved name `"Hello"`
- **THEN** the DIAL Core path is `gpt-4o__Hello` (no UUID suffix)
- **AND** `conversation.id` is `{bucket}/gpt-4o__Hello`

---

### Requirement: `getConversationTitleFromName` supports both 2-part and 3-part filenames

`getConversationTitleFromName(name)` in `apps/chat-api/src/conversations/utils/conversation.utils.ts` SHALL extract the human-readable title from a DIAL Core filename under both storage formats:

| Format | Example filename | Returned title |
|---|---|---|
| 2-part (new) | `gpt-4o__Hello` | `"Hello"` |
| 3-part legacy | `gpt-4o__Hello__<uuid>` | `"Hello"` |
| 1-part fallback | `orphan` | `"orphan"` |

Titles that themselves contain `__` are preserved correctly in both formats (middle segments are joined with `__`).

---

### Requirement: `buildRenamedConversationPath` supports both 2-part and 3-part filenames

`buildRenamedConversationPath(conversationPath, sanitisedTitle)` SHALL replace only the title segment of the filename while preserving the `deploymentId` prefix and — for legacy 3-part filenames — the UUID suffix.

| Input path | New title | Output path |
|---|---|---|
| `gpt-4o__Old title` | `New title` | `gpt-4o__New title` |
| `gpt-4o__Old title__<uuid>` | `New title` | `gpt-4o__New title__<uuid>` |
| `folder/gpt-4o__Old title` | `New title` | `folder/gpt-4o__New title` |

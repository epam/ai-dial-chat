# Spec: auto-index-duplicate-names

## Purpose

Define how conversations derive display names and storage paths in DIAL Core. Both create and duplicate use unsuffixed titles instead of numeric title deduplication, and every newly materialized conversation receives a fresh trailing UUID segment. Existing paths without a UUID remain readable for backward compatibility.

## Requirements

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

#### Scenario: Base name is used regardless of path collision

- **WHEN** `POST /api/v1/conversations` is called with `firstMessage: "My query"`
- **THEN** the created conversation has `name: "My query"` and is stored at path `gpt-4o__My query__<uuid>`

#### Scenario: Duplicate display title does not add numeric suffix

- **GIVEN** a conversation titled `"My query"` already exists
- **WHEN** `POST /api/v1/conversations` is called with `firstMessage: "My query"`
- **THEN** the created conversation has `name: "My query"` (no ` 1` suffix)

#### Scenario: Create does not fetch all user titles

- **WHEN** `createConversation` is called
- **THEN** `fetchAllUserTitles` is NOT invoked

---

### Requirement: `duplicateConversation` preserves the source display name without numeric suffix

When `duplicateConversation` creates a copy, the new conversation's `name` SHALL equal the source display name — read from the source conversation's JSON `name` field (which may have been updated by LLM naming), sanitised via `prepareEntityName` — with **no numeric suffix appended**.

Path uniqueness SHALL be handled by the same unconditional UUID-segment mechanism as `createConversation`: every copy is stored at `{deploymentId}__{name}__{uuid}`, where `{uuid}` is freshly generated for the duplicate. `conversation.name` remains the unsuffixed base name. A trailing UUID from the source path is never carried over.

`duplicateConversation` SHALL NOT call `fetchAllUserTitles`.
`duplicateConversation` SHALL NOT call `resolveUniqueConversationName`.
`duplicateConversation` SHALL NOT perform a destination path-existence check.
`duplicateConversation` SHALL NOT invoke `ConversationNamingService`, SHALL NOT call the utility model, and SHALL NOT read or write `llmNamingDone`.

#### Scenario: Duplicate preserves source name as-is

- **GIVEN** a source conversation titled `"hello"`
- **WHEN** `duplicateConversation` is called
- **THEN** the duplicate display name is `"hello"`

#### Scenario: Duplicate of suffixed title preserves the full title

- **GIVEN** a source conversation titled `"hello 1"`
- **WHEN** `duplicateConversation` is called
- **THEN** the duplicate display name is `"hello 1"` (not `"hello 1 1"`, not `"hello 2"`)

#### Scenario: Duplicate of LLM-renamed conversation uses the LLM-assigned name

- **GIVEN** a source conversation whose storage path encodes the original first-message name but whose JSON `name` field was updated by LLM naming to `"AI Discussion"`
- **WHEN** `duplicateConversation` is called
- **THEN** the duplicate display name is `"AI Discussion"` and the destination path is `gpt-4o__AI Discussion__<fresh-uuid>`

#### Scenario: No bucket scan during duplicate

- **WHEN** `duplicateConversation` is called
- **THEN** `fetchAllUserTitles` is NOT invoked

#### Scenario: LLM naming is not invoked during duplicate

- **WHEN** `duplicateConversation` is called
- **THEN** `ConversationNamingService` is NOT invoked and `llmNamingDone` is NOT read or written

---

### Requirement: `createConversation` path always ends with a UUID segment

The DIAL Core storage path for a newly **created** conversation SHALL always be:

```
{deploymentId}__{baseName}__{uuid}
```

where `{baseName}` is the sanitised display name and `{uuid}` is `crypto.randomUUID()` generated at create time. The UUID segment is unconditional — `createConversation` SHALL NOT perform a path-existence check before building the path. `conversation.name` SHALL remain the unsuffixed `{baseName}`.

For versioned or multi-segment deployment IDs, the invariant is the fresh trailing UUID rather than a fixed total number of `__`-separated segments.

#### Scenario: Conversation path always ends with a UUID

- **WHEN** a conversation is created with `deploymentId: "gpt-4o"` and base name `"Hello"`
- **THEN** the DIAL Core path is `gpt-4o__Hello__<uuid>`
- **AND** `conversation.id` is `{bucket}/gpt-4o__Hello__<uuid>`
- **AND** `conversation.name` is `"Hello"` (unsuffixed)

#### Scenario: No collision check on create

- **WHEN** `createConversation` is called
- **THEN** `getConversationMetadata` is NOT called to check for an existing path

#### Scenario: getConversationTitleFromName extracts unsuffixed title from 3-part path

- **WHEN** the filename is `gpt-4o__Hello__<uuid>`
- **THEN** `getConversationTitleFromName` returns `"Hello"`

---

### Requirement: `duplicateConversation` path always ends with a fresh UUID segment

The DIAL Core storage path for every **duplicated** conversation SHALL be:

```
{deploymentId}__{baseName}__{uuid}
```

where `{baseName}` is the sanitised display name and `{uuid}` is `crypto.randomUUID()` generated at duplicate time. The UUID segment is unconditional, including when no resource exists at the corresponding unsuffixed path. `conversation.name` SHALL remain the unsuffixed `{baseName}`.

`duplicateConversation` SHALL NOT call `getConversationMetadata` to check whether `{deploymentId}__{baseName}` exists. The destination path SHALL use a fresh UUID rather than reusing a trailing UUID from the source path.

#### Scenario: Duplicate path has a UUID when the unsuffixed path is free

- **WHEN** a conversation is duplicated with `deploymentId: "gpt-4o"` and base name `"Hello"` and no resource exists at `gpt-4o__Hello`
- **THEN** the DIAL Core path is `gpt-4o__Hello__<fresh-uuid>`
- **AND** `conversation.id` is `{bucket}/gpt-4o__Hello__<fresh-uuid>`
- **AND** `getConversationMetadata` is NOT called to check the unsuffixed path

#### Scenario: Repeated duplicates receive different paths

- **WHEN** the same conversation is duplicated twice with base name `"Hello"`
- **THEN** both copies have `conversation.name: "Hello"`
- **AND** their paths end with different freshly generated UUIDs

---

### Requirement: `getConversationTitleFromName` supports legacy unsuffixed and current UUID-suffixed filenames

`getConversationTitleFromName(name)` in `apps/chat-api/src/conversations/utils/conversation.utils.ts` SHALL extract the human-readable title from a DIAL Core filename under both storage formats:

| Format | Example filename | Returned title |
|---|---|---|
| Legacy unsuffixed | `gpt-4o__Hello` | `"Hello"` |
| Current UUID-suffixed | `gpt-4o__Hello__<uuid>` | `"Hello"` |
| 1-part fallback | `orphan` | `"orphan"` |

Titles that themselves contain `__` are preserved correctly in the current UUID-suffixed format by joining the title segments before the trailing UUID. Legacy unsuffixed paths remain supported where their title boundary is unambiguous.

#### Scenario: Legacy unsuffixed filename returns its title

- **WHEN** `getConversationTitleFromName("gpt-4o__Hello")` is called
- **THEN** the result is `"Hello"`

#### Scenario: UUID-suffixed filename returns its unsuffixed title

- **WHEN** `getConversationTitleFromName("gpt-4o__Hello__<uuid>")` is called
- **THEN** the result is `"Hello"`

---

### Requirement: `buildRenamedConversationPath` supports legacy unsuffixed and current UUID-suffixed filenames

`buildRenamedConversationPath(conversationPath, sanitisedTitle)` SHALL replace only the title segment of the filename while preserving the `deploymentId` prefix and — for current UUID-suffixed filenames — the UUID suffix.

| Input path | New title | Output path |
|---|---|---|
| `gpt-4o__Old title` | `New title` | `gpt-4o__New title` |
| `gpt-4o__Old title__<uuid>` | `New title` | `gpt-4o__New title__<uuid>` |
| `folder/gpt-4o__Old title` | `New title` | `folder/gpt-4o__New title` |

#### Scenario: Legacy unsuffixed path replaces its title segment

- **WHEN** `buildRenamedConversationPath("gpt-4o__Old title", "New title")` is called
- **THEN** the result is `gpt-4o__New title`

#### Scenario: UUID-suffixed path preserves its UUID

- **WHEN** `buildRenamedConversationPath("gpt-4o__Old title__<uuid>", "New title")` is called
- **THEN** the result is `gpt-4o__New title__<uuid>`

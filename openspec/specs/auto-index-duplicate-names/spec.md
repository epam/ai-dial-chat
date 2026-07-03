# Spec: auto-index-duplicate-names

## Purpose

Define how conversations derive display names and storage paths in DIAL Core. Both create and duplicate use unsuffixed titles; path uniqueness uses an optional UUID segment on collision instead of numeric title deduplication.

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

### Requirement: `duplicateConversation` preserves the source display name without numeric suffix

When `duplicateConversation` creates a copy, the new conversation's `name` SHALL equal the source display name — read from the source conversation's JSON `name` field (which may have been updated by LLM naming), sanitised via `prepareEntityName` — with **no numeric suffix appended**.

Path uniqueness SHALL be handled by the same UUID-segment mechanism as `createConversation`: if `{deploymentId}__{name}` is already taken, the copy is stored at `{deploymentId}__{name}__{uuid}`; `conversation.name` remains the unsuffixed base name in both cases. The destination path is always built as a clean two-part (or three-part for versioned deployments) filename; the legacy UUID from the source path is never carried over.

`duplicateConversation` SHALL NOT call `fetchAllUserTitles`.
`duplicateConversation` SHALL NOT call `resolveUniqueConversationName`.
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

- **GIVEN** a source conversation whose storage path encodes the original first-message name (e.g. `gpt-4o__Hello there`) but whose JSON `name` field was updated by LLM naming to `"AI Discussion"`
- **WHEN** `duplicateConversation` is called
- **THEN** the duplicate display name is `"AI Discussion"` and the destination path starts with `gpt-4o__AI Discussion`

#### Scenario: No bucket scan during duplicate

- **WHEN** `duplicateConversation` is called
- **THEN** `fetchAllUserTitles` is NOT invoked

#### Scenario: LLM naming is not invoked during duplicate

- **WHEN** `duplicateConversation` is called
- **THEN** `ConversationNamingService` is NOT invoked and `llmNamingDone` is NOT read or written

---

### Requirement: Conversation path uses `{deploymentId}__{name}` format without a UUID suffix

The DIAL Core storage path for a newly created or duplicated conversation SHALL be:

```
{deploymentId}__{baseName}
```

when no resource already exists at that path in the user's bucket, where `{baseName}` is the sanitised display name. No UUID segment is appended in this case.

When a resource **already exists** at `{deploymentId}__{baseName}`, the backend SHALL instead persist at:

```
{deploymentId}__{baseName}__{uuid}
```

where `{uuid}` is `crypto.randomUUID()` generated at create/duplicate time. In both cases `conversation.name` SHALL remain the unsuffixed `{baseName}`.

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

### Requirement: `getConversationTitleFromName` supports both 2-part and 3-part filenames

`getConversationTitleFromName(name)` in `apps/chat-api/src/conversations/utils/conversation.utils.ts` SHALL extract the human-readable title from a DIAL Core filename under both storage formats:

| Format | Example filename | Returned title |
|---|---|---|
| 2-part (new) | `gpt-4o__Hello` | `"Hello"` |
| 3-part legacy | `gpt-4o__Hello__<uuid>` | `"Hello"` |
| 1-part fallback | `orphan` | `"orphan"` |

Titles that themselves contain `__` are preserved correctly in both formats (middle segments are joined with `__`).

#### Scenario: Two-part filename returns middle segment as title

- **WHEN** `getConversationTitleFromName("gpt-4o__Hello")` is called
- **THEN** the result is `"Hello"`

#### Scenario: Three-part filename returns unsuffixed title

- **WHEN** `getConversationTitleFromName("gpt-4o__Hello__<uuid>")` is called
- **THEN** the result is `"Hello"`

---

### Requirement: `buildRenamedConversationPath` supports both 2-part and 3-part filenames

`buildRenamedConversationPath(conversationPath, sanitisedTitle)` SHALL replace only the title segment of the filename while preserving the `deploymentId` prefix and — for legacy 3-part filenames — the UUID suffix.

| Input path | New title | Output path |
|---|---|---|
| `gpt-4o__Old title` | `New title` | `gpt-4o__New title` |
| `gpt-4o__Old title__<uuid>` | `New title` | `gpt-4o__New title__<uuid>` |
| `folder/gpt-4o__Old title` | `New title` | `folder/gpt-4o__New title` |

#### Scenario: Two-part path replaces title segment only

- **WHEN** `buildRenamedConversationPath("gpt-4o__Old title", "New title")` is called
- **THEN** the result is `gpt-4o__New title`

#### Scenario: Three-part path preserves UUID suffix

- **WHEN** `buildRenamedConversationPath("gpt-4o__Old title__<uuid>", "New title")` is called
- **THEN** the result is `gpt-4o__New title__<uuid>`

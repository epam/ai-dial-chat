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

Path uniqueness SHALL be handled by a single targeted collision check rather than by a bucket scan: the duplicate is written to `{deploymentId}__{name}`, and only when a resource already exists at that path is a freshly generated `__{uuid}` appended. `conversation.name` remains the unsuffixed base name either way, and a trailing UUID from the source path is never carried over.

The duplicate SHALL stay in the source conversation's folder — the source path's folder segments are preserved and only the filename is rebuilt.

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

- **GIVEN** a source conversation whose storage path encodes the original first-message name but whose JSON `name` field was updated by LLM naming to `"AI Discussion"`
- **WHEN** `duplicateConversation` is called
- **THEN** the duplicate display name is `"AI Discussion"` and the destination filename is built from `gpt-4o__AI Discussion`, gaining a `__<fresh-uuid>` suffix only if that path is already taken

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

where `{baseName}` is the sanitised display name and `{uuid}` is `generateUUID()` generated at create time. The UUID segment is unconditional — `createConversation` SHALL NOT perform a path-existence check before building the path. `conversation.name` SHALL remain the unsuffixed `{baseName}`.

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

The DIAL Core storage filename for a **duplicated** conversation SHALL be `{deploymentKey}__{baseName}`, or `{deploymentKey}__{baseName}__{uuid}` when a resource already exists at the former. `{deploymentKey}` is the deployment segment recovered from the source filename (which may itself be multi-part for a versioned application deployment), `{baseName}` is the sanitised display name, and `{uuid}` is `generateUUID()` generated at duplicate time. `conversation.name` SHALL remain the unsuffixed `{baseName}` in both cases.

The existence check SHALL be a single lookup of that one candidate path — never a listing of the user's conversations. A trailing UUID from the source path SHALL NOT be reused.

This differs deliberately from `createConversation`, which always appends a UUID: a create happens on every new chat and cannot afford a round trip, while a duplicate is a rare, explicit action where keeping the clean path when it is free is worth one lookup.

#### Scenario: Duplicate keeps the clean path when it is free

- **WHEN** a conversation is duplicated with base name `"Hello"` and no resource exists at `gpt-4o__Hello`
- **THEN** the DIAL Core filename is `gpt-4o__Hello`, with no UUID segment

#### Scenario: Duplicate gains a UUID when the clean path is taken

- **WHEN** the same conversation is duplicated again and `gpt-4o__Hello` already exists
- **THEN** the DIAL Core filename is `gpt-4o__Hello__<fresh-uuid>`
- **AND** `conversation.name` is still `"Hello"`

#### Scenario: Duplicate stays in the source folder

- **WHEN** the source conversation lives at `folder/sub/gpt-4o__Hello`
- **THEN** the duplicate is written under `folder/sub/` as well

---

### Requirement: `getConversationTitleFromName` supports legacy unsuffixed and current UUID-suffixed filenames

`getConversationTitleFromName(name, isApplicationDeployment)` in `apps/chat-api/src/conversations/utils/conversation.utils.ts` SHALL extract the human-readable title from a DIAL Core filename under both storage formats. The second argument is required and supplied by the caller, because a versioned application deployment id is itself `__`-separated and the filename alone cannot say where the deployment segment ends:

| Format | Example filename | Returned title |
|---|---|---|
| Legacy unsuffixed | `gpt-4o__Hello` | `"Hello"` |
| Current UUID-suffixed | `gpt-4o__Hello__<uuid>` | `"Hello"` |
| 1-part fallback | `orphan` | `"orphan"` |

Suffix detection depends on the deployment shape. For a versioned application deployment the last segment counts as a suffix only when it actually parses as a UUID; for a plain deployment id any filename with three or more segments is treated as having a trailing suffix.

Titles that themselves contain `__` are therefore preserved in the UUID-suffixed format — the segments between the deployment id and the trailing UUID are rejoined — but a legacy **unsuffixed** filename whose title contains `__` is ambiguous, and its last segment is read as a suffix rather than as part of the title.

#### Scenario: Legacy unsuffixed filename returns its title

- **WHEN** `getConversationTitleFromName("gpt-4o__Hello", false)` is called
- **THEN** the result is `"Hello"`

#### Scenario: UUID-suffixed filename returns its unsuffixed title

- **WHEN** `getConversationTitleFromName("gpt-4o__Hello__<uuid>", false)` is called
- **THEN** the result is `"Hello"`

#### Scenario: A versioned application deployment keeps a non-UUID last segment in the title

- **WHEN** the filename ends in a segment that is not a UUID and `isApplicationDeployment` is `true`
- **THEN** that segment is treated as part of the title, not as a suffix

---

### Requirement: `buildRenamedConversationPath` supports legacy unsuffixed and current UUID-suffixed filenames

`buildRenamedConversationPath(conversationPath, sanitisedTitle)` SHALL replace only the title segment of the filename while preserving the folder segments, the `deploymentId` prefix, and — for current UUID-suffixed filenames — the UUID suffix. It operates on a full path and derives `isApplicationDeployment` itself from the folder segments.

The filename-level helper it delegates to, `buildRenamedFilename(filename, sanitisedTitle, isApplicationDeployment)`, takes that flag explicitly and SHALL only be given a bare filename — it is safe to use on a decoded filename whose deployment name contains a literal slash, which the path-level helper is not.

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

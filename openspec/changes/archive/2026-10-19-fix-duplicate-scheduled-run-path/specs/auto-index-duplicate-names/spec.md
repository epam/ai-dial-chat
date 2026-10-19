# Spec Delta

## MODIFIED Requirements

### Requirement: `duplicateConversation` preserves the source display name without numeric suffix

When `duplicateConversation` creates a copy, the new conversation's `name` SHALL equal the source display name — read from the source conversation's JSON `name` field (which may have been updated by LLM naming), sanitised via `prepareEntityName` — with **no numeric suffix appended**.

Path uniqueness SHALL be handled by a single targeted collision check rather than by a bucket scan: the duplicate is written to `{deploymentId}__{name}`, and only when a resource already exists at that path is a freshly generated `__{uuid}` appended. `conversation.name` remains the unsuffixed base name either way, and a trailing UUID from the source path is never carried over.

The duplicate SHALL stay in the source conversation's folder — the source path's folder segments are preserved and only the filename is rebuilt — with one exception: the reserved scheduler prefix (a leading `.scheduler` segment and the schedule id segment that follows it) is not preserved, so a copy of a scheduled-task run is an ordinary conversation. The `duplicate-conversation` capability defines that exception.

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

#### Scenario: Duplicate of a scheduled-task run drops the reserved scheduler prefix

- **WHEN** the source conversation lives at `.scheduler/sched_abc/gpt-4o__Morning briefing__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5`
- **THEN** the duplicate is written at the root of the caller's bucket as `gpt-4o__Morning briefing`, not under `.scheduler/`

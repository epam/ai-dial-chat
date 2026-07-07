## MODIFIED Requirements

### Requirement: `duplicateConversation` preserves the source display name without numeric suffix

When `duplicateConversation` creates a copy, the new conversation's `name` SHALL equal the sanitised source display name (`prepareEntityName(sourceTitle)`) with **no numeric suffix appended**.

Path uniqueness SHALL be handled by the UUID-segment mechanism (same as `createConversation`): if `{deploymentId}__{name}` is already taken, the copy is stored at `{deploymentId}__{name}__{uuid}`; `conversation.name` remains the unsuffixed base name in both cases.

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

#### Scenario: No bucket scan during duplicate

- **WHEN** `duplicateConversation` is called
- **THEN** `fetchAllUserTitles` is NOT invoked

#### Scenario: LLM naming is not invoked during duplicate

- **WHEN** `duplicateConversation` is called
- **THEN** `ConversationNamingService` is NOT invoked and `llmNamingDone` is NOT read or written

---

## REMOVED Requirements

### Requirement: `resolveUniqueConversationName` is a pure deterministic utility

**Reason**: No longer used — `duplicateConversation` now keeps the source display name as-is instead of computing a suffixed unique title.

**Migration**: Remove `resolveUniqueConversationName` and its test file if no other caller exists after this change.

### Requirement: All existing titles are fetched with pagination before name resolution

**Reason**: `fetchAllUserTitles` is no longer called from any flow. Display-title uniqueness is not enforced; path uniqueness is handled by the UUID-segment mechanism.

**Migration**: Remove `fetchAllUserTitles` from `ConversationService` if no other caller exists after this change.

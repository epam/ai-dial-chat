## ADDED Requirements

### Requirement: Manual rename marks the conversation as finally named

A manual conversation rename (via `PATCH /api/v1/conversations`) SHALL set `llmNamingDone: true` on the stored conversation body. Once set, the automatic LLM naming pass SHALL treat the conversation as already named: `maybeRenameAfterFirstReply` MUST skip it (as it already does for any conversation with `llmNamingDone === true`), so a pending or future automatic naming pass never overwrites a user-chosen title.

This makes the manual title win the race with the asynchronous naming pass, and combines with the existing `preserveLlmDisplayName` guard so that later client `saveConversation` calls carrying a stale message-derived `name` do not clobber the manual title.

#### Scenario: Manual rename suppresses a pending automatic naming pass

- **GIVEN** `features.llmConversationNaming` is enabled and a conversation has `llmNamingDone` unset
- **WHEN** the user manually renames it to `"Budget planning"` (which sets `llmNamingDone: true`)
- **AND** the asynchronous naming pass subsequently runs for that conversation
- **THEN** the naming pass skips it and the stored `name` remains `"Budget planning"`

#### Scenario: Later stale client save does not overwrite the manual title

- **GIVEN** a conversation stored with `name: "Budget planning"` and `llmNamingDone: true` after a manual rename
- **WHEN** `saveConversation` is later called with a stale `name` and `llmNamingDone` unset
- **THEN** the persisted body keeps `name: "Budget planning"` and `llmNamingDone: true`

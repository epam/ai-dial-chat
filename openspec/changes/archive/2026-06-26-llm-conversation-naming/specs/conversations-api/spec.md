## ADDED Requirements

### Requirement: POST /api/v1/conversations sets unsuffixed message-derived name

On `POST /api/v1/conversations`, `ConversationService.createConversation` SHALL set `conversation.name` to the base name from `getConversationName('New chat', firstMessage)` without calling `resolveUniqueConversationName`.

When the 2-part storage path `{deploymentId}__{baseName}` collides with an existing resource, the service SHALL persist at `{deploymentId}__{baseName}__{uuid}` while keeping `conversation.name` as the unsuffixed base name. See the [auto-index-duplicate-names spec](../../auto-index-duplicate-names/spec.md).

`llmNamingDone` SHALL NOT be set on create (field absent or false).

#### Scenario: Create returns unsuffixed name when duplicate title exists

- **GIVEN** a conversation with `name: "Hello"` already exists in the user's bucket
- **WHEN** `POST /api/v1/conversations` is called with `firstMessage: "Hello"`
- **THEN** the response body has `name: "Hello"` (not `"Hello 1"`)

#### Scenario: Create does not invoke LLM naming

- **GIVEN** `features.llmConversationNaming` is enabled
- **WHEN** `POST /api/v1/conversations` succeeds
- **THEN** no utility-model chat completion is requested during create

---

### Requirement: saveConversation may trigger backend-only LLM rename after first reply

`ConversationService.saveConversation` SHALL, after a successful DIAL Core persist, optionally invoke LLM conversation naming as defined in the [llm-conversation-naming spec](../llm-conversation-naming/spec.md).

The rename is fire-and-forget: the `saveConversation` response MUST return immediately with the conversation as saved, without waiting for the LLM or rename to complete.

No new HTTP endpoint is added for LLM naming.

#### Scenario: saveConversation response is not delayed by LLM

- **GIVEN** `features.llmConversationNaming` is enabled
- **WHEN** `saveConversation` persists the first assistant reply
- **THEN** the HTTP response is sent before the utility-model call completes

#### Scenario: Client discovers renamed title on subsequent fetch

- **GIVEN** LLM naming succeeds asynchronously after the first save
- **WHEN** the client later calls `GET /api/v1/conversations` or `GET /api/v1/conversations/:id`
- **THEN** the response reflects the updated `name` and `llmNamingDone: true`

---

### Requirement: saveConversation preserves LLM display name from stale client saves

Before persisting, `ConversationService.saveConversation` SHALL call `preserveLlmDisplayName`: when the stored conversation already has `llmNamingDone: true` and a non-empty `name`, the save body MUST keep that server `name` and `llmNamingDone: true` even if the client sent a stale message-derived title.

#### Scenario: Stale client save does not overwrite LLM title

- **GIVEN** DIAL Core stores `name: "Docker networking basics"` and `llmNamingDone: true`
- **WHEN** `saveConversation` is called with `name: "How do I..."` and `llmNamingDone` unset
- **THEN** the persisted body keeps `name: "Docker networking basics"` and `llmNamingDone: true`

---

### Requirement: Conversation list uses stored display name for writable items

`ConversationService.listConversations` SHALL enrich writable user-owned list items with `conversation.name` from `getConversation` when available, so list `title` reflects the stored display name (including LLM-renamed titles), not only the filename-derived title.

#### Scenario: List title reflects LLM-renamed display name

- **GIVEN** a conversation is stored at `gpt-4o__Hello__<uuid>` with `name: "Docker networking basics"`
- **WHEN** `GET /api/v1/conversations` is called
- **THEN** the matching list item `title` is `"Docker networking basics"`

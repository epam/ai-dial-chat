## MODIFIED Requirements

### Requirement: PUT /api/v1/conversations saves client bodies without overwriting a pending background answer

`PUT /api/v1/conversations` (`saveConversation` handler) SHALL call `ConversationService.saveClientConversation`, bound to `ConversationStreamingService.saveClientConversation`.

That method MUST apply the client body through `BackgroundGenerationService.saveClientConversation`. It applies the body to the latest stored version through `updateConversationUnlessPending` with `If-Match`:

- it keeps the stored LLM display name (`withStoredLlmDisplayName`);
- it merges client messages with the stored marked message — a pending background message or a live `foregroundGeneration` marker (`mergeClientMessages`);
- it neutralizes every other marker in the body.

**Fallbacks and failures.**

- A conversation that does not exist yet (the read resolves `null`) is saved through `ConversationPersistenceService.saveConversation`, with every marker in the client messages neutralized.
- A read that fails SHALL make the save fail with `503 Service Unavailable` instead of falling back to an unconditional save.
- The save also fails with `503` when conflicts persist on a version that holds a marked message, or when a marked version was read without an `ETag`.

This applies to top-level and project conversations alike; the project save route reaches the same method.

#### Scenario: Client save keeps a stored background message

- **GIVEN** the stored conversation holds a pending background message written after the client loaded it
- **WHEN** the client sends `PUT /api/v1/conversations?path=...` with its older body
- **THEN** the body is saved with `If-Match` and the stored background message is kept

#### Scenario: Client save keeps another participant's running exchange

- **GIVEN** the stored conversation holds an exchange whose answer carries a live `foregroundGeneration` marker, written after the client loaded it
- **WHEN** the client sends its older body
- **THEN** the body is saved with `If-Match` and the stored exchange, with its marker, is kept

#### Scenario: Client save cannot be applied safely

- **GIVEN** the conversation keeps changing while it holds a marked message
- **WHEN** the client sends `PUT /api/v1/conversations?path=...`
- **THEN** the response status is 503

#### Scenario: The stored version cannot be read

- **WHEN** the client saves an existing conversation and reading its stored version fails with a storage error
- **THEN** the response status is 503 and no write is made

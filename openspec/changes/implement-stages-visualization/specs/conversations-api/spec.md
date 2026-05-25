## MODIFIED Requirements

### Requirement: Shared Conversation and Message types live in libs/chat-shared

The `Conversation` and `Message` interfaces SHALL be declared in `libs/chat-shared/src/models/chat.ts` and re-exported from `libs/chat-shared/src/index.ts`. Both `apps/chat` (via `@epam/ai-dial-chat-shared`) and `apps/chat-api` (same import) MUST import these types from the shared lib. No duplicate type definitions are permitted in app-level files.

`Message` shape (updated to include optional `stages`):

```ts
interface Message {
  id: string;       // UUID
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO-8601
  stages?: Stage[];  // optional — present only on assistant messages that received stage data
}
```

`Conversation` shape (unchanged):

```ts
interface Conversation {
  id: string;
  messages: Message[];
  createdAt: string; // ISO-8601
}
```

Existing `Message` values that omit `stages` SHALL remain valid. The field is optional and no migration is required.

#### Scenario: Shared types are importable in both apps
- **WHEN** `apps/chat` imports `Conversation` from `@epam/ai-dial-chat-shared`
- **THEN** TypeScript resolves the type without error

#### Scenario: Shared types are importable in chat-api
- **WHEN** `apps/chat-api` imports `Conversation` from `@epam/ai-dial-chat-shared`
- **THEN** TypeScript resolves the type without error

#### Scenario: Message without stages is still valid
- **WHEN** a `Message` object is constructed without a `stages` key
- **THEN** TypeScript accepts it without error and the persisted JSON round-trips correctly

#### Scenario: Message with stages is valid
- **WHEN** a `Message` object is constructed with `stages: [{ index: 0, name: 'Step', status: null }]`
- **THEN** TypeScript accepts it and the value survives a JSON round-trip unchanged

## MODIFIED Requirements

### Requirement: Shared Conversation and Message types live in libs/chat-shared

The `Conversation` and `Message` interfaces SHALL be declared in `libs/chat-shared/src/models/chat.ts` and re-exported from `libs/chat-shared/src/index.ts`. Both `apps/chat` and `apps/chat-api` MUST import these types from `@epam/ai-dial-chat-shared`. No duplicate type definitions are permitted in app-level files.

`Message` shape:

```ts
interface Message {
  id: string;          // UUID
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;   // ISO-8601
  custom_content?: MessageCustomContent;
}
```

`MessageCustomContent` shape (stages stored here, not top-level on Message):

```ts
interface MessageCustomContent {
  stages?: Stage[];    // accumulated agent stages; optional — present only on assistant messages with stage data
  attachments?: MessageAttachment[];
  form_schema?: DeploymentConfigurationSchema;
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

Stages are stored on `Message.custom_content.stages`, NOT as a top-level `Message.stages` field. This mirrors the streaming delta format (`StreamChunkDelta.custom_content.stages`) and keeps `MessageCustomContent` as the single container for all non-text payload.

Existing `Message` values that omit `custom_content` or `custom_content.stages` SHALL remain valid. No migration is required.

#### Scenario: Shared types are importable in apps/chat
- **WHEN** `apps/chat` imports `Conversation` from `@epam/ai-dial-chat-shared`
- **THEN** TypeScript resolves the type without error

#### Scenario: Shared types are importable in chat-api
- **WHEN** `apps/chat-api` imports `Conversation` from `@epam/ai-dial-chat-shared`
- **THEN** TypeScript resolves the type without error

#### Scenario: Message without stages is still valid
- **WHEN** a `Message` object is constructed without `custom_content`
- **THEN** TypeScript accepts it without error and the persisted JSON round-trips correctly

#### Scenario: Message with stages is valid
- **WHEN** a `Message` object is constructed with `custom_content: { stages: [{ index: 0, name: 'Step', status: null }] }`
- **THEN** TypeScript accepts it and the value survives a JSON round-trip unchanged

#### Scenario: StreamChunkDelta accepts custom_content.stages
- **WHEN** a parsed SSE chunk has `choices[0].delta.custom_content.stages`
- **THEN** TypeScript accepts the value as `Stage[] | undefined` without a type assertion

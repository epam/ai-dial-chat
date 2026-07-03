## Purpose

The completion request contract (CompletionMode, generationId, messageIndex) and the server-side history rebuild it drives for append, continue, regenerate, and edit.

## Requirements

### Requirement: `CompletionMode` and generation fields on the completion DTO

`SendCompletionDto` SHALL carry `generationId` (`@IsString() @IsNotEmpty()`), `mode` (`@IsEnum(CompletionMode)`), and optional `messageIndex` (`@IsOptional() @IsInt() @Min(0)`). `CompletionMode` is a string enum: `Append = 'append'`, `ContinueLastUser = 'continue_last_user'`, `Regenerate = 'regenerate'`, `Edit = 'edit'`. `message` becomes optional.

#### Scenario: Missing generationId is rejected

- **WHEN** a completion request omits `generationId`
- **THEN** validation fails with HTTP 400

#### Scenario: `regenerate`/`edit` require `messageIndex`

- **WHEN** a request uses mode `regenerate` or `edit` without `messageIndex`
- **THEN** the backend responds 400 (`messageIndex is required`)

### Requirement: History builder rebuilds messages per mode

`buildConversationHistory` (`apps/chat-api/src/conversations/utils/conversation-history-builder.ts`) SHALL return `{ conversation, assistantMessageIndex }` and build history as: `Append` appends a user message + empty assistant placeholder; `ContinueLastUser` appends only a placeholder when the last message is already a user message; `Regenerate` truncates at `messageIndex` (exclusive) then appends a placeholder; `Edit` truncates at `messageIndex` (the user message), appends the edited user message + placeholder.

#### Scenario: Append adds a new turn

- **WHEN** mode is `append`
- **THEN** the saved start state ends with the new user message followed by an empty assistant placeholder

#### Scenario: Regenerate drops the old answer

- **WHEN** mode is `regenerate` with the assistant index
- **THEN** the old assistant message (and anything after it) is removed and a fresh placeholder is appended at that index

### Requirement: Frontend forwards the correct truncation index per mode

The frontend SHALL forward the backend `messageIndex` derived from the local assistant-placeholder index: equal to it for `Regenerate`, one less for `Edit` (the placeholder follows the edited user message), and omitted for `Append`/`ContinueLastUser`.

#### Scenario: Edit forwards the user message index

- **WHEN** the user edits the message whose placeholder sits at local index `n`
- **THEN** the request sends `messageIndex = n - 1`

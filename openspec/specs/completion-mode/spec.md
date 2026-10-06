## Purpose

The completion request contract (CompletionMode, generationId, messageIndex) and the server-side history rebuild it drives for append, continue, regenerate, and edit.

## Requirements

### Requirement: `CompletionMode` and generation fields on the completion DTO

`SendCompletionDto` (`apps/chat-api/src/conversations/dto/send-completion.dto.ts`) SHALL carry `generationId` (`@IsUUID('4')`), `mode` (`@IsEnum(CompletionMode)`), and optional `messageIndex` (`@IsOptional() @IsInt() @Min(0)`). `CompletionMode` is a string enum: `Append = 'append'`, `ContinueLastUser = 'continue_last_user'`, `Regenerate = 'regenerate'`, `Edit = 'edit'`. `message` is optional (`@IsOptional() @IsString() @MaxLength(50000)`, plus `@IsMessageOrAttachmentsPresent()`).

#### Scenario: Missing generationId is rejected

- **WHEN** a completion request omits `generationId` or sends a value that is not a v4 UUID
- **THEN** validation fails with HTTP 400

#### Scenario: `regenerate`/`edit` require `messageIndex`

- **WHEN** a request uses mode `regenerate` or `edit` without `messageIndex`
- **THEN** the backend responds 400 (`messageIndex is required for regenerate mode` / `messageIndex is required for edit mode`)

### Requirement: History builder rebuilds messages per mode

`buildConversationHistory` (`apps/chat-api/src/conversations/utils/conversation-history-builder.ts`) SHALL return `{ conversation, assistantMessageIndex }` and build history as: `Append` appends a user message + empty assistant placeholder; `ContinueLastUser` appends only a placeholder when the last message is already a user message (when it is not and `message` is supplied, it first appends that user message); `Regenerate` truncates at `messageIndex` (exclusive) then appends a placeholder; `Edit` truncates at `messageIndex` (the user message), appends the edited user message + placeholder. For `Regenerate` and `Edit`, a `messageIndex` outside the current history, or one that does not reference an assistant (`Regenerate`) / user (`Edit`) message, SHALL be rejected with 400. For `Regenerate`, a supplied `custom_content.configuration_value` SHALL be persisted onto the user message the regenerated answer replies to.

`buildConversationHistory` SHALL also accept the `model` deployment id for the request. For `Regenerate`, when `model` differs from `conversation.model.id`, every message in the truncated history SHALL have `custom_content.state` cleared before the placeholder is appended — a stateful app's `state` is deployment-specific and is not valid once the deployment changes.

#### Scenario: Append adds a new turn

- **WHEN** mode is `append`
- **THEN** the saved start state ends with the new user message followed by an empty assistant placeholder

#### Scenario: Regenerate drops the old answer

- **WHEN** mode is `regenerate` with the assistant index
- **THEN** the old assistant message (and anything after it) is removed and a fresh placeholder is appended at that index

#### Scenario: Regenerate with the same model preserves state

- **WHEN** mode is `regenerate` and `model` equals `conversation.model.id`
- **THEN** `custom_content.state` on messages before `messageIndex` is left untouched

#### Scenario: Regenerate with a different model clears state

- **WHEN** mode is `regenerate` and `model` differs from `conversation.model.id`
- **THEN** `custom_content.state` is cleared from every message before `messageIndex`

### Requirement: Frontend forwards the correct truncation index per mode

The frontend (`useConversationStream` in `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`) SHALL forward the backend `messageIndex` derived from the local assistant-placeholder index: equal to it for `Regenerate`, one less for `Edit` (the placeholder follows the edited user message), and omitted for `Append`/`ContinueLastUser`.

#### Scenario: Edit forwards the user message index

- **WHEN** the user edits the message whose placeholder sits at local index `n`
- **THEN** the request sends `messageIndex = n - 1`

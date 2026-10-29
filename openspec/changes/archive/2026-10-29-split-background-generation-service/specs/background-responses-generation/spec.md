## ADDED Requirements

### Requirement: Background path helpers live outside the service file

`apps/chat-api/src/conversations/generation/background-generation.service.ts` SHALL contain no module-level function besides the `BackgroundGenerationService` class. Its other exports SHALL be the service's public contract: `GENERATION_ACTIVE_MESSAGE`, `BACKGROUND_START_TIMEOUT_MS`, `BackgroundStopResult`, `BackgroundStartResult`, `BackgroundRequestContext`, `BackgroundAttachPlan` and `BackgroundStartParams`.

The pure helpers the service uses SHALL live in sibling modules of `apps/chat-api/src/conversations/generation/`, grouped by what they work on:

- `background-message.ts`: stored-message helpers, including `mergeClientMessages`.
- `background-terminal.ts`: mapping stored or retrieved state to terminal values (`toStoredTerminalEvent`, `extractOutputText`, `toTerminalFields`, and the `isRunningStatus` check they use).
- `background-chunk.ts`: parsing relayed SSE frames (`parseChunkFrame`, `readChunkResponseId`).

Each helper SHALL keep its name, signature and behavior. Unit tests for a helper SHALL sit in the spec file next to its module, for example `background-terminal.spec.ts` for `extractOutputText` and `toTerminalFields`.

This structure needs no endpoint, DTO, env var, cache, i18n, RTL, accessibility or telemetry change.

#### Scenario: The service file holds only the class and its contract

- **WHEN** the top-level declarations of `background-generation.service.ts` are listed
- **THEN** they are the imports, the seven contract members and `BackgroundGenerationService`, with no other `const` arrow function or `function` declaration

#### Scenario: Helper behavior is unchanged

- **WHEN** the existing `extractOutputText` and `toTerminalFields` tests run from `background-terminal.spec.ts`, and the `BackgroundGenerationService` tests run from `background-generation.service.spec.ts`
- **THEN** every test passes with the assertions it had before the move

#### Scenario: Consumers of the contract are untouched

- **WHEN** `conversation.controller.ts` and `conversation-streaming.service.ts` are compared before and after the change
- **THEN** their imports from `./generation/background-generation.service` and `../generation/background-generation.service` are identical

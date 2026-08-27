# chat-hooks-conversation-path-utilities Specification

## Purpose

Host-agnostic `getModelIdFromConversationId` conversation-ID parsing,
published from `@epam/ai-dial-chat-hooks` so any DIAL-Core-backed client can
depend on the package instead of hand-copying
`apps/chat/src/utils/get-model-id-from-conversation-id.ts`.

## Requirements

### Requirement: `getModelIdFromConversationId` is a host-agnostic public export

`@epam/ai-dial-chat-hooks` SHALL export `getModelIdFromConversationId(id: string): string | undefined`, reproducing exactly the parsing behavior of the former `apps/chat/src/utils/get-model-id-from-conversation-id.ts`: ordinary model IDs, slash-containing deployment IDs and titles, versioned application IDs, scheduler paths, malformed IDs, and URL-encoded segments all resolve identically to before the move. The function SHALL take no dependency on any app context, generated client, or browser API.

#### Scenario: Ordinary conversation ID resolves its model ID
- **WHEN** `getModelIdFromConversationId` is called with a conversation ID of the form `{modelId}__{title}`
- **THEN** it returns `modelId` unchanged

#### Scenario: Slash-containing deployment ID or title is preserved
- **WHEN** the conversation ID's model-ID segment or title segment contains `/` characters (e.g. a deployment path or a title copied from free text)
- **THEN** the returned model ID includes those `/` characters exactly as they appeared in the input

#### Scenario: Versioned application ID resolves correctly
- **WHEN** the conversation ID encodes a versioned application ID (e.g. `app-name@1.2.3__title`)
- **THEN** the returned model ID includes the version suffix unchanged

#### Scenario: Scheduler-path conversation ID resolves correctly
- **WHEN** the conversation ID is a scheduled-task conversation path
- **THEN** the function returns the same model ID it returned before this move, with no change to the scheduler-path parsing branch

#### Scenario: Malformed conversation ID returns undefined without throwing
- **WHEN** `getModelIdFromConversationId` is called with an ID that does not match any recognized conversation-ID shape
- **THEN** it returns `undefined` and does not throw

#### Scenario: URL-encoded segments are decoded consistently
- **WHEN** the conversation ID contains URL-encoded characters in its model-ID or title segment
- **THEN** the returned model ID decodes those segments identically to the pre-move implementation

### Requirement: `apps/chat` consumes the published export, not a local copy

`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` SHALL import `getModelIdFromConversationId` from `@epam/ai-dial-chat-hooks`. `apps/chat/src/utils/get-model-id-from-conversation-id.ts` and its test SHALL be removed once the migration is verified.

#### Scenario: No app-owned duplicate remains
- **WHEN** the repository is inspected after this change
- **THEN** `apps/chat/src/utils/get-model-id-from-conversation-id.ts` does not exist and `ConversationPanelView.tsx` resolves `getModelIdFromConversationId` from `@epam/ai-dial-chat-hooks`

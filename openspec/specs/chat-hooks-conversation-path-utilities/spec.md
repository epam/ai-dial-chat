# chat-hooks-conversation-path-utilities Specification

## Purpose

Host-agnostic `getModelIdFromConversationId` conversation-ID parsing,
published from `@epam/ai-dial-chat-hooks` so any DIAL-Core-backed client can
depend on the package instead of hand-copying the former app helper
`apps/chat/src/utils/get-model-id-from-conversation-id.ts`.

## Requirements

### Requirement: `getModelIdFromConversationId` is a host-agnostic public export

`@epam/ai-dial-chat-hooks` SHALL export `getModelIdFromConversationId(id: string): string | undefined` (source `libs/chat-hooks/src/conversation/get-model-id-from-conversation-id.ts`, re-exported from the package root and the `conversation` entry point), reproducing exactly the parsing behavior of the former `apps/chat/src/utils/get-model-id-from-conversation-id.ts`. The input is a full conversation ID `conversations/{bucket}/{deploymentId}__{title}`; ordinary model IDs, slash-containing deployment IDs and titles, versioned application IDs, scheduler paths, malformed IDs, and URL-encoded segments all resolve identically to before the move. The function SHALL take no dependency on any app context, generated client, or browser API.

#### Scenario: Ordinary conversation ID resolves its model ID
- **WHEN** `getModelIdFromConversationId` is called with a conversation ID of the form `conversations/{bucket}/{modelId}__{title}` (e.g. `conversations/bucket/gpt-4__My%20chat`)
- **THEN** it returns `modelId` unchanged (e.g. `gpt-4`)

#### Scenario: Slash-containing deployment ID or title is preserved
- **WHEN** the conversation ID's model-ID segment or title segment contains `/` characters (e.g. a deployment path or a title copied from free text)
- **THEN** the returned model ID includes those `/` characters exactly as they appeared in the input

#### Scenario: Versioned application ID resolves correctly
- **WHEN** the conversation ID encodes a versioned custom-application deployment (`conversations/{bucket}/applications/{appBucket}/{name}__{version}__{title}`, e.g. `.../applications/b/app__1.2.3__title`)
- **THEN** the returned model ID includes the `__{version}` suffix unchanged (`applications/b/app__1.2.3`); a numeric second `__` segment is folded into the ID only under the `applications` prefix, so a plain model conversation with a numeric title keeps just the model ID

#### Scenario: Scheduler-path conversation ID resolves correctly
- **WHEN** the conversation ID is a scheduled-task conversation path (`conversations/{bucket}/.scheduler/{scheduleId}/{deploymentId}__{title}`)
- **THEN** the `.scheduler` and `{scheduleId}` segments are skipped and the function returns the same model ID it returned before this move

#### Scenario: Malformed conversation ID returns undefined without throwing
- **WHEN** `getModelIdFromConversationId` is called with an ID that does not match any recognized conversation-ID shape (fewer than three `/`-separated segments, or no segment containing `__`)
- **THEN** it returns `undefined` and does not throw

#### Scenario: URL-encoded segments are decoded consistently
- **WHEN** the conversation ID contains URL-encoded characters in its model-ID or title segment
- **THEN** the function performs no decoding: the deployment-ID segments are returned exactly as they appear in the input, identically to the pre-move implementation

### Requirement: `apps/chat` consumes the published export, not a local copy

`apps/chat` SHALL NOT keep a local copy: `apps/chat/src/utils/get-model-id-from-conversation-id.ts` and its test are removed. `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` consumes the parser indirectly through `useConversationPanelItems` from `@epam/ai-dial-chat-hooks`, which calls `getModelIdFromConversationId` internally to resolve each panel item's model ID.

#### Scenario: No app-owned duplicate remains
- **WHEN** the repository is inspected
- **THEN** `apps/chat/src/utils/get-model-id-from-conversation-id.ts` does not exist, no file under `apps/chat/src` defines its own `getModelIdFromConversationId`, and `ConversationPanelView.tsx` resolves model IDs through `useConversationPanelItems` from `@epam/ai-dial-chat-hooks`

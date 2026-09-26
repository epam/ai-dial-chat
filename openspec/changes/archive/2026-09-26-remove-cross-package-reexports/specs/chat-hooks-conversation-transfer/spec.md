## MODIFIED Requirements

### Requirement: UI-facing transfer contract ownership
`@epam/ai-dial-chat-shared` SHALL canonically define the four UI-facing transfer contracts
(`ConversationTransferJobStatus`, `ConversationTransferSubjectKind`, `ConversationTransferSubject`,
`ConversationTransferJob`), and SHALL be the package every consumer imports them from.
`@epam/ai-dial-chat-hooks` SHALL NOT re-export them from its own barrel and SHALL NOT declare a
second, parallel definition of any of the four; where its own modules need them — including
`libs/chat-hooks/src/conversation/conversation-transfer/types.ts`, which continues to own the
library's *own* transfer enums and event shapes — they SHALL be imported from
`@epam/ai-dial-chat-shared` directly, as `conversation-transfer/queue.ts` already did.
`useConversationTransferQueue`, `useConversationExport`, and `useConversationImport` SHALL continue
to use these types exactly as before; only the import path changes.

#### Scenario: `chat-hooks` imports, does not re-export or redeclare, the transfer contracts
- **WHEN** `libs/chat-hooks` is type-checked
- **THEN** `ConversationTransferJob` (and the other three names) resolve to the `chat-shared`
  declaration through a direct import, with no duplicate interface/enum declaration and no
  re-export from the `chat-hooks` barrel

#### Scenario: Consumers import the contracts from their owning package
- **WHEN** application code needs `ConversationTransferJobStatus` or any of the other three names
- **THEN** it imports the name from `@epam/ai-dial-chat-shared`, and importing it from
  `@epam/ai-dial-chat-hooks` does not resolve

#### Scenario: The library keeps its own transfer types
- **WHEN** a consumer needs `ConversationExportMode`, `ExportFileNameKind`,
  `ConversationTransferErrorCode`, `ConversationTransferWarningCode`, or the
  error/warning/success event shapes
- **THEN** those remain owned by and exported from `@epam/ai-dial-chat-hooks`, since the library —
  not `chat-shared` — declares them

## ADDED Requirements

### Requirement: UI-facing transfer contract ownership
`@epam/ai-dial-chat-shared` SHALL canonically define the four UI-facing transfer contracts (`ConversationTransferJobStatus`, `ConversationTransferSubjectKind`, `ConversationTransferSubject`, `ConversationTransferJob`).
`@epam/ai-dial-chat-hooks` SHALL re-export the same four names from its own barrel (`export type { ... }
from '@epam/ai-dial-chat-shared'`) so existing `chat-hooks` import paths keep resolving, but SHALL NOT
declare a second, parallel definition of any of the four. `useConversationTransferQueue`,
`useConversationExport`, and `useConversationImport` SHALL continue to use these types exactly as before;
only the canonical declaration's package changes.

#### Scenario: `chat-hooks` re-exports, does not redeclare, the transfer contracts
- **WHEN** `libs/chat-hooks` is type-checked
- **THEN** `ConversationTransferJob` (and the other three names) resolve to the `chat-shared` declaration
  via a re-export, with no duplicate interface/enum declaration in `chat-hooks`

#### Scenario: Existing `chat-hooks` consumers are unaffected
- **WHEN** application code imports `ConversationTransferJobStatus` from `@epam/ai-dial-chat-hooks`
- **THEN** the import continues to resolve and behaves identically to before this change

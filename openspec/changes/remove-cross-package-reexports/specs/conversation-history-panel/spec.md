## MODIFIED Requirements

### Requirement: `libs/conversation-panel` library exposes `ConversationPanel`

A new library `@epam/ai-dial-conversation-panel` SHALL exist at `libs/conversation-panel/`. It SHALL export `ConversationPanel` and the types: `ConversationPanelProps`, `ConversationPanelStyles`, `ConversationHistoryColors`, `ConversationHistoryTypography`, `ConversationHistoryItem`, `ConversationSource` (string enum), `FilterLabels`, `ConversationGroupProps`. It SHALL NOT export `FilterTab`, which is owned by `@epam/ai-dial-chat-shared` — consumers import that enum from its own package alongside this one. The library SHALL declare `react`, `@epam/ai-dial-ui-kit`, `@tabler/icons-react` as peer dependencies. It SHALL have `"license": "Apache-2.0"` in `package.json`.

The library imports `SidebarPanel`, `SearchInput`, and `SidebarOrientation` from `@epam/ai-dial-sidebar` to use as the panel shell.

#### Scenario: ConversationPanel is importable in apps/chat

- **WHEN** `apps/chat` imports `ConversationPanel` from `@epam/ai-dial-conversation-panel`
- **THEN** TypeScript resolves the import without error

#### Scenario: `FilterTab` resolves from its owning package

- **WHEN** `apps/chat` or any module inside `libs/conversation-panel` needs `FilterTab`
- **THEN** it imports the enum from `@epam/ai-dial-chat-shared`, and importing it from
  `@epam/ai-dial-conversation-panel` does not resolve

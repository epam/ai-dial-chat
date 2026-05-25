## ADDED Requirements

### Requirement: Stage and StageStatus types are declared in libs/chat-shared

The shared library SHALL export a `StageStatus` enum and a `Stage` interface from `libs/chat-shared/src/models/chat.ts`. `StreamChunkDelta` MUST be extended with an optional `custom_content` field typed as `{ stages?: Stage[] }`. Both types MUST be re-exported from `libs/chat-shared/src/index.ts`.

```ts
enum StageStatus {
  Completed = 'completed',
  Failed = 'failed',
}

interface Stage {
  index: number;
  name: string;
  status: StageStatus | null;
}
```

#### Scenario: Stage type is importable in apps/chat
- **WHEN** `apps/chat` imports `Stage` and `StageStatus` from `@epam/ai-dial-chat-shared`
- **THEN** TypeScript resolves both without error

#### Scenario: StreamChunkDelta accepts custom_content.stages
- **WHEN** a parsed SSE chunk has `choices[0].delta.custom_content.stages`
- **THEN** TypeScript accepts the value as `Stage[] | undefined` without a type assertion

---

### Requirement: Message type carries an optional stages array

The `Message` interface in `libs/chat-shared/src/models/chat.ts` SHALL include `stages?: Stage[]`. Existing `Message` values that do not have a `stages` key SHALL remain valid (the field is optional).

#### Scenario: Message without stages is still valid
- **WHEN** a `Message` object is constructed without a `stages` field
- **THEN** TypeScript accepts it without error

#### Scenario: Message with stages is valid
- **WHEN** a `Message` object is constructed with `stages: [{ index: 0, name: 'Step 1', status: null }]`
- **THEN** TypeScript accepts it without error

---

### Requirement: Streaming handler merges incoming stages into the assistant message

The `onChunk` handler in `apps/chat/src/pages/Conversation/Conversation.tsx` SHALL read `chunk.choices[0]?.delta?.custom_content?.stages` on every chunk. If stages are present, the handler MUST merge them into the current assistant message's `stages` array by upserting on `index` (replace existing entry with the same index, append if new) and sorting ascending by `index`. The merge MUST be applied inside the functional `setConversation` updater to avoid stale closure issues. Text token accumulation (`delta.content`) SHALL continue to work independently of stage merging.

#### Scenario: Stage with new index is appended
- **WHEN** a chunk arrives with `custom_content.stages: [{ index: 3, name: 'Lookup', status: null }]` and the message has no existing stage at index 3
- **THEN** the assistant message's `stages` array contains the new entry at the correct position

#### Scenario: Stage with existing index is replaced
- **WHEN** a chunk arrives with `custom_content.stages: [{ index: 1, name: 'Query', status: 'completed' }]` and the message already has `{ index: 1, name: 'Query', status: null }`
- **THEN** the stage at index 1 is updated to `status: 'completed'`

#### Scenario: Chunk without stages does not clear existing stages
- **WHEN** a chunk arrives with no `custom_content` field
- **THEN** the assistant message's existing `stages` array is unchanged

#### Scenario: Stages are present on the final saved message
- **WHEN** streaming completes and `saveConversation` is called
- **THEN** the saved conversation's last assistant message contains the full accumulated `stages` array

---

### Requirement: StagesPanel component renders accumulated stages

The `StagesPanel` component SHALL be created at `apps/chat/src/components/StagesPanel/StagesPanel.tsx`. It SHALL accept `stages: Stage[]` and `isStreaming: boolean` as required props, and a `defaultOpen?: boolean` prop (defaults to `true`). It SHALL render a collapsible panel. When collapsed, only the header row is visible. When expanded, each stage is shown as a row with:

- A status icon from `@tabler/icons-react`:
  - `status === null` → `IconLoader2` with `animate-spin` Tailwind class (running)
  - `status === StageStatus.Completed` → `IconCheck`
  - Any other non-null status → `IconX`
- The stage `name` text

The panel header MUST have `role="button"` and be keyboard-accessible (`onKeyDown` handling Enter/Space). The stage list MUST have `role="list"` and each row `role="listitem"`.

i18n keys:
- `stages.panel.header` — header label (e.g. "Steps")
- `stages.panel.collapseAriaLabel` — aria-label for toggle button (e.g. "Toggle steps panel")

#### Scenario: Panel renders all stages
- **WHEN** `StagesPanel` receives `stages` with 3 entries and `isStreaming={false}`
- **THEN** 3 stage rows are visible when the panel is open

#### Scenario: Running stage shows spinner icon
- **WHEN** a stage has `status: null`
- **THEN** the row renders an `IconLoader2` with the `animate-spin` class

#### Scenario: Completed stage shows check icon
- **WHEN** a stage has `status: StageStatus.Completed`
- **THEN** the row renders an `IconCheck`

#### Scenario: Failed stage shows X icon
- **WHEN** a stage has a non-null status that is not `StageStatus.Completed`
- **THEN** the row renders an `IconX`

#### Scenario: Panel can be toggled by click
- **WHEN** the user clicks the panel header
- **THEN** the panel collapses if open, expands if collapsed

#### Scenario: Panel can be toggled by keyboard
- **WHEN** the user focuses the header and presses Enter or Space
- **THEN** the panel collapses or expands accordingly

---

### Requirement: StagesPanel is rendered above the text content for assistant messages that have stages

In `ConversationView.tsx`, for each assistant `Message` that has a non-empty `stages` array, a `StagesPanel` SHALL be rendered immediately above the `MessageBubble` for that message. The `isStreaming` prop MUST be `true` only for the last message while `isAssistantTyping` is `true`.

#### Scenario: Assistant message with stages shows StagesPanel
- **WHEN** an assistant message has `stages: [...]` with at least one entry
- **THEN** `StagesPanel` is rendered above the corresponding `MessageBubble`

#### Scenario: User message does not show StagesPanel
- **WHEN** a user message is rendered
- **THEN** no `StagesPanel` is present for that message

#### Scenario: Assistant message without stages does not show StagesPanel
- **WHEN** an assistant message has no `stages` field or an empty array
- **THEN** no `StagesPanel` is rendered for that message

---

### Requirement: StagesPanel has unit tests

Tests SHALL be placed in `apps/chat/src/components/StagesPanel/tests/StagesPanel.spec.tsx`. They MUST cover: rendering stages, icon selection by status, and collapse/expand toggle. No `data-testid` attributes; use accessible queries (`getByRole`, `getByLabelText`).

#### Scenario: Test suite covers icon mapping
- **WHEN** the StagesPanel test suite runs
- **THEN** it asserts the correct icon is rendered for each status variant (null, completed, other)

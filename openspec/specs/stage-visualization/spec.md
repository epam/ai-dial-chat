# stage-visualization Specification

## Purpose

The `conversation-stages` library: merging streamed stages into a conversation and rendering them above assistant message bubbles.

## Requirements

### Requirement: `libs/conversation-stages` library exposes `StagesPanel`

A new library `@epam/ai-dial-conversation-stages` SHALL exist at `libs/conversation-stages/`. It SHALL export `StagesPanel`, `StagesPanelProps`, and `StagesPanelColors`. The library SHALL declare `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, `@tabler/icons-react`, and `@epam/ai-dial-conversation-messages` as peer dependencies.

#### Scenario: StagesPanel is importable in apps/chat
- **WHEN** `apps/chat` imports `StagesPanel` from `@epam/ai-dial-conversation-stages`
- **THEN** TypeScript resolves the import without error

---

### Requirement: Stage type includes optional content field

The `Stage` interface in `libs/chat-shared` SHALL include `content?: string` in addition to `index`, `name`, and `status`. The field accumulates the stage's markdown body text across streaming chunks.

#### Scenario: Stage without content is valid
- **WHEN** a `Stage` object is constructed without `content`
- **THEN** TypeScript accepts it without error

#### Scenario: Stage with content is valid
- **WHEN** a `Stage` object is constructed with `content: "## Result\n...">`
- **THEN** TypeScript accepts it without error

---

### Requirement: Streaming handler merges incoming stages into `custom_content`

The `onChunk` handler in `apps/chat/src/pages/Conversation/Conversation.tsx` SHALL read `chunk.choices[0]?.delta?.custom_content?.stages` on every chunk. If stages are present, the handler MUST:
1. Upsert each incoming stage into `message.custom_content.stages` by `index` (replace existing entry, append if new).
2. Append `stage.content` to the existing content for that index (do not replace).
3. Sort the accumulated list ascending by `index`.
4. Apply all mutations inside the functional `setConversation` updater.

Text token accumulation (`delta.content`) SHALL continue independently.

#### Scenario: Stage with new index is appended
- **WHEN** a chunk arrives with `custom_content.stages: [{ index: 3, name: 'Lookup', status: null }]` and the message has no stage at index 3
- **THEN** the assistant message's `custom_content.stages` array contains the new entry

#### Scenario: Stage with existing index is updated
- **WHEN** a chunk arrives with `custom_content.stages: [{ index: 1, status: 'completed' }]` and the message already has `{ index: 1, status: null }`
- **THEN** the stage at index 1 has `status: 'completed'`

#### Scenario: Stage content is appended
- **WHEN** two chunks both carry `content` for stage index 0
- **THEN** the accumulated `stage.content` equals the concatenation of both values

#### Scenario: Chunk without stages does not clear existing stages
- **WHEN** a chunk arrives with no `custom_content.stages`
- **THEN** the assistant message's existing stages are unchanged

#### Scenario: Stages persist after streaming ends
- **WHEN** streaming completes and `saveConversation` is called
- **THEN** the saved conversation's last assistant message contains the full accumulated stages in `custom_content.stages`

---

### Requirement: `StageIcon` maps status to the correct icon

The `StageIcon` component SHALL render:
- `Spinner` — when `status === null` AND `isLive === true` (last running stage during streaming)
- `IconAlertCircle` — when `status === null` AND `isLive === false`
- `IconCircleCheck` — when `status === StageStatus.Completed`
- `IconAlertCircle` — for any other non-null status

#### Scenario: Live running stage shows spinner
- **WHEN** `status` is `null` and `isLive` is `true`
- **THEN** `Spinner` is rendered

#### Scenario: Completed stage shows check icon
- **WHEN** `status` is `StageStatus.Completed`
- **THEN** `IconCircleCheck` is rendered

#### Scenario: Non-live null-status stage shows alert icon
- **WHEN** `status` is `null` and `isLive` is `false`
- **THEN** `IconAlertCircle` is rendered

---

### Requirement: `StageItem` collapses/expands its content body

Each `StageItem` SHALL render a header row (icon + name). When `stage.content` is present, the item SHALL be a button that toggles an animated content body (CSS grid-rows transition). When `stage.content` is absent, the item is a static row with no toggle.

#### Scenario: Stage without content renders a plain row
- **WHEN** `stage.content` is undefined or empty
- **THEN** no toggle button is rendered

#### Scenario: Stage with content renders a collapsible button
- **WHEN** `stage.content` is a non-empty string
- **THEN** a button element is rendered and clicking it expands/collapses the content body

---

### Requirement: `StagesPanel` renders a flat list of stages

`StagesPanel` SHALL accept `stages: Stage[]`, `isStreaming: boolean`, and optional `className`, `colors`, `typographyClassName`, `copyAriaLabel` props. It SHALL render a `<ul role="list">` containing one `<li role="listitem">` per stage. The `isLive` prop passed to each `StageItem` SHALL be `true` only for the last stage with `status === null` when `isStreaming` is `true`.

#### Scenario: Panel renders all stage rows
- **WHEN** `StagesPanel` receives 3 stages
- **THEN** 3 list items are rendered

#### Scenario: Only the last null-status stage is live during streaming
- **WHEN** `isStreaming` is `true` and stages 0 and 2 have `status: null`
- **THEN** only stage 2 receives `isLive={true}`

#### Scenario: No stage is live when not streaming
- **WHEN** `isStreaming` is `false`
- **THEN** no stage receives `isLive={true}`

---

### Requirement: `StagesPanel` is themed via CSS custom properties

When `colors` is provided, `StagesPanel` SHALL apply values as CSS custom properties on the root element using `buildCssVars`. Supported variables: `--cs-bg`, `--cs-border`, `--cs-text`, `--cs-stage-text`, `--cs-running`, `--cs-completed`, `--cs-failed`.

---

### Requirement: `StagesPanel` is rendered above assistant message bubbles that have stages

In `ConversationView.tsx`, a `messageHasStages` utility SHALL check `message.custom_content?.stages?.length > 0`. For each assistant message where this returns `true`, a `StagesPanel` SHALL be rendered immediately above the corresponding `MessageBubble`. The `isStreaming` prop SHALL be `true` only for the last message while `isAssistantTyping` is `true`.

#### Scenario: Assistant message with stages shows StagesPanel
- **WHEN** an assistant message has at least one entry in `custom_content.stages`
- **THEN** `StagesPanel` is rendered above the corresponding `MessageBubble`

#### Scenario: User message does not show StagesPanel
- **WHEN** a user message is rendered
- **THEN** no `StagesPanel` is present for that message

#### Scenario: Assistant message without stages does not show StagesPanel
- **WHEN** an assistant message has no stages
- **THEN** no `StagesPanel` is rendered for that message

---

### Requirement: `StagesPanel` has unit tests

Tests SHALL be placed in `libs/conversation-stages/src/components/StagesPanel/StagesPanel.spec.tsx`. They MUST cover: rendering stage rows, icon selection per status variant, and the live/non-live distinction.

#### Scenario: Test suite covers icon mapping
- **WHEN** the StagesPanel test suite runs
- **THEN** it asserts the correct icon for each status variant (null+live, null+not-live, completed, other)

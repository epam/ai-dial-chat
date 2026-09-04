# stage-visualization Specification

## Purpose

The `conversation-stages` library: merging streamed stages into a conversation and rendering them above assistant message bubbles.

## Requirements

### Requirement: `libs/conversation-stages` exposes the stage renderers

The `@epam/ai-dial-conversation-stages` library SHALL exist at `libs/conversation-stages/`. It SHALL export `StagesPanel`, `CollapsedGroup`, and their public props, labels, color, style, and typography types. The library SHALL declare `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and `@tabler/icons-react` as peer dependencies.

#### Scenario: CollapsedGroup is importable in apps/chat
- **WHEN** `apps/chat` imports `CollapsedGroup` from `@epam/ai-dial-conversation-stages`
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

### Requirement: Streaming assembly merges incoming stages into `custom_content`

`applyChunkToMessages` in `libs/chat-hooks/src/conversation/useConversationStream/apply-chunk.ts` SHALL read `chunk.choices[0]?.delta?.custom_content?.stages` on every chunk. If stages are present, it MUST:
1. Upsert each incoming stage into `message.custom_content.stages` by `index`, merging an existing entry and appending a new index.
2. Append `stage.name` and `stage.content` deltas to the existing values for that index.
3. Apply an incoming `status` only to the stage with the matching index; it MUST NOT infer a completed status from the arrival of another stage.
4. Preserve stages when a chunk contains no stage update.

Text token accumulation (`delta.content`) SHALL continue independently.

#### Scenario: Stage with new index is appended
- **WHEN** a chunk arrives with `custom_content.stages: [{ index: 3, name: 'Lookup', status: null }]` and the message has no stage at index 3
- **THEN** the assistant message's `custom_content.stages` array contains the new entry

#### Scenario: Stage with existing index is updated
- **WHEN** a chunk arrives with `custom_content.stages: [{ index: 1, status: 'completed' }]` and the message already has `{ index: 1, status: null }`
- **THEN** the stage at index 1 has `status: 'completed'`

#### Scenario: A later stage does not complete an earlier stage
- **WHEN** stage 6 has `status: null` and a subsequent chunk introduces stage 7
- **THEN** stage 6 keeps `status: null` until a chunk for index 6 explicitly supplies `status: 'completed'` or `status: 'failed'`

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
- `IconAlertCircle` — when `status === StageStatus.Failed`, regardless of a stale `isLive` value
- `IconCheck` — when `status === StageStatus.Completed`, regardless of a stale `isLive` value
- `Spinner` — when `status === null` AND `isLive === true`
- no status icon — when `status === null` AND `isLive === false`

A completion check MUST be driven only by the explicit `StageStatus.Completed` value. The component MUST NOT infer completion because a stage is no longer the latest entry or because `isLive` is `false`.

#### Scenario: Live running stage shows spinner
- **WHEN** `status` is `null` and `isLive` is `true`
- **THEN** `Spinner` is rendered

#### Scenario: Completed stage shows check icon
- **WHEN** `status` is `StageStatus.Completed`
- **THEN** `IconCheck` is rendered

#### Scenario: Non-live unresolved stage does not show a completed check
- **WHEN** `status` is `null` and `isLive` is `false`
- **THEN** neither `IconCheck`, `IconAlertCircle`, nor `Spinner` is rendered

#### Scenario: Explicit failure wins over stale live state
- **WHEN** `status` is `StageStatus.Failed` and `isLive` is `true`
- **THEN** `IconAlertCircle` is rendered and `Spinner` is not rendered

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

`StagesPanel` SHALL accept `stages: Stage[]`, `isStreaming: boolean`, and optional `className`, `styles`, and `labels` props. It SHALL render a `<ul role="list">` containing one `<li role="listitem">` per stage row. While `isStreaming` is `true`, every stage with `status === null` SHALL receive `isLive={true}` and show a running spinner. The arrival of a later unresolved stage MUST NOT change an earlier unresolved stage to a completed check. A collapsed repeated-stage row SHALL remain live while any attempt in that row has `status === null`.

#### Scenario: Panel renders all stage rows
- **WHEN** `StagesPanel` receives 3 stages
- **THEN** 3 list items are rendered

#### Scenario: Every null-status stage stays live during streaming
- **WHEN** `isStreaming` is `true` and stages 0 and 2 have `status: null`
- **THEN** stages 0 and 2 both receive `isLive={true}` and neither renders a completed check

#### Scenario: A stage becomes completed only after its status update
- **WHEN** stages 0 and 2 have `status: null`, then a later chunk changes only stage 0 to `status: 'completed'`
- **THEN** stage 0 renders a completed check and stage 2 continues to render a running spinner

#### Scenario: Repeated-stage group remains unresolved
- **WHEN** a collapsed repeated-stage row contains one completed attempt and one attempt with `status: null` while streaming
- **THEN** the group summary renders a running spinner until the unresolved attempt receives a terminal status

#### Scenario: No stage is live when not streaming
- **WHEN** `isStreaming` is `false`
- **THEN** no stage receives `isLive={true}` and an unresolved `status: null` stage does not render a completed check

---

### Requirement: `StagesPanel` is themed via CSS custom properties

When `styles.colors` is provided, `StagesPanel` SHALL apply its values as CSS custom properties on the root element using `buildCssVars`. Supported variables are `--cs-text`, `--cs-row-hover`, `--cs-button-bg`, `--cs-stage-text`, `--cs-failed-text`, `--cs-tag-text`, `--cs-count-text`, `--cs-duration-text`, `--cs-icon-secondary`, `--cs-icon-completed`, `--cs-icon-error`, `--cs-code-bg`, `--cs-code-border`, `--cs-code-text`, and `--cs-border`.

#### Scenario: Supplied colors become custom properties

- **WHEN** `StagesPanel` is rendered with a `styles.colors` object
- **THEN** its root element carries the corresponding `--cs-*` custom properties built via `buildCssVars`

#### Scenario: Omitted colors leave the root unstyled

- **WHEN** `StagesPanel` is rendered without `colors`
- **THEN** no `--cs-*` custom property is written onto the root element and the panel inherits the ambient theme

---

### Requirement: Finished stage summaries report elapsed execution time

`CollapsedGroup` and collapsed repeated-stage rows in `StagesPanel` SHALL show the elapsed execution time represented by parseable duration metadata in stage names. When every duration-bearing stage also has a valid `Start: HH:mm:ss` timestamp, each stage SHALL be treated as the interval from its start timestamp through its declared duration, and overlapping intervals SHALL contribute to the total only once. A backward jump of more than 12 hours between consecutive stage start timestamps SHALL be treated as a midnight rollover; a wide but forward-moving range within one day SHALL remain on the same day.

If any duration-bearing stage lacks a valid start timestamp, the components SHALL preserve compatibility with duration-only stage names by summing all parseable durations. If no duration can be parsed, no total-duration label SHALL be shown.

#### Scenario: Fully parallel stages contribute time once

- **WHEN** three finished stages each declare a duration of 40 seconds and the same start timestamp
- **THEN** the finished summary shows `40.0s`, not `2m 0s`

#### Scenario: Partially overlapping stages contribute their interval union

- **WHEN** one 20-second stage starts at `11:21:00`, another 20-second stage starts at `11:21:10`, and a separate 10-second stage starts at `11:21:40`
- **THEN** the finished summary shows `40.0s`

#### Scenario: Duration-only metadata uses the compatibility fallback

- **WHEN** two finished stages declare `[40s]` without start timestamps
- **THEN** the finished summary shows their summed duration of `1m 20s`

#### Scenario: Overlapping stages can span midnight

- **WHEN** a 20-second stage starts at `23:59:50` and a 10-second stage starts at `00:00:05`
- **THEN** the finished summary shows `25.0s`

#### Scenario: A wide same-day range does not imply a midnight rollover

- **WHEN** ordered stages start at `00:00:00`, `11:59:59`, `12:00:00`, and `23:59:59`, with the middle two intervals overlapping across noon
- **THEN** the middle intervals remain on the same day and the finished summary shows `7.0s`

#### Scenario: Stages without durations omit the total

- **WHEN** none of the finished stage names contains parseable duration metadata
- **THEN** no total-duration label is rendered

---

### Requirement: `CollapsedGroup` is rendered in assistant messages that have stages

In `ConversationMessageItem.tsx`, the `messageHasStages` utility SHALL return `true` only when `message.role` is `MessageRole.Assistant` and `message.custom_content?.stages?.length > 0`. For each message where this returns `true`, a `CollapsedGroup` SHALL be rendered in the corresponding `MessageBubble`'s `afterContent`, receiving the accumulated `message.custom_content.stages`. Its `isStreaming` prop SHALL come from `isStreamingMessage`, so it is `true` only for the last assistant message while `isAssistantTyping` is `true`.

#### Scenario: Assistant message with stages shows CollapsedGroup
- **WHEN** an assistant message has at least one entry in `custom_content.stages`
- **THEN** `CollapsedGroup` is rendered in the corresponding `MessageBubble` after-content area

#### Scenario: User message does not show CollapsedGroup
- **WHEN** a user message is rendered
- **THEN** no `CollapsedGroup` is present for that message

#### Scenario: Assistant message without stages does not show CollapsedGroup
- **WHEN** an assistant message has no stages
- **THEN** no `CollapsedGroup` is rendered for that message

---

### Requirement: Stage status rendering has unit tests

Tests SHALL be placed under the component-local `tests/` folders for `StageIcon`, `StageItem`, and `StagesPanel`. They MUST cover explicit completed and failed statuses, unresolved live and non-live states, multiple simultaneous `status: null` stages, the `null` to `completed` transition, and unresolved repeated-stage groups.

#### Scenario: Test suite covers icon mapping
- **WHEN** the conversation-stages test suite runs
- **THEN** it asserts that a completed check appears only for `StageStatus.Completed` and that adding a later stage does not complete an earlier `status: null` stage

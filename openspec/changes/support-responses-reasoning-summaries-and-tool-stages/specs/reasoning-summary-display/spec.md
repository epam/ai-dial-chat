## ADDED Requirements

### Requirement: `MessageCustomContent` and `StreamChunkDelta` carry reasoning summaries

`libs/chat-shared/src/models/chat.ts` SHALL declare `ReasoningSummaryPart { itemId: string; outputIndex: number; summaryIndex: number; text: string }`, and both `MessageCustomContent.reasoningSummaries?: ReasoningSummaryPart[]` and `StreamChunkDelta.custom_content.reasoning_summaries?: ReasoningSummaryPart[]` SHALL be added as optional fields, matching the wire key `reasoning_summaries` already used by the backend chunk/persistence shape.

#### Scenario: Message without reasoning summaries type-checks

- **WHEN** a `Message` object is constructed without `custom_content.reasoningSummaries`
- **THEN** TypeScript accepts it without error

#### Scenario: Message with reasoning summaries type-checks

- **WHEN** a `Message` object is constructed with `custom_content.reasoningSummaries: [{ itemId: 'rs_1', outputIndex: 0, summaryIndex: 0, text: 'Checking sources' }]`
- **THEN** TypeScript accepts it without error

### Requirement: A host-agnostic reasoning-summary component renders accumulated text

A new component (e.g. `ReasoningSummary`) SHALL exist under `libs/conversation-stages/src/components/` (or a sibling host-agnostic library, per the design's placement decision), receiving already-normalized text/parts and a `labels` prop (title, expand/collapse aria labels) with English defaults, and rendering through the library's existing sanitized-markdown rendering path (reusing `StageMarkdownContent` or equivalent) rather than unsanitized HTML. The component SHALL NOT import Responses API types, event names, or any app/backend contract — it only receives resolved strings/values via props.

#### Scenario: Component renders resolved text via props only

- **WHEN** `ReasoningSummary` is rendered with `text` and `labels` props
- **THEN** it renders the provided text through the shared markdown renderer without importing any Responses-API-specific type

#### Scenario: No unsanitized HTML rendering

- **WHEN** `text` contains raw HTML-like content
- **THEN** the component renders it through the existing sanitized markdown path, not as raw `dangerouslySetInnerHTML`

### Requirement: `apps/chat` renders the reasoning-summary section separately from stages

`ConversationMessageItem.tsx` SHALL render the reasoning-summary component conditionally, near the existing `hasStages && <CollapsedGroup ... />` block (`ConversationMessageItem.tsx:471-477`), only when the assistant message has at least one non-empty `custom_content.reasoningSummaries` entry. All labels passed into the component SHALL come from `react-i18next` `useTranslation` at this app boundary, using keys declared in `apps/chat/src/constants/translation-keys.ts`.

#### Scenario: No reasoning section when summaries are absent

- **WHEN** an assistant message has no `custom_content.reasoningSummaries` (or an empty array)
- **THEN** no reasoning-summary section is rendered

#### Scenario: Reasoning section renders when summaries are present

- **WHEN** an assistant message has at least one non-empty `custom_content.reasoningSummaries` entry
- **THEN** a labeled, collapsible reasoning-summary section renders near the message's stages section

#### Scenario: Reasoning section streams while in progress and persists after completion

- **WHEN** reasoning-summary text accumulates while the message is still streaming, and the message later completes and the conversation is reloaded
- **THEN** the reasoning-summary section is visible during streaming and remains visible, with the same text, after reload

#### Scenario: Reasoning section never affects executed-step count

- **WHEN** an assistant message has both a non-empty reasoning summary and executed tool stages
- **THEN** `Executed in N steps` reflects only the tool stages' count, unaffected by the presence or size of the reasoning summary

### Requirement: Reasoning-summary section accessibility and RTL behavior

The reasoning-summary section's expand/collapse control SHALL expose `aria-expanded` reflecting its open state and SHALL be reachable and operable via keyboard (Enter/Space), matching the existing `CollapsedGroup` toggle pattern. Streaming text updates SHALL use `aria-live="polite"` with `aria-atomic="false"`, consistent with continuously streamed content elsewhere in the app. Directional chevron icons SHALL mirror in RTL using `rtl:scale-x-[-1]`, matching the existing pattern in `CollapsedGroup`/`StageItem`. The "Thinking" empty-message shimmer (existing `thinkingLabel`) SHALL remain a distinct UI state from a returned, non-empty reasoning summary — the shimmer SHALL NOT be reused to represent in-progress summary text.

#### Scenario: Keyboard toggles the reasoning section

- **WHEN** a keyboard user focuses the reasoning-summary toggle and presses Enter or Space
- **THEN** the section's expanded/collapsed state toggles and `aria-expanded` reflects the new state

#### Scenario: RTL mirrors the directional icon

- **WHEN** the active language is RTL
- **THEN** the reasoning-summary section's chevron icon is visually mirrored

#### Scenario: Thinking shimmer and reasoning summary are distinct

- **WHEN** an assistant message has no content yet and no reasoning summary has arrived
- **THEN** only the existing "Thinking" shimmer is shown, not a reasoning-summary section

### Requirement: `i18n` keys for the reasoning-summary section

New keys SHALL be added to `apps/chat/src/i18n/locales/en.json` and referenced via a new or existing enum in `apps/chat/src/constants/translation-keys.ts`, for example `chat.reasoningSummary.title`, `chat.reasoningSummary.expandAriaLabel`, `chat.reasoningSummary.collapseAriaLabel`.

#### Scenario: All reasoning-summary strings resolve through i18n

- **WHEN** the reasoning-summary section renders any user-visible or aria-label text
- **THEN** every such string is sourced from a `translation-keys.ts` enum member via `t()`, never a raw string literal

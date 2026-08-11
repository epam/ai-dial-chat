## ADDED Requirements

### Requirement: Frontend chunk applier merges reasoning summaries matching server semantics

`apps/chat/src/utils/apply-chunk.ts` SHALL merge `delta.custom_content.reasoning_summaries` into `message.custom_content.reasoningSummaries`, using the same `(itemId, outputIndex, summaryIndex)` upsert-and-concatenate semantics as the server-side merge in `apply-chunk.server.ts`, so live-rendered and persisted text never diverge.

#### Scenario: Frontend merge matches server merge for the same chunk sequence

- **WHEN** the same sequence of `reasoning_summaries` chunks is applied by both `apply-chunk.ts` (live rendering) and `apply-chunk.server.ts` (persistence)
- **THEN** both produce the same accumulated `reasoning_summaries` entries for every key

#### Scenario: Chunk without reasoning_summaries does not clear existing entries

- **WHEN** a chunk arrives with no `custom_content.reasoning_summaries`
- **THEN** the message's existing `custom_content.reasoningSummaries` entries are unchanged

### Requirement: Provider-neutral `toolKind` is resolved to a localized label at the `apps/chat` boundary

`Stage` (`libs/chat-shared/src/models/chat.ts`) SHALL gain an optional `toolKind?: ToolStageKind` field, where `ToolStageKind` is a DIAL-level, provider-neutral enum (e.g. `WebSearch = 'web_search'`) that never carries a raw Responses API discriminator such as `web_search_call`. Before an array of stages reaches `CollapsedGroup`/`StagesPanel`, `apps/chat` (in `ConversationMessageItem.tsx` or a dedicated utility under `apps/chat/src/utils/`) SHALL map any recognized `toolKind` to a localized `name`/`tag` sourced from `react-i18next`, leaving stages without a recognized `toolKind` unchanged. `libs/conversation-stages` SHALL NOT import or branch on `ToolStageKind` — it continues to receive only the already-resolved `name`/`tag` strings.

#### Scenario: Recognized tool kind resolves to a localized label

- **WHEN** a stage has `toolKind: 'web_search'` and the active language has a translation for it
- **THEN** the stage's `name`/`tag` rendered by `CollapsedGroup`/`StagesPanel` reflects the localized label, not any raw backend-provided placeholder

#### Scenario: Existing Chat-Completions stages are unaffected

- **WHEN** a stage has no `toolKind` field (the existing Chat Completions case)
- **THEN** the label-resolution step makes no change to that stage's `name`/`tag`

#### Scenario: `libs/conversation-stages` remains free of Responses API knowledge

- **WHEN** `CollapsedGroup`/`StagesPanel`/`StageItem` render a Responses-origin stage
- **THEN** none of those components import, reference, or branch on `ToolStageKind` or any Responses API discriminator

### Requirement: `Executed in N steps` counts only actual normalized execution stages

The existing `stages.length`-based summary in `CollapsedGroup` (`CollapsedGroup.tsx:157,193`) SHALL continue to count only entries in `custom_content.stages`. Reasoning-summary entries SHALL NEVER be added to `custom_content.stages` and therefore SHALL NEVER be counted.

#### Scenario: Reasoning summary alongside stages does not change the count

- **WHEN** an assistant message has two completed tool stages and a non-empty reasoning summary
- **THEN** `CollapsedGroup` reports `Executed in 2 steps`, unaffected by the reasoning summary

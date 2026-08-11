## MODIFIED Requirements

### Requirement: `getModelIdFromConversationId` correctly extracts the deployment ID from multi-segment and slash-containing conversation IDs

`apps/chat/src/utils/get-model-id-from-conversation-id.ts` SHALL export `getModelIdFromConversationId(id: string): string | undefined`.

The backend encodes each `/`-separated segment of the conversation path individually with `encodeURIComponent` (`encodeDialResourcePath`). This means **both** the deployment ID and the conversation title can introduce extra URL path segments:

- Deployment `anthropic/claude-3`, title `My chat`
  → `conversations/bucket/anthropic/claude-3__My%20chat`
- Deployment `uuid`, title `report 6/2/2026` (title contains slashes)
  → `conversations/bucket/uuid__report%206/2/2026`

DIAL Scheduler additionally writes scheduled-task conversations under the reserved `conversations/{bucket}/.scheduler/{scheduleId}/{filename}` path shape (matching `apps/chat-api/src/conversations/utils/parse-scheduled-task-conversation-path.ts`'s `SCHEDULER_SEGMENT = '.scheduler'`). When the segment immediately after the bucket is the literal string `.scheduler`, the function MUST treat that segment and the one immediately following it (the schedule id) as a reserved path prefix and skip both before extracting the deployment id from the remaining segments — they are never part of the deployment id.

The function MUST scan the remaining segments (after skipping bucket, and after skipping the `.scheduler`/scheduleId pair when present) **left-to-right** and stop at the **first** segment (after URL-decoding) that contains `__`. Segments before that one form the deployment ID path prefix. The part of the separator segment before `__` is the final piece of the deployment ID. Segments after the separator segment are part of the title and MUST be ignored.

The function MUST return `undefined` when:
- The input has fewer than 3 `/`-separated segments.
- No segment (after any `.scheduler` prefix skip) contains `__`.

Note: outside the specifically-reserved `.scheduler/{scheduleId}` prefix, this function cannot reliably distinguish a real, user-created conversation folder from a genuine multi-segment deployment id — both appear as plain `/`-separated path segments once encoded into the resource path, and no other reserved marker exists to disambiguate them. Consumers of this function's return value MUST NOT assume the result is always a valid deployment id (see the `ConversationPanelView` icon-tooltip fallback requirement below).

#### Scenario: Simple single-segment deployment

- **WHEN** `getModelIdFromConversationId('conversations/bucket/gpt-4__My%20chat')` is called
- **THEN** it returns `'gpt-4'`

#### Scenario: Multi-segment deployment ID

- **WHEN** `getModelIdFromConversationId('conversations/bucket/anthropic/claude-3__My%20chat')` is called
- **THEN** it returns `'anthropic/claude-3'`

#### Scenario: Title containing slashes

- **WHEN** `getModelIdFromConversationId('conversations/bucket/gpt-4__report%206/2/2026')` is called
- **THEN** it returns `'gpt-4'`

#### Scenario: Multi-segment deployment AND title with slashes

- **WHEN** `getModelIdFromConversationId('conversations/bucket/anthropic/claude-3__report%206/2/2026')` is called
- **THEN** it returns `'anthropic/claude-3'`

#### Scenario: No `__` separator → returns undefined

- **WHEN** `getModelIdFromConversationId('conversations/bucket/gpt-4-no-title')` is called
- **THEN** it returns `undefined`

#### Scenario: Fewer than 3 segments → returns undefined

- **WHEN** `getModelIdFromConversationId('bucket/gpt-4__title')` is called
- **THEN** it returns `undefined`

#### Scenario: Scheduled-task conversation strips the .scheduler/{scheduleId} prefix

- **WHEN** `getModelIdFromConversationId('conversations/bucket/.scheduler/64bd658b-4258-46bd-b19e-afd9e0f3f254/gemini-3.1-flash-lite__title__run-id')` is called
- **THEN** it returns `'gemini-3.1-flash-lite'`, not `'.scheduler/64bd658b-4258-46bd-b19e-afd9e0f3f254/gemini-3.1-flash-lite'`

#### Scenario: Scheduled-task conversation with a multi-segment deployment id strips the prefix

- **WHEN** `getModelIdFromConversationId('conversations/bucket/.scheduler/schedule-id/anthropic/claude-3__title__run-id')` is called
- **THEN** it returns `'anthropic/claude-3'`

### Requirement: Panel body renders conversations grouped into four collapsible sections

When `isOpen` is `true`, `ConversationPanel` SHALL render conversation items split into four collapsible sections:

- **Pinned** — items where `isPinned === true`, shown first.
- **My chats** — items where `source` is not `ConversationSource.Shared` or `ConversationSource.Organization` and `isPinned` is falsy.
- **Shared** — items where `source === ConversationSource.Shared` and `isPinned` is falsy.
- **Organization** — items where `source === ConversationSource.Organization` and `isPinned` is falsy.

Each section renders a disclosure button (chevron icon) as its header that toggles open/closed. All sections start expanded. When a section is collapsed, all items in that section SHALL be hidden regardless of whether any item in that section is the currently active conversation. A section with zero items after active search + tab filter SHALL be hidden. Each item SHALL display the conversation `title` (truncated) and its deployment icon according to the following rules:

- When `item.isIconLoading` is `true`, an animated skeleton placeholder MUST be shown in the icon slot instead of the deployment icon or fallback.
- When `item.isIconLoading` is `false` or `undefined` and `item.iconUrl` is set, the resolved image MUST be shown.
- When `item.isIconLoading` is `false` or `undefined` and `item.iconUrl` is absent, the default fallback icon MUST be shown.

When `item.iconTooltip` is provided and `item.isIconLoading` is `false` or `undefined`, the deployment icon SHALL show a tooltip with that text on hover. The item SHALL call `onSelectConversation(id)` when activated. The active conversation (matching `activeConversationId`) SHALL receive `aria-current="page"`. Section headings via optional `groupLabels?: { pinned?, myChats?, shared?, organization? }` (English defaults: `"Pinned"`, `"My chats"`, `"Shared"`, `"Organization"`).

`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` computes each row's `iconTooltip` as the resolved deployment's `displayName` when `findDeploymentByIdOrReference` finds a match for the id extracted by `getModelIdFromConversationId`. When no match is found (the deployment is unavailable, or the extracted id was contaminated by real conversation-folder path segments — see the `getModelIdFromConversationId` requirement above), `iconTooltip` SHALL fall back to only the **last** `/`-separated segment of the extracted id, percent-decoded — NOT the full extracted id/path — to avoid showing a misleading or unreadable full path as the tooltip.

#### Scenario: Renders pinned conversations in Pinned section

- **WHEN** `conversations` contains 2 items with `isPinned: true` and 3 without
- **THEN** the Pinned section shows 2 items and the My chats section shows 3 items

#### Scenario: Active conversation is marked

- **WHEN** `activeConversationId` matches one item's `id`
- **THEN** that item has `aria-current="page"`

#### Scenario: Clicking an item calls onSelectConversation

- **WHEN** the user clicks a conversation item
- **THEN** `onSelectConversation` is called with that item's `id`

#### Scenario: Icon skeleton shown when `isIconLoading` is true

- **WHEN** an item has `isIconLoading: true`
- **THEN** an animated skeleton placeholder renders in the icon slot

#### Scenario: Fallback tooltip shows only the last path segment when no deployment matches

- **GIVEN** `getModelIdFromConversationId` extracted `'YH folder01.1/YH folder01.2/YH folder01.3/dial-chathub-v2-gpt-5.5-2026-04-24'` for a row (contaminated by real conversation-folder segments) and no deployment in `deployments` has that `id` or `reference`
- **WHEN** `ConversationPanelView` computes that row's `iconTooltip`
- **THEN** `iconTooltip` is `'dial-chathub-v2-gpt-5.5-2026-04-24'` (the last segment, decoded), not the full extracted path

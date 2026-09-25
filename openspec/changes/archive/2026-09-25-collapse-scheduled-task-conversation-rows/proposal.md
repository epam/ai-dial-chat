## Why

Every run of a scheduled task writes its own conversation (`conversations/{bucket}/.scheduler/{scheduleId}/{deploymentId}__{title}__{runId}`), and the conversation panel renders each one as a separate row — a daily task adds a near-identical row every day and buries the user's own chats (GitHub issue #8934). The design has also moved on from the current "unread dot before the avatar + trailing `TASK` pill" treatment of a task row.

## Problem

- `GET /api/v1/conversations/list` returns one item per run and the host maps each one straight to a panel row (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx:585-600` → `libs/chat-hooks/src/conversation/useConversationPanelItems/useConversationPanelItems.ts:95-111`). Nothing groups runs by `scheduleId`.
- The list item exposes only `updatedAt`, while the requirement is "newest by **creation** date". `mapItems` in `apps/chat-api/src/conversations/listing/conversation-listing.service.ts` drops the `createdAt` DIAL Core already returns (`ResourceItemMetadata.createdAt`; mirrored by `ConversationMetadataDto.createdAt` at `apps/chat-api/src/openapi/openapi-response.dto.ts:687`).
- The task row renders the unread dot in a reserved slot **before** the avatar and a `TASK` pill via `iconAfter` (`libs/conversation-panel/src/components/ConversationRow/ConversationRow.tsx:138-173`), which no longer matches the design.

## Solution

1. **Expose `createdAt`** on `ConversationListItemDto` (optional epoch ms, passed through from DIAL Core metadata; absent for shared items, whose `getSharedResources` payload carries no dates).
2. **Collapse at the host's display layer only.** A pure app utility derives the panel's input from the full list: runs of one task (group key `bucket + scheduleId`) collapse to one representative — the newest by `createdAt`, falling back to `updatedAt`, then `id` for determinism. `ConversationsContext` keeps the **full** list, because `ActiveScheduledTaskContext` (`apps/chat/src/context/ActiveScheduledTaskContext.tsx:107-137`), the History unread mapping (`apps/chat/src/utils/map-scheduled-task-run-dto.ts:77-81`), `markConversationViewed` (`apps/chat/src/context/ConversationsContext.tsx:330-332`), `useActiveConversationSync` (`libs/chat-hooks/src/conversation/useActiveConversationSync/useActiveConversationSync.ts:52-80`), `Conversation.isReadOnly` (`apps/chat/src/pages/Conversation/Conversation.tsx:171-183`) and the overlay bridge all look runs up in it.
3. **Restyle the task row** in `@epam/ai-dial-conversation-panel` with schedule-agnostic props: an optional host-supplied leading icon, a heavier title weight while unread, the unread indicator moved to the row's trailing edge, and no pill.

## What Changes

- `ConversationListItemDto` gains optional `createdAt: number`; OpenAPI + generated `chat-api-client` regenerated.
- New app utility `collapseScheduledTaskConversations` (in `apps/chat/src/utils/`, following the pure-helper pattern of `map-scheduled-task-run-dto.ts`) applied in `ConversationPanelView` to the `items` passed to `useConversationPanelItems` only. `useActiveConversationSync` keeps receiving the full list.
  - Pinned runs are never collapsed (a pin is an explicit user choice to keep that run visible).
  - When the active route conversation is an older run of a task, that run stands in as the task's representative so the open conversation stays highlighted in the panel.
- Deleting the representative promotes the next run automatically — it is a pure derivation of the full list.
- **BREAKING (`@epam/ai-dial-conversation-panel`, 0.x):** remove `ConversationItem.showTaskBadge`, `ConversationItem.taskBadgeLabel`, `ConversationColors.taskBadgeBorder|taskBadgeBackground|taskBadgeText`, and `ConversationPanelStyles.taskBadgeClassName`. Add `ConversationItem.leadingIcon?: ReactNode` (replaces the deployment avatar when set). `isUnread` now renders a trailing indicator plus heavier title weight; `unreadDot` color stays.
- **BREAKING (`@epam/ai-dial-chat-hooks`):** `useConversationPanelItems`'s `resolveTaskBadge` is replaced by `resolveTaskPresentation?: (item) => { leadingIcon?: ReactNode; isUnread: boolean } | undefined`.
- i18n: `conversationPanel.taskBadgeLabel` is removed; `conversationPanel.unreadIndicatorLabel` is reused. No new user-visible strings (the new icon is decorative and `aria-hidden`).

## Non-goals

- No server-side collapsing and no change to `GET /api/v1/conversations/list` item count, ordering, or pagination.
- No change to the task detail page / sources-panel History list or its per-run unread marks.
- Search stays lib-internal and matches the surviving row only (the lib remains schedule-agnostic); runs of one task normally share the task title.
- No grouping of scheduler conversations that are shared with or published to the user beyond the same `bucket + scheduleId` rule.

## Alternatives considered

| Option | Verdict |
|---|---|
| **A. Collapse in the BFF listing service** (issue's preferred option) | Rejected. Removing runs from the list breaks every consumer above: an older run opened from History resolves as `NotATaskConversation` (no banner, no History), loses its unread mark, cannot be marked viewed, and triggers a refresh loop attempt in `useActiveConversationSync`. The pagination argument does not apply — the frontend always calls `listConversations()` without `limit`/`nextToken` (`ConversationsContext.tsx:139`). |
| **B. Collapse in `ConversationsContext`** (store both lists) | Rejected. Adds a second list to a global provider for a purely presentational concern; every consumer must pick the right one. |
| **C. Collapse in `libs/chat-hooks` `useConversationPanelItems`** | Viable, but moves a product rule (what counts as "one task") into a published lib's public API before a second host needs it. Can be promoted later without a contract change. |
| **D. Display-level derivation in the host (chosen)** | Smallest blast radius, full list untouched, deletion promotion is free, trivially reversible. |

Ordering key: `createdAt` (from DIAL Core) is chosen over `updatedAt` (a reply inside an old run would resurrect it) and over scheduler run start time (requires a per-task runs fetch the panel does not make).

## Acceptance criteria

- The panel shows at most one unpinned row per `bucket + scheduleId`; it is the newest run by `createdAt` (fallback `updatedAt`, then `id`), or the active run when the route points at one of that task's runs.
- Two tasks never collapse into each other; non-task conversations are untouched; pinned runs each keep their own row.
- Deleting the representative shows the next newest run; the task disappears only when it has no conversations left.
- Opening an older run from History still shows the task banner/History and marks it read.
- A task row renders the host-supplied leading icon (`aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`), a heavier title while unread, a trailing unread indicator with a visually-hidden "Unread" label, and no pill; layout holds in RTL and on mobile.
- `ConversationListItemDto.createdAt` is in the OpenAPI document; `npm run openapi:check` passes; `chat-api-client` rebuilt.
- `libs/conversation-panel/README.md`, `libs/chat-hooks/README.md` and `docs/architecture.md` (if it describes the list contract) updated; `npm run validate:docs` passes.
- Unit tests cover collapsing, non-collapsing, pinned, active-run substitution, fallback ordering, deletion promotion, and the new row rendering.

## Capabilities

### New Capabilities

- `scheduled-task-conversation-grouping`: host-side display rule that collapses a scheduled task's run conversations to one representative panel row while the full list stays available to every other consumer.

### Modified Capabilities

- `conversations-api`: `ConversationListItemDto` gains optional `createdAt`.
- `conversation-history-panel`: the TASK-badge requirement is replaced by a task-row presentation requirement (leading icon, heavier unread title, trailing unread indicator); the unread-dot requirement moves the indicator to the row end.
- `chat-hooks-conversation-panel-controller`: `useConversationPanelItems`'s `resolveTaskBadge` is replaced by `resolveTaskPresentation`.

## Impact

- **Backend:** `apps/chat-api/src/conversations/dto/conversation-list.dto.ts`, `listing/conversation-listing.service.ts` (+ tests), OpenAPI artifact, `libs/chat-api-client` regeneration.
- **App:** new `apps/chat/src/utils/collapse-scheduled-task-conversations.ts` (+ tests), `ConversationPanelView.tsx`, `translation-keys.ts`, `en.json` (key removal).
- **Shared libs (scope flag):** `libs/conversation-panel` (row rendering, props, SCSS, README — breaking), `libs/chat-hooks` (`useConversationPanelItems` signature, README — breaking). Host knowledge stays out of both: the lib receives a ready `ReactNode` icon and a boolean `isUnread`; neither lib learns about schedules, buckets, or the grouping rule.
- **Design dependency:** exact icon, title weight token, and trailing-indicator size/color must be confirmed against Figma before the lib slice; the spec fixes behavior and a11y, not the final tokens.
- **Rollback:** backend field is additive and optional. The collapse is a single memo in `ConversationPanelView` and can be reverted alone. The lib restyle ships as one commit per lib; reverting restores the previous props (host must revert its mapping in the same revert).

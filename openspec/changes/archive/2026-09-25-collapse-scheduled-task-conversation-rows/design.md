## Context

DIAL Scheduler writes one conversation per run under `conversations/{bucket}/.scheduler/{scheduleId}/{...}/{deploymentId}__{title}__{runId}`. The BFF already tags such items (`isScheduledTask`, `scheduleId`, `runId`, `isUnread`) in `ConversationListingService.listConversations` via `parseScheduledTaskConversationPath`. The host loads the **complete** list once (`listConversations()` without `limit`/`nextToken`, `apps/chat/src/context/ConversationsContext.tsx:139`) and keeps it in `ConversationsContext`.

That full list is a lookup table for much more than the panel:

| Consumer | Uses the list to |
|---|---|
| `ActiveScheduledTaskContext` (`apps/chat/src/context/ActiveScheduledTaskContext.tsx:107-137`) | decide whether the routed conversation is a task run → banner, sources panel, History |
| `mapScheduledTaskRunDtosToItems` (`apps/chat/src/utils/map-scheduled-task-run-dto.ts:77-81`) | resolve per-run `isUnread` in History |
| `ConversationsContext.markConversationViewed` (`:330-332`) | no-op unless the item is listed and unread |
| `useActiveConversationSync` (`libs/chat-hooks/.../useActiveConversationSync.ts:52-80`) | refresh when the active conversation is missing; mark it viewed |
| `Conversation.isReadOnly` (`apps/chat/src/pages/Conversation/Conversation.tsx:171-183`) | read ownership flags |
| overlay `useConversationListBridge` | expose conversations to embedding hosts |

The panel itself is `ConversationPanelView` → `useConversationPanelItems` (`libs/chat-hooks`) → `ConversationPanel`/`ConversationRow` (`libs/conversation-panel`). Search and tab filtering happen inside the lib on the items it is given (`ConversationPanel.tsx:236`).

## Goals / Non-Goals

**Goals:**
- One panel row per scheduled task, chosen by creation time, with no regression in any consumer of the full list.
- `createdAt` available on list items as a reliable ordering key.
- New task-row presentation expressed as schedule-agnostic lib props.

**Non-Goals:**
- Server-side collapsing, pagination changes, or new endpoints.
- Changes to the task detail page / sources-panel History.
- Search across hidden runs.

## Decisions

### D1. Collapse at the display layer in the host, not in the BFF or context

`collapseScheduledTaskConversations` is a pure function in `apps/chat/src/utils/`, applied in `ConversationPanelView` via `useMemo` to the `items` passed to `useConversationPanelItems` only. `useActiveConversationSync` keeps receiving the full `items`.

*Alternatives:* BFF collapsing breaks every row of the table above (an older run opened from History would lose its banner, unread mark, and mark-viewed); a second list in `ConversationsContext` widens a global provider for a presentational rule; putting the rule in `libs/chat-hooks` publishes a product rule before a second host needs it. See the proposal's alternatives table.

*Consequence:* deletion promotion needs no code — `deleteConversation` already removes the row from the full list and the memo recomputes.

### D2. Group key `bucket + scheduleId`; bucket parsed from the item id

`scheduleId` is unique per owner, not globally; a run shared from another user could carry the same id. The bucket is the second decoded segment of `id` (`conversations/{bucket}/...`). A small helper parses it; ids that do not match fall back to "not groupable" rather than guessing.

*Alternative:* adding `bucket` to the DTO — rejected as unnecessary contract growth; the id already encodes it.

### D3. Ordering: `createdAt` → `updatedAt` → `id`

`createdAt` comes from DIAL Core `ResourceItemMetadata.createdAt` and is copied in `mapItems`. Shared items have no dates (`getSharedResources` returns only `nodeType/name/url/parentPath`), so ordering degrades to `updatedAt` (0) and then `id` to stay deterministic across renders. `runId` is a UUID and carries no order, so it is not used.

*Alternatives:* `updatedAt` only — a reply in an old run would resurrect it; scheduler run `startTime` — needs a per-task runs fetch the panel never makes.

### D4. Pinned runs are exempt; the active run substitutes

- A pin is an explicit user decision; collapsing a pinned run would silently hide it. Pinned runs render in the Pinned section as individual rows, and the newest **unpinned** run represents the task in its normal section.
- When the route points at an older run (typically opened from History), that run becomes the representative so the panel highlights what the user is looking at, and rename/share/delete on that row act on the open conversation. When the user navigates away, the representative reverts to the newest.

Both confirmed by product on 2026-09-25.

### D5. The row reflects its own conversation only

The representative's `isUnread` drives the dot; older unread runs do not propagate. Per-run unread state stays visible in History, which is unaffected because it reads the full list.

### D6. Lib API for the new row: `leadingIcon?: ReactNode`

`ConversationItem.leadingIcon` replaces the deployment avatar when present. The host renders the Tabler icon (`stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden`) and passes the node; the lib has no "task" concept. `isUnread` moves the dot to the trailing edge and applies a heavier title class. The removed props (`showTaskBadge`, `taskBadgeLabel`, `taskBadge*` colors, `taskBadgeClassName`) and the pre-avatar 12×12 reserved slot go away together.

*Alternatives:* a `variant: 'task'` enum in the lib — leaks the schedule concept into the lib; keeping `showTaskBadge` and re-interpreting it — silent behavior change under an old name, worse than an explicit break. The package is `0.0.1`, so a breaking minor is acceptable; hosts get a compile error rather than a silent visual regression.

`libs/chat-hooks` passes the `ReactNode` through `resolveTaskPresentation` without rendering anything itself, which keeps it inside its isolation exception (no UI-kit rendering import). `ReactNode` is a type-only import from `react`, already a peer.

### D7. Tokens (confirmed against Figma `chat-panel-item`, 2026-09-25)

- **Leading icon:** the app's existing `ScheduledTasksIcon` (`apps/chat/src/components/Icons/ScheduledTasksIcon`) — its path matches the Figma `scheduled-tasks` vector — at 16px, `stroke={DIAL_KIT_ICON_STROKE}` (1.5), color `var(--text-visual-blue, #1189C8)`, inside a 24×24 box with 4px padding, 8px radius, background `var(--bg-visual-blue, #D6EDF9)`. The host renders the whole box (it is the `leadingIcon` node); the lib only reserves the 24px avatar footprint.
- **Unread title:** `dial-small-semi-text` (Inter 600, 14/24), color unchanged (`--cp-text` → `--text-primary`).
- **Trailing indicator:** a 24×24 centered container holding a `7.11px` round dot filled with `--cp-unread-dot` → `--text-accent` (`#1D4ED8`).
- **Row:** 32px high, 8px gap, 12px start padding (the former `ps-0` + 12px pre-avatar slot is replaced by plain `ps-3`, keeping the avatar at the same x offset).
- **Hover / focus / open menu (not in the design, decided here):** the dot hides and the actions trigger takes the same trailing 24px spot; the `sr-only` "Unread" label stays in the accessibility tree. This avoids the dot jumping when the end padding widens for the trigger.

### Loading, empty, error states

No new surface. While the list loads the panel shows its existing skeleton; an empty list or a list with only task runs renders normally. `leadingIcon` rows ignore `isIconLoading` (the host icon needs no deployment lookup). No new endpoint → no new authorization.

## Risks / Trade-offs

- [The panel no longer lists every conversation the context holds] → documented in the grouping spec and in a comment at the memo; any new consumer that needs "all conversations" reads the context, never the panel items.
- [Search cannot find an older run whose title diverged (renamed or LLM-titled)] → accepted non-goal; the run is still reachable from the task's History. Revisit if product asks.
- [Active-run substitution makes the task row change title/unread state on navigation] → limited to that task's row; covered by tests; easy to drop if product disagrees.
- [Shared runs lack dates, so "newest" is id-order] → rare (tasks are private by default); deterministic, never flickers.
- [Breaking lib props break external hosts] → 0.x version, README migration note, compile-time failure instead of silent drift.
- [`createdAt` absent on older DIAL Core versions] → field optional; ordering falls back to `updatedAt`, matching today's behavior.

## Migration Plan

1. Ship the BFF field + regenerated client (additive, safe alone).
2. Ship the host collapse (uses `createdAt` when present; safe alone).
3. Ship lib + chat-hooks restyle and host mapping in one change (breaking lib API, host updated in the same commit; READMEs and `validate:docs` in the same commit).

Rollback: each step reverts independently in reverse order; step 3 must revert the lib and the host mapping together.

## Open Questions

Resolved 2026-09-25: pinned runs stay exempt and active-run substitution stays (confirmed by the user); design tokens confirmed (D7). No open questions remain.

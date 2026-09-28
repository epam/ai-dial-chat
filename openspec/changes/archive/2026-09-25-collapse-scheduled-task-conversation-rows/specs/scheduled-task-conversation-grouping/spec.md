## ADDED Requirements

### Requirement: The conversation panel shows one representative row per scheduled task

`apps/chat` SHALL export a pure function `collapseScheduledTaskConversations(items: ConversationListItemDto[], options: { activeConversationId?: string; conversationIdsMatch: (a: string, b: string) => boolean }): ConversationListItemDto[]` from `apps/chat/src/utils/collapse-scheduled-task-conversations.ts`. It has no React, i18n, context, or network dependency.

**Group key.** An item belongs to a group when `isScheduledTask === true` and `scheduleId` is a non-empty string. The group key is `${bucket}/${scheduleId}`, where `bucket` is the segment following the `conversations` resource-type segment of the item's decoded `id` (`conversations/{bucket}/.scheduler/{scheduleId}/...`). Items that are not scheduled-task conversations, or that lack `scheduleId`, are never grouped.

**Pinned runs are exempt.** An item with `isPinned === true` is never collapsed: it is returned as-is and does not count as a group member when choosing the representative among unpinned runs.

**Representative.** Among the unpinned members of a group, the function SHALL keep exactly one:

1. the member matching `activeConversationId` (via `conversationIdsMatch`), when one exists; otherwise
2. the member with the greatest `createdAt`; members without `createdAt` sort after members with it;
3. ties (including both missing) are broken by the greatest `updatedAt`, then by `id` in descending lexicographic order, so the result is deterministic.

**Order preservation.** The returned array SHALL preserve the relative order of the input for every kept item (the representative takes no new position; the panel's own ordering/grouping still applies). All non-kept group members are omitted. The input array is not mutated.

**Ownership.** The full, uncollapsed list remains owned by `ConversationsContext` and SHALL NOT be replaced or filtered in the context. Only the `items` argument passed to `useConversationPanelItems` in `ConversationPanelView` is collapsed; `useActiveConversationSync`, `ActiveScheduledTaskContext`, the History run mapping (`mapScheduledTaskRunDtosToItems`), `Conversation.isReadOnly`, and the overlay conversation-list bridge keep reading the full list.

**Memoisation.** `ConversationPanelView` SHALL compute the collapsed list with `useMemo` keyed on the context list reference, the active conversation id, and the (stable) `conversationIdsMatch`, so `useConversationPanelItems`' memoised output stays referentially stable when inputs are unchanged.

**Feature flag.** Collapsing is not gated by `ENABLED_FEATURES` / `scheduledTasksEnabled`: scheduler conversations exist and appear in the panel regardless of that flag (same rule as the previous TASK badge), so the collapsing applies regardless of it too.

**Observability.** None required — a pure client-side derivation with no new requests.

**Cache.** None — no new cached data.

#### Scenario: Several runs of one task collapse to the newest by createdAt

- **GIVEN** three unpinned items with the same bucket and `scheduleId: "s1"` and `createdAt` 100, 300, 200
- **WHEN** `collapseScheduledTaskConversations` runs with no active conversation
- **THEN** only the item with `createdAt: 300` is returned for `s1`

#### Scenario: createdAt beats updatedAt

- **GIVEN** run A with `createdAt: 100, updatedAt: 900` (the user replied in it later) and run B with `createdAt: 200, updatedAt: 200` of the same task
- **WHEN** the function runs
- **THEN** run B is the representative

#### Scenario: Missing createdAt falls back to updatedAt, then id

- **GIVEN** two shared runs of one task with no `createdAt` and `updatedAt: 0`, ids `conversations/u/.scheduler/s1/m__t__a` and `conversations/u/.scheduler/s1/m__t__b`
- **WHEN** the function runs
- **THEN** the item with id ending `__b` is the representative, on every invocation

#### Scenario: Two tasks do not collapse into each other

- **GIVEN** one run of `scheduleId: "s1"` and one run of `scheduleId: "s2"` in the same bucket
- **WHEN** the function runs
- **THEN** both items are returned

#### Scenario: Same scheduleId in different buckets does not collapse

- **GIVEN** a run of `s1` in the user's bucket and a run of `s1` shared from another user's bucket
- **WHEN** the function runs
- **THEN** both items are returned

#### Scenario: Non-task conversations are untouched

- **GIVEN** a list with ordinary conversations interleaved with task runs
- **WHEN** the function runs
- **THEN** every ordinary conversation is returned, in its original relative order

#### Scenario: Pinned runs keep their own rows

- **GIVEN** run A (pinned, oldest) and runs B, C (unpinned) of one task, C newest
- **WHEN** the function runs
- **THEN** A and C are returned and B is omitted

#### Scenario: The active older run stands in for its task

- **GIVEN** runs B (older) and C (newest) of one task and `activeConversationId` matching B
- **WHEN** the function runs
- **THEN** B is returned for that task and C is omitted

#### Scenario: Deleting the representative promotes the next run

- **GIVEN** runs A (`createdAt: 100`) and B (`createdAt: 200`) of one task and the panel showing B
- **WHEN** B is deleted and removed from the context list
- **THEN** the recomputed panel list shows A for that task

#### Scenario: A task disappears only when it has no conversations left

- **GIVEN** a task whose only remaining conversation is deleted
- **WHEN** the panel list is recomputed
- **THEN** no row for that task is shown

#### Scenario: Opening an older run from History keeps task context

- **GIVEN** a task with runs B (older, unread) and C (newest) and the panel showing only C
- **WHEN** the user opens B from the task's History panel
- **THEN** `ActiveScheduledTaskContext` resolves B as a task conversation (banner and History render), B is marked viewed via `markConversationViewed`, and the panel shows B as that task's row (active-run substitution)

#### Scenario: Input is not mutated

- **WHEN** the function runs on a frozen input array
- **THEN** no error is thrown and a new array is returned

# Proposal

## Why

Issue #9264: when a scheduled task's owner shares several run results with another user, the recipient sees only one of them — the others look overwritten. The collapse added for #8934 groups runs by `bucket + scheduleId`; every run shared from one owner has the same pair, so they merge into one row. The owner can still reach older runs through the task's History, but the recipient cannot: `getScheduledTask` returns 404 for a task they do not own (`ActiveScheduledTaskContext` → "Task details are unavailable"), so the hidden shared runs have no other way in. The #8934 design listed this as an accepted risk ("shared runs … rare"); QA has now hit it.

## Problem

- `getGroupKey` in `apps/chat/src/utils/collapse-scheduled-task-conversations.ts` treats a shared or published run like the user's own run.
- Shared runs carry no dates, so the representative among them is picked by `id` order — arbitrary from the recipient's point of view.
- The user explicitly received each shared result; hiding all but one loses data the user was given.

## Solution

Exempt runs the user did not produce themselves from collapsing: any item with `sharedWithMe === true` or `publishedWithMe === true` is returned as its own row, exactly like a pinned run. The user's own runs keep collapsing to the newest one, with History as the way to older ones.

Alternatives considered:

| Option | Verdict |
|---|---|
| Exempt `sharedWithMe` / `publishedWithMe` items (chosen) | Smallest change; mirrors the pinned-runs exemption; uses flags already on `ConversationListItemDto`. |
| Stack with an in-row switcher for the recipient | Needs a run-list source the recipient does not have and a new design; deferred, not needed to fix the bug. |
| Keep collapsing, expose hidden shared runs elsewhere | Same missing data source; more UI for the same outcome. |

## Non-goals

- The duplicate flow (`ConversationLifecycleService.duplicateConversation` keeps the `.scheduler/{scheduleId}` folder, so repeat copies of a shared run look like task runs again — the second case in #9264). Tracked as a separate follow-up.
- Any stack / switcher UI for shared runs.
- Changes to the BFF, the DTO, `ConversationsContext`, or `libs/*`.

## What Changes

- `collapseScheduledTaskConversations` / `groupScheduledTaskConversations` never group items with `sharedWithMe` or `publishedWithMe`.
- Spec `scheduled-task-conversation-grouping` gains the exemption (the Group key, Representative and two-phase paragraphs are reworded to match); the scenario that collapsed two shared runs is replaced by owned-run and shared-run scenarios.
- Unit tests cover shared, published, and shared-next-to-own cases.

No **BREAKING** changes. Rollback: revert the commit; behavior returns to the #8934 state.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `scheduled-task-conversation-grouping`: shared and published runs are exempt from collapsing; only the user's own runs form a group.

## Impact

- Code: `apps/chat/src/utils/collapse-scheduled-task-conversations.ts` and its spec `apps/chat/src/utils/tests/collapse-scheduled-task-conversations.spec.ts` (pattern: the existing pinned exemption in the same file).
- Libs / globals: none; `libs/conversation-panel` stays schedule-agnostic, `ConversationsContext` keeps the full list.
- i18n: no new strings. RTL: none (no UI change). Feature flags: unchanged (collapsing is not gated by `scheduledTasksEnabled`).
- Docs: the capability spec only; `docs/architecture.md` does not describe this rule.

## Acceptance criteria

- Two or more runs of one task shared with the user each appear as their own row.
- Published runs likewise.
- A shared run never replaces or hides the user's own newest run of a same-id task, and vice versa.
- The user's own runs still collapse to one row; pinned and active-run behavior is unchanged.
- `npm run validate:specs` and the unit tests pass.

Related: #8934, #9264.

## ADDED Requirements

### Requirement: Sources sidebar open state is reset by the resolved scheduleId, not the conversation id

The sources sidebar's open state SHALL NOT be reset by a change of the raw route conversation id. Instead, the reset SHALL be keyed on the resolved subject of the sidebar: the `scheduleId` of the active conversation, resolved exactly as `ActiveScheduledTaskContext` resolves it (canonical conversation-list lookup; non-task, flag-disabled, and not-yet-loaded conversations all resolve to no `scheduleId`).

The reset rule SHALL be:

- The active conversation resolves to **no `scheduleId`** → the sidebar SHALL close. This covers normal-to-normal, task-to-normal, and normal-to-task navigation, reproducing today's behavior exactly (the pre-change unconditional close of issue #7213/#7936), and covers a task conversation whose list entry has not loaded yet (no hold-open limbo). It also covers a route that resolves to no conversation id at all (bare `/conversations`, a malformed path segment) — the panel stays mounted on those routes, and the reset rule SHALL close there just as the pre-change conversation-id effect did; leaving `/conversations/*` entirely unmounts the panel, so that close stays owned by the Conversation page's unmount cleanup.
- The resolved `scheduleId` **changes** (different task) → the sidebar SHALL close.
- The resolved `scheduleId` is **unchanged** (switch between runs of the same task) → the sidebar SHALL stay open; its content continues to follow the active conversation through the existing `ActiveScheduledTaskContext`/run-history behavior with no additional close logic.

The close SHALL NOT be implemented as an effect keyed on `conversationId` in `Conversation.tsx`; ownership of the reset SHALL live in the sidebar/active-task context layer that already resolves the scheduleId. The existing unmount cleanup (closing the sidebar when leaving the `/conversations/*` routes) SHALL be preserved unchanged. The rule SHALL NOT affect the sidebar's open behavior: the sidebar still opens only by explicit user action, and the user's manual close is unaffected.

#### Scenario: Switching between runs of the same task keeps the sidebar open

- **WHEN** the sources sidebar is open on a scheduled-task run conversation and the user activates another run of the same task in the sidebar's own History list
- **THEN** the sidebar stays open, its Details and History content updates to the newly active run, and no close occurs

#### Scenario: Same-task run switch via conversation panel keeps the sidebar open

- **WHEN** the sources sidebar is open on a scheduled-task run conversation and the user navigates (conversation panel row, browser back/forward, or direct URL) to a different conversation of the same `scheduleId`
- **THEN** the sidebar stays open

#### Scenario: Switching to a different task closes the sidebar

- **WHEN** the sources sidebar is open on a scheduled-task run conversation and the user activates another task's conversation in the conversation panel
- **THEN** the sidebar closes (no reopen), matching the behavior of navigating to a normal conversation

#### Scenario: Switching from a task conversation to a normal conversation closes the sidebar

- **WHEN** the sources sidebar is open on a scheduled-task run conversation and the user navigates to a non-task conversation
- **THEN** the sidebar closes

#### Scenario: Normal-to-normal conversation switch still closes the sidebar

- **WHEN** the sources sidebar is open and the user switches from one non-task conversation to another
- **THEN** the sidebar closes (the pre-change #7213/#7936 behavior is preserved; the rule is "close when the current conversation resolves to no scheduleId", not "close when scheduleId changed")

#### Scenario: Unresolved conversation entry closes the sidebar

- **WHEN** the sidebar is open on a scheduled-task run conversation and the user navigates to a conversation whose list entry has not loaded (or the task feature flag is disabled), or to a route that resolves to no conversation id (bare `/conversations`, a malformed path segment)
- **THEN** the sidebar closes — there is no state in which the sidebar lingers open awaiting a resolution

#### Scenario: Leaving the conversations routes closes the sidebar

- **WHEN** the sidebar is open and the user navigates away from `/conversations/*` (e.g. back to the Scheduled Tasks page)
- **THEN** the existing unmount cleanup still closes the sidebar

#### Scenario: The reset rule introduces no new open behavior

- **WHEN** the user navigates between conversations of any kind without having opened the sidebar
- **THEN** the sidebar remains closed; nothing auto-opens it

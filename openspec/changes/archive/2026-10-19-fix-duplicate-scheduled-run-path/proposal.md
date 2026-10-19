# Proposal

## Why

Issue #9264 ("Additional case 2"): duplicating a scheduled-task run twice produces a chat that shows the scheduler icon and the "Task details are unavailable" banner, and further duplicates stack into one conversation-panel row. For the task owner the same bug is worse: a fake run can be picked as the task's newest and hide the real latest run.

## Problem

`ConversationLifecycleService.duplicateConversation` (`apps/chat-api/src/conversations/lifecycle/conversation-lifecycle.service.ts`) copies into the caller's bucket and keeps every source folder segment, including `.scheduler/{scheduleId}`. The copy's path is `{deploymentKey}__{title}`, plus `__{uuid}` only when that path is taken. So:

1. The 1st copy has no UUID suffix; `parseScheduledTaskConversationPath` returns `null` for it and it is an ordinary chat that happens to live under `.scheduler/…`.
2. The 2nd copy collides with the 1st, gets a collision UUID, and the parser reads that UUID as a `runId`. `isScheduledTask`, `scheduleId` and `runId` are set, the host shows the task icon and fetches the task by `scheduleId` (404 for a non-owner, hence "unavailable"), and `collapseScheduledTaskConversations` groups these fake runs by `bucket + scheduleId`.

Duplicate predates the scheduler feature (June–July vs. August 2026); no spec covers duplicating a run. This is a gap, not a decision.

## Solution

In `duplicateConversation`, when the source folder segments start with `.scheduler` followed by at least one more segment, drop those two leading segments from the destination. Keep any remaining folders (`applications/{bucket}/...` for application runs). Derive the existence check, destination path, saved `id` and saved `folderId` from the stripped segments. The copy becomes an ordinary chat at the root of the caller's bucket, where all other chats live; the original run is untouched.

Findings that shaped this (read from code):

- DIAL Core writes the run's conversation (`create_conversation: true` in the scheduler payload), so the saved body is a standard conversation; `ConversationResponseDto` has no scheduler-specific field. The copy keeps the model and messages, so continuing it behaves like continuing the run (replying in runs is already supported, #9310).
- `.scheduler` is referenced at runtime in exactly three places: the parser, `isApplicationDeploymentPath` and `libs/chat-hooks/src/conversation/get-model-id-from-conversation-id.ts`. The last two already handle paths without the prefix.
- The conversation list DTO has no folder field, so the panel is flat and the copy looks like any other chat.
- `renameConversation` does not change paths; publish builds its target from the caller-chosen public folder plus only the resource name (`conversation-publish.service.ts`), so neither can create `.scheduler` paths. Duplicate is the only operation that derives a new path from an existing one.

Alternatives considered:

| Option | Verdict |
|---|---|
| Strip the `.scheduler/{scheduleId}` prefix in duplicate (chosen) | Fixes the root cause, covers owner and recipient, one function, no contract change. |
| Keep the path, use a non-UUID collision suffix | Fragile (depends on the strict UUID check) and leaves copies in a namespace owned by the Scheduler. |
| Stricter parser / list | No reliable signal separates a run from a copy; changes a spec'd path-only contract. |
| Check `scheduleId` against `listScheduledTasks` on the client | Extra request and failure modes; does not help the owner duplicating their own run. |
| Block duplicate for runs | Removes a legitimate action (recipients want a private, continuable copy). |

## Non-goals

- Healing copies created before this change: they cannot be told apart from real runs and are not migrated.
- Parser changes, frontend changes, blocking duplicate, a stack/switcher UI, an ownership check against `listScheduledTasks`.

## What Changes

- `duplicateConversation` drops a leading `.scheduler/{scheduleId}` from the destination folder path (see Solution).
- Spec `duplicate-conversation` gains a requirement and scenarios for this; `auto-index-duplicate-names` gets the folder-preservation rule reworded with the exception.
- Unit tests in `apps/chat-api/src/conversations/lifecycle/tests/conversation-lifecycle.service.spec.ts` (pattern: the existing "preserves nested deployment paths when duplicating" case).

No **BREAKING** changes. Rollback: revert the commit; behavior returns to the current one.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `duplicate-conversation`: a copy of a scheduled-task run is stored without the reserved scheduler prefix and is an ordinary conversation.
- `auto-index-duplicate-names`: "the duplicate stays in the source folder" gets the `.scheduler` exception.

## Impact

- Code: `apps/chat-api/src/conversations/lifecycle/conversation-lifecycle.service.ts` and its spec. Backend only; no DTO, OpenAPI or generated-client change expected (the response shape is unchanged; confirm with `npm run openapi:check`).
- Libs / frontend: none. i18n and RTL: none (no UI change). Feature flags: none.
- Docs: only the two capability specs; `docs/architecture.md` does not describe duplicate paths.

## Acceptance criteria

- Duplicating an own or shared run yields a copy without `.scheduler` in its path, `isScheduledTask: false` in the list, and no task icon or banner.
- A second and third duplicate of the same run never look like runs.
- Application runs keep `applications/...`; ordinary folders are untouched; `folderId` matches the stored path.
- The original run is unchanged; replying in the copy works with the same model (manual check).
- `npm exec nx test chat-api`, `npm run validate:specs` and lint pass.

Related: #9264, #8934, #9310, PR #9451 (shared and published runs are no longer collapsed).

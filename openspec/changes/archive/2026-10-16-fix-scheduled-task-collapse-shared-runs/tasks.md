## 1. Tests first

- [x] 1.1 In `apps/chat/src/utils/tests/collapse-scheduled-task-conversations.spec.ts`, rewrite the case that collapses two `sharedWithMe` runs so it uses two own runs (same expectation: id order picks `b`).
- [x] 1.2 Add cases: two shared runs of one task both kept; two published runs both kept; a shared run next to two own runs of the same `scheduleId` keeps the shared run and only the newest own run.
- [x] 1.3 Add a case checking `applyActiveScheduledTaskRun` with a shared run active leaves the collapsed list reference unchanged. Run the spec and confirm the new cases fail.

## 2. Implementation

- [x] 2.1 In `apps/chat/src/utils/collapse-scheduled-task-conversations.ts`, add one predicate for "collapsible run" (not pinned, not `sharedWithMe`, not `publishedWithMe`) and use it in both `groupScheduledTaskConversations` and `keepRepresentatives`.
- [x] 2.2 Update the file's JSDoc rules paragraph to mention the shared and published exemption.

## 3. Verification

- [x] 3.1 Run the spec with `npm exec nx test chat -- --run src/utils/tests/collapse-scheduled-task-conversations.spec.ts` and confirm it passes.
- [x] 3.2 Run `npm run validate:specs` and `npm exec nx lint chat`.
- [x] 3.3 Manual check with two accounts: share two runs of one task, confirm the recipient sees two rows; confirm the owner still sees one row.

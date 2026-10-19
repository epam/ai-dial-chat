## 1. Tests first

- [x] 1.1 In `apps/chat-api/src/conversations/lifecycle/tests/conversation-lifecycle.service.spec.ts` (next to "preserves nested deployment paths when duplicating"), add: duplicating `.scheduler/sched_abc/gpt-4o__Title__<uuid>` saves at the bucket root with `id` `{bucket}/gpt-4o__Title` and `folderId` `{bucket}`.
- [x] 1.2 Add: a source from another bucket (shared run) is saved in the session bucket without `.scheduler`.
- [x] 1.3 Add: a second duplicate (clean path exists) gets `__<uuid>` at the root, not under `.scheduler`.
- [x] 1.4 Add: an application run `.scheduler/sched_abc/applications/{bucket}/{app}__0.0.1__{title}__<uuid>` keeps `applications/{bucket}` and `folderId` `{bucket}/applications/{bucket}`.
- [x] 1.5 Add: ordinary folders and a bare `.scheduler` folder (no second segment) are unchanged. Run the spec and confirm the new cases fail.

## 2. Implementation

- [x] 2.1 In `apps/chat-api/src/conversations/lifecycle/conversation-lifecycle.service.ts`, derive `destinationFolderSegments` as in design D1 and use it for the existence check, destination paths and `folderId`; leave the source read and `isApplicationDeployment` on the original segments.
- [x] 2.2 Add a short comment (a `//` line if it fits one line, a `/* */` block otherwise) explaining why the reserved prefix is dropped: a UUID-suffixed copy under `.scheduler` is read as a run.

## 3. Verification

- [x] 3.1 Run the lifecycle spec, then `npm exec nx test chat-api` and `npm exec nx lint chat-api`.
- [x] 3.2 Run `npm run validate:specs`; run `npm run openapi:check` to confirm no contract drift.
- [x] 3.3 Manual check: duplicate a run (own and shared) twice; confirm no task icon or banner, no grouping with the task's runs, the original is unchanged, and a message sent in the copy is answered by the same model.

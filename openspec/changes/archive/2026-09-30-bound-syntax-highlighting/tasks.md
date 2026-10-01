## 1. Bounded highlighting slice

- [x] 1.1 Add the pure eligibility utility and export in libs/chat-shared/src, integrate with MarkdownCodeBlock and libs/attachment-canvas/src/components/CodeContent/CodeContent.tsx, and document limits in both READMEs. Keep host integration out of libraries and relative TypeScript imports extensionless.
- [x] 1.2 Add boundary, newline, oversized-input, transition, and complete-copy/download tests. Verification: npm run test:file -- libs/chat-shared/src/utils/tests/syntax-highlighting.spec.ts libs/chat-shared/src/components/MarkdownRenderer/tests/MarkdownCodeBlock.spec.tsx libs/attachment-canvas/src/components/CodeContent/tests/CodeContent.spec.tsx. Run npm run verify:changed after this slice.

## 2. Deferred disclosure slice

- [x] 2.1 Conditional-mount content in StageItem, StageGroupRow, and CollapsedGroup under libs/conversation-stages/src/components; preserve streaming defaults, add disclosure relationships, and document lifecycle in README.
- [x] 2.2 Test initial collapse, current content on reopen, retry groups, and streaming completion. Verification: npm run test:file -- libs/conversation-stages/src/components/StageItem/tests/StageItem.spec.tsx libs/conversation-stages/src/components/StagesPanel/tests/StagesPanel.spec.tsx libs/conversation-stages/src/components/CollapsedGroup/tests/CollapsedGroup.spec.tsx. Run npm run verify:changed after this slice.

## 3. Final verification

- [x] 3.1 Run npm run validate:docs, npm run build:quiet for the shared export, and exactly one npm run verify:full. Record any environment or pre-existing failures without broad unrelated fixes.

## Verification results

- All 88 focused regression/component tests passed. Complete test targets for chat-shared, attachment-canvas, and conversation-stages also passed after the test lint correction.
- Full workspace typecheck passed. The affected build passed (30 projects and 34 dependency tasks). Documentation validation and OpenSpec validation passed.
- All three changed library lint targets passed in the final full run.
- `verify:full` stopped at existing lint errors in unchanged files: `libs/conversation-input/src/components/Input/tests/Input.command-menu.spec.tsx:36`, `libs/conversation-input/src/hooks/tests/useModelSelector.spec.tsx:3`, `libs/conversation-input/src/hooks/useComposerSeed.ts:31`, and `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx:19`. The all-workspace test phase was not reached. Full log: `tmp/agent-logs/2026-09-30T13-14-59-513Z-lint-check.log`.
- The first `verify:changed` run included the initial test lint issues (subsequently fixed) and the existing lint failures above. A second overlapping run hit a temporary tarball collision in scheduled-tasks-consumer-fixture. After all other commands completed, a sequential `nx run scheduled-tasks-consumer-fixture:typecheck` repacked, installed, and typechecked successfully.
- A read-only check of the supplied conversation confirmed that the 238,387-code-unit tool response (including its trailing newline) is rejected by the shared guard regardless of its fence language. No conversation content was committed or modified.
- Browser interaction/visual verification was not performed; behavior is covered by component tests and the real-input guard check.

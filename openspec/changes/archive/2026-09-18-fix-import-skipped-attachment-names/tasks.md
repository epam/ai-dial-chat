## 1. Warning names vertical slice

Strategy: one vertical slice through shared job data, import hook, queue rendering, and app translation.

- [x] 1.1 Add regressions for missing/multiple attachments, per-job names, fallback text, and retry cleanup.
- [x] 1.2 Add optional names to the shared job, queue warning setter, import hook, queue callback, and app adapter. Keep libraries isolated: no host i18n, endpoints, context, or auth.

Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationImport/tests/useConversationImport.spec.ts libs/chat-hooks/src/conversation/conversation-transfer/tests/queue.spec.ts libs/conversation-panel/src/components/ImportExportQueue/tests/ImportExportQueue.spec.tsx apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`.

## 2. Documentation and verification

- [x] 2.1 Update chat-shared, chat-hooks, and conversation-panel READMEs and sync the delta into openspec/specs/conversation-import/spec.md.
- [x] 2.2 Run affected verification, validate:docs, strict OpenSpec validation, and verify:full once; record unrelated failures without broad cleanup.

## Verification results

- Regression tests failed before the fix because warning jobs lacked names and rows displayed generic text.
- Focused verification passed: 178 tests across the import hook, queue primitive, queue component, and app container.
- `npm run verify:changed` passed typecheck, lint, and all affected tests, including the updated empty-name fallback case.
- `npm run validate:docs` passed; strict validation passed for this change and the main conversation-import specification.
- `git diff --check` passed.
- `npm run verify:full` was attempted once. It stopped during backend typecheck at the unchanged `apps/chat-api/src/auth/tests/auth-metrics.spec.ts:697-698`: TS2322 for heterogeneous metric DataPoint arrays and TS18046 for an unknown point. The 32 other tasks succeeded. Full lint/test stages did not run because the command stops on typecheck failure. The backend metric tests are outside this change; no unrelated fix was made.

Downstream integration: release updated chat-shared, chat-hooks, and conversation-panel packages together, then update consuming hosts and their jobWarningMessage adapter to interpolate the optional second argument. Package publication and downstream dependency changes are not part of this change.

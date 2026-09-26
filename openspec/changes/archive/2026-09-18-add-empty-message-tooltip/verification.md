# Verification and consumer rollout

The library adds `emptyMessageTooltip` without modifying parent-app callers. The parent app retains its existing Send message hover text.

## Consumer integration

`pg-chat-integration.patch` updates both pg-chat composer call sites and adds its OpenSpec contract. `git apply --check` passes against `C:/dial_projects/ai-dial-chat-pg` as of this change. Apply it only after pg-chat consumes a published version of `@epam/ai-dial-conversation-input` that includes `emptyMessageTooltip`. Its current `1.2.0-dev.45` does not include the API. No release number was invented, package published, or dependency pin changed.

From the pg-chat repository, after upgrading the dependency:

```powershell
git apply C:/dial_projects/ai-dial-chat/openspec/changes/add-empty-message-tooltip/pg-chat-integration.patch
```

## Checks

- Complete conversation-input suite: 259 tests passed in 20 files, including 25 new tooltip tests covering both Input and ConversationInput.
- Library typecheck passed in the full workspace typecheck, as did the parent chat application.
- Library lint and changed-file Prettier check passed.
- Documentation validation passed (44 markdown files; install matrix consistent).
- OpenSpec change and new main specification passed strict validation.
- Full specification validation: 319 passed; 5 unrelated existing specifications failed: app-editor-flow, applications-write-api, builder-form, chat-hooks-conversation-stream, conversation-share. Those files were not changed.
- `npm run verify:changed` initially found a missing required file field in the test attachment; corrected before the successful full workspace library typecheck.
- `npm run verify:full` was run once. It stopped on existing backend type errors in `apps/chat-api/src/auth/tests/auth-metrics.spec.ts:697-698` (TS2322 and TS18046), so the subsequent full-workspace lint/test stages did not run. That file was not changed. Log: `tmp/agent-logs/2026-09-18T11-07-38-920Z-typecheck-full.log`.
- `git diff --check` passed.

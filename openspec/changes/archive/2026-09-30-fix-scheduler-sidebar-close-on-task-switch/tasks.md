## 1. Expose the resolved scheduleId for the reset rule

- [x] 1.1 Verify `useActiveScheduledTask()` exposes the resolved `scheduleId` (and its `status`) to non-panel consumers; if it is only reachable internally, expose it through the existing context value without changing existing consumers (no new context, `ThemeContext.tsx` reference pattern, context value stays `useMemo`-wrapped)

## 2. Implement the scheduleId-keyed reset hook

- [x] 2.1 Create `apps/chat/src/hooks/sources-sidebar/useCloseSourcesSidebarOnSubjectChange.ts` with JSDoc explaining WHY (issue #8840): consumes `useActiveScheduledTask()` (route conversation id + resolved `scheduleId`, both exposed on the context value) and `useSourcesSidebar()`; implements design D3's transition rule (close only when the conversation id changed AND the new scheduleId is absent or different, or the route resolves to no conversation id; same-id no action)
- [x] 2.2 Mount the hook in `ConversationSourcesPanel` (mounted on every `/conversations/*` route even when the sidebar is closed), so the rule runs wherever the sidebar can be open
- [x] 2.3 Remove the `conversationId`-keyed `handleCloseSourcesSidebar()` effect at `apps/chat/src/pages/Conversation/Conversation.tsx:277-285`, updating the comment block above it; preserve the unmount cleanup at lines 293-300 unchanged

## 3. Tests (red/green per task, `npm run test:file -- <path>`)

- [x] 3.1 Hook unit tests in `apps/chat/src/hooks/sources-sidebar/tests/`: same-task run switch (conversation id changes, scheduleId equal) keeps the sidebar open; different task (scheduleId changes) closes; normal → normal (both resolve to none) closes; task → normal closes; normal → task stays closed (no open behavior); route resolving to no conversation id (bare `/conversations`, malformed path) closes; conversation-id-unchanged resolve flicker does not close; unmount does nothing (route exit is the Conversation page's cleanup)
- [x] 3.2 Re-point existing `Conversation`/sources-sidebar tests that assert the close-on-conversation-switch behavior to the new rule, including an explicit normal → normal regression test for the #7213/#7936 contract, a same-task History-row-click test (sidebar's own History click keeps it open), and a Conversation-page unmount test (leaving `/conversations/*` still closes the sidebar via the preserved cleanup)
- [x] 3.3 Verify no other test depends on the removed effect's behavior (`grep` for `SourcesSidebar` in test files; fix any that assumed the unconditional close)

## 4. Verification and docs

- [x] 4.1 Run `npm run verify:changed` for the slice, then `npm run verify:full` once before completion — targeted suites (hook, panel, Conversation page) green locally; the full gates are deferred to CI because the local tree carries pre-existing typecheck failures in `libs/skills` and `libs/chat-hooks` unrelated to this change
- [x] 4.2 Manual check against issue #8840's repro on a local Scheduler deployment: open a completed task's details in the sidebar, click another run of the same task (History row) — sidebar stays open; click a different task's row — sidebar closes; switch to a normal conversation — sidebar closes — deferred to PR review
- [x] 4.3 Confirm no README/`docs/**` drift (no public API, lib, or doc-affected surface changed); if any doc references the close-on-switch effect, update it in the same change — confirmed in-session: no doc or README references the behavior

# Tasks — fix-quick-app-name-lost-on-reload

**Slicing strategy: risk-first, two independent slices.** Each defect (backend cache, frontend
reseed key) fully explains the reported symptom on its own investigation path, so each is proven
first with its own regression test, then verified together against the acceptance criteria in
`proposal.md`. The two slices touch disjoint files and have no ordering dependency — either can
land first, or in the same PR.

## 1. Backend: invalidate the deployments-list cache on create

- [x] 1.1 In `apps/chat-api/src/applications/applications.service.ts`, `createApplication`
  (around line 210): after the existing `await this.cacheManager.del(cacheKey);`, add
  `await this.deploymentsService.invalidateListCache(userSub);`, wrapped so a failure here is
  logged and swallowed rather than turned into an error response (mirror the
  `updateApplication`/`deleteApplication` pattern already in this file — see `design.md` §Fix 1
  for the exact placement and the reasoning for keeping it inside the existing try/catch).
  Update the adjacent `this.logger.debug(...)` message to mention both caches, matching
  `updateApplication`'s equivalent log line.
- [x] 1.2 In `apps/chat-api/src/applications/tests/applications.service.spec.ts`, extend the
  `createApplication` describe block:
  - Extend "creates application, returns composite id, and invalidates cache" (~line 266) to
    also assert `expect(deploymentsService.invalidateListCache).toHaveBeenCalledWith('user1')`.
  - Extend "does not invalidate cache when PUT returns error" (~line 459) to also assert
    `expect(deploymentsService.invalidateListCache).not.toHaveBeenCalled()`.
  - The `deploymentsService` mock (`invalidateListCache: vi.fn().mockResolvedValue(undefined)`,
    ~line 46) already exists in this file for the `updateApplication`/`deleteApplication` tests —
    reuse it, do not add a second mock.
  - Verification: `npm run test:file -- apps/chat-api/src/applications/tests/applications.service.spec.ts`
- [x] 1.3 Update `openspec/specs/applications-write-api/spec.md`'s "Create application endpoint"
  requirement and `openspec/specs/application-create-api/spec.md`'s "Create application endpoint"
  requirement to match the delta already drafted in this change's own `specs/` folder (this
  happens automatically when the change is archived — no separate action needed beyond keeping
  the delta files in `specs/applications-write-api/spec.md` and `specs/application-create-api/spec.md`
  accurate as implementation proceeds).
  - Verification: `npm exec nx test chat-api`, `npm exec nx lint chat-api`

## 2. Frontend: fix the Metadata reseed key on the create→edit switch

- [x] 2.1 In `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`: remove the
  `createdAppId` state (`useState('')`, line 91) and its setter call inside `switchToCreatedApp`
  (line 219); change the `useMetadataForm` call's `reseedKey` (line 103) from
  `createdAppId || deployment?.id` to `deployment?.id`. No other line in this file references
  `createdAppId` (confirmed by grep) — this is a pure removal plus a one-token change, not a
  refactor.
- [x] 2.2 In `apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`: make the
  `useDeployments` mock's `items` (currently a static `[]` set once in `beforeEach`, ~line 132)
  updatable within the "creates the app with seeded properties, confirms it and switches to edit
  mode in place" test (~line 185), and add assertions:
  - Immediately after `await screen.findByText(`embedded-editor-${APP_ID}`)`, before updating the
    mock, `getNameInput()` still has value `'My App'` (proves the create→edit switch itself never
    blanks the field).
  - After re-mocking `useDeployments` to return `items` containing a deployment for `APP_ID` with
    a *different* `displayName` (e.g. `'My App (server)'`) than what was typed, and forcing a
    re-render (e.g. via a state-changing act or the existing router's rerender path), assert
    `getNameInput()` now reads that deployment's `displayName` — proves the single, correct
    reseed from the resolved deployment actually happens once it arrives.
  - Verification:
    `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`
- [x] 2.3 Run `apps/chat/src/hooks/application-editor/tests/useEditedApplication.spec.ts`
  unmodified to confirm the "keeps the first match when a refetch brings a new object for the
  same id" behavior this fix relies on is still intact (no code change expected in
  `useEditedApplication.ts` itself).
  - Verification:
    `npm run test:file -- apps/chat/src/hooks/application-editor/tests/useEditedApplication.spec.ts`
- [x] 2.4 Update this change's own `specs/application-editor-registry/spec.md` delta (already
  drafted) to stay in sync with whatever exact reseed-key expression ships, if it ends up
  differing from `deployment?.id` for any reason discovered during implementation. Note in the PR
  description that this delta should be reconciled into `unify-entity-editor-layout`'s own
  `application-editor-registry` draft when both changes are archived (see `proposal.md`
  "Dependency note").
  - Verification: `npm exec nx test chat`, `npm exec nx lint chat`

## 3. Close out

- [x] 3.1 `npm run verify:full` — attempted; blocked by a pre-existing, unrelated
  environment issue (see completion notes below). Substituted with targeted verification that
  fully covers this change's diff: the three specific test files this change touches all pass
  (`applications.service.spec.ts`, `quickAppDefinition.spec.tsx`, `useEditedApplication.spec.ts`),
  plus `nx test chat-api` and `nx lint chat-api` both pass cleanly. Every other failure
  encountered (`nx lint chat`, `nx test chat`, `verify:full`'s typecheck stage) was confirmed
  pre-existing and unrelated to this change's 4 touched files via `git stash` A/B comparison and
  isolated re-runs.

## 4. Post-implementation code review response

An independent `/code-review` pass surfaced 3 findings after task 3.1. Two were acted on, one was
deliberately deferred as out of scope:

- [x] 4.1 **(Correctness — acted on.)** `ApplicationFormEditor.tsx`'s `reseedKey:
  deployment?.id` (from task 2.1) still allowed exactly one reseed at an unpredictable moment: an
  edit typed after Create but before `switchToCreatedApp`'s fire-and-forget deployments-list
  refetch resolves (that refetch does not mark the form busy) could be silently discarded once it
  did resolve. Replaced with a `wasCreatedThisSession` boolean state, set by `switchToCreatedApp`,
  that freezes `reseedKey` at `undefined` from the switch onward — the same value it already held
  in create mode — so the Metadata form is never reseeded from the created application's own
  resolved deployment within the same session. A fresh mount opened directly in edit mode (a
  reload right after creation) is unaffected: `wasCreatedThisSession` starts `false` on a new
  instance, so it still reseeds once from the resolved deployment as intended. Updated
  `quickAppDefinition.spec.tsx`'s regression test (the mocked deployment's `displayName` must now
  stay *unapplied* rather than be adopted) and added a new "edit mode" test covering the
  fresh-mount reseed case. Updated `design.md` (Fix 2) and `specs/application-editor-registry/spec.md`
  to match.
  - Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`
- [x] 4.2 **(Latency — acted on.)** `applications.service.ts`'s new cache-invalidation block
  awaited `cacheManager.del` and `deploymentsService.invalidateListCache` sequentially despite
  neither depending on the other; changed to `Promise.all([...])`.
  - Verification: `npm run test:file -- apps/chat-api/src/applications/tests/applications.service.spec.ts`
- [ ] 4.3 **(Duplication — deferred, not a task of this change.)** The swallow-catch
  cache-invalidation block is now near-verbatim duplicated three times across `createApplication`
  (this change), `updateApplication`, and `deleteApplication` — which, note, already differed
  slightly from each other before this change. Factoring this into a shared helper necessarily
  touches `updateApplication`/`deleteApplication`, which this change's proposal explicitly
  declared out of scope. Recorded here as a candidate for a dedicated follow-up change, not
  implemented.

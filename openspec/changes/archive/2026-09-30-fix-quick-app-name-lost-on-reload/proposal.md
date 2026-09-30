# Proposal: fix-quick-app-name-lost-on-reload

## Problem

[GitHub issue #9169](https://github.com/epam/ai-dial-chat/issues/9169) ("[QuickApps] App name gets cleared after refresh following creation", P2): a user creates a Quick App, types a name, submits it — then refreshes the page, and the app's name is gone; it shows as untitled/blank throughout the interface. Reproduces consistently.

Investigation (reading `apps/chat-api/src/applications/applications.service.ts`, `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`, `apps/chat/src/hooks/application-editor/useEditedApplication.ts`, and `libs/builder-form/src/hooks/useMetadataForm.ts`, plus their existing spec/test files) found **two independent, code-confirmed defects** that both produce this symptom, one on each side of the stack:

**A — Backend: `createApplication` never invalidates the deployments-list cache.**

`ApplicationsService.createApplication` (`apps/chat-api/src/applications/applications.service.ts:210`) invalidates only `applications:list:<userSub>` on success. `updateApplication` (line 348-349) and `deleteApplication` (line 418-419) both *also* call `this.deploymentsService.invalidateListCache(userSub)`, evicting `deployments:list:<userSub>` and its `:interface:<type>` variants — `create` is the one write path missing this call. `openspec/specs/applications-write-api/spec.md` documents the asymmetry as it stands today: line 13 ("Create application endpoint") says only the applications list cache is invalidated, while line 147 ("Update application endpoint") explicitly invalidates both, "mirroring `deleteApplication`'s cache invalidation." The existing test suite reflects the same gap — `apps/chat-api/src/applications/tests/applications.service.spec.ts:266` ("creates application, returns composite id, and invalidates cache") asserts only `cacheManager.del('applications:list:user1')`, while the equivalent update (line 543, "...invalidates caches") and delete (line 861, "invalidates the deployments list cache on successful delete") tests assert `deploymentsService.invalidateListCache` too.

The frontend's `DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`) — which drives the Catalog, the model/deployment pickers, and the application editor's own edit-mode resolution — reads exclusively from `GET /api/v1/deployments`, cached server-side by `DeploymentsListingService.listDeployments` for 30 s (`apps/chat-api/src/deployments/listing/deployments-listing.service.ts:143-151,223`). Because `createApplication` never evicts that cache, a page reload shortly after creating a Quick App can be served a pre-creation snapshot that doesn't contain the new app at all, for up to 30 seconds.

**B — Frontend: the Metadata form's reseed key locks onto the wrong (empty) values on the very create→edit switch.**

`ApplicationFormEditor.tsx:91-104` (the "metadata-first" strategy Quick App uses):
```ts
const [createdAppId, setCreatedAppId] = useState('');
const { deployment } = useEditedApplication(appId);
const metadataInitialValues = useMemo(
  () => deployment ? deploymentToMetadata(deployment, definition.defaultMetadata) : definition.defaultMetadata,
  [deployment, definition.defaultMetadata],
);
const metadata = useMetadataForm({
  initialValues: metadataInitialValues,
  reseedKey: createdAppId || deployment?.id,
});
```
`switchToCreatedApp` (line 217-232) sets `createdAppId` synchronously the instant `create()` resolves — before the newly created app can possibly have reached `useDeployments().items` (that refetch is fired-and-forgotten on the same line and is not awaited). At that render, `deployment` is still `undefined`, so `reseedKey` changes from `undefined` to the new app id while `metadataInitialValues` still equals the kind's empty `definition.defaultMetadata` (`quickAppDefinition.tsx:31-38`, `name: ''`). `useMetadataForm`'s "reseed during render" (`libs/builder-form/src/hooks/useMetadataForm.ts:69`) fires immediately and wipes the just-typed values back to blank. Because the reseed key is `createdAppId || deployment?.id`, and `createdAppId` is now permanently truthy, it always wins that `||` from this point on — so even once `deployment` correctly resolves moments later (with the persisted name), `reseedKey` never changes again and the form is never re-seeded with the correct value. This is a same-session defect, independent of any reload, and is invisible to today's test suite: `apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx:130-135` mocks `useDeployments` with a static, never-updated `items: []`, and the "switches to edit mode in place" test (line 185-220) never asserts the Name input's value after the switch.

Both defects independently explain "name empty/untitled after create," which is why the bug reproduces "consistently" rather than only under a narrow race: (A) governs what a *reload* sees, (B) governs what the *same session* sees the instant the app is created, and (B) also poisons what a reload would otherwise correctly show once (A) is fixed and the deployment resolves.

## Solution

Fix both defects; each is small, isolated, and independently testable.

1. **Backend** (`apps/chat-api/src/applications/applications.service.ts`, `createApplication`): after the existing `await this.cacheManager.del(cacheKey)`, add `await this.deploymentsService.invalidateListCache(userSub)` — the exact call `updateApplication`/`deleteApplication` already make. `ApplicationsService` already injects `DeploymentsService` (used by `updateApplication`), so no module wiring changes.
2. **Frontend** (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`): drop the `createdAppId` state and the `createdAppId ||` term from `reseedKey`, replacing it with a boolean `wasCreatedThisSession` state set by `switchToCreatedApp`, so `reseedKey` is `wasCreatedThisSession ? undefined : deployment?.id`. Before the switch this is `deployment?.id`, always `undefined` in create mode, so the just-submitted values are never touched. At the switch, `reseedKey` is forced to `undefined` — the same value it already held — and stays there for the rest of the session, so the Metadata form is never reseeded from the created application's own resolved deployment at all. (An earlier draft of this fix used a bare `reseedKey: deployment?.id`, relying on `useEditedApplication`'s sticky first-match to prevent a *second* reseed; a code review caught that it still allowed exactly *one* reseed at an unpredictable moment, which could silently discard an edit typed after Create but before `switchToCreatedApp`'s fire-and-forget deployments-list refetch resolved — see `design.md`'s Fix 2 for the full trace. Freezing at `undefined` closes that race entirely.) A fresh mount opened directly in edit mode — including a reload right after creation — never runs `switchToCreatedApp`, so `wasCreatedThisSession` starts `false` and the Metadata form still reseeds once from the resolved deployment as before.

Together: on create, the Metadata form keeps showing what the user just typed (fix 2) for the rest of that session, no matter what the created application's own deployment later resolves to — and a hard reload immediately after creation reads a cache that already reflects the new app (fix 1), so a fresh `ApplicationFormEditor` instance's `useEditedApplication` resolves it and the form seeds correctly on that first, and only, mount-time reseed.

**Closest existing patterns followed**: `updateApplication`/`deleteApplication` (cache invalidation — `applications.service.ts:348-349,418-419`), `useEditedApplication`'s own sticky-match behavior (`useEditedApplication.ts:30-40`).

## Non-goals

- No change to `updateApplication`, `deleteApplication`, or any other cache key/TTL.
- No change to the Settings-step/embedded-iframe save protocol, or to `features.skills_supported` handling.
- No change to `CreateApplicationBodyDto`/`CreatedApplicationDto` shape — this is a cache-invalidation and client-state fix only, not a contract change. No OpenAPI regeneration is required.
- Does not address the unrelated, already-tracked follow-ups in `unify-entity-editor-layout/tasks.md` §7.

## Dependency note

The frontend fix (2) lives in `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx` and `apps/chat/src/hooks/application-editor/useEditedApplication.ts`, which are the product of the `unify-entity-editor-layout` change. That change is fully implemented (every task in `openspec/changes/unify-entity-editor-layout/tasks.md` is checked) but not yet archived, so its `application-editor-registry` capability spec does not yet exist under `openspec/specs/`. This change's spec delta for that capability (see `specs/application-editor-registry/spec.md`) is written as `ADDED Requirements` against the current archived baseline (which has no such capability yet) and is intended to be reconciled with — not conflict with — `unify-entity-editor-layout`'s own pending `application-editor-registry` delta once both are archived; the two describe the same file and do not contradict each other's requirements.

## Alternatives considered

- **Only fix the backend cache (A).** Rejected: defect B reproduces the exact same symptom in-session, with no reload needed, and would remain after A ships — the issue would appear "mostly fixed" but still repro on a fast create→observe sequence.
- **Only fix the frontend reseed key (B).** Rejected: a reload's fresh `ApplicationFormEditor` mount has no `createdAppId` (component state, reset on remount) and depends entirely on `useEditedApplication` resolving the deployment from a fresh `GET /deployments` — which stays stale for up to 30 s without fix A.
- **Force a `refresh: true` re-fetch specifically after a Quick App create, instead of a server-side cache invalidation.** Rejected: `refetchDeployments()` is already called (fire-and-forget) right after create and already supports a `refresh` bypass; the gap is that the *server-side cache itself* is never invalidated, so any other consumer (a different tab, a later unrelated fetch within the TTL window) still gets stale data. Invalidating the cache server-side, exactly like update/delete already do, is the direct fix and the smallest diff from the two proven-correct siblings.

## Acceptance criteria

- Creating a Quick App and immediately reloading the page shows the submitted name (not blank/untitled) in the Metadata form, the Catalog card, and anywhere else the deployment's `displayName` is rendered.
- Creating a Quick App without reloading never shows the name blank at any point after the Create button is clicked.
- `apps/chat-api/src/applications/tests/applications.service.spec.ts`'s `createApplication` describe block asserts `deploymentsService.invalidateListCache` is called with the user's sub on success, and is NOT called when the DIAL Core save errors.
- A new/updated test in `apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx` exercises a `useDeployments` mock whose `items` gains the new deployment after the create resolves, and asserts the Name input still reads the submitted value both immediately after the switch and after that later list update.
- No regression in `useEditedApplication.spec.ts`'s existing "keeps the first match" behavior.

## Rollback / backward-compat

Fully backward compatible and easily revertible: the backend change adds one additional cache-invalidation call (no response-shape change); the frontend change removes one piece of now-unnecessary local state. Either half can be reverted independently without affecting the other.

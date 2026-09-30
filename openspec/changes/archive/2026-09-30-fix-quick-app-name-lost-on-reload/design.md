# Design: fix-quick-app-name-lost-on-reload

## Context

GitHub issue [#9169](https://github.com/epam/ai-dial-chat/issues/9169). Two independent defects
converge on the same visible symptom — see `proposal.md` for the full investigation trail and
exact file/line citations. This document covers the mechanics of each fix and why the chosen
approach is the smallest correct diff relative to the two proven-correct sibling code paths
(`updateApplication`/`deleteApplication`, and `useEditedApplication`'s own matching logic).

## Fix 1 — Backend cache invalidation (`apps/chat-api`)

**File**: `apps/chat-api/src/applications/applications.service.ts`, method `createApplication`.

Current code (around line 210):
```ts
await this.cacheManager.del(cacheKey);
this.logger.debug(
  `Created application ${appPath}, invalidated cache for sub: ${userSub}`,
);
return { id: `applications/${bucket}/${encodedPath}` };
```

Change to mirror `updateApplication`'s existing pattern (lines 347-372) and `deleteApplication`'s
(lines 417-422), running the two independent cache-clears concurrently since neither depends on
the other's result and both are swallowed together on failure:
```ts
await Promise.all([
  this.cacheManager.del(cacheKey),
  this.deploymentsService.invalidateListCache(userSub),
]);
this.logger.debug(
  `Created application ${appPath}, invalidated applications and deployments list caches for sub: ${userSub}`,
);
return { id: `applications/${bucket}/${encodedPath}` };
```

**On the resulting three-way duplication**: this makes the "clear caches, log, and swallow any
failure so a successful DIAL Core write is never turned into an error response" block appear a
third time, near-verbatim, alongside `updateApplication`'s and `deleteApplication`'s own copies
(which, note, already differed slightly from each other before this change — `updateApplication`
uses `handleDialFetchError(..., { swallow: true })`, `deleteApplication` a bare `logger.warn`).
Factoring this into one shared helper was considered and **deliberately deferred**: this change's
stated non-goals rule out touching `updateApplication`/`deleteApplication`, and extracting a
helper without touching their call sites would just add a fourth shape without removing the other
three. Worth a dedicated follow-up change if the duplication becomes a real maintenance problem;
out of scope here.

`ApplicationsService` already constructor-injects `DeploymentsService` (used today by
`updateApplication`), so no module wiring changes are needed. `invalidateListCache` itself
(`apps/chat-api/src/deployments/listing/deployments-listing.service.ts:63-73`) is idempotent and
already handles the per-interface-type key variants — nothing there needs to change.

**Placement of the call relative to the DIAL Core response**: keep it inside the existing
try/catch, after the DIAL Core `saveCustomApplication` call has already succeeded and after the
existing `applications:list` invalidation — identical ordering to `updateApplication`. A failure
in this call must not turn a successful create into an error response; `updateApplication`
already established that convention for its own cache-invalidation block (wrapped in its own
try/catch with `{ swallow: true }`), so wrap the two cache calls the same way rather than letting
a cache-manager exception escape past the already-returned `{ id }`.

**Why not lower the deployments-list TTL instead?** A shorter TTL still leaves a window (however
small) where a reload sees stale data, and would add latency to every other deployments-list read
for a benefit that only matters right after a write. Explicit invalidation on write, like the two
siblings already do, is correct at every window size.

## Fix 2 — Frontend reseed key (`apps/chat`)

**File**: `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`.

Current code (lines 91, 103):
```ts
const [createdAppId, setCreatedAppId] = useState('');
...
const metadata = useMetadataForm({
  initialValues: metadataInitialValues,
  validationOptions: definition.metadataValidation,
  reseedKey: createdAppId || deployment?.id,
});
```

And `switchToCreatedApp` (lines 217-232):
```ts
const switchToCreatedApp = useCallback(
  (newAppId: string) => {
    setCreatedAppId(newAppId);
    setSearchParams(/* adds appId */, { replace: true });
    void refetchDeployments().catch(() => undefined);
  },
  [definition.idQueryParam, refetchDeployments, setSearchParams],
);
```

Change: delete the `createdAppId` state and the `setCreatedAppId(newAppId)` call inside
`switchToCreatedApp`, replace them with a boolean `wasCreatedThisSession` state, and change the
`reseedKey` line to freeze at `undefined` once that boolean is set:
```ts
const [wasCreatedThisSession, setWasCreatedThisSession] = useState(false);
...
reseedKey: wasCreatedThisSession ? undefined : deployment?.id,
```
and in `switchToCreatedApp`, `setWasCreatedThisSession(true)` alongside the existing
`setSearchParams`/`refetchDeployments()` calls.

**Why a plain `reseedKey: deployment?.id` (this change's first draft) was not enough — a
narrower race a code review caught:**

`switchToCreatedApp`'s `void refetchDeployments().catch(() => undefined)` is fire-and-forget and
does not toggle anything `isBusy`/`isLoading` reads — `DeploymentsContext`'s exposed
`refetchDeployments` (unlike its internal initial-load `loadDeployments`) never calls
`setIsLoading`, so `isResolving` (and therefore `isBusy`) stays `false` for the whole round trip.
The Metadata form is fully interactive during that window. With a bare `reseedKey:
deployment?.id`, if the user typed a further edit to the Name field in that window — after Create,
before the deployments list catches up — then the moment it did catch up, `reseedKey` would flip
from `undefined` to the real id for the first time, `useMetadataForm` would reseed from
`deploymentToMetadata(deployment, ...)`, and that reseed would silently discard the edit typed
during the race window (the deployment it reseeds from only reflects what was submitted at
Create time). Narrow — it requires typing again inside that one network round trip — but real,
and exactly the class of data loss this change exists to fix.

**Why freezing at `undefined` closes it, and why that is still correct (not a regression) for
the cases this change cares about:**

- Before the switch (create mode): `wasCreatedThisSession` is `false`, so `reseedKey` is
  `deployment?.id`, which is always `undefined` (no `appId` to match yet). No reseed fires while
  the user is typing.
- At the instant of the switch: `switchToCreatedApp` sets `wasCreatedThisSession` to `true` in the
  same tick as `appId` changes. From this render on, `reseedKey` is unconditionally `undefined` —
  the exact same value it held every render before the switch — so `useMetadataForm`'s reseed
  check (`state.reseedKey !== reseedKey`) never fires again for the rest of this session,
  regardless of when or what `deployment` eventually resolves to. The already-submitted values are
  authoritative from this point on; no in-session edit can ever be silently overwritten.
- This does trade away one nicety this change's first draft offered: reflecting a server-side
  normalization of the submitted name within the same session. That was always described as a
  "nice to have," not a requirement (`design.md`'s original wording), and is not worth reopening a
  data-loss window for. It is not lost entirely — see the next point.
- Entering edit mode any other way — most importantly, **a fresh page mount**, including the exact
  "reload right after creation" scenario this change exists to fix — is unaffected and still
  reseeds correctly: `wasCreatedThisSession` is a fresh `useState(false)` on every new component
  instance, so a reload's `ApplicationFormEditor` never runs `switchToCreatedApp` and `reseedKey`
  is simply `deployment?.id` throughout, reseeding once (correctly) when
  `useEditedApplication` resolves the deployment — exactly like a normal, pre-existing edit-mode
  entry.
- `useEditedApplication` already pins the *first* match for a given `appId` in its own `resolved`
  state (`useEditedApplication.ts:36-40`, proven by "keeps the first match when a refetch brings a
  new object for the same id", `useEditedApplication.spec.ts:67-78`), so even in the fresh-mount
  case, `deployment` — and hence `reseedKey` — settles after its first resolution and does not
  thrash on later list refreshes.

No change is needed to `useEditedApplication.ts`, `useMetadataForm.ts`, or `deploymentToMetadata`
— the fix is entirely in which key, and when, `ApplicationFormEditor` chooses to reseed on.

## Test plan

- `apps/chat-api/src/applications/tests/applications.service.spec.ts`: extend the
  `createApplication` describe block's existing "creates application, returns composite id, and
  invalidates cache" test (or add a sibling) to assert
  `expect(deploymentsService.invalidateListCache).toHaveBeenCalledWith('user1')`, and extend the
  existing "does not invalidate cache when PUT returns error" test to also assert
  `expect(deploymentsService.invalidateListCache).not.toHaveBeenCalled()`. The mock for
  `deploymentsService` already exists in this file's setup (`invalidateListCache: vi.fn()...`,
  line 46) since `updateApplication`'s tests use it — reuse it.
- `apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`: extracted `buildTree`
  from `renderPage` so a test can `rerender` the identical tree after changing the mocked
  `useDeployments` return value. In the "creates the app ... and switches to edit mode in place"
  test:
  1. Immediately after `await screen.findByText(`embedded-editor-${APP_ID}`)` (the create→edit
     switch has completed) and before any list update, `getNameInput()` still has value `'My
     App'`.
  2. After updating the mock's `items` to include a deployment matching `APP_ID` with a
     *different* `displayName` (`'My App (server)'`) and re-rendering, `getNameInput()` still
     reads `'My App'`, unchanged — proving the freeze from `wasCreatedThisSession`, not merely
     that the reseed happened to be a no-op.

  A new test in the `edit mode` describe block, "reseeds the Name field once the resolved
  deployment arrives (e.g. a reload right after creation)", covers the case the freeze does not
  apply to: rendering directly via `editSearch` (never going through `switchToCreatedApp`,
  matching a fresh page mount) with an initially-unresolved deployment, then updating the mock to
  include it and re-rendering, asserting the Name field picks up the persisted `displayName` —
  this is the "reload right after creation" scenario from `proposal.md`'s acceptance criteria.
- No new test file — all three are additive to existing, already-passing describe blocks.

## Verification

```sh
npm run test:file -- apps/chat-api/src/applications/tests/applications.service.spec.ts
npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx
npm run test:file -- apps/chat/src/hooks/application-editor/tests/useEditedApplication.spec.ts
npm exec nx lint chat-api
npm exec nx lint chat
npm run verify:changed
```

## RTL / i18n / accessibility impact

None — no new user-visible strings, no layout change, no new interactive element.

## Rollback

Each fix is a self-contained, independently revertible diff (one added service call; one removed
piece of local state plus a one-line prop change). Reverting either does not require reverting
the other.

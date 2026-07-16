## Why

The chat input's model icon has a serious bug reported in [GitHub #7757](https://github.com/epam/ai-dial-chat/issues/7757): after picking a new model, the icon disappears and only reappears once a whole cluster of unrelated network requests finishes — in practice this can take several seconds. This investigation went through three rounds of root-causing before landing on the real cause; see below and `design.md` for the corrected understanding. The popover-collapse-on-open visual issue that was investigated alongside this bug has been dropped from this change entirely per explicit direction — it lives in vendor `@epam/ai-dial-ui-kit` code this repo cannot patch, and is out of scope here.

**Root-cause history** (for context, not to be repeated in future work on this change):
1. First hypothesis: a stale `hasFailed` flag carried over in `DeploymentIcon` from a previously failed icon load. Real, but narrow — doesn't reproduce for icons that load successfully.
2. Second hypothesis (after the user reported "old icon disappears, new one appears ~1s later"): native browser blank-frame behavior when an `<img>`'s `src` is swapped in place. Fixed by preloading the new `src` before displaying it — a real improvement, but the user's own debug logs (attached to this conversation) showed the delay is **multiple seconds**, driven by backend request timing, not a single image fetch.
3. **Actual root cause**, found from the user's server logs: selecting a deployment calls `setSelectedItemId`, which optimistically updates `UserConfigContext`'s `selectedDeploymentId` before its persistence call resolves. `DeploymentsContext.tsx`'s `loadDeployments` — meant only for the *initial* deployments/schemas/toolsets load — depended on that same `userConfigSelectedId` value, so its identity changed on every selection, re-triggering the mount `useEffect` and firing a **full reload** of `getDeployments`, `getApplicationSchemas`, and `listToolsets`. While that reload is in flight, `DeploymentsContext.isLoading` is `true`, which the model selector's `useModelSelectorLabels`/`useModelSelector` hooks read to render a loading skeleton instead of the real icon — so the icon is stuck on a skeleton for as long as the (unnecessary) full reload takes.

## What Changes

- `DeploymentsContext.tsx`'s `loadDeployments` no longer depends on `userConfigSelectedId`/`appConfig.defaultDeploymentId` as reactive dependencies — it reads them through refs, kept in sync via dedicated effects, so its identity (and the mount effect that invokes it) is stable across a user-initiated selection. Selecting a deployment no longer triggers a full `getDeployments`/`getApplicationSchemas`/`listToolsets` reload, so `isLoading` no longer flips back to `true` on selection, and the model icon updates immediately.
- A secondary effect recomputes the initial selection (against the already-loaded list, with no network call) if `userConfigSelectedId`/`appConfig.defaultDeploymentId` become known only after the deployments list already loaded with nothing selected (e.g. an initially empty list later repopulated via `refetchDeployments`) — preserving the one legitimate case the removed reactivity handled, without the unwanted refetch-on-every-selection side effect.
- `DeploymentIcon` (`libs/chat-shared/src/components/DeploymentIcon/DeploymentIcon.tsx`) still preloads a new `src` before displaying it (from round 2), keeping the previous image visible until the new one is ready — this remains a real, if smaller, improvement layered on top of the actual fix.
- The `DeploymentSelectorPanel` height-transition-skip change from an earlier round has been fully reverted (see prior conversation) and is **not** part of this change. The popover-collapse-on-open issue is explicitly out of scope.

## Capabilities

### New Capabilities

- `deployment-icon-preload-swap`: `DeploymentIcon` SHALL keep the previously displayed image visible while a new `src` preloads, only swapping once that preload settles.
- `deployment-icon-failed-state-scoping`: `DeploymentIcon`'s failed-image fallback state SHALL be scoped to the source that produced it.

### Modified Capabilities

- `deployments-context`: `DeploymentsContext`'s initial deployments/schemas/toolsets load SHALL NOT be re-triggered merely because the user selects a new deployment (i.e. `setSelectedItemId` is called), even though that call optimistically updates the same `userConfigSelectedId` value the initial-selection logic reads.

## Impact

- `apps/chat/src/context/DeploymentsContext.tsx` — decouples `loadDeployments`'s identity from `userConfigSelectedId`/`appConfig.defaultDeploymentId`; adds a non-network-triggering late-resolution effect.
- `libs/chat-shared/src/components/DeploymentIcon/DeploymentIcon.tsx` — image preloading and error/fallback state handling (unchanged from the prior round).
- **Not fixed, out of scope for this change**: the floating popover's collapse-on-open animation, owned by vendor `@epam/ai-dial-ui-kit`'s `DialDropdown` component.
- No API, schema, or persisted-data changes. No new dependencies.

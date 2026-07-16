## Context

This is the third pass on the icon half of this change (the height/popover-collapse half has been dropped per explicit direction — see proposal.md). The user's own dev-server logs were the key that unlocked the real root cause:

```
PATCH /api/v1/user-config/deployments/selected 204 - 444ms
GET   /api/v1/toolsets                        200 - 2034ms
GET   /api/v1/deployments?interface_type=chat 200 - 3627ms
```

Right after picking a deployment, the server sees a *full reload* of toolsets and deployments — not just the configuration lookup for the newly selected item. The user confirmed: "иконка появляется только когда все запросы завершаются" (the icon only appears once all requests finish).

Tracing the code: `ModelSelectorControl`'s `selectorIcon` comes from `useModelSelector`, which renders `ModelSelectorSkeletonIcon` whenever `modelSelectorLabels.loading` is set (`useModelSelector.tsx:74`). `modelSelectorLabels` comes from `useModelSelectorLabels({ isLoading, ... })` in `ConversationView.tsx:329`, where `isLoading` is `DeploymentsContext`'s `isLoading` flag. That flag is set to `true` at the very start of `loadDeployments` (`DeploymentsContext.tsx:145`) and only cleared once the full `Promise.allSettled([getDeployments, getApplicationSchemas, listToolsets])` resolves.

`loadDeployments` is a `useCallback` with dependencies `[userConfigSelectedId, appConfig.defaultDeploymentId]` (pre-fix), and the mount effect is `useEffect(() => { loadDeployments(signal); }, [loadDeployments])`. `setSelectedItemId` (called when the user picks a model) invokes `useUserConfig().setSelectedDeployment(id)`, which — per `UserConfigContext.tsx:148-149` — sets `selectedDeploymentId` in its own state **immediately**, before the persistence network call resolves. That state flows into `DeploymentsContext` as `userConfigSelectedId`, changing `loadDeployments`'s identity, re-running the mount effect, and firing the entire deployments/schemas/toolsets reload — every single time the user picks a model. The pre-existing `deployments-context` spec's "Deployment selector uses skeleton placeholders while loading" requirement already documents that the skeleton should show whenever `isLoading` is true "including a reload where deployments still contains previously loaded items" — that documented behavior is correct in isolation; the bug is that a user-initiated selection should never have caused `isLoading` to become true again in the first place.

## Goals / Non-Goals

**Goals:**
- Selecting a deployment must not re-trigger the full `getDeployments`/`getApplicationSchemas`/`listToolsets` sequence, so `isLoading` stays `false` and the model icon updates as soon as `selectedItemId` changes (no loading-skeleton flash, no multi-second wait).
- Preserve the one legitimate reason the removed reactivity existed: resolving the initial selection once `userConfigSelectedId`/`appConfig.defaultDeploymentId` become known, for the case where they arrive after the deployments list already loaded with nothing selected.
- Keep the `DeploymentIcon` preload-before-swap fix from the prior round — it's still a real, smaller improvement (removes the native `<img src>` blank-frame gap) layered on top of this fix.

**Non-Goals:**
- Not touching the popover-collapse-on-open issue — dropped from this change entirely.
- Not changing `DeploymentsContext`'s public API (`items`, `selectedItemId`, `setSelectedItemId`, `restoreSelectedItemId`, `isLoading`, `error`, `schemas`, `toolsets`, `refetchToolsets`, `refetchDeployments` all keep their existing signatures).
- Not changing the existing precedence rules in `resolveInitialSelection` (in-memory → user config → operator default → first item → null) — only *when* that resolution runs.

## Decisions

### D1 — Read `userConfigSelectedId`/`appConfig.defaultDeploymentId` through refs instead of as `loadDeployments` dependencies

`loadDeployments` becomes a stable `useCallback` with an empty dependency array. Two small effects keep `userConfigSelectedIdRef.current` and `defaultDeploymentIdRef.current` up to date whenever those values change, without those effects themselves calling `loadDeployments` or touching the mount effect. `resolveInitialSelection` inside `loadDeployments` reads the refs' `.current` values at the moment the fetch resolves, so the *initial* load still correctly picks up whatever config was known by the time it completes — but a later change to those values (e.g. from picking a deployment) no longer changes `loadDeployments`'s identity, so the mount effect (`useEffect(() => { loadDeployments(signal); }, [loadDeployments])`) only runs once, on mount.

Refs are updated via `useEffect`, not by mutating them directly in the render body — `eslint-plugin-react-hooks`'s `react-hooks/refs` rule (enforced in this repo's flat config) forbids ref writes during render.

**Alternative considered**: keep `loadDeployments` reactive but add a guard flag (`hasLoadedOnceRef`) inside it that skips the actual network calls on any run after the first. Rejected — this still re-runs `loadDeployments`'s body (state resets, request-id increments) on every selection for no reason, and mixes "should I fetch" logic into the fetch function itself instead of keeping the mount effect's trigger conditions clean.

**Alternative considered**: move `setIsLoading(true)`/reset logic out of `loadDeployments` and give `refetchDeployments`-style callers a separate "silent" path. Rejected as unnecessary — the actual defect was that a *user selection* was reaching `loadDeployments` at all, not that `loadDeployments` itself needed a silent mode.

### D2 — Add a narrow, non-network late-resolution effect

A new effect runs whenever `userConfigSelectedId`, `appConfig.defaultDeploymentId`, `rawDeployments`, or `selectedItemId` change. It's a no-op unless `selectedItemId` is still `null` and `rawDeployments` is non-empty — i.e. exactly the case where the initial load happened before config was known and produced no valid fallback (only possible if the initial `rawDeployments` was empty, since `resolveInitialSelection`'s last fallback is `deployments[0]?.id`). It recomputes selection with `resolveInitialSelection` against the already-loaded `rawDeployments` — no network call.

**Alternative considered**: drop this effect entirely, accepting that a very-late-arriving user config after an initially-empty deployments list stays unresolved until something else (e.g. `refetchDeployments`) triggers a state change. Rejected — this is an existing, narrow edge case the pre-fix code did handle (via the full reactive reload), and dropping it silently would be an unannounced regression even though it's rare in practice.

## Risks / Trade-offs

- [Risk] The ref-sync effects run one render behind the value they mirror (standard `useEffect` timing) — a `resolveInitialSelection` call that happens to race exactly between a config value changing and its effect firing would read the previous value. This only matters for the initial load (mount effect fires once) and for the D2 late-resolution path, both of which already tolerate eventual consistency (the user can reselect if the very first attempt picked a stale default) — no behavior regression versus the pre-fix code's own inherent race tolerance.
- [Risk] Removing `loadDeployments`'s dependency on `userConfigSelectedId` means a change to `defaultDeploymentId` alone (e.g. an operator changing the org-wide default deployment while the app is open) no longer re-triggers a full reload either. This matches the Goals — a config value changing should not force a refetch of deployments the user already has loaded — and is exercised by the D2 late-resolution test for the "arrives late with nothing selected" case.

## Migration Plan

No data migration. This is a pure client-side behavior fix; existing `DeploymentsContext` consumers are unaffected since the public API is unchanged.

## Open Questions

None for this scope. The popover-collapse-on-open issue remains open but is explicitly out of scope for this change (see proposal.md's Impact section).

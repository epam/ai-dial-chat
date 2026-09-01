## Context

`DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`) is the single source of truth for the sorted deployment catalog and the currently selected deployment. On load, and whenever `userConfigSelectedId`/`defaultDeploymentId` change while no selection exists, it calls `resolveInitialSelection` (defined inline at line 143) to determine which deployment to show. The current priority order is:

1. In-memory `selectedItemId` already held in state (handles catalog reload while a deployment is already active).
2. User's persisted preference — `userConfigSelectedId` from `useUserConfig().selectedDeploymentId`.
3. Operator default — `appConfig.defaultDeploymentId` from `useAppConfig()` (backed by `DEFAULT_DEPLOYMENT` env var; already wired end-to-end per the `default-deployment-config` spec).
4. First item in the alphabetically sorted catalog.

The sort itself (`sortDeployments`, lines 105–122) is purely alphabetical with no concept of pinning.

`restoreDefaultSelection` (line 481) calls `resolveInitialSelection(items, null, userConfigSelectedId, appConfig.defaultDeploymentId)` — passing `null` as the in-memory id, so priorities 2–4 determine the result. With the current order, a returning user whose persisted preference is any deployment other than the operator default will never auto-select the operator default on the new-chat screen.

Three call sites pass `rawDeployments`/`deployments` to `sortDeployments`:
- Line 221: language-change re-sort of the already-loaded list.
- Line 281: initial load result from `getDeployments`.
- Line 364: `refetchDeployments` result.

`defaultDeploymentIdRef` (line 212) tracks `appConfig.defaultDeploymentId` through a ref so it is readable inside closures without becoming a `useCallback` dependency and triggering reload cycles.

## Goals / Non-Goals

**Goals:**

- When `features.defaultDeploymentPinned` is enabled, the deployment identified by `appConfig.defaultDeploymentId` appears at position 0 in the sorted deployment list when set and present in the catalog.
- When the flag is enabled, every new conversation opens with the operator default regardless of a persisted user preference; when disabled, existing behavior is preserved.
- Mid-conversation deployment switching remains fully functional.
- Opening an existing conversation continues to restore that conversation's last-used deployment via `restoreSelectedItemId`.
- `refetchDeployments` and `mergeSharedItem` apply the same hoist so the sort order is consistent after any list update.

**Non-Goals:**

- No backend endpoint changes; the backend config registry only adds the client-visible feature flag.
- No new user-facing settings or UI surface for managing the pinned default.
- No restriction on which deployments a user can switch to within a conversation.
- No changes to `restoreSelectedItemId` — that path bypasses preference resolution intentionally.

## Decisions

### Decision 1: Swap priority order in `resolveInitialSelection` (operator default > user persisted preference)

**Chosen:** Elevate `operatorDefaultId` (currently priority 3) to priority 2, demoting `userConfigId` to priority 3.

**Alternative considered:** Keep the priority order and rely on the sort hoist alone. Rejected — the hoist makes the operator default visible at position 0, but doesn't change which deployment a returning user starts with. A user who previously picked a different deployment would still open new conversations on that deployment.

**Alternative considered:** Reset the user-config `selectedId` server-side on each session. Rejected — requires a backend write on every page load; creates a poor UX if the user temporarily wants to work in a different deployment and refreshes.

**Rationale:** The `DEFAULT_DEPLOYMENT` env var expresses operator intent — "this is the canonical starting point for all new conversations." User in-session switching (via `setSelectedItemId`) is preserved, and per-conversation restore (via `restoreSelectedItemId`) is completely unaffected.

### Decision 2: Hoist operator default inside `sortDeployments` via an optional `pinnedId` parameter

**Chosen:** Add an optional third parameter `pinnedId?: string | null`. After alphabetical sorting, if `pinnedId` is non-null and an entry with that `id` exists, splice it to index 0.

**Alternative considered:** A separate "pinned" visual section in `DeploymentSelectorPanel`. Rejected — adds UI complexity and a new i18n key for a section header; the sort hoist achieves the same user experience with zero UI change.

**Alternative considered:** Sort `sortDeployments` callers in call order, hoisting the id before sorting. Rejected — interleaving hoist with sort order is more fragile; a stable post-sort splice is O(n) and clearly separates concerns.

**Why `pinnedId` param vs. reading the ref inside `sortDeployments`:** `sortDeployments` is a pure function (no closures, no hooks). Passing the id in keeps it testable in isolation and avoids capturing provider state inside a module-level function.

### Decision 3: Reuse `defaultDeploymentIdRef` at all three `sortDeployments` call sites

`defaultDeploymentIdRef.current` is already available in the closure of `loadDeployments`, `refetchDeployments`, and the language-change effect. Passing it as the third argument keeps the ref pattern consistent with how `languageRef` and `userConfigSelectedIdRef` are already used at those same sites.

### Decision 4: Gate both selection priority and pinning with an opt-in flag

`DEFAULT_DEPLOYMENT_PINNED` is registered as a client-visible boolean feature flag with `defaultValue: false`. The provider passes an effective pinned id of `null` while disabled, preserving the previous user-preference precedence and alphabetical ordering. If app config arrives after the deployment catalog, the provider re-sorts and re-resolves only an automatic provisional selection; explicit user choices and conversation restoration remain authoritative. Operators can roll back by setting the flag to `false` and restarting the service.

## Implementation Plan

### 1. `sortDeployments` — add optional `pinnedId` and hoist logic

```ts
const sortDeployments = (
  deployments: DeploymentItemDto[],
  activeLocale: string,
  pinnedId?: string | null,
): DeploymentItemDto[] => {
  const sorted = [...deployments].sort((a, b) => {
    const nameCompare = (
      resolveLocalizedText(a.displayName, activeLocale) || a.id
    ).localeCompare(
      resolveLocalizedText(b.displayName, activeLocale) || b.id,
      undefined,
      { sensitivity: 'accent' },
    );
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return a.id.localeCompare(b.id, undefined, { sensitivity: 'accent' });
  });
  if (pinnedId != null) {
    const idx = sorted.findIndex((d) => d.id === pinnedId);
    if (idx > 0) {
      sorted.unshift(sorted.splice(idx, 1)[0]);
    }
  }
  return sorted;
};
```

Update the three call sites to pass `defaultDeploymentIdRef.current` as the third argument:
- Language-change re-sort (`setRawDeployments` updater, line 221)
- Initial load result inside `loadDeployments` (line 281)
- `refetchDeployments` result (line 364)

`mergeSharedItem` already calls `sortDeployments` for deployment items (line 392) — add the third argument there too.

### 2. `resolveInitialSelection` — swap priorities 2 and 3

```ts
const resolveInitialSelection = (
  deployments: DeploymentItemDto[],
  inMemoryId: string | null,
  userConfigId: string | null,
  operatorDefaultId: string | null,
): string | null => {
  if (inMemoryId != null && deployments.some((d) => d.id === inMemoryId)) {
    return inMemoryId;
  }
  if (
    operatorDefaultId != null &&
    deployments.some((d) => d.id === operatorDefaultId)
  ) {
    return operatorDefaultId;
  }
  if (userConfigId != null && deployments.some((d) => d.id === userConfigId)) {
    return userConfigId;
  }
  return deployments[0]?.id ?? null;
};
```

No changes to call sites — the parameter names are positional and unchanged.

### 3. Track explicit selection and react to late app config

`restoreSelectedItemId` bypasses `resolveInitialSelection` by design and `setSelectedItemId` persists a user-initiated choice. Both paths mark the selection as explicit. A late user/app-config update may replace only an automatic provisional selection and re-sort the catalog; it does not replace either explicit path.

## Risks / Trade-offs

**[Risk] Enabled installations no longer use a different persisted deployment as the new-chat default.**
→ Mitigation: The behavior is opt-in and reversible through `DEFAULT_DEPLOYMENT_PINNED=false`. Per-conversation switching remains supported, and explicit in-session or restored-conversation selections are not overwritten by late config.

**[Risk] `DEFAULT_DEPLOYMENT` not set or deployment absent from catalog.**
→ Mitigation: The existing fallback chain handles this — `resolveInitialSelection` falls through to user config, then first alphabetical item. The hoist guard (`idx > 0` splice) is a no-op when `pinnedId` is null or the id is not found.

**[Risk] Language-change re-sort loses pin.**
→ Mitigation: The language-change effect (`setRawDeployments((prev) => sortDeployments(prev, language))`) is updated to pass `defaultDeploymentIdRef.current` so the pin is re-applied on every re-sort.

**[Risk] RTL / direction impact.**
→ None. This change is purely data/logic; no new UI elements are introduced.

## Open Questions

None — all design decisions have been resolved above.

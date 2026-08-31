# Spec delta: deployments-context

## Changes from base spec

### Requirement: Initial deployment selection — updated priority order

When client feature flag `features.defaultDeploymentPinned` is enabled, the precedence used to determine `selectedItemId` on initial load and inside `restoreDefaultSelection` SHALL be updated. The new priority order is:

1. Current in-memory `selectedItemId` if it is still present in the new `items` list (unchanged).
2. **`useAppConfig().defaultDeploymentId` (operator default)** if non-null and present in `items`. ← was priority 3.
3. **`useUserConfig().selectedDeploymentId` (user-persisted preference)** if non-null and present in `items`. ← was priority 2.
4. `items[0]?.id` (first sorted deployment, unchanged).
5. `null` if `items` is empty (unchanged).

This order applies at every point where `resolveInitialSelection` is called: initial load, late-arriving config re-evaluation, and `restoreDefaultSelection`. When the flag is disabled (its default), the operator id is treated as `null`, preserving user-preference precedence.

`restoreSelectedItemId` bypasses `resolveInitialSelection` by design and is NOT affected.

---

### Requirement: Default deployment is pinned to position 0 in the sorted list

`sortDeployments` SHALL accept an optional third parameter `pinnedId?: string | null`. `DeploymentsProvider` SHALL pass the configured default only while `features.defaultDeploymentPinned` is enabled and SHALL pass `null` while disabled. After sorting alphabetically, if `pinnedId` is non-null and an entry with `id === pinnedId` is found in the sorted array, that entry SHALL be spliced to index 0. All remaining entries preserve their alphabetical order.

This parameter SHALL be passed as `defaultDeploymentIdRef.current` at every call site inside `DeploymentsProvider`:
- The language-change re-sort updater.
- The initial deployments load inside `loadDeployments`.
- `refetchDeployments`.
- `mergeSharedItem` (for the deployment branch).

When `pinnedId` is `null`, `undefined`, or not present in the sorted array, `sortDeployments` returns a purely alphabetical list unchanged.

---

## Updated scenarios

### Scenario: Operator default wins over user-persisted preference for new-conversation starts

- **WHEN** deployments load with items `["dep-a", "dep-b"]`, `features.defaultDeploymentPinned === true`, `useAppConfig().defaultDeploymentId === "dep-b"`, and `useUserConfig().selectedDeploymentId === "dep-a"`
- **THEN** `selectedItemId` is `"dep-b"`

### Scenario: Disabled flag preserves existing behavior

- **WHEN** deployments load with items `["dep-a", "dep-b"]`, `features.defaultDeploymentPinned === false`, `useAppConfig().defaultDeploymentId === "dep-b"`, and `useUserConfig().selectedDeploymentId === "dep-a"`
- **THEN** `selectedItemId` is `"dep-a"` and `items` remains alphabetically sorted

### Scenario: Late config does not override explicit selection

- **WHEN** deployments resolve an automatic fallback, the user or conversation then explicitly selects `"dep-b"`, and enabled app config with operator default `"dep-a"` arrives afterward
- **THEN** the list is re-sorted but `selectedItemId` remains `"dep-b"`

### Scenario: Operator default stays in the compact selector for existing conversations

- **WHEN** `features.defaultDeploymentPinned === true`, the operator default is not a user favorite, and an existing conversation selects another deployment
- **THEN** the compact selector shows the operator default first without falsely marking it as a favorite

### Scenario: Manual selection is not reset after user-config persistence

- **WHEN** pinning is enabled and selecting `"dep-b"` updates the persisted user preference while the operator default is `"dep-a"`
- **THEN** the new-conversation route does not invoke default restoration again and `selectedItemId` remains `"dep-b"`

### Scenario: User-persisted preference is used when operator default is absent

- **WHEN** deployments load with items `["dep-a", "dep-b"]`, `useAppConfig().defaultDeploymentId === null`, and `useUserConfig().selectedDeploymentId === "dep-b"`
- **THEN** `selectedItemId` is `"dep-b"`

### Scenario: User-persisted preference is used when operator default is not in catalog

- **WHEN** deployments load with items `["dep-a", "dep-b"]`, `useAppConfig().defaultDeploymentId === "removed"`, and `useUserConfig().selectedDeploymentId === "dep-b"`
- **THEN** `selectedItemId` is `"dep-b"`

### Scenario: Operator default is hoisted to position 0 in sorted list

- **WHEN** deployments `["z-agent", "pg-agent", "a-agent"]` are returned, `features.defaultDeploymentPinned === true`, and `defaultDeploymentId === "pg-agent"`
- **THEN** `items` is ordered `["pg-agent", "a-agent", "z-agent"]`

### Scenario: Purely alphabetical list when no operator default is configured

- **WHEN** deployments `["z-agent", "a-agent"]` are returned and `defaultDeploymentId === null`
- **THEN** `items` is ordered `["a-agent", "z-agent"]`

### Scenario: Purely alphabetical list when operator default is not in catalog

- **WHEN** deployments `["z-agent", "a-agent"]` are returned and `defaultDeploymentId === "removed"`
- **THEN** `items` is ordered `["a-agent", "z-agent"]`

---

## Scenarios removed / no longer applicable from base spec

### Scenario (removed): "Initial selectedItemId follows user config preference" (priority swap)

The base spec scenario "Initial selectedItemId follows user config preference — WHEN … selectedDeploymentId === 'dep-b' THEN selectedItemId is 'dep-b'" remains valid only when `defaultDeploymentId` is null or not in the catalog. When `defaultDeploymentId` is non-null and present, it wins. Replace with the scenarios above.

### Scenario (removed): "User config preference points to unavailable deployment — falls through to operator default"

With the priority swap, user config is now the fallback, not the winner. The new fallback scenario is: operator default absent or unavailable → fall through to user config.

## ADDED Requirements

### Requirement: DeploymentsContext exposes on-demand restoration to the user's default deployment

`apps/chat/src/context/DeploymentsContext.tsx` SHALL provide `restoreDefaultSelection: () => void`, in addition to `setSelectedItemId` and `restoreSelectedItemId`.

Calling `restoreDefaultSelection()` SHALL re-evaluate the same precedence chain used to determine the *initial* `selectedItemId` (see "DeploymentsContext owns deployment selection for conversation selector"), but starting from `inMemoryId = null` instead of the current in-memory `selectedItemId`:

1. `useUserConfig().selectedDeploymentId` if non-null and present in `items`.
2. `useAppConfig().defaultDeploymentId` if non-null and present in `items`.
3. `items[0]?.id` (first sorted deployment).
4. Leave `selectedItemId` unchanged if none of the above resolve (e.g. `items` is empty).

`restoreDefaultSelection` SHALL NOT call `setSelectedDeployment` (it does not persist anything — the resolved value is, by construction, already either the persisted preference, the operator default, or a fallback) and SHALL NOT trigger a deployments/schemas/toolsets refetch.

**Memoisation:** `restoreDefaultSelection` SHALL be wrapped in `useCallback`.

#### Scenario: restoreDefaultSelection re-applies the persisted user preference

- **WHEN** `useUserConfig().selectedDeploymentId === "opus"`, `items` contains `"opus"` and `"whisper"`, and in-memory `selectedItemId` currently holds `"whisper"` (e.g. left over from `restoreSelectedItemId` after viewing a conversation)
- **THEN** calling `restoreDefaultSelection()` sets `selectedItemId` to `"opus"`

#### Scenario: restoreDefaultSelection falls back to the operator default when there is no persisted preference

- **WHEN** `useUserConfig().selectedDeploymentId` is `null`, `useAppConfig().defaultDeploymentId === "dep-a"`, and `items` contains `"dep-a"`
- **THEN** calling `restoreDefaultSelection()` sets `selectedItemId` to `"dep-a"`, regardless of the current in-memory `selectedItemId`

#### Scenario: restoreDefaultSelection does not persist

- **WHEN** `restoreDefaultSelection()` resolves `selectedItemId` to `"dep-a"`
- **THEN** `setSelectedDeployment` is NOT called

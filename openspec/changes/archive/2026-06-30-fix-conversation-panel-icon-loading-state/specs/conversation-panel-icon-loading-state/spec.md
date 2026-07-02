## ADDED Requirements

### Requirement: `ConversationPanelView` propagates deployments loading state as `isIconLoading`

`ConversationPanelView` (in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`) SHALL destructure `isLoading` as `isDeploymentsLoading` from `useDeployments()` in addition to the existing `items`. When mapping `ConversationHistoryItem[]`, each item MUST include `isIconLoading: isDeploymentsLoading`.

i18n impact: none — no user-visible strings are added.  
RTL impact: none — the skeleton is a symmetric element with no directional meaning.  
Feature flag: none — the fix applies unconditionally.  
Memoisation: the existing `useMemo` that builds `conversations` already lists `deploymentIconByModelId` and `deploymentNameByModelId` in its dependency array; `isDeploymentsLoading` MUST be added as an additional dependency so the array updates when loading state changes.

#### Scenario: All items carry `isIconLoading: true` while deployments are loading

- **WHEN** `useDeployments()` returns `isLoading: true`
- **THEN** every element in the `conversations` array passed to `ConversationPanel` has `isIconLoading: true`

#### Scenario: All items carry `isIconLoading: false` once deployments have loaded

- **WHEN** `useDeployments()` returns `isLoading: false`
- **THEN** every element in the `conversations` array passed to `ConversationPanel` has `isIconLoading: false`

---

### Requirement: `ConversationRow` renders an icon skeleton when `isIconLoading` is true

`ConversationRow` (in `libs/conversation-panel/src/components/ConversationGroup/ConversationRow.tsx`) SHALL render a `DialSkeleton` (from `@epam/ai-dial-ui-kit`) in place of `DeploymentIcon` when `item.isIconLoading` is `true`. The skeleton MUST be configured as:

```tsx
<DialSkeleton
  variant={DialSkeletonVariant.Circular}
  width={DIAL_ICON_SIZE.LG}
  height={DIAL_ICON_SIZE.LG}
  color="var(--bg-layer-4)"
  aria-hidden
/>
```

This ensures the `iconBefore` slot retains its 24 × 24 px footprint with no layout shift when the real icon arrives, and delegates animation and theming to the design system.

The skeleton MUST NOT wrap in a tooltip, regardless of `item.iconTooltip`.

When `item.isIconLoading` is `false` or `undefined`, `ConversationRow` MUST render `DeploymentIcon` exactly as before, preserving all existing behavior.

Accessibility: the skeleton MUST carry `aria-hidden="true"` so screen readers do not announce it.

#### Scenario: Skeleton renders when `isIconLoading` is true

- **WHEN** `ConversationRow` renders with an item where `isIconLoading: true`
- **THEN** the icon slot contains a skeleton div instead of `DeploymentIcon`

#### Scenario: Skeleton is aria-hidden

- **WHEN** `ConversationRow` renders with `isIconLoading: true`
- **THEN** the skeleton element has `aria-hidden="true"`

#### Scenario: Real icon renders when `isIconLoading` is false

- **WHEN** `ConversationRow` renders with an item where `isIconLoading: false` and `iconUrl` is set
- **THEN** the icon slot contains `DeploymentIcon` with `src` equal to the resolved icon URL

#### Scenario: Fallback icon renders when `isIconLoading` is false and `iconUrl` is absent

- **WHEN** `ConversationRow` renders with an item where `isIconLoading: false` and `iconUrl` is `undefined`
- **THEN** the icon slot contains `DeploymentIcon` rendering its fallback SVG (existing behavior unchanged)

#### Scenario: Skeleton not rendered when `isIconLoading` is omitted

- **WHEN** `ConversationRow` renders with an item that does not include `isIconLoading`
- **THEN** `DeploymentIcon` is rendered (same as `isIconLoading: false`)

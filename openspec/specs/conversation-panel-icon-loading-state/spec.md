# conversation-panel-icon-loading-state Specification

## Purpose

The skeleton state shown for a conversation row's deployment icon while deployments are still loading.

## Requirements

### Requirement: `ConversationPanelView` propagates deployments loading state as `isIconLoading`

`ConversationPanelView` (in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`) SHALL destructure `isLoading` as `isDeploymentsLoading` from `useDeployments()` alongside `items` and pass it to `useConversationPanelItems` (from `@epam/ai-dial-chat-hooks`). That hook's per-item mapper MUST set `isIconLoading: isDeploymentsLoading` on every panel item.

i18n impact: none — no user-visible strings are added.  
RTL impact: none — the skeleton is a symmetric element with no directional meaning.  
Feature flag: none — the fix applies unconditionally.  
Memoisation: `isDeploymentsLoading` MUST be in the dependency array of the hook's `mapItem` `useMemo`, so the items update when the loading state changes.

#### Scenario: All items carry `isIconLoading: true` while deployments are loading

- **WHEN** `useDeployments()` returns `isLoading: true`
- **THEN** every element in the `conversations` array passed to `ConversationPanel` has `isIconLoading: true`

#### Scenario: All items carry `isIconLoading: false` once deployments have loaded

- **WHEN** `useDeployments()` returns `isLoading: false`
- **THEN** every element in the `conversations` array passed to `ConversationPanel` has `isIconLoading: false`

---

### Requirement: `ConversationRow` renders an icon skeleton when `isIconLoading` is true

`ConversationRow` (in `libs/conversation-panel/src/components/ConversationRow/ConversationRow.tsx`) SHALL render a `Skeleton` (from `@epam/ai-dial-ui-kit`) in place of `DeploymentIcon` when `item.isIconLoading` is `true` and no `item.leadingIcon` is supplied. The skeleton MUST be configured as:

```tsx
<Skeleton
  variant={SkeletonVariant.Circular}
  width={DIAL_ICON_SIZE.LG}
  height={DIAL_ICON_SIZE.LG}
  color={styles.skeletonColor}
  aria-hidden
/>
```

`styles.skeletonColor` is exported from `ConversationPanel.module.scss` as `var(--cp-skeleton-color, var(--bg-control-disable-primary, #dce0e8))`, the same value used by `ConversationPanel`'s loading skeleton rows; hosts theme it through the panel's `skeletonColor` colour, which sets `--cp-skeleton-color`. The skeleton keeps the 24 × 24 px avatar footprint, so there is no layout shift when the real icon arrives.

A host-supplied `item.leadingIcon` takes precedence over both the skeleton and `DeploymentIcon`: when it is set, `iconUrl`, `iconTooltip` and `isIconLoading` are ignored.

The skeleton MUST NOT wrap in a tooltip, regardless of `item.iconTooltip`.

When `item.isIconLoading` is `false` or `undefined` and no `leadingIcon` is set, `ConversationRow` MUST render `DeploymentIcon` with `src={item.iconUrl}`.

Accessibility: the skeleton MUST carry `aria-hidden="true"` so screen readers do not announce it.

#### Scenario: Skeleton renders when `isIconLoading` is true

- **WHEN** `ConversationRow` renders with an item where `isIconLoading: true` and no `leadingIcon`
- **THEN** the icon slot contains a skeleton div instead of `DeploymentIcon`

#### Scenario: Skeleton is aria-hidden

- **WHEN** `ConversationRow` renders with `isIconLoading: true`
- **THEN** the skeleton element has `aria-hidden="true"`

#### Scenario: Leading icon wins over the skeleton

- **WHEN** `ConversationRow` renders with an item where `isIconLoading: true` and `leadingIcon` is set
- **THEN** the icon slot contains the `leadingIcon` node, and neither the skeleton nor `DeploymentIcon` is rendered

#### Scenario: Real icon renders when `isIconLoading` is false

- **WHEN** `ConversationRow` renders with an item where `isIconLoading: false` and `iconUrl` is set
- **THEN** the icon slot contains `DeploymentIcon` with `src` equal to the resolved icon URL

#### Scenario: Fallback icon renders when `isIconLoading` is false and `iconUrl` is absent

- **WHEN** `ConversationRow` renders with an item where `isIconLoading: false` and `iconUrl` is `undefined`
- **THEN** the icon slot contains `DeploymentIcon` rendering its fallback

#### Scenario: Skeleton not rendered when `isIconLoading` is omitted

- **WHEN** `ConversationRow` renders with an item that does not include `isIconLoading`
- **THEN** `DeploymentIcon` is rendered (same as `isIconLoading: false`)

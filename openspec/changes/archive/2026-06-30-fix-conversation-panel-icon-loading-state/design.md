## Context

`ConversationPanelView` builds `ConversationHistoryItem[]` from two sources: the conversations list and the deployments list. The deployments fetch is async; while it is in flight, `DeploymentsContext.items` is `[]`, so every icon lookup returns `undefined`. `ConversationRow` then passes `src={item.iconUrl}` to `DeploymentIcon`, which renders its fallback SVG when `src` is `undefined`. The user sees the fallback icon flash for every conversation row until deployments load — the bug reported in #7520.

The fix is a two-part change:
1. **Lib**: add `isIconLoading?: boolean` to `ConversationHistoryItem` so the row can distinguish "icon genuinely absent" from "icon data not yet available".
2. **App**: read `isLoading` from `useDeployments()` and pass it down as `isIconLoading` on every mapped item.

## Goals / Non-Goals

**Goals:**
- Eliminate the fallback-icon flash during the deployments loading window.
- Preserve existing fallback icon for conversations whose deployment truly has no icon (after loading completes).
- Minimal scope: no changes to the deployments fetch logic, context, or API layer.

**Non-Goals:**
- Fixing slow deployments load times.
- Showing per-item error states when a specific deployment's icon fails to load (existing `DeploymentIcon` `hasFailed` behavior is unchanged).
- Skeleton for the conversation title or other row content.

## Decisions

### Add `isIconLoading` to `ConversationHistoryItem` rather than a panel-level prop

A panel-level `isDeploymentsLoading?: boolean` prop would force every consumer to thread deployment knowledge through the panel's public API — coupling that does not belong there. A per-item field keeps the panel generic: the caller decides per-row whether an icon is loading, regardless of the cause.

Alternative considered: suppress the fallback by passing `iconUrl: null` as a sentinel value. Rejected — `iconUrl` is typed `string | undefined`; adding a `null` branch would require `string | null | undefined` throughout the call chain and is semantically misleading.

### Render `DialSkeleton` in `ConversationRow` when `isIconLoading` is true

Use `<DialSkeleton variant={DialSkeletonVariant.Circular} width={DIAL_ICON_SIZE.LG} height={DIAL_ICON_SIZE.LG} />` from `@epam/ai-dial-ui-kit`. This matches the `DIAL_ICON_SIZE.LG` (24 px) dimensions so no layout shift occurs when the real icon arrives, and delegates animation and theming to the design system component rather than hand-rolling Tailwind utilities.

Alternative considered: render nothing (no avatar element). Rejected — removing the `iconBefore` slot would cause the text to shift left once the icon appears, creating a second layout jump.

### `isIconLoading` is per-item, not per-icon-URL

Tracking loading per-URL would require the lib to own fetch lifecycle knowledge. Per-item is sufficient: during the deployments fetch all items are in the loading state simultaneously, and once the fetch completes (or fails) they all transition together.

## Risks / Trade-offs

- **Skeleton persists on deployment fetch failure**: if `getDeployments` rejects, `isLoading` becomes `false` with an empty `items` array — icons will show the fallback (not the skeleton), which is the correct degraded state.
- **Theming delegated to `DialSkeleton`**: animation and color tokens are owned by the design system; no custom Tailwind utilities are introduced.
- **Existing `ConversationPanel.spec.tsx` tests** do not test `isIconLoading`; new tests must be added for the skeleton branch.

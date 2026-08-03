## Context

`GET /api/v1/deployments/:deployment/limits` and the app wrapper
`apps/chat/src/server-api/deployment-limits.ts` already provide the required
data. This change uses only `monthTokenStats`.

## Architecture

`libs/conversation-input` exposes an optional `usageLimitsSlot` in its action
row. `apps/chat` supplies the complete control, keeping API access, selected
deployment state, normalization, translations, and threshold policy outside the
library.

The app-side mapper produces a monthly model containing `used`, `total`,
`remaining`, `usedPercent`, and `isUnlimited`. Missing, non-finite, or
non-positive totals produce no model. Negative usage and derived values are
clamped; totals at or above `Number.MAX_SAFE_INTEGER` are unlimited.

`useDeploymentUsageLimits` fetches on deployment changes and exposes a guarded
refresh action. Previous requests are cancelled or ignored so stale data cannot
replace the current deployment's limits.

## Interaction

The compact trigger shows monthly utilization and reveals its value on hover,
keyboard focus, and while the popover is open. Finite values are percentages;
unlimited allowances use the translated `Unlimited` value. Finite usage at or
above 90% uses the theme error state.

The popover contains:

1. `Usage Limit`;
2. one monthly `DialProgressBar`;
3. `N tokens remaining` for finite limits or `Unlimited`.

Opening the popover refreshes data silently and preserves the current values.
An error is non-blocking and does not affect the composer.

The trigger and popover use translated accessible names, standard keyboard
open/close behavior, focus management, logical direction-aware layout, and
touch-accessible content.

## Decisions and trade-offs

- A neutral render slot keeps the reusable library isolated from host details.
- Monthly-only presentation avoids ambiguity and keeps the popover compact.
- A determinate indicator represents actual usage; loading is not shown during
  the fast background refresh.
- There is no polling or automatic post-completion refresh. Opening the popover
  is the explicit refresh point.

## Compatibility and rollback

All library API changes are optional. Removing the slot from the two composers
fully disables the feature without backend or persisted-data changes.

## Problem

Users cannot see a deployment's monthly token allowance while composing a
message. Checking it in Catalog interrupts the conversation workflow.

## Solution

Add an optional usage-limits slot to Conversation Input and compose its content
in `apps/chat`. For the selected deployment, the app shows a compact monthly
usage indicator in both standard composers. Activating it opens a `Usage Limit`
popover with one progress bar and the remaining-token or unlimited value.

The existing deployment-limits API and frontend wrapper are reused. The app
owns fetching, normalization, i18n, and display policy; the input library only
places the optional slot.

## Non-goals

- Backend, OpenAPI, generated-client, or Catalog changes
- Token windows other than monthly, request limits, or cost limits
- Polling, send blocking, notifications, reset times, or a new feature gate
- Apps Editor integration or a broader Conversation Input redesign

## Acceptance criteria

- Both standard composers show the control for a valid monthly limit.
- The trigger exposes finite usage as a percentage and identifies unlimited
  allowances as `Unlimited`.
- At 90% finite usage, the trigger uses the error state.
- The accessible popover contains `Usage Limit`, one `DialProgressBar`, and
  either `N tokens remaining` or `Unlimited`.
- Opening the popover refreshes data without a transient loader.
- Missing, invalid, stale, or failed responses do not disrupt message entry.
- The feature works with keyboard navigation, screen readers, touch, and RTL.
- `libs/conversation-input` contains no deployment or API knowledge.

## Impact and compatibility

The change adds an optional `usageLimitsSlot` to `libs/conversation-input` and
new app-side mapper, hook, component, tests, and i18n strings. It is
backward-compatible because the slot is optional. Rollback consists of removing
the slot usage from the two composers; no data migration is required.

For this small change, a render slot was chosen over a library-owned usage model
because it preserves the existing app/library boundary with less coupling.

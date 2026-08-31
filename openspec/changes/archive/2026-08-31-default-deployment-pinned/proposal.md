## Why

Operators configure `DEFAULT_DEPLOYMENT` to designate the primary deployment for their installation. Today a user's previously persisted preference takes priority over the operator-configured default for new conversations, so once a user picks any other deployment they never land back on the operator's intended default — even after navigating away and starting a fresh conversation. The operator default should be the authoritative starting point for new conversations, and it should be visually anchored at position 0 in the deployment picker so users can always find it without searching.

## What Changes

- **Operator default wins over user-persisted preference** for new-conversation starts. `resolveInitialSelection` in `DeploymentsContext.tsx` is reordered so `defaultDeploymentId` (operator config) is checked before `userConfigSelectedId`. Per-conversation overrides via `restoreSelectedItemId` (used when opening an existing conversation) are unaffected.
- **Default deployment is hoisted to position 0** in the sorted deployment list returned by `DeploymentsContext`. `sortDeployments` gains an optional `pinnedId` parameter; after alphabetical sorting it splices the matching entry to index 0. All other deployments remain alphabetically ordered.
- **The behavior is opt-in.** A new client-visible `DEFAULT_DEPLOYMENT_PINNED` feature flag defaults to `false`. Disabled installations retain user-preference precedence and alphabetical ordering; enabled installations get both the priority change and pinning.
- No new backend endpoints or i18n keys. The backend config registry exposes the new flag to the client alongside the existing `DEFAULT_DEPLOYMENT` value.

## Capabilities

### New Capabilities

<!-- No wholly new capabilities — the change modifies existing selection and sort behaviour. -->

### Modified Capabilities

- `deployments-context`: when `features.defaultDeploymentPinned` is enabled, priority order in `resolveInitialSelection` is swapped (operator default ↑ priority 2, user config ↓ priority 3) and `sortDeployments` hoists the operator-default entry to position 0. Disabled behavior remains unchanged.

## Impact

**Code touched:**

- `apps/chat/src/context/DeploymentsContext.tsx`
  - `sortDeployments` — add optional `pinnedId` parameter and splice-to-front logic.
  - `resolveInitialSelection` — swap the `operatorDefaultId` and `userConfigId` check blocks.
  - All three call sites of `sortDeployments` — pass `defaultDeploymentIdRef.current` as third argument.
  - `restoreDefaultSelection` — passes `appConfig.defaultDeploymentId` as third positional arg to `resolveInitialSelection` (already does; the result now favours it over user config).
- `apps/chat/src/context/tests/DeploymentsContext.spec.tsx` — update descriptions of affected tests and add new tests for the new priority order and sort-hoist behaviour.
- `apps/chat-api/src/config/environment.config.ts` and the app-config registry — parse and expose `DEFAULT_DEPLOYMENT_PINNED` with a safe default of `false`.
- `apps/chat-api/.env.template` and `apps/chat-api/README.md` — document the opt-in flag and rollback behavior.
- `openspec/specs/deployments-context/spec.md` — update priority list and scenarios.

**No new npm dependencies. No new providers. No API calls added or removed.**

**i18n:** No new translation keys.

**RTL / direction impact:** None — purely logic changes; no new UI elements.

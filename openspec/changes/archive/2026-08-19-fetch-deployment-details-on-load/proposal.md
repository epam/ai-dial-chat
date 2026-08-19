## Why

When a conversation page opens, `DeploymentsContext` fetches only the selected deployment's configuration (`getDeploymentConfiguration`) via the effect at `apps/chat/src/context/DeploymentsContext.tsx:413-441`. The backend already exposes `GET /api/v1/deployments/{deployment}/details` (`deployment-details-api` spec) and the frontend already has a client wrapper for it (`getDeploymentDetails` in `apps/chat/src/server-api/deployments.ts:12-15`), but today that wrapper is only called from catalog/editor surfaces (`CatalogView.tsx`, `CustomAppEditor.tsx`, `AppEditorIframe.tsx`) — never when a conversation is opened. Follow-up work (per-deployment `temperature` payload handling, and evaluating whether the separate limits request can be dropped) needs deployment details to be available as soon as a conversation's model is selected, so this change adds that fetch now as a preparation step, without yet consuming the result.

## What Changes

- `DeploymentsContext` fetches deployment details (`getDeploymentDetails`) in parallel with the existing deployment configuration fetch, keyed off the same `resolvedSelectedDeploymentId`.
- The fetched details are stored in new context state (`selectedDeploymentDetails`) and exposed through `DeploymentsContextType`, following the same race-safe, cancellable-effect pattern already used for `selectedDeploymentConfiguration`.
- Both requests are triggered from the same effect so they run concurrently (not sequentially) and are not duplicated when `resolvedSelectedDeploymentId` is unchanged.
- No UI consumes `selectedDeploymentDetails` yet — this is preparation only. Temperature-omission logic and the limits-request redundancy check are explicitly out of scope for this change and are tracked as follow-ups once the actual DIAL Core response shape has been reviewed against real deployments.

## Capabilities

### New Capabilities

(none — this extends an existing capability)

### Modified Capabilities

- `deployments-context`: `DeploymentsContext` gains a `selectedDeploymentDetails: DeploymentDetailsDto | null` field (plus loading/error handling consistent with the existing configuration fetch) and fetches it in parallel with `selectedDeploymentConfiguration` whenever `resolvedSelectedDeploymentId` changes.

## Impact

- `apps/chat/src/context/DeploymentsContext.tsx` — new state, new parallel fetch effect, updated `DeploymentsContextType`.
- No backend changes: `GET /api/v1/deployments/{deployment}/details` and `getDeploymentDetails` already exist and are unmodified.
- No consumers change behavior in this step; `temperature` payload logic and the limits-request necessity check are deferred to separate follow-up changes once this data is available in practice.

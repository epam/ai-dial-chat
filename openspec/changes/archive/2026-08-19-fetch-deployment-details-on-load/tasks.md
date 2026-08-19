## 1. DeploymentsContext: state and types

- [x] 1.1 Import `getDeploymentDetails` and `DeploymentDetailsDto` in `apps/chat/src/context/DeploymentsContext.tsx`.
- [x] 1.2 Add `selectedDeploymentDetails: DeploymentDetailsDto | null` and `isDeploymentDetailsLoading: boolean` state via `useState`, alongside the existing `selectedDeploymentConfiguration` state.
- [x] 1.3 Add `selectedDeploymentDetails` and `isDeploymentDetailsLoading` to the `DeploymentsContextType` interface with JSDoc comments matching the style of the existing fields.

## 2. DeploymentsContext: parallel fetch effect

- [x] 2.1 Extend the existing effect keyed on `resolvedSelectedDeploymentId` (currently only fetching configuration) to also fetch details via `Promise.allSettled([getDeploymentConfiguration(id), getDeploymentDetails(id)])`, so both requests fire concurrently.
- [x] 2.2 On `resolvedSelectedDeploymentId === null`, set both `selectedDeploymentConfiguration` and `selectedDeploymentDetails` to `null`, set `isDeploymentDetailsLoading` to `false`, and skip both requests (matching current early-return behavior).
- [x] 2.3 Set `isDeploymentDetailsLoading` to `true` before the details fetch starts and `false` once it settles (success or failure), guarded by the effect's existing `signal.isCancelled` flag.
- [x] 2.4 Apply the configuration result and the details result independently from the two settled promises, so a rejection on one does not null out a fulfilled value on the other.
- [x] 2.5 Confirm the effect's cleanup (`signal.isCancelled = true`) suppresses state updates from both fetches when `resolvedSelectedDeploymentId` changes again or the provider unmounts before either settles.

## 3. Provider value and exports

- [x] 3.1 Add `selectedDeploymentDetails` and `isDeploymentDetailsLoading` to the `useMemo`-wrapped context value and its dependency array.

## 4. Tests

- [x] 4.1 In `apps/chat/src/context/tests/DeploymentsContext.spec.tsx`, add a test asserting `getDeploymentConfiguration` and `getDeploymentDetails` are both called when `resolvedSelectedDeploymentId` changes, without one awaiting the other (e.g. assert both mocks were invoked before either resolves).
- [x] 4.2 Add a test for successful details fetch: `selectedDeploymentDetails` set to the resolved DTO, `isDeploymentDetailsLoading` becomes `false`.
- [x] 4.3 Add a test for a details-fetch rejection: `selectedDeploymentDetails` becomes `null`, `isDeploymentDetailsLoading` becomes `false`, and a concurrently successful `selectedDeploymentConfiguration` is unaffected.
- [x] 4.4 Add a test for `resolvedSelectedDeploymentId === null`: both `selectedDeploymentConfiguration` and `selectedDeploymentDetails` are `null`, and neither `getDeploymentConfiguration` nor `getDeploymentDetails` is called.
- [x] 4.5 Add a test for unmount/selection-change before the details fetch resolves: the stale result does not update state (mirror the existing configuration cancellation test).
- [x] 4.6 Add a test confirming a re-render with the same `resolvedSelectedDeploymentId` does not call `getDeploymentDetails` again.

## 5. Verification

- [x] 5.1 Run `npm exec nx test chat` (or the scoped test file) and confirm all `DeploymentsContext` tests pass.
- [x] 5.2 Run `npm exec nx lint chat` and fix any violations.
- [x] 5.3 Manually open a conversation in the running app and confirm, via the network tab, that `GET /api/v1/deployments/{id}/details` fires alongside `GET /api/v1/deployments/{id}/configuration` when the conversation's model is selected.

## ADDED Requirements

### Requirement: `refetchDeployments`/`refetchToolsets` guard against stale in-flight responses

`DeploymentsContext` SHALL expose `refetchToolsets(): Promise<void>` and `refetchDeployments(): Promise<void>` (already part of `DeploymentsContextType`) that re-fetch and replace `toolsets`/`rawDeployments` respectively. The provider SHALL maintain two monotonic per-resource request-id counters (one for deployments, one for toolsets). Every call site that can set `rawDeployments` (the initial mount-time `loadDeployments`, and `refetchDeployments`) SHALL increment the deployments counter at dispatch time and only apply its result if the counter is unchanged when the response arrives; the same pattern applies to `toolsets` (initial load's toolsets fetch and `refetchToolsets`) against the toolsets counter. A response whose captured id no longer matches the current counter SHALL be silently discarded (no state update, no error surfaced) — it does not represent an error, only a superseded request.

This prevents a race where the initial mount-time list fetch (unavoidably in flight before any resource could have been shared to the user) resolves *after* a later, deliberate `refetchDeployments()`/`refetchToolsets()` call (e.g. one triggered right after accepting a share invitation) and overwrites its fresher result with the stale pre-share snapshot.

#### Scenario: A later refetch's result is not clobbered by a slower initial load

- **WHEN** the initial mount-time deployments fetch is still in flight and `refetchDeployments()` is called and resolves first with a fresh list
- **AND** the initial fetch's response subsequently arrives
- **THEN** `items` reflects the `refetchDeployments()` result, not the initial fetch's result

#### Scenario: A later refetch's result is not clobbered by a slower initial toolsets load

- **WHEN** the initial mount-time toolsets fetch is still in flight and `refetchToolsets()` is called and resolves first with a fresh list
- **AND** the initial fetch's response subsequently arrives
- **THEN** `toolsets` reflects the `refetchToolsets()` result, not the initial fetch's result

#### Scenario: Normal sequential refetch still applies

- **WHEN** `refetchDeployments()` (or `refetchToolsets()`) is called with no other in-flight request for that resource
- **THEN** its result is applied to `items`/`toolsets` as before, unaffected by the request-id guard

#### Scenario: A superseded response does not trigger an error notification

- **WHEN** a stale response for a since-superseded request arrives (successfully, from the network's perspective)
- **THEN** no `showNotification` error call is made and no state changes — the response is discarded because it is stale, not because it failed

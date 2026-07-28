## ADDED Requirements

### Requirement: Deployments/toolsets fetch is keyed to the authenticated identity

`DeploymentsProvider` SHALL treat the currently authenticated identity (`useUser().user?.sub`) as part of the load effect's dependencies, in addition to the existing `loadDeployments` callback. When the resolved `sub` changes while `DeploymentsProvider` remains mounted, the provider SHALL re-run `loadDeployments`, resetting `rawDeployments`, `schemas`, and `toolsets` to empty and `isLoading` to `true` for the duration of the refetch, exactly as it already does on initial mount. This SHALL NOT re-run merely because `user` is updated in place with unchanged `sub` (see `spa-auth-session`'s identity revalidation requirement).

This closes a defense-in-depth gap: even if a future code path (e.g. a different provider nesting used in overlay/embedded mode) keeps a `DeploymentsProvider` instance mounted across an identity change without an intervening `RequireAuth` unmount, the deployments/toolsets snapshot — and the `isMy` ownership flags computed for the previous identity — cannot outlive that identity change.

#### Scenario: Identity changes while DeploymentsProvider stays mounted

- **WHEN** `useUser().user?.sub` changes from one authenticated value to another while a `DeploymentsProvider` instance remains mounted
- **THEN** `isLoading` becomes `true`, `rawDeployments`/`schemas`/`toolsets` are cleared, and `loadDeployments` is re-invoked, replacing `items`/`toolsets` with data fetched for the new identity

#### Scenario: In-place user update with unchanged sub does not trigger a refetch

- **WHEN** `useUser().user` is replaced with a new object whose `sub` equals the previous value (e.g. from the `spa-auth-session` focus-revalidation requirement updating other claims)
- **THEN** `DeploymentsProvider` does NOT reset or refetch `rawDeployments`/`schemas`/`toolsets`

#### Scenario: Stale catalog item cannot survive an identity change

- **WHEN** a deployment or toolset with `isMy: true` was fetched for the previous identity, and the identity subsequently changes while the provider is mounted
- **THEN** that item is absent from `items`/`toolsets` after the refetch unless the new identity's own `GET /api/v1/deployments` response includes it, preventing a stale `itemId` belonging to the old identity's bucket from being available for a `Share` action under the new session

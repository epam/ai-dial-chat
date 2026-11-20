# Spec Delta

## ADDED Requirements

### Requirement: The org-unit hook answers the right to publish directly
`libs/chat-shared` SHALL export a pure right `canApprovePublicationsAt(access, publicPath)` that is `true` for a DIAL admin and otherwise only when the unit owning `publicPath` grants both `read` and `write` on the `publications` namespace; a path under no listed unit is `false` for a non-admin. Separately, the direct-publish answer below SHALL require an owning unit even for a DIAL admin, as `canWriteIntoOrgUnitAt` does. `useOrgUnits` SHALL return `canPublishDirectlyAt(publicPath, namespace)`: `true` only when status is `Ready`, the path lies inside a listed unit, `canWriteIntoOrgUnitAt` holds for `namespace`, and `canApprovePublicationsAt` holds. Until the status is `Ready` (and in `Disabled` and `Error`) it SHALL be `false`, so missing data never selects a write; the existing answers of the hook are unchanged. `buildFolderGuards` and `useFolderGuards` are unchanged: the host reads the hook's checks directly. `libs/chat-hooks` SHALL export a pure function that, given the folder, the entity's namespace, the dependency types and the hook's direct-publish and strict write checks, returns whether the direct path is available and which dependency namespaces are missing, so the host can fall back to a request and name the missing types.

#### Scenario: Unit grants the approval right
- **WHEN** unit `Delivery` grants `write` on `applications` and `read` and `write` on `publications`, and the path is `Delivery/Teams`
- **THEN** `canPublishDirectlyAt('Delivery/Teams', 'applications')` is `true`

#### Scenario: Half of the approval right
- **WHEN** the unit grants `read` but not `write` on `publications`
- **THEN** the answer is `false`

#### Scenario: Admin outside units
- **WHEN** the user is a DIAL admin and the path is under no unit
- **THEN** the answer is `false`

#### Scenario: Rights not loaded
- **WHEN** the status is `Idle`, `Loading`, `Disabled` or `Error`
- **THEN** the answer is `false` and the other checks answer as before

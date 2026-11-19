# Spec Delta

## ADDED Requirements

### Requirement: The org-unit hook answers the right to publish directly
`libs/chat-shared` SHALL export a pure right `canApprovePublicationsAt(access, publicPath)` that is `true` for a DIAL admin and otherwise only when the unit owning `publicPath` grants both `read` and `write` on the `publications` namespace; a path under no listed unit is `false` for a non-admin and, like `canWriteIntoOrgUnitAt`, the direct path SHALL still require an owning unit. `useOrgUnits` SHALL return `canPublishDirectlyAt(publicPath, namespace)`: `true` only when status is `Ready`, the path lies inside a listed unit, `canWriteIntoOrgUnitAt` holds for `namespace`, and `canApprovePublicationsAt` holds. Until the status is `Ready` (and in `Disabled` and `Error`) it SHALL be `false`, so missing data never selects a write; the existing answers of the hook are unchanged. `buildFolderGuards` SHALL accept the new check as `canPublishDirectlyAt` and expose `canPublishDirectlyTo(folderPath, root?)` for the Publish purpose only, matching the unit only for the Organization root. The helper that lists the dependency namespaces a folder lacks SHALL accept the same check, so the Publish panel names missing types with the Save panel's reason channel.

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

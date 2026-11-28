## ADDED Requirements

### Requirement: The org-unit state answers which public folders are visible
`libs/chat-shared/src/utils/org-unit.ts` SHALL export the pure function `isOrgUnitTreeFolder(units, publicPath): boolean`. It takes the same decoded public-relative path as `findOwningOrgUnit`, and it knows no endpoint, flag or context. It returns:
- `true` for the public root (an empty path);
- `true` when `findOwningOrgUnit(units, publicPath)` finds an owner (the folder is a unit or lies inside one);
- `true` when the folder, with one trailing slash, is a prefix at a segment boundary of some unit's normalised folder (the folder is an ancestor of a unit);
- `false` otherwise.

The function SHALL reuse the per-`units`-array normalisation memo of `findOwningOrgUnit`, and it ignores `hasAdminAccess`. A sibling that shares leading characters SHALL NOT count as an ancestor: `Ac` is not an ancestor of `Acme/Risk/`.

`useOrgUnits` (`libs/chat-hooks/src/org-units/useOrgUnits/useOrgUnits.ts`) SHALL return `isPublicFolderVisible(publicPath: string): boolean`, a `useCallback` over the loaded answer:
- when the status is `Ready`, it returns `isOrgUnitTreeFolder(units, publicPath)`;
- in `Idle`, `Loading`, `Disabled` and `Error`, it returns `true`, so missing data never hides a folder.

`useOrgUnits` SHALL also return `canCreatePublicFolderIn(publicPath: string): boolean`, a `useCallback` that tells a folder tree whether a new folder created inside the path would stay listed:
- when the status is `Ready`, it returns whether `findOwningOrgUnit(units, publicPath)` finds an owner, so it is `false` for the public root and for an ancestor-only folder;
- before `Ready`, it returns `true`.

`useOrgUnitsContext()` (`apps/chat/src/context/OrgUnitsContext.tsx`) SHALL forward both answers in its memoised value. While `features.orgUnitsEnabled` is off, it SHALL answer `true` for every path.

The existing answers of the hook are unchanged. No new state, request or cache is introduced: the answer reads the units `ensureUnits` and `refreshUnits` already load.

#### Scenario: Unit, inside a unit, ancestor
- **WHEN** the only unit has folder `public/Acme/Risk/`
- **THEN** `isOrgUnitTreeFolder` is `true` for `Acme`, `Acme/Risk` and `Acme/Risk/Reports`, and `false` for `Acme/Old` and `Shared`

#### Scenario: Encoded unit folder
- **WHEN** a unit's folder is `public/Acme/US%20Risk/`
- **THEN** `isOrgUnitTreeFolder(units, 'Acme/US Risk')` and `isOrgUnitTreeFolder(units, 'Acme')` are `true`

#### Scenario: Prefix that is not a segment
- **WHEN** the only unit is `public/Acme/`
- **THEN** `isOrgUnitTreeFolder(units, 'Ac')` and `isOrgUnitTreeFolder(units, 'Acme2')` are `false`

#### Scenario: Not loaded yet
- **WHEN** the status is `Loading`
- **THEN** `isPublicFolderVisible('Shared')` is `true`

#### Scenario: Loaded
- **WHEN** the status is `Ready` and `Shared/` lies under no unit and above none
- **THEN** `isPublicFolderVisible('Shared')` is `false`

#### Scenario: Where a new folder stays listed
- **WHEN** the status is `Ready` and the only unit is `public/Acme/Risk/`
- **THEN** `canCreatePublicFolderIn` is `true` for `Acme/Risk` and `Acme/Risk/Q1`, and `false` for `Acme`, `Shared` and the public root `''`

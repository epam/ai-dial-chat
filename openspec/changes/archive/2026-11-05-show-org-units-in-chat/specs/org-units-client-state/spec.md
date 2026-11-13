## ADDED Requirements

### Requirement: Pure helpers match a unit folder against a public-bucket path
`libs/chat-shared` SHALL export an `OrgUnit` type (`id`, `name`, `displayName`, `path`, `folder`) and pure functions `toOrgUnitFolderSet(units)` and `isOrgUnitFolder(unitFolders, publicPath)`. Matching SHALL work on a normalised form with exactly one trailing slash, reached differently for the two inputs. A unit's Core `folder` is url-encoded and rooted at `public/`: `normalizeOrgUnitFolder` decodes every segment (a malformed escape keeps the raw segment) and drops that leading root, and a folder outside `public/` normalises to nothing. The path passed to `isOrgUnitFolder` is already decoded and public-relative, as the file manager and the publish tree show it, so it is neither decoded nor stripped again: a top-level folder named `public` stays a folder, and a literal `%20` in a folder name is not a space. So Core's `public/Acme/US%20Risk/` and the file-manager path `Acme/US Risk` both reduce to `Acme/US Risk/`. A folder *inside* a unit SHALL NOT match. Only the unit's own folder does. `Risk/` SHALL NOT match `Risk2/`. The helpers live in the lib because both `apps/chat` and other hosts render DIAL public folders. They take resolved data only and know no endpoint.

#### Scenario: Encoded Core folder matches a decoded tree path
- **WHEN** the set holds a unit with `folder: "public/Acme/US%20Risk/"` and `isOrgUnitFolder` is asked about `Acme/US Risk`
- **THEN** it returns `true`

#### Scenario: Subfolder of a unit is not a unit
- **WHEN** the set holds `public/Acme/` and the path is `Acme/Reports/`
- **THEN** it returns `false`

#### Scenario: Prefix of a different name does not match
- **WHEN** the set holds `public/Risk/` and the path is `Risk2/`
- **THEN** it returns `false`

### Requirement: chat-hooks loads the org units once and reports a status
`libs/chat-hooks` SHALL export `useOrgUnits({ listOrgUnits })`. `listOrgUnits: () => Promise<{ enabled: boolean; units: OrgUnit[] }>` is supplied by the host, so the hook never builds a client or a URL. The hook SHALL return a status from the string enum `OrgUnitsStatus` (`Idle`, `Loading`, `Ready`, `Disabled`, `Error`), `ensureUnits()` (starts the load on first call; later calls are no-ops, except that the first call after a failed load starts it again) and `isOrgUnitFolder(path)` (a `useCallback` over the memoised set of unit folders). `enabled: false` SHALL give `Disabled` with no units, and is never re-read. A rejected promise SHALL give `Error` with no units, and SHALL NOT notify or rethrow; because the BFF never caches a failure, the next `ensureUnits()` retries it. The load SHALL use a cancelled flag so an unmounted owner never sets state. While the status is not `Ready`, `isOrgUnitFolder` returns `false` for every path.

#### Scenario: First ensureUnits loads, later calls do not
- **WHEN** `ensureUnits()` is called three times
- **THEN** `listOrgUnits` is called once and the status moves `Idle` → `Loading` → `Ready`

#### Scenario: Org units off
- **WHEN** `listOrgUnits` resolves `{ enabled: false, units: [] }`
- **THEN** the status is `Disabled` and `isOrgUnitFolder` returns `false` for every path

#### Scenario: A failed load is retried on the next request
- **WHEN** `listOrgUnits` rejects once and a consumer later calls `ensureUnits()` again
- **THEN** `listOrgUnits` is called a second time and the status moves `Error` → `Loading` → `Ready`

#### Scenario: Load fails silently
- **WHEN** `listOrgUnits` rejects
- **THEN** the status is `Error`, no notification is raised, and `isOrgUnitFolder` returns `false`

### Requirement: The app owns one shared org-unit state
`apps/chat/src/context/OrgUnitsContext.tsx` SHALL provide `OrgUnitsProvider` and `useOrgUnitsContext()`. It wraps `useOrgUnits` with the app wrapper `listOrgUnits` from `apps/chat/src/server-api/org-units.api.ts`, which calls the generated `orgUnitsApi.listOrgUnits()`. The context value SHALL be wrapped in `useMemo`. `useOrgUnitsContext()` SHALL throw a clear error outside the provider. The provider SHALL be mounted in `apps/chat/src/AppRoot.tsx` and SHALL NOT fetch on mount: a consumer calls `ensureUnits()` when it first needs the answer, so a session with no consumer makes no request. The feature is gated by the client-visible flag `features.orgUnitsEnabled` (env `ORG_UNITS_ENABLED`, off by default), read with `useFeatureFlag('orgUnitsEnabled')`: while it is off, the provider's `ensureUnits()` does nothing, so no request is made and no folder is a unit, and the BFF answers 403. When the flag resolves to on after a consumer has mounted, `ensureUnits` gets a new identity, so that consumer's effect starts the read. With the flag on, Core's org-units switch (404 → `Disabled`) still applies.

#### Scenario: No request until a consumer asks
- **WHEN** the app loads and no consumer calls `ensureUnits()`
- **THEN** `GET /api/v1/org-units` is not called

#### Scenario: Consumers share one load
- **WHEN** two consumers call `ensureUnits()` in the same session
- **THEN** `GET /api/v1/org-units` is called once

#### Scenario: Feature flag off
- **WHEN** `features.orgUnitsEnabled` is off and a consumer calls `ensureUnits()`
- **THEN** `GET /api/v1/org-units` is not called and `isOrgUnitFolder` returns `false` for every path

#### Scenario: Hook used outside the provider
- **WHEN** `useOrgUnitsContext()` is called with no `OrgUnitsProvider` above it
- **THEN** it throws an error naming `OrgUnitsProvider`

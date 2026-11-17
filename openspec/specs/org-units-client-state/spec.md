# Spec: org-units-client-state

## Purpose

How the chat loads the current user's org units once and answers which public-bucket folders are units, without libraries learning the endpoint. No surface renders a unit differently yet: consumers (for example publish permissions) read the answer through `OrgUnitsContext`.

## Requirements

### Requirement: chat-hooks loads the org units once and reports a status
`libs/chat-hooks` SHALL export `useOrgUnits({ listOrgUnits })` as the one org-unit hook. `listOrgUnits: () => Promise<{ enabled: boolean; hasAdminAccess: boolean; units: OrgUnit[] }>` is supplied by the host, so the hook never builds a client or a URL. The hook SHALL return a status from the string enum `OrgUnitsStatus` (`Idle`, `Loading`, `Ready`, `Disabled`, `Error`), `ensureUnits()` (starts the load on first call; later calls are no-ops, except that the first call after a failed load starts it again), `refreshUnits()` (re-reads without clearing the previous answer while the read runs), and `canSaveAt(publicPath, namespace)` and `canPublishAt(publicPath, namespace)` (each a `useCallback` over the memoised answer; `canSaveAt` wraps `canSaveToFolderAt`, `canPublishAt` wraps `canRequestPublicationAt`); `canSaveDirectlyAt(publicPath, namespace)` wraps `canWriteIntoOrgUnitAt` and is `false` until `Ready`, the one check that does not follow the unknown-means-allowed rule. The hook SHALL NOT expose the lenient `canWriteAt` or `canReadAt`: a direct write must go through `canSaveDirectlyAt`, so unknown rights can never allow it; the pure `canWriteAt` and `canReadAt` helpers stay in `libs/chat-shared`. `enabled: false` SHALL give `Disabled` with no units, and is never re-read. A rejected promise SHALL give `Error` with no units, and SHALL NOT notify or rethrow; because the BFF never caches a failure, the next `ensureUnits()` retries it. The load SHALL use a cancelled flag so an unmounted owner never sets state.

Until the status is `Ready`, and in `Disabled` and `Error`, the hook SHALL answer by the unknown-rights rule: `canSaveAt` and `canPublishAt` return `true` for every path, so a folder is never disabled by missing data and the Core 403 stays the only guard (today's behaviour). Only a `Ready` answer can disable a folder. The host maps a resource type to a namespace through `getOrgUnitNamespace(entityType)`, exported from `@epam/ai-dial-chat-hooks`, covering applications (including Quick App), toolsets, prompts, skills, projects and conversations; an existing mapping in the libs is reused or extended before a new one is written. The decision "which folders are usable for this panel" (flag on and `Ready`, namespace, path, reason text injected as a callback) lives in `libs/chat-hooks` as one function, `buildFolderGuards`, which returns `{ isDestinationUsable, getDisabledReason, canSaveDirectlyTo }` (all `undefined` unless the flag is on, the status is `Ready` and a namespace is given). `isDestinationUsable` and `getDisabledReason` take the destination's `SaveDestinationRoot` as an optional second argument and decide only for `SaveDestinationRoot.Organization` (an omitted root means Organization); every other root is always usable. The app wraps it in `useOrgUnitFolderGuards({ purpose, namespace, isActive, isQuickApp, shouldRefreshOnOpen })` (`apps/chat/src/hooks/publish/`), which takes one options object, reads the context, starts the read while `isActive`, re-reads loaded rights on open when `shouldRefreshOnOpen` (the save panel), and supplies the typed translated reason; the publish panels call it with `purpose: Publish`.

#### Scenario: First ensureUnits loads, later calls do not
- **WHEN** `ensureUnits()` is called three times
- **THEN** `listOrgUnits` is called once and the status moves `Idle` → `Loading` → `Ready`

#### Scenario: Org units off
- **WHEN** `listOrgUnits` resolves `{ enabled: false, hasAdminAccess: false, units: [] }`
- **THEN** the status is `Disabled` and `canSaveAt` returns `true` for every path

#### Scenario: A failed load is retried on the next request
- **WHEN** `listOrgUnits` rejects once and a consumer later calls `ensureUnits()` again
- **THEN** `listOrgUnits` is called a second time and the status moves `Error` → `Loading` → `Ready`

#### Scenario: Load fails silently
- **WHEN** `listOrgUnits` rejects
- **THEN** the status is `Error`, no notification is raised, and `canSaveAt` returns `true`

#### Scenario: Refresh keeps the previous answer meanwhile
- **WHEN** the status is `Ready` and `refreshUnits()` is called
- **THEN** `canSaveAt` keeps answering from the old data until the new read resolves

#### Scenario: Save check is true until Ready
- **WHEN** the status is `Idle`, `Loading`, `Disabled` or `Error`
- **THEN** `canSaveAt` returns `true` for every path

#### Scenario: Ready answer disables a folder
- **WHEN** the status is `Ready` and the owner of `Acme/Reports` grants only `read` on `applications`
- **THEN** `canSaveAt('Acme/Reports', OrgUnitNamespace.Applications)` returns `false`

### Requirement: The app owns one shared org-unit state
`apps/chat/src/context/OrgUnitsContext.tsx` SHALL provide `OrgUnitsProvider` and `useOrgUnitsContext()`. It wraps `useOrgUnits` with the app wrapper `listOrgUnits` from `apps/chat/src/server-api/org-units.api.ts`, which calls the generated `orgUnitsApi.listOrgUnits()` and maps the response. `useOrgUnitsContext()` SHALL return the hook's result: `status`, `ensureUnits`, `refreshUnits`, `canSaveAt`, `canSaveDirectlyAt` and `canPublishAt`; the former `isOrgUnitFolder` is removed. The context value SHALL be wrapped in `useMemo`. `useOrgUnitsContext()` SHALL throw a clear error outside the provider. The provider SHALL be mounted in `apps/chat/src/AppRoot.tsx` and SHALL NOT fetch on mount: a consumer calls `ensureUnits()` when it first needs the answer, so a session with no consumer makes no request. The feature is gated by the client-visible flag `features.orgUnitsEnabled` (env `ORG_UNITS_ENABLED`, off by default), read with `useFeatureFlag('orgUnitsEnabled')`: while it is off, `ensureUnits` and `refreshUnits` do nothing, so no request is made, `canSaveAt` and `canPublishAt` return `true` (and `canSaveDirectlyAt` returns `false`), and the BFF answers 403. When the flag resolves to on after a consumer has mounted, `ensureUnits` gets a new identity, so that consumer's effect starts the read. With the flag on, Core's org-units switch (404 → `Disabled`) still applies.

#### Scenario: No request until a consumer asks
- **WHEN** the app loads and no consumer calls `ensureUnits()`
- **THEN** `GET /api/v1/org-units` is not called

#### Scenario: Consumers share one load
- **WHEN** two consumers call `ensureUnits()` in the same session
- **THEN** `GET /api/v1/org-units` is called once

#### Scenario: Feature flag off
- **WHEN** `features.orgUnitsEnabled` is off and a consumer calls `ensureUnits()`
- **THEN** `GET /api/v1/org-units` is not called and `canSaveAt` returns `true` for every path

#### Scenario: Hook used outside the provider
- **WHEN** `useOrgUnitsContext()` is called with no `OrgUnitsProvider` above it
- **THEN** it throws an error naming `OrgUnitsProvider`

### Requirement: Pure helpers find the owning unit and answer a right
`libs/chat-shared` SHALL keep the `OrgUnit` type, extended with `permissions: Record<string, string[]>`, and `normalizeOrgUnitFolder`, and SHALL export the string enums `OrgUnitNamespace` (Core's namespaces: `files`, `conversations`, `prompts`, `applications`, `toolsets`, `skills`, `projects`, `publications`) and `OrgUnitAction` (`read`, `write`), the type `OrgUnitAccess` (`hasAdminAccess: boolean`, `units: OrgUnit[]`) and the pure functions `findOwningOrgUnit(units, publicPath)`, `canAccessAt(access, publicPath, namespace, action)`, `canWriteAt(access, publicPath, namespace)`, `canSaveToFolderAt(access, publicPath, namespace)`, `canWriteIntoOrgUnitAt(access, publicPath, namespace)`, `canReadAt(access, publicPath, namespace)` and `canRequestPublicationAt(access, publicPath, namespace)`. They take resolved data only and know no endpoint, flag or context.

The path is a decoded public-relative path, as the file manager and the publish tree show it (`Acme/US Risk`, `Acme/US Risk/Reports/2026`), neither decoded nor stripped again. A unit's Core `folder` is url-encoded and rooted at `public/`: `normalizeOrgUnitFolder` decodes every segment (a malformed escape keeps the raw segment), drops that root, gives exactly one trailing slash, and a folder outside `public/` normalises to nothing; so `public/Acme/US%20Risk/` and the path `Acme/US Risk` both reduce to `Acme/US Risk/`. The owner of a path is the unit whose normalised folder is the longest prefix of the path at a segment boundary; the unit's own folder belongs to that unit; the public root and a path under no listed unit have no owner. A sibling with the same leading characters does not match (`Risk/` does not own `Risk2/`). `canAccessAt` SHALL return:
- `true` when `hasAdminAccess` is `true`, for any path, owner or not;
- otherwise `false` when the path has no owner (outside units only a DIAL admin writes);
- otherwise whether the owner's `permissions[namespace]` includes the action. A namespace with no entry, an empty list or an absent `permissions` means no right. Role names are never consulted, and a `write` entry does not imply `read`.

`canSaveToFolderAt` answers whether a folder is a usable save destination: `true` for an admin, `true` when the path has no owner (the plain public folders keep today's save-then-request flow, so a Save panel never disables them), otherwise `canWriteAt` on the owner. `canWriteAt` itself stays strict (no owner means `false` for a non-admin) because a direct save into a unit needs a proven owner and `write`. `canWriteIntoOrgUnitAt` is that direct-save rule: an owner must exist and grant `write`, so a DIAL admin outside every unit does not take the direct path.

`canRequestPublicationAt` answers whether a publication request into the path can be sent: `true` when the path has no owner (outside units Core's folder read rules decide, as today, so the client does not block), otherwise `canReadAt` on the owner (Core needs `read` there to accept the request); `true` for an admin.

#### Scenario: Nested folder belongs to the nearest unit
- **WHEN** units `Acme/` (`applications: [read, write]`) and `Acme/US Risk/` (`applications: [read]`) are listed and the path is `Acme/US Risk/Reports`
- **THEN** the owner is `Acme/US Risk/`, `canReadAt` is `true` and `canWriteAt` for `applications` is `false`

#### Scenario: Unit's own folder
- **WHEN** the path equals a unit's folder `Acme/`
- **THEN** that unit is the owner

#### Scenario: Encoded Core folder matches a decoded path
- **WHEN** a unit has `folder: "public/Acme/US%20Risk/"` and the path is `Acme/US Risk/Plans`
- **THEN** that unit is the owner

#### Scenario: Prefix of a different name has no owner
- **WHEN** only `Risk/` is listed and the path is `Risk2/Plans`
- **THEN** there is no owner and `canWriteAt` is `false` for a non-admin

#### Scenario: Namespace missing means no right
- **WHEN** the owner's `permissions` is `{ "prompts": ["read", "write"] }` and `canWriteAt` is asked for `applications`
- **THEN** it returns `false`

#### Scenario: Admin may write anywhere
- **WHEN** `hasAdminAccess` is `true` and the path is `Plain/Folder` under no unit
- **THEN** `canWriteAt` returns `true`

#### Scenario: Non-admin outside every unit
- **WHEN** `hasAdminAccess` is `false` and the path is under no listed unit
- **THEN** `canWriteAt` and `canReadAt` return `false`

#### Scenario: Save outside units is not blocked
- **WHEN** `hasAdminAccess` is `false` and the path is under no listed unit
- **THEN** `canSaveToFolderAt` returns `true` while `canWriteAt` returns `false`

#### Scenario: Admin outside units does not write directly
- **WHEN** `hasAdminAccess` is `true` and the path is under no listed unit
- **THEN** `canWriteIntoOrgUnitAt` returns `false`, while inside a unit that grants `write` (or for an admin) it returns `true`

#### Scenario: Save into a unit needs write
- **WHEN** the owner's `permissions` grant only `read` on the namespace
- **THEN** `canSaveToFolderAt` returns `false`; with `write` it returns `true`; for an admin it returns `true`

#### Scenario: Publication request outside units is not blocked
- **WHEN** the path is under no listed unit and `hasAdminAccess` is `false`
- **THEN** `canRequestPublicationAt` returns `true`

#### Scenario: Publication request needs read inside a unit
- **WHEN** the owner's `permissions` hold no `read` for the namespace
- **THEN** `canRequestPublicationAt` returns `false`

#### Scenario: Custom role name is ignored
- **WHEN** a unit's `permissions` grant `write` on `skills` but its roles are not `editor` or `admin`
- **THEN** `canWriteAt` for `skills` returns `true`

#### Scenario: Parents missing from the list
- **WHEN** a unit is listed without the units above it (a unit reached only by path)
- **THEN** its own folder still owns paths inside it; the missing parents are not guessed (a known limitation, Core stays the authority)

### Requirement: Publish write access comes from the unit rights when they are known
`usePublishFolders` in `libs/chat-hooks/src/catalog/usePublishFolders/usePublishFolders.ts` SHALL keep the existing `Production` placeholder (`hasPublishFolderWriteAccess`) as the fallback and SHALL take an optional host callback `canPublishTo(folderPath: string[]) => boolean`; when a callback is given it replaces the placeholder, otherwise the placeholder applies. The app containers pass the callback, built from `useOrgUnitsContext().canPublishAt` and the resource type's namespace, only when `features.orgUnitsEnabled` is on and the status is `Ready`; otherwise they pass none. With the flag off, behaviour is exactly as today.

#### Scenario: Folder named Production with the flag on and rights Ready
- **WHEN** the flag is on, the status is `Ready`, and a user opens a publish panel where the folder `Production/Releases` lies under no org unit
- **THEN** it is selectable and the no-access callout does not show

#### Scenario: Folder named Production with the flag off or rights not Ready
- **WHEN** the flag is off, or the status is not `Ready`, and a user opens a publish panel with the folder `Production/Releases`
- **THEN** it is still blocked and the no-access callout shows, as today

#### Scenario: Read-less unit blocks the publish request
- **WHEN** the flag is on, the status is `Ready` and the owner of the selected folder grants no `read` on the type's namespace
- **THEN** `hasPublishWriteAccess` returns `false` and `derivePublishState` shows the no-access callout

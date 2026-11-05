## ADDED Requirements

### Requirement: Pure helpers match a unit folder against a public-bucket path
`libs/chat-shared` SHALL export an `OrgUnit` type (`id`, `name`, `displayName`, `path`, `folder`) and pure functions `toOrgUnitFolderSet(units)` and `isOrgUnitFolder(unitFolders, publicPath)`. Matching SHALL work on a normalised form: every segment url-decoded (a malformed escape keeps the raw segment), the leading `public/` removed, and exactly one trailing slash. So Core's `public/Acme/US%20Risk/` and the file-manager path `Acme/US Risk` both reduce to `Acme/US Risk/`. A folder *inside* a unit SHALL NOT match. Only the unit's own folder does. `Risk/` SHALL NOT match `Risk2/`. The helpers live in the lib because both `apps/chat` and other hosts render DIAL public folders. They take resolved data only and know no endpoint.

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
`libs/chat-hooks` SHALL export `useOrgUnits({ listOrgUnits })`. `listOrgUnits: () => Promise<{ enabled: boolean; units: OrgUnit[] }>` is supplied by the host, so the hook never builds a client or a URL. The hook SHALL return `units`, a memoised `unitFolders` set (`useMemo` on `units`), a status from the string enum `OrgUnitsStatus` (`Idle`, `Loading`, `Ready`, `Disabled`, `Error`), `ensureUnits()` (starts the load on first call; later calls are no-ops) and `isOrgUnitFolder(path)` (a `useCallback` over `unitFolders`). `enabled: false` SHALL give `Disabled` with no units. A rejected promise SHALL give `Error` with no units, and SHALL NOT notify or rethrow. The load SHALL use a cancelled flag so an unmounted owner never sets state. While the status is not `Ready`, `isOrgUnitFolder` returns `false` for every path.

#### Scenario: First ensureUnits loads, later calls do not
- **WHEN** `ensureUnits()` is called three times
- **THEN** `listOrgUnits` is called once and the status moves `Idle` → `Loading` → `Ready`

#### Scenario: Org units off
- **WHEN** `listOrgUnits` resolves `{ enabled: false, units: [] }`
- **THEN** the status is `Disabled` and `isOrgUnitFolder` returns `false` for every path

#### Scenario: Load fails silently
- **WHEN** `listOrgUnits` rejects
- **THEN** the status is `Error`, no notification is raised, and `isOrgUnitFolder` returns `false`

### Requirement: The app owns one shared org-unit state
`apps/chat/src/context/OrgUnitsContext.tsx` SHALL provide `OrgUnitsProvider` and `useOrgUnitsContext()`. It wraps `useOrgUnits` with the app wrapper `listOrgUnits` from `apps/chat/src/server-api/org-units.api.ts`, which calls the generated `orgUnitsApi.listOrgUnits()`. The context value SHALL be wrapped in `useMemo`. `useOrgUnitsContext()` SHALL throw a clear error outside the provider. The provider SHALL be mounted in `apps/chat/src/AppRoot.tsx` and SHALL NOT fetch on mount: the file manager and the publish destination tree call `ensureUnits()` when they first render, so a session that opens neither makes no request. The feature is not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. Core's org-units switch (404 → `Disabled`) is the only gate.

#### Scenario: No request until a consumer renders
- **WHEN** the app loads and the user never opens the file manager or a publish panel
- **THEN** `GET /api/v1/org-units` is not called

#### Scenario: Both surfaces share one load
- **WHEN** the user opens the file manager and then a publish panel in the same session
- **THEN** `GET /api/v1/org-units` is called once

#### Scenario: Hook used outside the provider
- **WHEN** `useOrgUnitsContext()` is called with no `OrgUnitsProvider` above it
- **THEN** it throws an error naming `OrgUnitsProvider`

### Requirement: One shared org-unit icon component
`libs/chat-shared` SHALL export `OrgUnitFolderIcon` (`libs/chat-shared/src/components/OrgUnitFolderIcon/OrgUnitFolderIcon.tsx`). It renders Tabler `IconSitemap` (`size={DIAL_ICON_SIZE.MD}`, `stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden`) inside an element with `role="img"`, whose `aria-label` and `title` are its `label` prop (English default `Organization unit`). Its colour comes from `colors.icon`, read in its `.module.scss` as `var(--oufi-icon, var(--text-secondary, #57647a))`. Both the file manager and the publish destination tree render this component, so the two surfaces cannot drift.

#### Scenario: Default name
- **WHEN** `OrgUnitFolderIcon` renders without `label`
- **THEN** it is an image named `Organization unit` with the same tooltip

### Requirement: File manager marks unit folders with a distinct icon
`DialFileManagerShell` in `libs/chat-shared` SHALL accept an optional `isOrgUnitFolder?: (item: DialFile) => boolean`. It SHALL pass a `getItemIcon` to both `treeOptions` and the grid options of `@epam/ai-dial-react-file-manager`. For a folder where the predicate is true, `getItemIcon` returns `OrgUnitFolderIcon` labelled with `labels.orgUnit` (new optional `DialFileManagerShellLabels.orgUnit`) and coloured by `DialFileManagerShellColors.orgUnitIcon`. Otherwise it returns `undefined`, which keeps the package's own icon. Files never get the unit icon. No Tailwind colour class is used. `FileManagerAttachModal` SHALL forward the same prop to the shell. In `apps/chat`, the predicate SHALL come from `useOrgUnitFolderPredicate(organizationRootLabel)` in `apps/chat/src/hooks/files/useOrgUnitFolderPredicate.ts`, which `DialFileManagerPage` and `DialFileManagerModal` both call. It calls `ensureUnits()` on mount. It is true only for rows under the Organization root, including the Organization section of the All tab: it converts the row's virtual path with `toOrganizationPublicPath` from `@epam/ai-dial-chat-hooks` (`libs/chat-hooks/src/org-units/org-unit-path.ts`) and asks the context's `isOrgUnitFolder`. `getItemIcon` SHALL be memoised with `useCallback`, so the grid and tree options memos stay stable. Breadcrumbs are unchanged.

#### Scenario: Unit folder in the Organization tree and grid
- **WHEN** the Organization tab lists `Acme/` and `Acme` is an org unit
- **THEN** the `Acme` row shows `IconSitemap` labelled `Organization unit` in the tree and in the grid, and a plain sibling folder keeps the folder icon

#### Scenario: Same folder name in My files is not marked
- **WHEN** the My files tab lists a folder named `Acme`
- **THEN** it keeps the folder icon

#### Scenario: Org units off
- **WHEN** the org-unit status is `Disabled` or `Error`
- **THEN** every folder keeps the folder icon and no error is shown

### Requirement: Publish destination tree marks unit folders with the same icon
`PublishFoldersTree` in `libs/publish-panel` SHALL accept an optional `isOrgUnitFolder?: (folderPath: string[], rootKey?: string) => boolean`. Segments are relative to their root, as in `PublishFolderNode.path`, and `rootKey` is passed in multi-root mode only. It SHALL also accept an optional `orgUnitLabel` prop (English default `Organization unit`). It SHALL pass `getItemIcon` to `DialFoldersTree`, which renders `OrgUnitFolderIcon` for a matching folder (never for a root), coloured by `PublishFoldersTreeColors.orgUnitIcon`.

Forwarding:
- `PublishPanel` and `StandalonePublishPanel` forward `isOrgUnitFolder(folderPath)`, with the label in `PublishPanelLabels.orgUnitLabel`.
- `SaveToFolderPanel` and `StandaloneSaveToFolderPanel` forward `isOrgUnitFolder(folderPath, rootKey)`, with the label in `SaveToFolderPanelLabels.orgUnitLabel`.
- `libs/catalog` threads `isPublishOrgUnitFolder` from `Catalog` through `DetailsPanel` to its `PublishPanel`.

In `apps/chat`, `useOrgUnitDestinationPredicate(isOpen)` (`apps/chat/src/hooks/publish/useOrgUnitDestinationPredicate.ts`) calls `ensureUnits()` once a panel is open. It supplies the predicates to `PublishConversationPanelContainer`, `PublishProjectPanelContainer`, `ResourceSavePanelContainer` (Organization root only, `SaveDestinationRoot.Organization`) and `CatalogView`. The catalog owns its panel's open state, so the read starts with the catalog. The label comes from `getPublishPanelCommonLabels` in `apps/chat/src/utils/publish.ts`. The panel's "Change folder" button and the selected-destination line keep `IconFolder`.

#### Scenario: Unit in the drill-in folder view
- **WHEN** the user opens Change folder and the tree shows `Acme`, an org unit
- **THEN** `Acme` shows `IconSitemap` labelled `Organization unit`, and selecting it works as for any folder

#### Scenario: Host passes no predicate
- **WHEN** a host renders `PublishFoldersTree` without `isOrgUnitFolder`
- **THEN** every folder keeps the folder icon, exactly as before this change

### Requirement: Indicator strings, direction and accessibility
The only new user-visible string SHALL be the i18n key `dialFileManager.orgUnit` (`Organization unit`). The key goes in `apps/chat/src/i18n/locales/en.json` and the `DialFileManagerI18nKeys` enum (`OrgUnit`) in `apps/chat/src/constants/translation-keys.ts`. `apps/chat` SHALL fill `DialFileManagerShellLabels.orgUnit` and every publish `orgUnitLabel` with `t(DialFileManagerI18nKeys.OrgUnit)`. The libs SHALL NOT import i18n. RTL: `IconSitemap` is not directional, so it is not mirrored. It sits where the folder icon was, so the row's existing logical spacing still applies and no physical classes are added. Accessibility: the label gives screen-reader and pointer users the same "this is a unit" information (the icon is not decorative). Keyboard navigation, focus order and row roles of both trees and the grid are unchanged.

#### Scenario: Arabic locale
- **WHEN** the chat runs in an RTL locale
- **THEN** the unit icon renders unmirrored at the start of the row, like the folder icon, and its label is the translated string

#### Scenario: Screen reader on a unit row
- **WHEN** a screen-reader user focuses the `Acme` unit row in either tree
- **THEN** the row's content includes an image named `Organization unit` next to the name `Acme`

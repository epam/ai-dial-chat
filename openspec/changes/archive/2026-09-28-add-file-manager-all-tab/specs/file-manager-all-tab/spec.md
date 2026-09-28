## ADDED Requirements

### Requirement: All tab enum member

`@epam/ai-dial-react-file-manager` SHALL declare `DialFileManagerTabs.All = 'all'` as the first member of `DialFileManagerTabs`, so that `useDialFileManagerTabs` lists it before `MyFiles`. The existing members and their string values SHALL be unchanged. This workspace SHALL depend on the release that contains it, declared at a single range across every manifest that names the package.

#### Scenario: Tab hook lists All first

- **WHEN** `useDialFileManagerTabs(labels)` is called with a label for every member
- **THEN** the first returned tab has `value === 'all'`

### Requirement: useDialFileManagerSections composes one manager per source section

`@epam/ai-dial-chat-hooks` SHALL export `useDialFileManagerSections(options)`, together with its `UseDialFileManagerSectionsOptions`, `UseDialFileManagerSectionsResult` and `DialFileManagerSection` types. Its options are those of `useDialFileManager` without `rootLabel`, plus `activeTab` (which may be `All`) and `sections: DialFileManagerSection[]` (`{ tab, rootLabel }`, where `tab` is one of `MyFiles`/`Shared`/`Organization`).

The hook SHALL call `useDialFileManager` exactly three times per render, in the fixed order MyFiles, Shared, Organization, whatever `sections` contains. Each call SHALL pass:

- that section's fixed `activeTab`
- its `rootLabel`, falling back to the tab id when the section is absent
- `isActive = sectionEnabled && (activeTab === section || activeTab === All)`
- `sessionKey = activeTab`

The result SHALL be a `UseDialFileManagerResult` plus `sectionTab`. The hook SHALL read no config, environment, i18n, or application context; section availability and labels arrive through `sections`.

**State ownership**: the composer owns only the browsed-section state and the last-info section. All listing and cache state stays in the per-section `useDialFileListing` instances.

**Memoisation**: the merged result and every routed callback SHALL be memoized on the section results.

#### Scenario: Single tab returns the section result unchanged

- **WHEN** `activeTab === Shared`
- **THEN** every field of the returned object equals the Shared instance's result, and `sectionTab === Shared`
- **AND** the MyFiles and Organization instances issue no requests

#### Scenario: Disabled section never loads

- **WHEN** `sections` omits Organization and `activeTab === All`
- **THEN** the Organization instance issues no request, and `items` has no Organization root

#### Scenario: Hook order is independent of configuration

- **WHEN** `sections` changes between renders from three entries to one
- **THEN** React reports no hook-order change, and the hook still calls `useDialFileManager` three times

### Requirement: All view renders one top-level folder per enabled section

When `activeTab === All`, the composer's `items` SHALL be the root node of each enabled section, in `sections` order. Each root node's `path` is `/${rootLabel}`. The initially browsed section SHALL be the first entry in `sections`, and `path` SHALL be that section's root path. Each root SHALL expand lazily. A section's first listing request is issued when All becomes active, and its children render when the user expands it.

#### Scenario: Three roots in order

- **WHEN** `sections` is My files, Shared, Organization (labels `My files`, `Shared`, `Organization`) and `activeTab === All`
- **THEN** `items.map(i => i.path)` is `['/My files', '/Shared', '/Organization']`, and `path === '/My files'`

#### Scenario: Expanding Shared lists shared-with-me items

- **WHEN** the user expands `/Shared` in the tree
- **THEN** the Shared instance's `onExpandedPathsChange` receives only the `/Shared…` paths
- **AND** the tree shows the items returned by `DialFilesApi.listSharedFiles`

### Requirement: All view routes every operation to the section that owns the path

The composer SHALL resolve a virtual path's section by matching its first segment exactly against each enabled `rootLabel` (`resolveSectionByPath` in `dial-file-manager-path.util.ts`). A path that matches no section SHALL be ignored. Routing is as follows:

- **Navigation:** `onPathChange(p)` SHALL make `p`'s section the browsed section and forward `p` to it. `onPathChange()` with no argument returns to the browsed section's root.
- **Browsed-section fields:** `path`, `isLoading`, `error`, `retry`, search fields, `uploadEnabled`, `isNewButtonDisabled`, `disabledNewButtonTooltip`, `visibleColumns`, `actionLabels`, `dateLocale`, `dateOptions` and `sectionTab` SHALL be the browsed section's.
- **Unions:** `expandedPaths`, `loadedPaths`, `folderPopupLoadingPaths`, `sharedWithMeIds` and `sharedByMePaths` SHALL be unions across sections. `onExpandedPathsChange` SHALL split its argument by section.
- **Path-routed callbacks:** upload, create-folder, download, delete, unshare, remove-access, info and rename-validate callbacks SHALL be routed by their destination, parent, or first item path.
- **Operation flags:** operation-in-progress flags SHALL be the logical OR across sections.
- **Upload batch:** `uploadBatchState` and its cancel/clear callbacks SHALL come from the section holding a non-null batch (the browsed section preferred), so an upload queue keeps rendering after the user navigates to another section.

#### Scenario: Browsing into a shared folder applies Shared rules

- **WHEN** on All the user opens `/Shared/team-folder/`, a nested shared folder with WRITE
- **THEN** `sectionTab === Shared` and `visibleColumns` includes the Author column
- **AND** `uploadEnabled === true`, and `actionLabels` contains no Delete

#### Scenario: Shared root disables upload on All

- **WHEN** on All the browsed path is `/Shared`
- **THEN** `uploadEnabled === false`, matching the Shared tab's root rule

#### Scenario: Organization folder is read-only on All

- **WHEN** on All the browsed path is under `/Organization`
- **THEN** `uploadEnabled === false`, and `actionLabels` contains only Download and (with the Full profile) Info

#### Scenario: My files actions on All match the My files tab

- **WHEN** on All the browsed path is `/My files/reports/` with WRITE and the Full profile
- **THEN** `actionLabels` equals what the My files tab produces for the same folder

#### Scenario: Delete routes to the owning section

- **WHEN** `onDeleteFiles` is called with items under `/My files/reports/`
- **THEN** only the My files instance's `onDeleteFiles` is invoked

#### Scenario: Label prefix does not mis-route

- **WHEN** a My files folder is named `Shared stuff` and the user opens `/My files/Shared stuff/`
- **THEN** the browsed section remains My files

#### Scenario: Upload queue survives section navigation

- **WHEN** an upload into `/My files/` is in progress and the user opens `/Organization`
- **THEN** `uploadBatchState` is still the My files batch, and `cancelUpload` cancels it

### Requirement: Cross-section copy and move are refused

On the All view, `onCopyFiles` and `onMoveToFiles` SHALL issue no request when the destination folder resolves to a different section from the source items (a drag between top-level folders included). Instead they SHALL call `onNotification` with `{ variant: NotificationVariant.Warning, reason: FileManagerNotificationReason.CrossSectionTransferUnsupported }`. Same-section destinations SHALL be routed to the source section unchanged.

The app's `file-manager-notification-adapter` SHALL map the reason to the i18n key `dialFileManager.crossSectionTransferUnsupported` (`DialFileManagerI18nKeys.CrossSectionTransferUnsupported`), with the `en` text "Copying and moving between My files, Shared, and Organization isn't supported yet."

#### Scenario: Copy from Organization into My files is refused

- **WHEN** `onCopyFiles` is called with items under `/Organization/docs/` and destination `/My files/`
- **THEN** no `DialFilesApi` copy call is made
- **AND** `onNotification` is called once with reason `CrossSectionTransferUnsupported`

#### Scenario: Move within My files proceeds

- **WHEN** `onMoveToFiles` is called with items under `/My files/a/` and destination `/My files/b/`
- **THEN** the My files instance's `onMoveToFiles` is invoked with the same arguments

### Requirement: Tab switches around All reset navigation and selection

Switching between All and any single tab, in either direction, SHALL reset every section's folder navigation, cache and expanded paths (via `sessionKey`), and SHALL return the browsed section to the first enabled section. `DialFileManagerPage` SHALL clear its selection on every tab change and on every `sectionTab` change.

#### Scenario: All to My files resets the subfolder

- **WHEN** on All the user is in `/My files/reports/` and switches to the My files tab
- **THEN** the My files tab opens at `/My files`, with no expanded folders and an empty selection

#### Scenario: Navigating to another section clears selection

- **WHEN** on All two files under `/My files/` are selected and the user opens `/Shared`
- **THEN** `selectedPaths` becomes empty

### Requirement: All tab label and layout

The All chip label SHALL be `t(DialFileManagerI18nKeys.TabAll)`, with key `dialFileManager.tab.all`, `en` "All". The All view SHALL add no new layout. It SHALL render within the existing responsive shell with no horizontal scroll at 360px, and correctly under `dir="rtl"`. No icon is added or mirrored.

#### Scenario: RTL renders the All tab without layout changes

- **WHEN** the page is rendered under `dir="rtl"` on the All tab
- **THEN** the All chip is the first chip in reading order, and the tree roots keep the order My files, Shared, Organization

#### Scenario: Mobile width has no horizontal scroll

- **WHEN** the page is rendered at 360px width on the All tab
- **THEN** the document has no horizontal scroll

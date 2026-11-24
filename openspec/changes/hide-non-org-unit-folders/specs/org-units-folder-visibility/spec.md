## ADDED Requirements

### Requirement: Only the org-unit tree of the public bucket is listed
While `features.orgUnitsEnabled` is on and the org-unit status is `Ready`, every surface that lists public-bucket folders SHALL list a folder only when `isOrgUnitTreeFolder(units, publicPath)` is `true` (see `org-units-client-state`). That means the folder is an org-unit folder, lies inside one, or is an ancestor of one. Every other public folder SHALL be hidden together with its whole subtree.

The surfaces are:
- the publish panels of the catalog (`apps/chat/src/components/CatalogView/CatalogView.tsx`), conversations (`apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`) and projects (`apps/chat/src/components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx`);
- the Organization root of the Save / Change folder tree (`apps/chat/src/components/ResourceSavePanelContainer/ResourceSavePanelContainer.tsx`);
- the Organization section of the File storage page (`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`) and of `DialFileManagerModal` (`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`), including the All tab, the folder tree, the grid, the Copy/Move destination panel and search results.

The rule SHALL apply to DIAL admins as it does to everyone, since Core already returns every unit to an admin. Only folders are hidden. A file stays listed while its parent folder is visible, including files directly in the public root or in an ancestor-only folder.

When the flag is off, or the status is `Idle`, `Loading`, `Disabled` or `Error`, no folder SHALL be hidden and every surface SHALL list exactly what it lists today. This is a presentation rule, not access control: Core access to a hidden folder is unchanged, and no request is added to the listing. No feature key from `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` applies beyond `orgUnitsEnabled`.

#### Scenario: Plain folder hidden from the publish tree
- **WHEN** the flag is on, the units are `Ready` with one unit `Acme/`, and the public bucket holds `Acme/` and `Shared/`
- **THEN** the catalog publish tree lists `Acme` and does not list `Shared` or any folder under it

#### Scenario: Ordinary folder inside a unit stays
- **WHEN** `Acme/` is a unit and `Acme/Reports/` is not
- **THEN** `Acme/Reports` is listed in every surface

#### Scenario: Ancestor of a unit stays as the path to it
- **WHEN** `Acme/Risk/` is a unit, `Acme/` is not, and `Acme/` also holds the plain folder `Acme/Old/`
- **THEN** `Acme` and `Acme/Risk` are listed and `Acme/Old` is hidden

#### Scenario: Save tree hides plain folders only under Organization
- **WHEN** the Save panel shows a Personal folder `Shared` and the Organization folder `Shared/`, which lies under no unit
- **THEN** the Personal `Shared` is listed and the Organization `Shared` is hidden

#### Scenario: File manager search drops results in hidden folders
- **WHEN** a search in the File storage Organization section matches `Shared/report.pdf` and `Acme/report.pdf`
- **THEN** only `Acme/report.pdf` is listed

#### Scenario: Copy/Move destination follows the same rule
- **WHEN** the user opens Copy on a file in the Organization section
- **THEN** the destination tree lists no folder that the Organization tree hides

#### Scenario: Flag off
- **WHEN** `features.orgUnitsEnabled` is off
- **THEN** every surface lists `Shared` as it does today and `GET /api/v1/org-units` is not called

#### Scenario: Units still loading or failed
- **WHEN** the org-unit status is `Loading` or `Error`
- **THEN** no folder is hidden, and once the status becomes `Ready` the plain folders leave the list without a reload

### Requirement: A hidden folder cannot come back through a remembered or current path
`usePublishFolders` (`libs/chat-hooks/src/catalog/usePublishFolders/usePublishFolders.ts`) SHALL apply its optional `isFolderVisible(folderPath: string[])` after merging remembered destinations and locally created folders into `folderItems`. A remembered or created path inside a hidden folder is therefore not listed. The tree search (`filterFolderTree` in `libs/publish-panel/src/utils/publish-folder-tree.ts`) runs over the pruned tree.

`useDialFileListing` (`libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts`) SHALL apply its optional `isPublicFolderVisible(publicPath: string)` only to the Organization tab. When the current path lies inside a hidden folder, for example after a deep link, a breadcrumb or a stale selection, the section SHALL show its root instead of an empty folder.

The `useOrgUnits` / `OrgUnitsContext` answer is the predicate's single source: `apps/chat/src/hooks/publish/usePublishFolders.ts` passes `isFolderVisible`, and `apps/chat/src/components/DialFileManagerShell/useDialFileManagerHostOptions.ts` passes `isPublicFolderVisible`. Both are wrapped in `useCallback` over the context answer. The pruned `folderItems` and `items` SHALL be memoised on the listing and the predicate identity, so an unrelated render does not rebuild the tree.

#### Scenario: Remembered destination in a plain folder
- **WHEN** `localStorage` remembers the destination `Shared/Reports` and `Shared/` lies under no unit
- **THEN** the publish tree does not list `Shared` or `Shared/Reports`

#### Scenario: Deep link into a hidden folder
- **WHEN** the File storage page opens on the Organization path `Shared/Reports`
- **THEN** the section shows the Organization root and lists no `Shared` folder

#### Scenario: Other tabs untouched
- **WHEN** the My files tab holds a folder `Shared`
- **THEN** it is listed whatever the org units are

### Requirement: Folder creation never produces a hidden folder
The Publish and Save panels in `libs/publish-panel` (`PublishPanel`, `StandalonePublishPanel`, `StandaloneSaveToFolderPanel`) SHALL accept an optional `canCreateFolderIn(destination: FolderDestination): boolean` and forward it to the `@epam/ai-dial-react-file-manager` folder tree they render. When it returns `false` for a parent, the tree SHALL NOT offer the trailing "Create new folder" button or the "Add child" item for that parent, nor "Add sibling" for that parent's children.

`libs/catalog` SHALL forward the host's predicate as `canCreatePublishFolderIn`, next to `getPublishDisabledReason`. The host answer comes from `useOrgUnitFolderGuards` (`apps/chat/src/hooks/publish/useOrgUnitFolderGuards.ts`):
- for an Organization destination, `true` only when the parent lies inside an org unit;
- for the Personal root, and while the rule is not `Ready`, `true`.

No new label is introduced: an action that is not offered is not rendered, so there is no i18n impact and no RTL impact. Keyboard order and the tree's ARIA roles are unchanged.

#### Scenario: No new folder at the Organization root
- **WHEN** the units are `Ready` and the user selects the Organization root in a publish tree
- **THEN** "Create new folder" is not offered for it

#### Scenario: New folder inside a unit
- **WHEN** the user selects the unit folder `Acme`
- **THEN** "Create new folder" and "Add child" are offered, and the created `Acme/New` stays listed

#### Scenario: No new folder in an ancestor-only folder
- **WHEN** `Acme/` is not a unit but `Acme/Risk/` is, and the user selects `Acme`
- **THEN** "Add child" is not offered for `Acme`, and "Add sibling" is not offered on `Acme/Risk`

#### Scenario: Personal root unaffected
- **WHEN** the Save panel's Personal root is selected
- **THEN** "Create new folder" is offered as today

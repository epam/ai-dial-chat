## ADDED Requirements

### Requirement: Shell gates per-tab UI on the controller's sectionTab

`FileManagerController` (`libs/chat-shared/src/file-manager/file-manager-controller.ts`) SHALL declare an optional `sectionTab?: DialFileManagerTabs`, documented as the source tab of the browsed folder and never `All`. `UseDialFileManagerResult` SHALL remain structurally assignable to `FileManagerController`.

`DialFileManagerShell` SHALL compute `gateTab = controller.sectionTab ?? activeTab` and use `gateTab` for:

- the upload-archive toolbar gate (`gateTab === DialFileManagerTabs.MyFiles`, together with the existing variant, profile and `uploadEnabled` conditions)
- the root empty state (`labels.emptyStateByTab[gateTab]`)
- the grid-editing-scroll reset

`activeTab` SHALL remain the value passed as `treeOptions.activeTab` and the key for `labels.treeHeaderByTab`. `DialFileManagerShellLabels.treeHeaderByTab` and `.emptyStateByTab` stay `Record<DialFileManagerTabs, …>`, so hosts supply an `all` entry.

#### Scenario: Upload-archive entry on the All tab inside My files

- **WHEN** the shell renders with `activeTab === All`, `controller.sectionTab === MyFiles`, `variant === Standalone`, `actionProfile === Full` and `uploadEnabled === true`
- **THEN** the upload-archive toolbar entry is present

#### Scenario: Upload-archive entry hidden on the All tab inside Organization

- **WHEN** the shell renders with `activeTab === All` and `controller.sectionTab === Organization`
- **THEN** the upload-archive toolbar entry is absent

#### Scenario: Root empty state follows the section

- **WHEN** `activeTab === All`, `controller.sectionTab === Shared`, the path is `/Shared` and there are no items
- **THEN** the empty state renders `labels.emptyStateByTab[Shared]`

#### Scenario: Strip still shows All pressed

- **WHEN** `activeTab === All` and `controller.sectionTab === Shared`
- **THEN** `treeOptions.activeTab` is `All`, and the tree header is `labels.treeHeaderByTab[All]`

#### Scenario: Controllers without sectionTab behave as before

- **WHEN** the attach modal renders the shell with a plain `useDialFileManager` result (no `sectionTab`)
- **THEN** every gate uses `activeTab`, exactly as before this change

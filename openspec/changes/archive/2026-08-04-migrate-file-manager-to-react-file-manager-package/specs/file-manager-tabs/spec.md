## MODIFIED Requirements

### Requirement: Tab navigation in DialFileManagerModal

`DialFileManagerModal` SHALL display the tabs present in the deployment-configured `fileManagerTabs` list (per `file-manager-tab-config`, read via `useAppConfig().config.fileManagerTabs`) — by default `My files`, `Shared with me`, and `Organization` (all three, when `FILE_MANAGER_AVAILABLE_TABS` is unset) — using `useDialFileManagerTabs` from `@epam/ai-dial-react-file-manager`, filtered against `fileManagerTabs`. The active tab SHALL be tracked via `handleTabChange` and wired to `DialFileManager` through `toolbarOptions.tabs`, `toolbarOptions.activeTab`, and `toolbarOptions.onTabChange`. The initial tab SHALL be the first tab present in `fileManagerTabs` following the fixed priority `my_files` → `shared` → `organization` (defaulting to `DialFileManagerTabs.MyFiles` when `fileManagerTabs` includes `my_files`, which is the default case).

Tab label i18n keys:
- `my_files` → `dialFileManager.tab.myFiles`
- `shared` → `dialFileManager.tab.shared`
- `organization` → `dialFileManager.tab.organization`

RTL: tab rendering and label alignment are handled by the ui-kit; no physical direction classes in the modal wrapper.

#### Scenario: Modal opens on My files tab

- **WHEN** `DialFileManagerModal` mounts with `isOpen=true` and `fileManagerTabs` includes `my_files` (the default)
- **THEN** the active tab is `DialFileManagerTabs.MyFiles` and the file listing shows the user's personal bucket

#### Scenario: Switching to Shared tab loads shared listing

- **WHEN** the user clicks the Shared with me tab
- **THEN** `activeTab` becomes `DialFileManagerTabs.Shared`, the listing reloads from the shared-files endpoint, and the path resets to the shared root

#### Scenario: Switching to Organization tab loads public listing

- **WHEN** the user clicks the Organization tab
- **THEN** `activeTab` becomes `DialFileManagerTabs.Organization` and the listing reloads from the public-files endpoint

#### Scenario: Tab switch resets folder navigation

- **WHEN** the user has navigated into a subfolder on My files and switches to Shared
- **THEN** the path resets to the root of the Shared tab and the cache for the previous tab is cleared

#### Scenario: Deployment-narrowed tab set hides an unconfigured tab

- **WHEN** `fileManagerTabs` is `['my_files', 'organization']` (Shared excluded by deployment configuration)
- **THEN** `DialFileManagerModal` does not render a Shared tab, and `toolbarOptions.tabs` contains only My files and Organization

#### Scenario: Initial tab falls back when my_files is excluded

- **WHEN** `fileManagerTabs` is `['shared', 'organization']` (My files excluded)
- **THEN** the initial active tab is `DialFileManagerTabs.Shared`, not `DialFileManagerTabs.MyFiles`

#### Scenario: Active tab resets when it becomes unavailable

- **WHEN** the modal is currently active on a tab that is subsequently no longer present in `fileManagerTabs` (e.g. the config resolves after mount to a narrower set that excludes the currently-active tab)
- **THEN** the active tab automatically changes to the first tab present in `fileManagerTabs` following the fixed priority `my_files` → `shared` → `organization`, per `useDialFileManagerTabConfig` (see `file-manager-tab-config`)

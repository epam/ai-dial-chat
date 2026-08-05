## MODIFIED Requirements

### Requirement: Tab navigation UI in DialFileManagerModal

`DialFileManagerModal` SHALL render My files, Shared with me, and Organization tabs using `useDialFileManagerTabs` from `@epam/ai-dial-react-file-manager`. The hook is called with an i18n-translated label map and `DialFileManagerTabs.MyFiles` as the initial tab. The resulting `tabs`, `activeTab`, and `handleTabChange` are wired to `toolbarOptions.tabs`, `toolbarOptions.activeTab`, and `toolbarOptions.onTabChange` respectively. No custom tab UI is built — the ui-kit toolbar handles tab rendering.

RTL: tab bar direction is handled by the ui-kit; no physical direction classes on the modal wrapper.

#### Scenario: Tab bar renders in modal toolbar

- **WHEN** `DialFileManagerModal` opens
- **THEN** three tabs are visible in the toolbar: My files, Shared with me, Organization
- **AND** the active tab is My files

#### Scenario: Tab labels use i18n

- **WHEN** the app language is changed
- **THEN** tab labels update to match the active locale's `dialFileManager.tab.*` keys

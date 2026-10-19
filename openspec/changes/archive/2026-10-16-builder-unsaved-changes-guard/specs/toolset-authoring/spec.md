## ADDED Requirements

### Requirement: Toolset editor reports unsaved changes to the host

`ToolsetEditor` from `libs/toolset-editor` SHALL accept a new optional prop `onDirtyChange?: (isDirty: boolean) => void`. It SHALL call this prop on mount and whenever the reported value changes. The value is whether the whole form — Metadata and Setup alike — differs from a baseline: the form the editor was seeded with, replaced by the last successfully persisted form.

When the user starts Log In, the editor may persist a draft first (`persistFormIfChanged`). After that persist succeeds, the editor SHALL report `onDirtyChange(false)` straight away, before the login continues, because the persisted draft is now the baseline. The OAuth login itself runs in a popup, so the editor page never unloads during it. A failed draft persist leaves the form dirty.

The lib stays free of routing and app contexts. `ToolsetApplicationEditor` (`apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`) SHALL:

- feed the reported value to `useBuilderLeaveGuard`;
- call `allowNextNavigation()` before its `onSaveComplete` navigation;
- keep `handleBack` as a plain navigation, which the guard intercepts.

#### Scenario: Dirty state is reported
- **WHEN** the user edits the toolset name and then reverts it
- **THEN** `onDirtyChange` is called with `true` and then with `false`

#### Scenario: Successful save exit is not intercepted
- **WHEN** a user saves a valid, dirty toolset with the primary action
- **THEN** the editor navigates to the return URL without the unsaved-changes dialog

#### Scenario: Log In draft persist clears dirtiness before the login continues
- **WHEN** a dirty toolset is persisted by Log In before the login request
- **THEN** `onDirtyChange(false)` is reported before the login continues

#### Scenario: Failed Log In draft persist keeps the form dirty
- **WHEN** Log In tries to persist a dirty toolset and the persist fails
- **THEN** `onDirtyChange(false)` is not reported and the form stays dirty

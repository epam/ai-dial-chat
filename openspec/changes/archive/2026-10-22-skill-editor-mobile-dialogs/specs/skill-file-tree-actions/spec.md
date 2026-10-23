# Spec Delta

## MODIFIED Requirements

### Requirement: Inline folder creation

At the `desktop` breakpoint, activating Create folder SHALL insert a draft folder node under the target folder, expand the target folder, and render the draft in `DialFoldersTree`'s inline rename state (via `renamedPath`) prefilled with `newFolderDefaultName` ("New folder"). Confirming SHALL call `fileActions.onCreateFolder(<target>/<name>)` with the trimmed name, remove the draft and select the new folder. Cancelling (Escape) SHALL remove the draft with no host call. Before confirming, the name SHALL be validated in this order, with the first failing message shown inline: empty after trim → `folderNameRequiredError` ("Enter a folder name"); contains `/` or `\`, or equals `.` or `..` → `folderNameInvalidError` ("Folder name can't contain / or \\, or be . or .."); equals the name of an existing sibling file or folder, or `SKILL.md` at the root → `folderNameDuplicateError` ("An item with this name already exists here"); otherwise the message returned by the optional `fileActions.validateFolderPath(<target>/<name>)`. Only one draft SHALL exist at a time; starting another Create folder replaces it. The draft SHALL NOT affect the dirty state until committed.

Below the `desktop` breakpoint, Create folder in the mobile Files pane SHALL NOT insert a draft; it SHALL open a Create folder dialog (a `BottomSheet`, titled `createFolderLabel`) with a required Name field (`createFolderNameLabel`, placeholder `createFolderNamePlaceholder`) and Create (`createFolderConfirmLabel`) / Cancel. The same validation order applies; its message SHALL appear under the field once Create has been pressed and SHALL update as the name is edited. A valid Create SHALL call `fileActions.onCreateFolder(<target>/<name>)`, expand the target folder, select the new folder and close the dialog; Cancel, Escape or the close control SHALL close it with no host call.

App keys: `skillEditor.newFolderDefaultName`, `skillEditor.folderNameRequired`, `skillEditor.folderNameInvalid`, `skillEditor.folderNameDuplicate`, `skillEditor.createFolderNamePlaceholder`; the dialog's Name label reuses `skillEditor.nameLabel`, and the host's `validateFolderPath` reuses `skillEditor.error.pathInvalid`.

#### Scenario: Creating a root folder
- **WHEN** nothing but `SKILL.md` is selected, the user chooses Create folder, types `scripts` and confirms
- **THEN** `fileActions.onCreateFolder('scripts')` is called and, once the host adds the node, `scripts` is selected

#### Scenario: Creating a nested folder
- **WHEN** the user chooses Create folder in the context menu of `docs`, types `img` and confirms
- **THEN** `docs` is expanded and `fileActions.onCreateFolder('docs/img')` is called

#### Scenario: Duplicate name is rejected
- **WHEN** a sibling named `docs` exists and the user confirms the name `docs`
- **THEN** `folderNameDuplicateError` is shown inline and `onCreateFolder` is not called

#### Scenario: Cancelling leaves the tree unchanged
- **WHEN** the user presses Escape on the draft folder
- **THEN** the draft disappears and no host callback is invoked

#### Scenario: Mobile names a folder in a dialog
- **WHEN** below the `desktop` breakpoint the user chooses Create folder with `docs` selected, types `img` and presses Create
- **THEN** no tree draft appears, `fileActions.onCreateFolder('docs/img')` is called and the dialog closes

### Requirement: Responsive, RTL and accessibility

The Add dropdown and node menus SHALL render inside the Files pane on desktop and inside the mobile "Editing file" card, using only logical Tailwind properties. No directional icon is introduced (plus, folder-plus, upload, archive and database icons are symmetric and SHALL NOT be mirrored; submenu chevrons are the ui-kit's own). Every Tabler icon SHALL pass `stroke={DIAL_KIT_ICON_STROKE}` and `aria-hidden`. The folder-name error SHALL be exposed by `DialFoldersTree`'s rename field on desktop, and by the Create folder dialog's Name field below the `desktop` breakpoint, where Enter in the field submits like Create. The feature is not gated behind `ENABLED_FEATURES`; it ships with the Skill Editor route. No telemetry is added.

#### Scenario: Keyboard-only Create folder
- **WHEN** a keyboard user focuses Add, presses Enter, arrows to Create folder, presses Enter, types a name and presses Enter
- **THEN** the folder is created without using a pointer

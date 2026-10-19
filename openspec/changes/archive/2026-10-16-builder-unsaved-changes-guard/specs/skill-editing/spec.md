## MODIFIED Requirements

### Requirement: Dirty-navigation guard

The page considers the form to have unsaved changes when the most recent `onDirtyChange` call from `libs/skill-editor` reported `true`. While the edit or create form has unsaved changes, the page SHALL guard **every** in-app navigation away from it through `useBuilderLeaveGuard` and the shared "Discard unsaved changes?" dialog (see `builder-unsaved-changes-guard`). This covers:

- Cancel;
- the page's Back control while the `SKILL.md` view is shown;
- nav rail and mobile-sheet items;
- Settings;
- Log out;
- browser Back/Forward.

The page SHALL also guard closing or reloading the tab through `beforeunload`.

The dialog outcomes are:

- **Discard changes**: the navigation proceeds to the destination the user chose.
- **Keep editing**: the user stays on the page with their edits intact.

The page SHALL NOT use `useUnsavedChangesGuard` or its own confirmation popup.

The Back control while a supporting file is selected is **not** a navigation and SHALL NOT be guarded. It returns to the `SKILL.md` view inside the editor (see `skill-file-preview`'s "Returning from a supporting-file preview"). It neither discards edits nor leaves the page, so it SHALL NOT raise the confirmation. Cancel SHALL remain an editor exit in every selection state, guarded as above.

#### Scenario: Cancel with unsaved changes confirms first
- **WHEN** a user has unsaved edits and activates Cancel
- **THEN** the "Discard unsaved changes?" dialog opens before navigating to `returnUrl`; choosing Keep editing leaves the edits intact

#### Scenario: Cancel with no unsaved changes navigates immediately
- **WHEN** a user has made no edits (or has reverted to the seeded state) and activates Cancel
- **THEN** the page navigates immediately, with no confirmation prompt

#### Scenario: Back from the manifest view with unsaved changes confirms first
- **WHEN** a user has unsaved edits, the `SKILL.md` view is shown, and they activate Back
- **THEN** the dialog opens before navigating to `returnUrl`; choosing Keep editing leaves the edits intact

#### Scenario: Back from a supporting-file preview with unsaved changes does not prompt
- **WHEN** a user has unsaved edits, a supporting file is selected, and they activate Back
- **THEN** the editor returns to the `SKILL.md` view with the edits intact, no confirmation prompt is shown, and no navigation occurs

#### Scenario: Cancel from a supporting-file preview is still guarded
- **WHEN** a user has unsaved edits, a supporting file is selected, and they activate Cancel
- **THEN** the dialog opens before navigating to `returnUrl`, exactly as it does from the `SKILL.md` view

#### Scenario: Navigating to another section with unsaved changes confirms first
- **WHEN** a user has unsaved edits and activates the Chat nav rail item
- **THEN** the dialog opens and the URL is unchanged until the user chooses; Discard changes lands on `ROUTES.Root`

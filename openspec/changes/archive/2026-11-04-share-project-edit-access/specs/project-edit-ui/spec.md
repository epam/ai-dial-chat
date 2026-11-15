## ADDED Requirements

### Requirement: A shared editor edits the content but not the name

`ProjectEditPage` (`apps/chat/src/pages/ProjectEditPage/ProjectEditPage.tsx`) SHALL render the edit form for every loaded project with `canEdit: true`. That is the owner and a recipient with edit access; the read-only guard still sends a `canEdit: false` project to its view page. For a project with `canManage: false`, the page passes to `ProjectCreateForm`:

- `isNameReadOnly`, so the Name field shows the stored name and cannot be changed (see the `project-create-ui` capability);
- `labels.nameReadOnlyHint = t(ProjectsI18nKeys.EditNameReadOnlyHint)` ("Only the project owner can rename it.").

The owner's form is unchanged: `isNameReadOnly` is `false`, and no hint renders.

Because the field cannot change, `values.name` stays the loaded name. The save sends that name, so the BFF makes no move and the page stays on the same route. Instructions and context files are edited, validated, dirty-checked, guarded on leave and saved exactly as for the owner. The draft hook (`useProjectDraft`) and the save hook (`useSaveProject`) do not change.

A save the BFF refuses with `403` (for example, the owner revoked the share while the page was open) shows the existing `projects.edit.toast.error` and keeps the draft.

**State ownership:** no new state. `isNameReadOnly` is derived from the loaded `ProjectDetailsDto` on render.

**Feature flag:** `projectsEnabled`, unchanged. **RTL impact:** none beyond the form's (the hint is text in normal flow under the field). **Accessibility:** see the `project-create-ui` capability: the read-only field stays focusable and is described by the hint.

#### Scenario: An editor opens the edit page

- **WHEN** a recipient with edit access opens `/projects/edit/z9y8x7/research` for a project with `canEdit: true` and `canManage: false`
- **THEN** the form renders with the stored instructions and context files, the Name input is read-only with the value `research`, and the hint "Only the project owner can rename it." is shown under it

#### Scenario: An editor saves new instructions

- **WHEN** that editor changes the instructions and activates Save
- **THEN** `updateProject` is called with `name: 'research'`, and after the success toast the router is at `/projects/view/z9y8x7/research`

#### Scenario: The owner can still rename

- **WHEN** the owner opens the edit page of their project
- **THEN** the Name input is editable, and no read-only hint renders

## MODIFIED Requirements

### Requirement: Project edit strings flow through react-i18next

The edit page SHALL resolve every string through `useTranslation().t()` with `ProjectsI18nKeys` / `ButtonsI18nKeys` members. New `en.json` keys, with matching `ProjectsI18nKeys` members:

| Key | English |
| --- | --- |
| `projects.edit.title` | Edit project |
| `projects.edit.saving` | Saving… |
| `projects.edit.savingStatus` | Saving project… |
| `projects.edit.toast.success` | `Project "{{name}}" saved` |
| `projects.edit.toast.error` | Could not save the project |
| `projects.edit.errors.unknownFile` | A removed file no longer exists. Reload and try again. |
| `projects.edit.nameReadOnlyHint` | Only the project owner can rename it. |

`projects.edit.nameReadOnlyHint` is the `ProjectsI18nKeys.EditNameReadOnlyHint` member.

Reused keys: `buttons.save`, `buttons.reload`, `projects.create.errors.*`, `projects.errors.changedElsewhere`, and every key `useProjectCreateFormLabels` already resolves. Every key SHALL exist in every locale file.

#### Scenario: Edit title

- **WHEN** the edit page renders
- **THEN** the form's `<h1>` reads "Edit project", and the submit button reads "Save"

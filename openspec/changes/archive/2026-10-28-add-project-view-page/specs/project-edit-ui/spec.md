## ADDED Requirements

### Requirement: The project edit page renders behind the projectsEnabled flag

The application SHALL register `ROUTES.ProjectEdit` (`/projects/edit/:bucket/*`) in `apps/chat/src/app/app.tsx` as a lazy-loaded `ProjectEditPage` (`apps/chat/src/pages/ProjectEditPage/ProjectEditPage.tsx`), inside the standard `RouteErrorBoundary` + `Suspense` + `RouteFallback` wrapper.

The page SHALL:

- render `RouteFallback` until the app config is ready;
- render `NotFoundPage` when `projectsEnabled` is not `true`;
- rebuild the id with `parseProjectRouteParams`;
- load the project with `useProject`;
- while loading, render `RouteFallback`;
- on error or not-found, render the same states the view page uses, through `ProjectView`'s state rendering with `project={null}`.

**Read-only guard.** When the loaded project has `canEdit: false`, the page SHALL `navigate(getProjectViewRoute(id), { replace: true })` and render nothing editable.

**Feature flag:** `projectsEnabled`. **RTL impact:** inherited from `ProjectCreateForm` (logical properties, mirrored back arrow). **i18n impact:** see the i18n requirement.

#### Scenario: Shared project cannot be edited by URL

- **WHEN** a user opens `/projects/edit/z9y8x7/shared-research` for a project with `canEdit: false`
- **THEN** the router replaces the location with `/projects/view/z9y8x7/shared-research`

#### Scenario: Flag off

- **WHEN** `projectsEnabled` is not `true`
- **THEN** `NotFound` renders, and `getProject` is not called

### Requirement: The edit page seeds ProjectCreateForm from the loaded project

`ProjectEditPage` SHALL render `ProjectCreateForm` with its state seeded once per loaded `etag`:

- `values` = `{ name, description, instructions }` from the DTO;
- `contextFiles` = one `StoredProjectContextFile` per `contextFiles[]` entry: `{ id: 'stored:' + name, name, size, contentType, type, status: RequestStatus.Idle, isStored: true }`, with `contentType` and `type` inferred from the name.

The page owns these, in `useState`:

- `values`;
- `contextFiles`, a `ProjectContextFile[]`;
- `errors`;
- the derived `removedFileNames`: the stored names no longer present in `contextFiles`;
- the new files: the `Attachment` entries in `contextFiles`.

**Labels.** Every form label comes from `useProjectCreateFormLabels`, with these overrides:

- `title`: `projects.edit.title` ("Edit project");
- `createLabel`: `buttons.save`;
- `submittingLabel`: `projects.edit.saving` ("Saving…");
- `creatingStatus`: `projects.edit.savingStatus` ("Saving project…").

**Other props.** The limits, the file-manager picker and the refinement callbacks are wired as on `ProjectCreatePage`. `onBack` and `onCancel` navigate to `getProjectViewRoute(id)`.

**Dirty state.** `isDirty` is `true` when any value differs from the loaded DTO, any stored file was removed, or any new file was added. It is passed to `useBuilderLeaveGuard({ isDirty })`, which arms both the in-app confirmation and `beforeunload`.

#### Scenario: Form is prefilled

- **WHEN** the edit page loads a project with a description, instructions and two context files
- **THEN** the form shows those values, and two removable context cards, and the capacity meter reflects their sizes

#### Scenario: Removing a stored file marks the form dirty

- **WHEN** the user removes a stored context card
- **THEN** `isDirty` is `true`, and navigating away asks for confirmation

#### Scenario: Unchanged form does not prompt

- **WHEN** the user opens the edit page and activates Back without changes
- **THEN** no leave confirmation is shown, and the router is at the view route

### Requirement: Save sends one atomic update and handles every outcome

`useSaveProject` (`apps/chat/src/hooks/projects/useSaveProject.ts`) SHALL call `updateProject(id, fields, newFiles, removedFileNames, etag, signal)` in `apps/chat/src/server-api/projects.api.ts`. That wrapper calls:

```ts
projectsApi.updateProject({
  id,
  ifMatch: etag,
  name,
  description,
  instructions,
  fileNames: JSON.stringify(newFiles.map((file) => file.name)),
  removedFileNames: JSON.stringify(removedFileNames),
  files: newFiles,
});
```

The hook returns `{ save, isSubmitting }`, aborts the request on unmount, and normalizes failures with `getApiErrorDetails` into `{ status, code, requestId }`. Before submitting, the page trims `name`.

The page maps outcomes as follows:

- **Success:**
  1. `showSuccessNotification` with `projects.edit.toast.success` (interpolating `{{name}}`);
  2. when `response.id !== id`, `replacePinnedProjectId(id, response.id)` from `useUserConfig()`;
  3. `allowNextNavigation()`;
  4. `navigate(getProjectViewRoute(response.id))`.
- **`409 name-taken`:** `errors.name` is set to `projects.create.errors.nameTaken`. Focus moves to Name, and the draft is kept.
- **`409 project-changed`:** `showErrorNotification` with `projects.errors.changedElsewhere`, with a Reload action (`buttons.reload`). Reload calls `retry()` from `useProject`, which reseeds the form from the new ETag. The draft is kept until the user chooses Reload.
- **`400`/`413` file codes** (`unsupported-file-type`, `file-too-large`, `capacity-exceeded`, `invalid-file-name`, `duplicate-file-name`, `too-many-files`, `unknown-file`): `errors.context`, through `mapProjectCreateError` (`apps/chat/src/utils/project-create-errors.ts`), which gains `unknown-file` → `projects.edit.errors.unknownFile`.
- **`400 invalid-name`:** the matching name message.
- **`413 project-too-large`, `428`, and anything else:** `showErrorNotification` with `projects.edit.toast.error`, and the draft is kept.

#### Scenario: Save without rename

- **WHEN** the user edits the instructions and saves
- **THEN** `updateProject` is called once with the loaded ETag, empty `fileNames` and `removedFileNames`, and the router is at the same view route after the toast

#### Scenario: Rename navigates to the new id and keeps the pin

- **WHEN** a pinned project `q4` is renamed to `Q4 launch` and the save resolves with `id: 'projects/a1b2c3/Q4 launch'`
- **THEN** `replacePinnedProjectId` is called, the leave guard does not prompt, and the router is at `/projects/view/a1b2c3/Q4%20launch`

#### Scenario: Name collision is inline

- **WHEN** `updateProject` rejects with `409` and `code: 'name-taken'`
- **THEN** the Name field shows "A project with this name already exists", focus is on Name, and no toast is shown

#### Scenario: Concurrent change asks to reload

- **WHEN** `updateProject` rejects with `409` and `code: 'project-changed'`
- **THEN** a toast says the project was changed by someone else and offers Reload, and the draft is unchanged until Reload is chosen

#### Scenario: Added file uses only new bytes

- **WHEN** the user adds `retro.pdf` and removes `survey.xlsx`, then saves
- **THEN** `files` contains only `retro.pdf`, `fileNames` is `["retro.pdf"]`, and `removedFileNames` is `["survey.xlsx"]`

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

Reused keys: `buttons.save`, `buttons.reload`, `projects.create.errors.*`, `projects.errors.changedElsewhere`, and every key `useProjectCreateFormLabels` already resolves. Every key SHALL exist in every locale file.

#### Scenario: Edit title

- **WHEN** the edit page renders
- **THEN** the form's `<h1>` reads "Edit project", and the submit button reads "Save"

### Requirement: The edit page is mobile-first, RTL-safe and meets WCAG 2.1 AAA

The edit page SHALL inherit `ProjectCreateForm`'s layout, RTL and accessibility contract (`project-create-ui`). In addition:

- The Reload action of the conflict toast is a keyboard-operable button.
- Focus moves to Name on `name-taken`.
- Stored context cards have the same named remove buttons as new ones (`labels.removeFileLabel(name)`).
- The page's handlers are `useCallback`, and the seeded initial values are `useMemo` keyed by the loaded `etag`.

#### Scenario: Remove button is named

- **WHEN** a stored file `tickets.csv` is shown
- **THEN** its remove button is named "Remove tickets.csv"

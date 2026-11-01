## MODIFIED Requirements

### Requirement: Save sends one atomic update and handles every outcome

`useSaveProject` (`apps/chat/src/hooks/projects/useSaveProject.ts`) SHALL call `updateProject(id, fields, newFiles, removedFileNames, contentVersion, signal)` in `apps/chat/src/server-api/projects.api.ts`. That wrapper calls:

```ts
projectsApi.updateProject({
  id,
  ifMatch: contentVersion,
  name,
  description,
  instructions,
  fileNames: JSON.stringify(newFiles.map((file) => file.name)),
  removedFileNames: JSON.stringify(removedFileNames),
  files: newFiles,
});
```

`contentVersion` is the value the loaded `ProjectDetailsDto` carries, not its `etag`: a project conversation written while the form is open does not change it, so chatting in another tab never makes the save fail (see the `project-detail-api` capability). The hook returns `{ save, isSubmitting }`, aborts the request on unmount, and normalizes failures with `getApiErrorDetails` into `{ status, code, requestId }`. Before submitting, the page trims `name`.

The page maps outcomes as follows:

- **Success:**
  1. `showSuccessNotification` with `projects.edit.toast.success` (interpolating `{{name}}`);
  2. when `response.id !== id`, `replacePinnedProjectId(id, response.isPinned ? response.id : null)` from `useUserConfig()`, following the pin state the BFF reports because it moves the pin best-effort;
  3. `allowNextNavigation()`;
  4. `navigate(getProjectViewRoute(response.id), { replace: true })`, so Back never returns to the stale edit URL.
- **`409 name-taken`:** `errors.name` is set to `projects.create.errors.nameTaken`. Focus moves to Name, and the draft is kept.
- **`409 project-changed`:** `showErrorNotification` with `projects.errors.changedElsewhere`, with a Reload action (`buttons.reload`). Reload calls `retry()` from `useProject`, which reseeds the form from the new `contentVersion`. The draft is kept until the user chooses Reload.
- **`400`/`413` file codes** (`unsupported-file-type`, `file-too-large`, `capacity-exceeded`, `invalid-file-name`, `duplicate-file-name`, `too-many-files`, `unknown-file`): `errors.context`, through `mapProjectCreateError` (`apps/chat/src/utils/project-create-errors.ts`), which gains `unknown-file` → `projects.edit.errors.unknownFile`.
- **`400 invalid-name`:** the matching name message.
- **`413 project-too-large`** (the stored `PROJECT.md` is over the BFF's manifest limit): `showErrorNotification` with `projects.edit.toast.tooLarge`, and the draft is kept.
- **`428`, `403`, and anything else:** `showErrorNotification` with `projects.edit.toast.error`, and the draft is kept.

#### Scenario: Save without rename

- **WHEN** the user edits the instructions and saves
- **THEN** `updateProject` is called once with the loaded `contentVersion`, empty `fileNames` and `removedFileNames`, and the router is at the same view route after the toast

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

#### Scenario: A chat written while editing does not interrupt the save

- **WHEN** the project's `etag` changed after the edit page loaded because a project conversation was written, and its `contentVersion` did not
- **THEN** the save sends the loaded `contentVersion` and succeeds, and no "changed by someone else" toast is shown

## MODIFIED Requirements

### Requirement: The app page owns form state, submission and navigation

`ProjectCreatePage` SHALL own the form state:

- `values: ProjectCreateFormValues` (`{ name, description, instructions }`, all initially `''`);
- `contextFiles: Attachment[]`, using the `Attachment` type from `@epam/ai-dial-chat-shared`, initially `[]`;
- `errors: ProjectCreateFormErrors`.

No new React context is introduced.

Submission goes through a `useCreateProject` hook (`apps/chat/src/hooks/projects/useCreateProject.ts`, one hook per file, with JSDoc on why it exists).

- The hook calls `createProject(values, files, signal)` in `apps/chat/src/server-api/projects.api.ts`, which calls `projectsApi.createProject({ name, description, instructions, fileNames: JSON.stringify(names), files })` on the generated `ProjectsApi`.
- The request is aborted on unmount.
- Before submitting, the page trims leading and trailing whitespace from `name`. Description and instructions are sent unchanged.

The page maps outcomes as follows:

- **Success:**
  1. `showSuccessNotification` with `projects.create.toast.success` (interpolating `{{name}}`);
  2. `allowNextNavigation()` from `useBuilderLeaveGuard`;
  3. `navigate(getProjectViewRoute(response.id))`, so the user lands on the new project's view page (`project-view-ui`).
- **`409 name-taken`:** `errors.name` is set to `projects.create.errors.nameTaken`. The form keeps every value and file, and focus moves to Name.
- **`400 invalid-name`:** `errors.name` is set to the matching client message.
- **`400`/`413` with a file code** (`unsupported-file-type`, `file-too-large`, `capacity-exceeded`, `invalid-file-name`, `duplicate-file-name`): `errors.context` is set to `projects.create.errors.filesRejected`. `too-many-files` maps to `projects.create.errors.tooManyFiles`.

  The client pre-check (`checkContextFiles`) already names each rejected file, so the server path is a fallback, and it does not name a file. The codes are read with `getApiErrorDetails` from `@epam/ai-dial-chat-hooks`, which exposes `code` but not `field`.
- **Any other failure** (`403`, `502`, `503`, network): `showErrorNotification` with `projects.create.toast.error`. The form keeps its state.

#### Scenario: Successful create

- **WHEN** the user submits a valid form named `Q4 launch` and `createProject` resolves with `id: 'projects/a1b2c3/Q4 launch'`
- **THEN** a success toast is shown, the leave guard does not prompt, and the router is at `/projects/view/a1b2c3/Q4%20launch`

#### Scenario: Duplicate name stays inline

- **WHEN** `createProject` rejects with `409` and `code: 'name-taken'`
- **THEN** the Name field shows the localized "A project with this name already exists" error, no toast is shown, and the entered description, instructions and files are kept

#### Scenario: Upstream failure keeps the draft

- **WHEN** `createProject` rejects with `503`
- **THEN** an error toast is shown, and every value and file is unchanged

### Requirement: ProjectCreateForm is a host-agnostic presentational component

`libs/projects` SHALL export `ProjectCreateForm`, together with:

- the `ProjectCreateFormProps`, `ProjectCreateFormLabels`, `ProjectCreateFormValues`, `ProjectCreateFormErrors` and `ProjectCreateFormStyles` types;
- the `ProjectCreateFormColors` and `ProjectCreateFormTypography` types;
- the `ProjectContextFile` and `StoredProjectContextFile` types;
- the `ProjectNameError` and `ContextFileRejection` string enums;
- the pure helpers `validateProjectName`, `checkContextFiles`, `getContextFilesSize`, `isStoredContextFile` and `filterContextFileItems`, with their `ContextFileLimits`, `ContextFileCheck` and `RejectedContextFile` types;
- the `PROJECT_NAME_MAX_BYTES` constant.

**The context-file type.** `ProjectContextFile` is `Attachment | StoredProjectContextFile`, where `StoredProjectContextFile` extends `DisplayAttachment` (`@epam/ai-dial-chat-shared`) with `size: number` and `isStored: true`.

- A stored file is one already in the project, with no browser `File`.
- `getContextFilesSize` and `checkContextFiles` read a file's size from `file.size` for an `Attachment`, and from `size` for a stored file.
- `Attachment` stays assignable to `contextFiles`. `onContextFilesChange` receives the union, and a host narrows it with the exported `isStoredContextFile` guard. `ProjectCreatePage` holds `ProjectContextFile[]` and uploads only the non-stored entries.
- The form renders both kinds identically.

The lib SHALL NOT import any of these:

- `@epam/ai-dial-chat-api-client`, or any REST path;
- feature flags, i18n, the router or app contexts;
- the DIAL file manager.

Its props:

| Prop | Type |
| --- | --- |
| `values` | `ProjectCreateFormValues` |
| `errors` | `ProjectCreateFormErrors` (`{ name?: string; context?: string }`) |
| `onFieldChange` | `<K extends keyof ProjectCreateFormValues>(field: K, value: ProjectCreateFormValues[K]) => void` |
| `contextFiles` | `ProjectContextFile[]` |
| `onContextFilesChange` | `(files: ProjectContextFile[]) => void` |
| `allowedExtensions` | `string[]` (lower-case, without a dot) |
| `maxFileBytes` | `number` |
| `maxTotalBytes` | `number` |
| `onPickFromFileManager` | optional `() => Promise<File[] \| undefined>`; the File manager source is hidden when omitted |
| `onRefineDescription` | optional `(value: string, signal: AbortSignal) => Promise<string>` |
| `onRefineInstructions` | optional `(value: string, signal: AbortSignal) => Promise<string>` |
| `onBack` | `() => void` |
| `onCancel` | `() => void` |
| `onSubmit` | `() => void` |
| `isSubmitting` | optional `boolean`, default `false` |
| `labels` | `ProjectCreateFormLabels` |
| `markdownEditorTheme` | optional `EditorThemes` |
| `styles` | optional `ProjectCreateFormStyles`, applied via `buildCssVars` |

Every declared prop SHALL be read. The same component serves the edit page (`project-edit-ui`). The host changes only the strings it already owns (`labels.title`, `labels.createLabel`, `labels.submittingLabel`, `labels.creatingStatus`) and passes stored files.

`ProjectCreatePage` supplies the host-owned pieces:

- `allowedExtensions`, `maxFileBytes` and `maxTotalBytes`, from `useAppConfig().config`;
- the refinement callbacks, from `useTextRefinementCallback`;
- `onPickFromFileManager`, from `useProjectFileManagerPicker`;
- every string, from `useProjectCreateFormLabels`, which formats the limits named in `labels.dropZoneHint` and the too-large message with `formatFileSize` from `@epam/ai-dial-chat-shared`.

#### Scenario: Lib has no host integration knowledge

- **WHEN** `libs/projects/src` is searched for `/api/`, `@epam/ai-dial-chat-api-client`, `useFeatureFlag`, `react-router` and `react-i18next`
- **THEN** none of them occurs

#### Scenario: Stored files count toward capacity

- **WHEN** `contextFiles` holds a stored file of 9.5 MiB, `maxTotalBytes` is 10 MiB, and the user drops a 1 MiB file
- **THEN** the dropped file is rejected with `ContextFileRejection.CapacityExceeded`

#### Scenario: Stored file is removable like a new one

- **WHEN** a stored file `tickets.csv` is rendered and its remove button is activated
- **THEN** `onContextFilesChange` receives the list without it

### Requirement: Added files show as removable cards with a capacity meter

Each context file, stored or new, SHALL render as an `AttachmentCard` from `@epam/ai-dial-attachment-input`, with an `onRemove` handler and `labels.removeFileLabel(name)` as the remove button's accessible name. The card shows:

- the name, truncated, with the full name in the tooltip;
- the type icon;
- the extension.

Cards wrap in a flex-wrap list (`<ul>` with one `<li>` each). Removing a card calls `onContextFilesChange` without that file.

Once at least one file is present, a capacity meter SHALL render:

- an element with `role="meter"`, `aria-valuemin={0}`, `aria-valuemax={maxTotalBytes}` and `aria-valuenow={usedBytes}`;
- `aria-valuetext={labels.capacityLabel(percent)}`, the same text as the visible label "N% of capacity used".

`percent` is `Math.min(100, Math.round(usedBytes / maxTotalBytes * 100))`. `usedBytes` is the sum of `file.size` for new files and `size` for stored files. The meter is not rendered while there are no files.

**Layout and type (design).** The form column is at most 1040px wide with `24px 32px` padding and `20px` between fields. Field labels are `dial-tiny-semi-text` (12/16 semibold, `--text-secondary`) with `8px` to their control; the instructions editor is 176px high. The Context header carries the label on the inline start and, on the inline end, the meter — a 60px bar with the percentage beside it — then the small (24px) neutral **Add** menu, `16px` apart. The Context section uses `8px` gaps, and the file list has `4px` extra top padding (12px below the drop zone).

#### Scenario: Meter appears with the first file

- **WHEN** a 1 MB file is added with a 10 MB total limit
- **THEN** a `role="meter"` element appears with the text "10% of capacity used" and `aria-valuenow` of 1048576

#### Scenario: Removing the last file hides the meter

- **WHEN** the only file's remove button ("Remove tickets.csv") is activated
- **THEN** the card and the meter are gone, and `onContextFilesChange` received `[]`

#### Scenario: Stored file sizes feed the meter

- **WHEN** the form renders one stored file with `size: 2097152` and a 10 MB total limit
- **THEN** the meter reads "20% of capacity used"

## ADDED Requirements

### Requirement: The Name field can be read-only

`ProjectCreateForm` SHALL accept `isNameReadOnly?: boolean` (default `false`) and `labels.nameReadOnlyHint?: string` (English default "Only the project owner can rename it."). With `isNameReadOnly`:

- **The input.** The Name `Input` renders `values.name` with the native `readOnly` attribute, not `disabled`, so it stays in the tab order and screen readers announce it as read-only. It keeps its visible label and `required`. `onFieldChange('name', …)` is never called.
- **The hint.** The form renders `labels.nameReadOnlyHint` as helper text under the field, with the form's helper typography (`helperClassName`), and gives it an `id`. The input's `aria-describedby` includes that id; when a name error is also shown, it includes both ids.
- **Validation.** `validateProjectName` still runs on the value and can still disable Submit. In practice it does not, because the host passes a stored, valid name.
- **Everything else** (instructions, context files, Refine with AI, header and footer buttons) behaves as without the prop.

Without `isNameReadOnly`, the hint does not render and the field behaves as before. The lib does not know why the name is locked: the host decides, and supplies the translated hint.

**RTL impact:** none. The hint is text in normal flow, and it has no directional icon.

#### Scenario: Read-only name

- **WHEN** `ProjectCreateForm` renders with `isNameReadOnly` and `values.name` `research`
- **THEN** the textbox named by `labels.nameLabel` has the value `research` and is read-only, and the hint text is rendered and linked from its `aria-describedby`

#### Scenario: Typing does not change a read-only name

- **WHEN** the user focuses the read-only Name input and types
- **THEN** `onFieldChange` is not called

#### Scenario: Editable by default

- **WHEN** the form renders without `isNameReadOnly`
- **THEN** the Name input is editable, and no hint renders

## MODIFIED Requirements

### Requirement: ProjectCreateForm is a host-agnostic presentational component

`libs/projects` SHALL export `ProjectCreateForm`, together with:

- the `ProjectCreateFormProps`, `ProjectCreateFormLabels`, `ProjectCreateFormValues`, `ProjectCreateFormErrors`, `ProjectCreateFormStyles` and `ProjectDropZoneLinks` types;
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
| `onPickFromFileManager` | optional `() => Promise<File[] \| undefined>`; the drop zone's file manager link is absent when omitted |
| `onRefineInstructions` | optional `(value: string, signal: AbortSignal) => Promise<string>` |
| `onBack` | `() => void` |
| `onCancel` | `() => void` |
| `onSubmit` | `() => void` |
| `isSubmitting` | optional `boolean`, default `false` |
| `isNameReadOnly` | optional `boolean`, default `false`; see "The Name field can be read-only" |
| `labels` | `ProjectCreateFormLabels`, including the optional `nameReadOnlyHint` |
| `markdownEditorTheme` | optional `EditorThemes` |
| `styles` | optional `ProjectCreateFormStyles`, applied via `buildCssVars` |

Every declared prop SHALL be read. The same component serves the edit page (`project-edit-ui`). The host changes only the strings it already owns (`labels.title`, `labels.createLabel`, `labels.submittingLabel`, `labels.creatingStatus`, and `labels.nameReadOnlyHint` when it locks the name), passes stored files, and sets `isNameReadOnly` for a caller who may not rename.

`ProjectCreatePage` supplies the host-owned pieces:

- `allowedExtensions`, `maxFileBytes` and `maxTotalBytes`, from `useAppConfig().config`;
- the Instructions refinement callback, from `useTextRefinementCallback`;
- `onPickFromFileManager`, from `useProjectFileManagerPicker`;
- every string, from `useProjectCreateFormLabels`, which formats the limits named in `labels.dropZoneHint` and the too-large message with `formatFileSize` from `@epam/ai-dial-chat-shared`.

`ProjectCreatePage` never sets `isNameReadOnly`.

#### Scenario: Lib has no host integration knowledge

- **WHEN** `libs/projects/src` is searched for `/api/`, `@epam/ai-dial-chat-api-client`, `useFeatureFlag`, `react-router` and `react-i18next`
- **THEN** none of them occurs

#### Scenario: Stored files count toward capacity

- **WHEN** `contextFiles` holds a stored file of 9.5 MiB, `maxTotalBytes` is 10 MiB, and the user drops a 1 MiB file
- **THEN** the dropped file is rejected with `ContextFileRejection.CapacityExceeded`

#### Scenario: Stored file is removable like a new one

- **WHEN** a stored file `tickets.csv` is rendered and its remove button is activated
- **THEN** `onContextFilesChange` receives the list without it

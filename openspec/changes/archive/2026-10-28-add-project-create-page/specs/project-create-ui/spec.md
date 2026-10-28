## ADDED Requirements

### Requirement: New project page renders behind the projectsEnabled flag

The application SHALL register `ROUTES.ProjectCreate` (`/projects/new`) as a lazy-loaded `ProjectCreatePage` (`apps/chat/src/pages/ProjectCreatePage/ProjectCreatePage.tsx`), using the `RouteErrorBoundary` + `Suspense` + `RouteFallback` wrapper. The route is registered unconditionally. The page reads `useFeatureFlag('projectsEnabled')` and renders `NotFoundPage` (`apps/chat/src/pages/NotFound/NotFound.tsx`) unless the flag is `true`, as `ProjectsPage` does. While the flag is off, no request is sent and no file-manager modal is mounted.

**Feature flag:** `projectsEnabled`. **RTL impact:** see the RTL requirement. **i18n impact:** see the i18n requirement.

#### Scenario: Flag off

- **WHEN** `projectsEnabled` is not `true` and the user opens `/projects/new` directly
- **THEN** the NotFound content renders, and `ProjectsApi.createProject` is never called

#### Scenario: Page is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/projects/new`
- **THEN** neither `ProjectCreatePage` nor `ProjectCreateForm` is in the initial bundle

### Requirement: The app page owns form state, submission and navigation

`ProjectCreatePage` SHALL own the form state:

- `values: ProjectCreateFormValues` (`{ name, description, instructions }`, all initially `''`);
- `contextFiles: Attachment[]`, using the `Attachment` type from `@epam/ai-dial-chat-shared`, initially `[]`;
- `errors: ProjectCreateFormErrors`.

No new React context is introduced.

Submission goes through a `useCreateProject` hook (`apps/chat/src/hooks/projects/useCreateProject.ts`, one hook per file, with JSDoc on why it exists). The hook calls `createProject(values, files, signal)` in `apps/chat/src/server-api/projects.api.ts`, which calls `projectsApi.createProject({ name, description, instructions, fileNames: JSON.stringify(names), files })` on the generated `ProjectsApi`. The request is aborted on unmount. Before submitting, the page trims leading and trailing whitespace from `name`. Description and instructions are sent unchanged.

The page maps outcomes as follows:

- **Success:** `showSuccessNotification` with `projects.create.toast.success` (interpolating `{{name}}`), then `allowNextNavigation()` from `useBuilderLeaveGuard`, then `navigate(ROUTES.Projects)`. There is no project detail route yet.
- **`409 name-taken`:** `errors.name` is set to `projects.create.errors.nameTaken`. The form keeps every value and file, and focus moves to Name.
- **`400 invalid-name`:** `errors.name` is set to the matching client message.
- **`400`/`413` with a file code** (`unsupported-file-type`, `file-too-large`, `capacity-exceeded`, `invalid-file-name`, `duplicate-file-name`): `errors.context` is set to `projects.create.errors.filesRejected`. `too-many-files` maps to `projects.create.errors.tooManyFiles`.

  The client pre-check (`checkContextFiles`) already names each rejected file, so the server path is a fallback, and it does not name a file. The codes are read with `getApiErrorDetails` from `@epam/ai-dial-chat-hooks`, which exposes `code` but not `field`.
- **Any other failure** (`403`, `502`, `503`, network): `showErrorNotification` with `projects.create.toast.error`. The form keeps its state.

#### Scenario: Successful create

- **WHEN** the user submits a valid form and `createProject` resolves
- **THEN** a success toast is shown, the leave guard does not prompt, and the router is at `/projects`

#### Scenario: Duplicate name stays inline

- **WHEN** `createProject` rejects with `409` and `code: 'name-taken'`
- **THEN** the Name field shows the localized "A project with this name already exists" error, no toast is shown, and the entered description, instructions and files are kept

#### Scenario: Upstream failure keeps the draft

- **WHEN** `createProject` rejects with `503`
- **THEN** an error toast is shown, and every value and file is unchanged

### Requirement: ProjectCreateForm is a host-agnostic presentational component

`libs/projects` SHALL export `ProjectCreateForm`, together with the `ProjectCreateFormProps`, `ProjectCreateFormLabels`, `ProjectCreateFormValues`, `ProjectCreateFormErrors` and `ProjectCreateFormStyles` types, the `ProjectCreateFormColors` and `ProjectCreateFormTypography` types, the `ProjectNameError` and `ContextFileRejection` string enums, the pure helpers `validateProjectName`, `checkContextFiles` and `getContextFilesSize` with their `ContextFileLimits`, `ContextFileCheck` and `RejectedContextFile` types, and the `PROJECT_NAME_MAX_BYTES` constant.

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
| `contextFiles` | `Attachment[]` |
| `onContextFilesChange` | `(files: Attachment[]) => void` |
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

Every declared prop SHALL be read. `ProjectCreatePage` supplies the host-owned pieces:

- `allowedExtensions`, `maxFileBytes` and `maxTotalBytes`, from `useAppConfig().config`;
- the refinement callbacks, from `useTextRefinementCallback`;
- `onPickFromFileManager`, from `useProjectFileManagerPicker`;
- every string, from `useProjectCreateFormLabels`, which formats the limits named in `labels.dropZoneHint` and the too-large message with `formatFileSize` from `@epam/ai-dial-chat-shared`.

#### Scenario: Lib has no host integration knowledge

- **WHEN** `libs/projects/src` is searched for `/api/`, `@epam/ai-dial-chat-api-client`, `useFeatureFlag`, `react-router` and `react-i18next`
- **THEN** none of them occurs

### Requirement: The form has a header with back, title, Cancel and Create

The form SHALL render inside `BuilderFormContainer` from `@epam/ai-dial-builder-form` (the shell `ScheduledTaskCreateForm` uses), whose header contains, in this order:

- a back icon button (`IconArrowNarrowLeft`, with `rtl:scale-x-[-1]`, named by `labels.backLabel`), which calls `onBack`;
- the `<h1>` title `labels.title` ("New project");
- on the inline end, **Cancel**, which calls `onCancel`;
- **Create**, which calls `onSubmit`.

At mobile widths the container moves Cancel and Create into a sticky footer, so both stay reachable.

Create SHALL be disabled while any of these holds:

- `validateProjectName(values.name.trim())` returns an error;
- `isSubmitting` is true;
- a refinement is pending.

While `isSubmitting`, Create shows the kit loading state and its accessible name stays `labels.createLabel`. `onBack` and `onCancel` in the app navigate to `ROUTES.Projects`. While the form is dirty, `useBuilderLeaveGuard({ isDirty })` asks for confirmation before leaving and keeps the browser's `beforeunload` guard active. `isDirty` is true when any value differs from `''` or `contextFiles` is non-empty.

#### Scenario: Create is disabled until a valid name is typed

- **WHEN** the form first renders
- **THEN** Create is disabled, and typing `Handbook` into Name enables it

#### Scenario: Cancel with unsaved changes asks for confirmation

- **WHEN** the user has typed a description and activates Cancel
- **THEN** the unsaved-changes confirmation opens, and the route changes only after the user confirms

#### Scenario: Clean form leaves without confirmation

- **WHEN** nothing has been entered and the user activates the back button
- **THEN** the router goes to `/projects` with no confirmation

#### Scenario: Submit in flight

- **WHEN** `isSubmitting` is true
- **THEN** Create is disabled and shows its loading state, and a second activation does not call `onSubmit`

### Requirement: Name is required and validated on the client with the BFF rule

The Name field SHALL be a kit `Input` with:

- the visible label `labels.nameLabel` and the placeholder `labels.namePlaceholder` ("Enter project name");
- `required` and `aria-required="true"`.

`validateProjectName(name: string): ProjectNameError | null` SHALL mirror the BFF rule in `project-create-api`. The members of `ProjectNameError` are `Required = 'required'`, `InvalidCharacters = 'invalid-characters'`, `Reserved = 'reserved'` and `TooLong = 'too-long'`. The helper checks the trimmed name and rejects:

- an empty name;
- a name of more than 255 UTF-8 bytes;
- any character matched by `PROHIBITED_CONVERSATION_NAME_CHARS_RE` from `@epam/ai-dial-chat-shared`;
- any `\p{Cc}` control character;
- the bidi controls U+200E, U+200F, U+202A–U+202E and U+2066–U+2069;
- `.`, `..`, `v`, `files`, `.dial-resource` and `.dial-folder`.

The client error appears after the field is first blurred, or after a submit attempt. It uses `labels.nameErrors[error]`. A host-supplied `errors.name` takes precedence. The error element has an `id`, is referenced by the input's `aria-describedby`, and sets `aria-invalid="true"` on the input.

#### Scenario: Invalid characters

- **WHEN** the user types `Q4/launch` and blurs the field
- **THEN** the localized invalid-characters message is shown under Name, the input has `aria-invalid="true"`, and Create is disabled

#### Scenario: Server error is linked to the field

- **WHEN** `errors.name` is "A project with this name already exists"
- **THEN** that text is rendered, and the Name input's `aria-describedby` includes its element id

### Requirement: Description and Instructions support Refine with AI

- **Description** SHALL be a multi-line `Textarea` with the label `labels.descriptionLabel` and the placeholder `labels.descriptionPlaceholder` ("Describe what the project is about").
- **Instructions** SHALL be the `MarkdownEditor` from `LazyMarkdownEditor()` (`@epam/ai-dial-ui-kit/editors`). It is loaded lazily, exactly as `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx` does, with its toolbar (bold, italic, strike, heading, lists, quote, link, code, table) and its edit / split / preview / fullscreen modes. It has the label `labels.instructionsLabel` and the placeholder `labels.instructionsPlaceholder` ("Explain your reasoning step by step for complex problems. Use specific examples.").

Each field is wrapped in `TextRefinementField` and driven by `useTextRefinement` from `@epam/ai-dial-chat-shared`, wired as in the Skill Editor:

- The Refine with AI action renders only when its callback is supplied.
- At most one refinement is pending per form. While it is pending, the other Refine action and Create are disabled.
- Undo restores the pre-refinement text.
- The refined text is published through `onFieldChange('description' | 'instructions', text)`.

`labels.refinement` (`TextRefinementLabels`) carries the copy. The app uses `TextRefinementPurpose.ProjectDescription` / `ProjectInstructions`, and supplies the callbacks only when `config.aiTextRefinementAvailable` is true.

#### Scenario: Refine Description

- **WHEN** the user activates Refine with AI on Description
- **THEN** `onRefineDescription` is called with the current text and an `AbortSignal`, the result replaces Description through `onFieldChange('description', …)`, and Undo restores the original text

#### Scenario: Refine Instructions keeps markdown

- **WHEN** Instructions contain a heading and a list and the user refines them
- **THEN** the refined markdown replaces Instructions through `onFieldChange('instructions', …)`

#### Scenario: Refinement unavailable

- **WHEN** neither refinement callback is supplied
- **THEN** neither field shows the Refine with AI action

### Requirement: Context files are added from the device or the file manager

The Context section SHALL render:

- **A drop zone**: the kit `FileDropzone`. Its label is `labels.dropZoneLabel` ("Drag&drop context, upload from device or file manager"), and its hint is the host-resolved `labels.dropZoneHint` ("File formats .csv, .pdf, .xlsx (max 1 MB)"), which names the same limits the host passes as props. The kit renders the area as a label over a visually hidden file input, so it is keyboard-operable and announced as a file input. The `accept` attribute is built from `allowedExtensions`.
- **A drag overlay**: `FileDndOverlay` from `@epam/ai-dial-attachment-input`, shown while a file-bearing drag is over the form.
- **An Add menu**: a kit `ButtonDropdown` labelled `labels.addLabel`, with two items. `labels.addFromDeviceLabel` opens the native picker. `labels.addFromFileManagerLabel` calls `onPickFromFileManager()`, and is present only when that prop is supplied.

Files from every source go through `checkContextFiles(incoming, contextFiles, { allowedExtensions, maxFileBytes, maxTotalBytes })`. The helper returns `{ accepted: Attachment[]; rejected: { name: string; reason: ContextFileRejection }[] }`. The members of `ContextFileRejection` are `UnsupportedType = 'unsupported-type'`, `TooLarge = 'too-large'`, `CapacityExceeded = 'capacity-exceeded'`, `Duplicate = 'duplicate'` and `InvalidName = 'invalid-name'`. The helper rejects:

- an extension that is not in `allowedExtensions`;
- a file over `maxFileBytes`;
- a file that would push the running total over `maxTotalBytes`;
- a name already present in `contextFiles` or earlier in the same batch;
- a name that fails `validateProjectName`.

Accepted files are appended through `onContextFilesChange`. Each rejection is listed under the drop zone as `labels.fileRejections[reason](name)`. Rejections are replaced by the next add and cleared by a remove. A non-empty `errors.context` renders in the same place.

`useProjectFileManagerPicker` (`apps/chat/src/hooks/projects/useProjectFileManagerPicker.ts`) is the app-level adapter. It follows `useSkillFileSystemPicker`:

- It opens `DialFileManagerModal` with `canAttachFolders={false}`, `allowedTypes` derived from the allowed extensions, and `maxSelectableFileSize={maxFileBytes}`.
- It downloads each picked file, which copies it into the project.
- It resolves the files as `File[]`. A download failure shows `projects.create.toast.fileManagerError` and resolves `undefined`.

#### Scenario: Add from device

- **WHEN** the user picks `tickets.csv` (200 KB) from the device
- **THEN** a card for `tickets.csv` appears, and `onContextFilesChange` receives one `Attachment` whose `file` is the picked `File`

#### Scenario: Add from the file manager

- **WHEN** the user picks `survey.xlsx` in the file manager and attaches it
- **THEN** the app downloads it, and a `survey.xlsx` card appears exactly as for a device upload

#### Scenario: Unsupported and oversized files are rejected on the client

- **WHEN** the user drops `notes.docx` and a 2 MB `big.pdf` with the default limits
- **THEN** neither is added, and both rejection messages are listed and announced

#### Scenario: Capacity overflow is rejected on the client

- **WHEN** files totalling 9.5 MB are added and the user adds a further 0.8 MB file with a 10 MB total limit
- **THEN** that file is rejected with the capacity message, and the existing files stay

#### Scenario: Keyboard upload

- **WHEN** a keyboard user tabs to the drop zone's file input and activates it
- **THEN** the native file picker opens, and the input's accessible name is `labels.dropZoneLabel`

### Requirement: Added files show as removable cards with a capacity meter

Each context file SHALL render as an `AttachmentCard` from `@epam/ai-dial-attachment-input`, with an `onRemove` handler and `labels.removeFileLabel(name)` as the remove button's accessible name. The card shows:

- the name, truncated, with the full name in the tooltip;
- the type icon;
- the extension.

Cards wrap in a flex-wrap list (`<ul>` with one `<li>` each). Removing a card calls `onContextFilesChange` without that file.

Once at least one file is present, a capacity meter SHALL render:

- an element with `role="meter"`, `aria-valuemin={0}`, `aria-valuemax={maxTotalBytes}` and `aria-valuenow={usedBytes}`;
- `aria-valuetext={labels.capacityLabel(percent)}`, the same text as the visible label "N% of capacity used".

`percent` is `Math.min(100, Math.round(usedBytes / maxTotalBytes * 100))`, and `usedBytes` is the sum of `file.size`. The meter is not rendered while there are no files.

#### Scenario: Meter appears with the first file

- **WHEN** a 1 MB file is added with a 10 MB total limit
- **THEN** a `role="meter"` element appears with the text "10% of capacity used" and `aria-valuenow` of 1048576

#### Scenario: Removing the last file hides the meter

- **WHEN** the only file's remove button ("Remove tickets.csv") is activated
- **THEN** the card and the meter are gone, and `onContextFilesChange` received `[]`

### Requirement: Form status is announced

The form SHALL contain a visually hidden `role="status"` `aria-live="polite"` region, which announces:

- each accepted add (`labels.filesAddedStatus(count)`);
- each rejection batch;
- each remove (`labels.fileRemovedStatus(name)`);
- the start of a submission (`labels.creatingStatus`, "Creating project…").

The generated client exposes no upload progress, so no percentage is announced. Host errors (`errors.name`, `errors.context`) render in `role="alert"` elements.

#### Scenario: Submission is announced

- **WHEN** `isSubmitting` becomes true
- **THEN** the status region text is "Creating project…"

### Requirement: Projects create strings flow through react-i18next

Every user-visible string SHALL be resolved in `ProjectCreatePage` with `useTranslation().t()`, and passed to the lib as a plain string or a formatter. The new keys live in the `projects` namespace of `apps/chat/src/i18n/locales/en.json`, and are referenced through `ProjectsI18nKeys`:

- `projects.page.newProject`
- `projects.create.title`
- `projects.create.name.label`
- `projects.create.name.placeholder`
- `projects.create.description.label`
- `projects.create.description.placeholder`
- `projects.create.instructions.label`
- `projects.create.instructions.placeholder`
- `projects.create.context.label`
- `projects.create.context.dropZone`
- `projects.create.context.hint` (interpolates `{{extensions}}` and `{{maxSize}}`)
- `projects.create.context.fromDevice`
- `projects.create.context.fromFileManager`
- `projects.create.context.fileManagerTitle`
- `projects.create.context.dropOverlayTitle`
- `projects.create.context.dropOverlaySubtitle`
- `projects.create.context.capacityMeter`
- `projects.create.context.capacity` (interpolates `{{percent}}`)
- `projects.create.context.remove` (interpolates `{{name}}`)
- `projects.create.status.added` (with `{{count}}` plural forms)
- `projects.create.status.removed` (interpolates `{{name}}`)
- `projects.create.status.creating`
- `projects.create.errors.nameRequired`
- `projects.create.errors.nameInvalid`
- `projects.create.errors.nameReserved`
- `projects.create.errors.nameTooLong`
- `projects.create.errors.nameTaken`
- `projects.create.errors.unsupportedType` (interpolates `{{name}}`)
- `projects.create.errors.tooLarge` (interpolates `{{name}}` and `{{maxSize}}`)
- `projects.create.errors.capacityExceeded` (interpolates `{{name}}`)
- `projects.create.errors.duplicate` (interpolates `{{name}}`)
- `projects.create.errors.invalidFileName` (interpolates `{{name}}`)
- `projects.create.errors.tooManyFiles`
- `projects.create.errors.filesRejected`
- `projects.create.toast.success` (interpolates `{{name}}`)
- `projects.create.toast.error`
- `projects.create.toast.fileManagerError`

The Cancel, Create and Add labels reuse `ButtonsI18nKeys.Cancel`, `ButtonsI18nKeys.Create` and `ButtonsI18nKeys.Add`, and the back button reuses `NavigationI18nKeys.Back`. The Refine with AI copy comes from the existing `useTextRefinementLabels`.

#### Scenario: Keys exist

- **WHEN** the change is applied
- **THEN** every key listed above exists in `en.json` and in `ProjectsI18nKeys`

### Requirement: New project page is mobile-first, RTL-safe and meets WCAG 2.1 AAA

The New project page and `ProjectCreateForm` SHALL meet the layout, RTL, accessibility and memoisation rules below.

**Layout:**

- The form is a single column with mobile-first spacing.
- Only the `desktop:` variant from `tools/tailwind/theme.css` is used. There are no `sm:`/`md:`/`lg:`/`xl:` prefixes.
- On `mobile`, the header keeps Cancel and Create visible and reachable. The title truncates first, and the buttons never wrap off-screen.
- File cards wrap.
- At a 320 px viewport, the page has no horizontal scroll with a 120-character name or file name.

**RTL:**

- Only logical properties are used (`ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end`).
- The back arrow is mirrored with `rtl:scale-x-[-1]`. The upload, plus and close icons are not mirrored.
- Direction is inherited from `<html dir>`.

**Accessibility:**

- Every field has a visible, programmatically associated label.
- Name has `aria-required="true"`, and its error is linked by `aria-describedby`.
- The drop zone and the Add menu are keyboard-operable.
- The capacity meter is a `role="meter"` with a text value.
- Status is announced through `aria-live`.
- Remove buttons have accessible names.
- Every Tabler icon passes `stroke={DIAL_KIT_ICON_STROKE}`. Decorative icons are `aria-hidden`.
- Text colors use theme tokens whose fallbacks meet 7:1.

**Memoisation:**

- The page memoises `labels` with `useMemo`, and its handlers with `useCallback`.
- The form computes `usedBytes`, `percent` and the `accept` string in `useMemo`.

#### Scenario: Narrow viewport

- **WHEN** the page renders at 320 px with a 120-character name and three files
- **THEN** `document.documentElement.scrollWidth` does not exceed `clientWidth`, Create is visible, and the cards wrap

#### Scenario: RTL back arrow

- **WHEN** `<html dir="rtl">` is set
- **THEN** the back icon carries `rtl:scale-x-[-1]`, and no physical `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`text-left`/`text-right` class occurs in the form source

### Requirement: Observability of project creation

No new client telemetry event SHALL be added. Project creation is observed through the BFF's existing HTTP lifecycle metrics (route template `/api/v1/projects`, method `POST`, status), and through the `ProjectsService` outcome log, which records the outcome, the file count and the total bytes, and never a name or any content.

#### Scenario: Metrics label the create route

- **WHEN** a create request completes with `409`
- **THEN** the HTTP lifecycle metric for `POST /api/v1/projects` records status `409`

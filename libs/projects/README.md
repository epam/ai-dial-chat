# @epam/ai-dial-projects

## Overview

Presentational Projects pages for a host app: the Projects list and the New project form. `Projects` renders a header, a search and sort toolbar, and a grid of project cards. Each card, on the kit `CardShell`, shows the project's name with the search match highlighted and, under a divider, its folder path: the source (personal, shared or organization) followed by the grouping folders it sits in. The component filters the projects by name and sorts them itself (Newest, Oldest or Name A–Z). It renders exactly one content state at a time: loading, error with retry, empty, no results, or the list. When the host reports `incompleteSources`, a notice with a retry action sits above the list; with nothing listed, that notice replaces the empty state so the page never claims there are no projects.

`ProjectCreateForm` is the New project form: a name, a description and markdown instructions (both with optional Refine with AI), and context files added from the device, by drag and drop, or from a host-supplied file picker, with a capacity meter. It checks names and files with the same rules the chat's BFF enforces, so it rejects early.

The lib knows nothing about routing, feature flags, i18n or any backend API. The host loads and creates the projects, owns the search query, sort key and form values, resolves every string, formats dates, and opens its own file manager. Use it when a host app needs the Projects pages. Wire data fetching, submission and feature gating at the app level, then render `<Projects />` or `<ProjectCreateForm />` with the resolved strings, values and handlers.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-projects": "*"
  }
}
```

Import the stylesheet once in the consuming app. It includes the structural styles of the `@epam/ai-dial-builder-form` dependency that the New project form is built on:

```ts
import '@epam/ai-dial-projects/styles.css';
```

The form also renders `@epam/ai-dial-attachment-input` cards and lazy-loads the kit markdown editor; both arrive as dependencies of this package.

## Peer Dependencies

- `react`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-chat-shared`

## Components

### Projects

Page shell with:

- an `<h1>` title and a subtitle;
- a search input inside a `role="search"` landmark;
- a sort control inside a `role="group"` named by `labels.sortLabel`. Its trigger shows the applied option's label, or `labels.sortLabel` when `sortKey` matches no option;
- the content region.

Search matches project names case-insensitively, using the trimmed `searchQuery`, and highlights the match. In both date orders, projects without `updatedAt` come last. Name A–Z collates with `Intl.Collator(locale, { sensitivity: 'base', numeric: true })`.

A visually hidden `role="status"` region announces:

- `labels.resultCountLabel(count)` while the list is shown;
- `labels.noResultsLabel`, `labels.emptyStateLabel`, `labels.errorLabel` or `labels.incompleteLabel` in the matching state;
- nothing while loading.

Each card is an `<article>` named by the project; the folder path is the kit `FolderPath`, named by `labels.folderPathLabel`. Cards are not interactive.

When `onCreateProject` is supplied, a primary **New project** button labelled `labels.createProjectLabel` sits at the inline end of the title row, and a second one is the empty state's action. Neither renders without the callback.

```tsx
import {
  Projects,
  ProjectSource,
  ProjectsSortKey,
} from '@epam/ai-dial-projects';

<Projects
  projects={[
    {
      id: 'projects/a1b2c3/q4-launch',
      name: 'Q4 launch',
      source: ProjectSource.Personal,
      updatedAt: 1791234567000,
    },
  ]}
  isLoading={false}
  hasError={false}
  incompleteSources={[]}
  onRetry={() => {}}
  searchQuery=""
  onSearchQueryChange={() => {}}
  sortKey={ProjectsSortKey.Newest}
  onSortKeyChange={() => {}}
  onCreateProject={() => {}}
  locale="en"
  labels={{
    title: 'Projects',
    subtitle:
      'Projects you own, projects shared with you, and your organization’s projects',
    searchPlaceholder: 'Search projects',
    searchAriaLabel: 'Search projects',
    clearSearchLabel: 'Clear search',
    sortLabel: 'Sort',
    sortOptions: [
      { value: ProjectsSortKey.Newest, label: 'Newest' },
      { value: ProjectsSortKey.Oldest, label: 'Oldest' },
      { value: ProjectsSortKey.NameAsc, label: 'Name A–Z' },
    ],
    emptyStateLabel: 'No projects yet',
    emptyStateDescription: 'Your projects will appear here once created.',
    noResultsLabel: 'No projects match your search',
    errorLabel: 'Projects could not be loaded',
    incompleteLabel:
      'Some projects could not be loaded. The list may be incomplete.',
    retryLabel: 'Retry',
    sourceLabels: {
      [ProjectSource.Personal]: 'Personal',
      [ProjectSource.Shared]: 'Shared',
      [ProjectSource.Organization]: 'Organization',
    },
    resultCountLabel: (count) => `${count} projects`,
    folderPathLabel: 'Project location',
    createProjectLabel: 'New project',
  }}
/>;
```

The layout is mobile-first:

- On mobile, the toolbar stacks the search above the sort control, and cards use a single column.
- From the `desktop` breakpoint, the toolbar is one row and the grid has three columns with a 20px gap, at most 1116px wide.

Only logical properties are used, so the layout follows the inherited `dir`.

`styles.colors` overrides the CSS custom properties. Each one falls back to the matching app theme token:

| Field            | Fallback            |
| ---------------- | ------------------- |
| `background`     | `--bg-layer-base`   |
| `subtitleText`   | `--text-secondary`  |
| `sortButtonText` | `--text-accent`     |
| `cardBackground` | `--bg-layer-raised` |
| `cardTitleText`  | `--text-primary`    |
| `cardDivider`    | `--stroke-tertiary` |
| `pathText`       | `--text-secondary`  |

`styles.typography` overrides the type-scale classes:

| Field                | Default                 |
| -------------------- | ----------------------- |
| `titleClassName`     | `'dial-h1-text'`        |
| `subtitleClassName`  | `'dial-body-text'`      |
| `cardTitleClassName` | `'dial-body-semi-text'` |
| `pathLabelClassName` | `'dial-tiny-text'`      |
| `pathLeafClassName`  | `'dial-tiny-semi-text'` |

### ProjectCreateForm

Controlled New project form inside the builder-form shell: a header with a back button (mirrored in RTL), the `<h1>` title, **Cancel** and **Create**, moved into a sticky footer on mobile.

- **Name** is required. `validateProjectName` checks it after the field is first blurred; a host `errors.name` (for example a taken name) takes precedence, is announced as an alert, and moves focus back to the field. The error is linked through `aria-describedby`.
- **Description** and **Instructions** (the kit markdown editor) get a Refine with AI action when `onRefineDescription` / `onRefineInstructions` is supplied. At most one refinement runs at a time.
- **Context** files come from the drop zone, a drag anywhere over the form, or the **Add** menu (device, and the file manager when `onPickFromFileManager` is supplied). `checkContextFiles` filters them; rejections are listed under the drop zone and announced. Each file renders as an `AttachmentCard` with a named remove button, and a `role="meter"` shows the share of `maxTotalBytes` in use once a file is added.
- **Create** is disabled while the name is invalid, a refinement is pending, or `isSubmitting` is true.

The form shows no unsaved-changes dialog: leaving is the host's decision through `onBack` / `onCancel`.

```tsx
import { ProjectCreateForm } from '@epam/ai-dial-projects';
import { ContextFileRejection, ProjectNameError } from '@epam/ai-dial-projects';

<ProjectCreateForm
  values={{ name: '', description: '', instructions: '' }}
  errors={{}}
  onFieldChange={(field, value) => {}}
  contextFiles={[]}
  onContextFilesChange={(files) => {}}
  allowedExtensions={['csv', 'pdf', 'xlsx']}
  maxFileBytes={1048576}
  maxTotalBytes={10485760}
  onPickFromFileManager={async () => undefined}
  onBack={() => {}}
  onCancel={() => {}}
  onSubmit={() => {}}
  labels={{
    title: 'New project',
    backLabel: 'Back',
    cancelLabel: 'Cancel',
    createLabel: 'Create',
    nameLabel: 'Name',
    namePlaceholder: 'Enter project name',
    nameErrors: {
      [ProjectNameError.Required]: 'Enter a project name',
      [ProjectNameError.InvalidCharacters]:
        'The name contains invalid characters',
      [ProjectNameError.Reserved]: 'This name is reserved',
      [ProjectNameError.TooLong]: 'The name is too long',
    },
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Describe what the project is about',
    instructionsLabel: 'Instructions',
    instructionsPlaceholder:
      'Explain your reasoning step by step for complex problems. Use specific examples.',
    contextLabel: 'Context',
    dropZoneLabel: 'Drag&drop context, upload from device or file manager',
    dropZoneHint: 'File formats .csv, .pdf, .xlsx (max 1 MB)',
    addLabel: 'Add',
    addFromDeviceLabel: 'Upload from device',
    addFromFileManagerLabel: 'File manager',
    capacityMeterLabel: 'Context capacity',
    capacityLabel: (percent) => `${percent}% of capacity used`,
    removeFileLabel: (name) => `Remove ${name}`,
    fileRejections: {
      [ContextFileRejection.UnsupportedType]: (name) =>
        `${name}: this file format isn't supported`,
      [ContextFileRejection.TooLarge]: (name) =>
        `${name}: the file is too large`,
      [ContextFileRejection.CapacityExceeded]: (name) =>
        `${name}: not enough capacity left`,
      [ContextFileRejection.Duplicate]: (name) => `${name}: already added`,
      [ContextFileRejection.InvalidName]: (name) => `${name}: invalid name`,
    },
    filesAddedStatus: (count) => `${count} files added`,
    fileRemovedStatus: (name) => `${name} removed`,
    creatingStatus: 'Creating project…',
  }}
/>;
```

`labels.submittingLabel` (defaults to `createLabel`), `labels.dropOverlayTitle` / `dropOverlaySubtitle` and `labels.refinement` (`TextRefinementLabels`) are optional. `markdownEditorTheme` sets the editor theme.

`styles.colors` overrides the CSS custom properties:

| Field          | Fallback            |
| -------------- | ------------------- |
| `background`   | `--bg-layer-base`   |
| `headerBorder` | `--stroke-tertiary` |
| `helperText`   | `--text-secondary`  |
| `meterTrack`   | `--bg-layer-sunken` |
| `meterFill`    | `--stroke-accent`   |

`styles.typography` overrides the type-scale classes:

| Field             | Default                 |
| ----------------- | ----------------------- |
| `titleClassName`  | `'dial-h1-text'`        |
| `labelClassName`  | `'dial-body-semi-text'` |
| `helperClassName` | `'dial-tiny-text'`      |

## Utilities

### validateProjectName

Returns the `ProjectNameError` for a name the chat BFF would reject, or `null`. It trims first, then rejects an empty name, more than `PROJECT_NAME_MAX_BYTES` (255) UTF-8 bytes, `: ; , = / \ { } % & "`, tab, control and bidi characters, and the reserved names `.`, `..`, `v`, `files`, `.dial-resource` and `.dial-folder`.

```ts
import { validateProjectName } from '@epam/ai-dial-projects';

validateProjectName('Q4/launch'); // ProjectNameError.InvalidCharacters
```

### checkContextFiles

Splits incoming `File`s into staged `Attachment`s to append and `{ name, reason }` rejections, against the files already added: an allowed extension, the per-file limit, the running total, a unique name and a valid name. `getContextFilesSize` sums the staged files' bytes.

```ts
import { checkContextFiles } from '@epam/ai-dial-projects';

const { accepted, rejected } = checkContextFiles(files, contextFiles, {
  allowedExtensions: ['csv', 'pdf', 'xlsx'],
  maxFileBytes: 1048576,
  maxTotalBytes: 10485760,
});
```

## Enums

### ProjectSource

Where a project comes from: `Personal` (`'personal'`), `Shared` (`'shared'`), `Organization` (`'organization'`).

### ProjectsSortKey

Order of the visible projects: `Newest` (`'newest'`), `Oldest` (`'oldest'`), `NameAsc` (`'name-asc'`).

### ProjectNameError

Why a name was rejected: `Required` (`'required'`), `InvalidCharacters` (`'invalid-characters'`), `Reserved` (`'reserved'`), `TooLong` (`'too-long'`).

### ContextFileRejection

Why a context file was not added: `UnsupportedType` (`'unsupported-type'`), `TooLarge` (`'too-large'`), `CapacityExceeded` (`'capacity-exceeded'`), `Duplicate` (`'duplicate'`), `InvalidName` (`'invalid-name'`).

## Types

- `ProjectItem` — `{ id, name, source, parentPath?, updatedAt? }`, one card; `updatedAt` only drives the date sort orders.
- `ProjectsLabels` — every user-visible string, including `sourceLabels`, `folderPathLabel` and the `resultCountLabel` callback.
- `ProjectsProps` — the props of `Projects`.
- `ProjectsStyles`, `ProjectsColors`, `ProjectsTypography` — style overrides.
- `ProjectCreateFormValues` — `{ name, description, instructions }`.
- `ProjectCreateFormErrors` — `{ name?, context? }`, host-supplied errors.
- `ProjectCreateFormLabels` — every string of the form, including the `nameErrors` and `fileRejections` maps.
- `ProjectCreateFormProps` — the props of `ProjectCreateForm`.
- `ProjectCreateFormStyles`, `ProjectCreateFormColors`, `ProjectCreateFormTypography` — style overrides.
- `ContextFileLimits`, `ContextFileCheck`, `RejectedContextFile` — the input and result of `checkContextFiles`.

# @epam/ai-dial-projects

## Overview

Presentational Projects pages for a host app: the Projects list, the New project form (also used to edit a project) and the project view. `Projects` renders a header, a search and sort toolbar, and a grid of project cards. Each card, on the kit `CardShell`, shows the project's name with the search match highlighted and, under a divider, its folder path: the source (personal, shared or organization) followed by the grouping folders it sits in. The component filters the projects by name and sorts them itself (Newest, Oldest or Name A–Z). It renders exactly one content state at a time: loading, error with retry, empty, no results, or the list. When the host reports `incompleteSources`, a notice with a retry action sits above the list; with nothing listed, that notice replaces the empty state so the page never claims there are no projects.

`ProjectCreateForm` is the New project form: a name, markdown instructions (with optional Refine with AI), and context files added from the device, by drag and drop, or from a host-supplied file picker. It checks names and files with the same rules the chat's BFF enforces, so it rejects early. Given stored context files, the same form edits an existing project.

`ProjectView` is one project's page: a header with Pin, Publish, Edit and a more-actions menu, and a Details panel with the description, the markdown instructions and a searchable list of context files.

The lib knows nothing about routing, feature flags, i18n or any backend API; the project requests and data hooks a host wires to it live in `@epam/ai-dial-chat-hooks/project` (see [Projects reuse](../../docs/projects-reuse.md)). The host loads and creates the projects, owns the search query, sort key and form values, resolves every string, formats dates, and opens its own file manager. Use it when a host app needs the Projects pages. Wire data fetching, submission and feature gating at the app level, then render `<Projects />`, `<ProjectCreateForm />` or `<ProjectView />` with the resolved strings, values and handlers.

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

- an `<h1>` title, and a subtitle when `labels.subtitle` is set;
- a search input inside a `role="search"` landmark;
- a sort control inside a `role="group"` named by `labels.sortLabel`. Its trigger shows the applied option's label, or `labels.sortLabel` when `sortKey` matches no option;
- the content region.

Search matches project names case-insensitively, using the trimmed `searchQuery`, and highlights the match. Projects with `isPinned: true` come first in every order. When `onTogglePin(id, isPinned)` is supplied, every card has a pin toggle in its top inline-end corner, named by `labels.pinLabel` (default `'Pin'`) with `aria-pressed` for the state; an unpinned card's toggle shows on hover or keyboard focus, and stays visible on touch screens. Without the callback, a pinned card shows a static marker there instead, with visually hidden `labels.pinnedLabel` text (default `'Pinned'`). In both date orders, projects without `updatedAt` come last. Name A–Z collates with `Intl.Collator(locale, { sensitivity: 'base', numeric: true })`.

A visually hidden `role="status"` region announces:

- `labels.resultCountLabel(count)` while the list is shown;
- `labels.noResultsLabel`, `labels.emptyStateLabel`, `labels.errorLabel` or `labels.incompleteLabel` in the matching state;
- nothing while loading.

Each card is an `<article>` named by the project. It shows the last-updated time relative to the page visit (`Intl.RelativeTimeFormat(locale)`, e.g. `3 days ago`) in a `<time>` element when `updatedAt` is set, then the name, then the folder path. The folder path is the kit `FolderPath`, named by `labels.folderPathLabel`. When `getProjectHref` is supplied, the name is a link to `getProjectHref(id)` stretched over the whole card; the name and the folder path stay above the link, so their truncation tooltips still open. A plain primary click calls `onOpenProject(id)` when it is supplied, and otherwise follows the `href`, as does a modified or middle click, so the project opens in a new tab. Without `getProjectHref`, cards are not interactive.

When `onCreateProject` is supplied, a primary **New project** button labelled `labels.createProjectLabel` sits at the inline end of the title row (on mobile, a round icon-only `+` button named by the same label floats at the bottom inline-end corner instead), and a secondary one is the empty state's action. None renders without the callback.

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
  onTogglePin={(id, isPinned) => {}}
  onOpenProject={(id) => {}}
  getProjectHref={(id) => `/projects/view/${id.slice('projects/'.length)}`}
  locale="en"
  labels={{
    title: 'Projects',
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
    loadingAriaLabel: 'Loading projects',
    sourceLabels: {
      [ProjectSource.Personal]: 'Personal',
      [ProjectSource.Shared]: 'Shared',
      [ProjectSource.Organization]: 'Organization',
    },
    resultCountLabel: (count) => `${count} projects`,
    folderPathLabel: 'Project location',
    createProjectLabel: 'New project',
    pinnedLabel: 'Pinned',
    pinLabel: 'Pin',
  }}
/>;
```

The layout is mobile-first:

- On mobile, there is no visible title row (the `<h1>` stays for assistive tech and the subtitle is not shown), the toolbar keeps a standard-size search and a small sort control on one row, and cards use a single column with a 16px gap.
- From the `desktop` breakpoint, the title row is shown, the search is large, and the grid has three columns with a 20px gap, at most 1116px wide and centred.
- The empty and no-results states sit at the top of the content area; loading and error states are centred in it.

Only logical properties are used, so the layout follows the inherited `dir`.

`styles.colors` overrides the CSS custom properties. Each one falls back to the matching app theme token:

| Field              | Fallback            |
| ------------------ | ------------------- |
| `background`       | `--bg-layer-base`   |
| `subtitleText`     | `--text-secondary`  |
| `sortButtonText`   | `--text-accent`     |
| `cardBackground`   | `--bg-layer-raised` |
| `cardTitleText`    | `--text-primary`    |
| `updatedAtText`    | `--text-secondary`  |
| `pathText`         | `--text-secondary`  |
| `cardFocusOutline` | `--stroke-focus`    |

`styles.typography` overrides the type-scale classes:

| Field                            | Default                       |
| -------------------------------- | ----------------------------- |
| `titleClassName`                 | `'dial-h1-text'`              |
| `subtitleClassName`              | `'dial-body-text'`            |
| `cardTitleClassName`             | `'dial-body-semi-text'`       |
| `pathLabelClassName`             | `'dial-tiny-text'`            |
| `pathLeafClassName`              | `'dial-tiny-semi-text'`       |
| `updatedAtClassName`             | `'dial-tiny-text'`            |
| `emptyStateDescriptionClassName` | `'dial-small-paragraph-text'` |

### ProjectCreateForm

Controlled New project form inside the builder-form shell: a header with a back button (mirrored in RTL), the `<h1>` title, **Cancel** and **Create**, moved into a sticky footer on mobile.

- **Name** is required. `validateProjectName` checks it after the field is first blurred; a host `errors.name` (for example a taken name) takes precedence, is announced as an alert, and moves focus back to the field when editable. The error is linked through `aria-describedby`. With `isNameReadOnly` (default `false`) the input gets the native `readOnly` and `disabled` attributes, so it cannot be edited and is skipped in the tab order. `onFieldChange('name', …)` is never called. `labels.nameReadOnlyHint` (default `"The project name can't be changed after creation"`) is the input's hover tooltip and renders under it as a `CaptionText` that the input's `aria-describedby` also names, keeping the explanation available on touch devices. The lib does not decide when to lock the name: the host sets the flag.
- **Instructions** (the kit markdown editor) get a Refine with AI action when `onRefineInstructions` is supplied. The form has no description field.
- **Context** files come from the kit `FileDropzone` (a click or a drop opens and takes the device picker) or a drag anywhere over the form. `labels.dropZoneLabel` places two link elements in its sentence: an underlined "from device" span — the whole zone opens the device picker — and, when `onPickFromFileManager` is supplied, a "file manager" button that opens the host's picker instead. `labels.dropZoneAriaLabel` names the zone's file input. `checkContextFiles` filters the files against `maxFileBytes` and `maxTotalBytes`; each rejection, and a host `errors.context` after them, shows as the kit drop zone's `errorText` — one per line in the error color, with an error border, linked to the file input through `aria-describedby` / `aria-invalid` — and is announced. Each file renders as an `AttachmentCard` with a named remove button. When the host passes `onContextFileClick`, each card is also a button named `labels.openFileLabel(name)` (optional, defaulting to `Preview {name}`) that reports the card's `ProjectContextFile.id`, and the card whose id equals `selectedContextFileId` renders selected (`aria-pressed`); what a click opens, and where its bytes come from, is the host's decision, so the lib never loads a file. The form shows no capacity meter.
- **Create** is disabled while the name is invalid, a refinement is pending, or `isSubmitting` is true.

The form shows no unsaved-changes dialog: leaving is the host's decision through `onBack` / `onCancel`.

The same form edits an existing project: the host passes the project's files as `StoredProjectContextFile`s (`size`, `isStored: true`) alongside newly added `Attachment`s, and supplies the edit strings through `labels` (`title`, `createLabel`, `submittingLabel`, `creatingStatus`). Stored files count toward `maxTotalBytes` and render as removable cards; `isStoredContextFile` separates them when the host builds its save request. In `apps/chat`, every edit page passes `isNameReadOnly` and `labels.nameReadOnlyHint`: owners and shared editors can edit instructions and files, but cannot rename an existing project. New-project names remain editable.

```tsx
import { ProjectCreateForm } from '@epam/ai-dial-projects';
import { ContextFileRejection, ProjectNameError } from '@epam/ai-dial-projects';
import { cloneElement } from 'react';

<ProjectCreateForm
  values={{ name: '', instructions: '' }}
  errors={{}}
  onFieldChange={(field, value) => {}}
  contextFiles={[]}
  onContextFilesChange={(files) => {}}
  onContextFileClick={(id) => {}}
  selectedContextFileId={undefined}
  allowedExtensions={['csv', 'pdf', 'xlsx']}
  maxFileBytes={1048576}
  maxTotalBytes={10485760}
  onPickFromFileManager={async () => undefined}
  onBack={() => {}}
  onCancel={() => {}}
  onSubmit={() => {}}
  isNameReadOnly={false}
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
    instructionsLabel: 'Instructions',
    instructionsPlaceholder:
      'Explain your reasoning step by step for complex problems. Use specific examples.',
    editorLoadingAriaLabel: 'Loading editor',
    contextLabel: 'Context',
    dropZoneLabel: ({ fromDevice, fileManager }) => (
      <>
        Drag&drop context, upload {cloneElement(fromDevice, {}, 'from device')}
        {fileManager && (
          <> or {cloneElement(fileManager, {}, 'file manager')}</>
        )}
      </>
    ),
    dropZoneAriaLabel: 'Upload context from device',
    dropZoneHint: 'File formats .csv, .pdf, .xlsx (max 1 MB)',
    removeFileLabel: (name) => `Remove ${name}`,
    openFileLabel: (name) => `Preview ${name}`,
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

`labels.submittingLabel` (defaults to `createLabel`), `labels.nameReadOnlyHint` (defaults to `"The project name can't be changed after creation"`), `labels.dropZoneAriaLabel`, `labels.dropOverlayTitle` / `dropOverlaySubtitle` and `labels.refinement` (`TextRefinementLabels`) are optional. A host with i18n can fill `dropZoneLabel` with its rich-text interpolation instead of `cloneElement` — `apps/chat` uses `react-i18next`'s `Trans` with `components={{ device: fromDevice, manager: fileManager }}`. `markdownEditorTheme` sets the editor theme.

`styles.colors` overrides the CSS custom properties:

| Field                | Fallback                            |
| -------------------- | ----------------------------------- |
| `background`         | `--bg-layer-base`                   |
| `headerBorder`       | `--stroke-tertiary`                 |
| `labelText`          | `--text-secondary`                  |
| `linkText`           | drop zone text                      |
| `dropZoneBackground` | `--bg-layer-raised`, then `#d1dbea` |

`styles.typography` overrides the type-scale classes:

| Field             | Default                 |
| ----------------- | ----------------------- |
| `titleClassName`  | `'dial-h1-text'`        |
| `labelClassName`  | `'dial-tiny-semi-text'` |
| `helperClassName` | `'dial-tiny-text'`      |

### ProjectView

A project's home page: a header with back (its arrow mirrored in RTL), the name (an `<h1>`, truncated with a tooltip), a Pin button (`IconPin` with `labels.pinLabel`, or a crossed-out `IconPin` with `labels.unpinLabel` while `isPinned`, still focusable while `isPinPending`), Publish and Edit buttons with icons and a ⋮ menu (Share, Download, Delete, each with an icon), then a Details panel — an `<aside>` headed by an `<h2>`, a 488px column on the inline end on desktop framed only by an inline-start border (a top border when stacked under the header on mobile) — with the description, the instructions rendered as markdown, and the context: a search that filters and highlights the files and announces the match count, and one `AttachmentCard` per file. The view shows no capacity meter. On mobile, Publish and Edit move into the ⋮ menu.

`mainContent` fills a main column rendered before the Details panel (stacked above it on mobile), named by `mainContentLabel` (default `'Project content'`), with its content centered at a 748px max width; without it the panel stays on the inline end. While the panel sits beside the main column on desktop, the header stays in place and each column scrolls on its own; stacked, both scroll together below the header. The host puts its own content there, such as a chat input and a `ProjectConversationList`.

Activating a context card calls `onContextFileClick` with the file's name, and the card whose name equals `selectedContextFileId` renders selected (`aria-pressed`). The lib downloads and opens nothing: the host decides, for example by previewing the file in a canvas beside the page. While such a preview takes the inline end, the host sets `isDetailsStacked` (default `false`) so the Details panel and its cards move below the main column at every width, with a top border instead of the inline-start one, and stay reachable.

Read-only mode is the host omitting `onPublish`, `onEdit`, `onShare` and `onDelete`: each hides its action. Exactly one state renders — loading (`isLoading`), error with Retry (`hasError`), not found with a way back (`isNotFound`), or the loaded `project`.

```tsx
import { ProjectView } from '@epam/ai-dial-projects';

<ProjectView
  project={{
    name: 'Q4 launch',
    description: 'Bundles the Q4 support tickets.',
    instructions: '## Approach\nExplain your reasoning.',
    contextFiles: [{ name: 'tickets.csv', contentType: 'text/csv' }],
  }}
  isPinned={false}
  contextSearchQuery=""
  onContextSearchQueryChange={() => {}}
  onBack={() => {}}
  onTogglePin={() => {}}
  onEdit={() => {}}
  onDownload={() => {}}
  onContextFileClick={(id) => {}}
  selectedContextFileId={undefined}
  isDetailsStacked={false}
  onRetry={() => {}}
  onBrowseProjects={() => {}}
  labels={{
    backLabel: 'Back',
    pinLabel: 'Pin',
    unpinLabel: 'Unpin',
    publishLabel: 'Publish',
    editLabel: 'Edit',
    moreActionsLabel: 'More actions',
    shareLabel: 'Share',
    downloadLabel: 'Download',
    deleteLabel: 'Delete',
    detailsLabel: 'Details',
    descriptionLabel: 'Description',
    instructionsLabel: 'Instructions',
    contextLabel: 'Context',
    contextSearchPlaceholder: 'Search files',
    contextSearchAriaLabel: 'Search context files',
    clearSearchLabel: 'Clear search',
    contextResultCountLabel: (count) => `${count} files found`,
    emptyContextLabel: 'No context files',
    noContextMatchesLabel: 'No files match your search',
    openFileLabel: (name) => `Preview ${name}`,
    errorLabel: 'Could not load the project',
    retryLabel: 'Retry',
    notFoundLabel: 'Project not found',
    browseProjectsLabel: 'Back to projects',
    loadingAriaLabel: 'Loading project',
  }}
/>;
```

`styles.colors` fields fall back to `--bg-layer-base` (`background`), `--stroke-tertiary` (`border`), `--text-primary` (`headingText`, `bodyText`) and `--text-secondary` (`secondaryText`). `styles.typography` defaults to `'dial-h1-text'` (`titleClassName`), `'dial-body-semi-text'` (`panelTitleClassName`), `'dial-tiny-text'` (`sectionTitleClassName`, `helperClassName`) and `'dial-small-text'` (`bodyClassName`).

### ProjectConversationList

A project's conversations as a `<section>` named by its `<h2>` (`labels.title`; with no chats the heading is hidden and the section keeps the name through `aria-label`), with one row per item: a button named `labels.openLabel(title, authorName)` holding an `aria-hidden` status point (an outline when read, filled when unread; an item's `leading` node replaces it and an unread item then shows the dot at the row's end instead, which its `trailing` node replaces) and the title truncated with a tooltip. When `onRename` or `onDelete` is given, each row also has a ⋮ menu (`labels.moreActionsLabel(title)`) with those items — a dropdown, or on a phone a bottom sheet closed by `labels.closeLabel` (default `'Close'`) — shown on `desktop` only while the row is hovered or focused or the menu is open (always on `mobile`); without both it is read-only and rows only open. Exactly one state renders — loading, error with Retry, the empty state, or the rows — and the loading, error and empty states are a `role="status"` region. With `hasMore` and `onLoadMore`, a See more link button (`labels.loadMoreLabel`, default `'See more'`) follows the rows and is disabled while `isLoadingMore`. With `isEmptyStateShown={false}` (default `true`) an empty list renders nothing instead of the empty state. The lib loads nothing: the host passes the rows and handles the callbacks.

```tsx
import { ProjectConversationList } from '@epam/ai-dial-projects';

<ProjectConversationList
  items={[
    { id: 'c1', title: 'Weekly support summary', authorName: 'Valery Tester' },
  ]}
  onRetry={() => {}}
  hasMore
  onLoadMore={() => {}}
  onOpen={(id) => {}}
  onRename={(id) => {}}
  onDelete={(id) => {}}
  labels={{
    title: 'Chats',
    openLabel: (title, authorName) =>
      authorName ? `${title}, by ${authorName}` : title,
    moreActionsLabel: (title) => `More actions for ${title}`,
    renameLabel: 'Rename',
    deleteLabel: 'Delete',
    loadingLabel: 'Loading chats',
    errorLabel: 'Could not load the chats',
    retryLabel: 'Retry',
    emptyTitle: 'No outputs or chats yet',
    emptyDescription: 'Your outputs and chats will appear here once started.',
    loadMoreLabel: 'See more',
  }}
/>;
```

`typography` defaults to `'dial-body-semi-text'` (`titleClassName`), `'dial-body-text'` (`rowTitleClassName`), `'dial-body-semi-text'` (`unreadRowTitleClassName`) and `'dial-small-text'` (`messageClassName`).

An item with `isUnread: true` shows its title in `unreadRowTitleClassName` and a filled status point, and its row button is described by `labels.unreadLabel` (default `'Unread'`) through `aria-describedby`, so its accessible name does not change. `colors.readDot` sets the read point's outline (`--pcl-read-dot`, default `var(--stroke-secondary, #d1dbea)`), `colors.unreadDot` the unread point's fill (`--pcl-unread-dot`, default `var(--text-accent, #1d4ed8)`), and `colors.rowHoverBackground` the background of a hovered or focused row (`--pcl-row-hover`, default `var(--bg-control-accent-alpha-hover, #2764d924)`).

```tsx
<ProjectConversationList
  items={[{ id: 'c1', title: 'Weekly summary', isUnread: true }]}
  onRetry={retry}
  onOpen={openChat}
  labels={{ ...labels, unreadLabel: 'Unread' }}
  colors={{ unreadDot: 'var(--text-accent)' }}
/>
```

### ProjectConversationsPanel

A project's chat column for `ProjectView.mainContent`: the host's chat input (`composer`, any node), then the host's `outputs` node (any node, typically `ProjectOutputs`; nothing renders in its place when it is unset), then `ProjectConversationList`; `hasOutputs` (default `false`) tells it that `outputs` shows content, so an empty list drops its "No outputs or chats yet" state, plus the rename dialog (a labelled input seeded with the title, an inline error for an empty name, Cancel and Save buttons, Enter to save, the trimmed value sent to `onRename`) and the delete confirmation. `hasMore`, `isLoadingMore` and `onLoadMore` pass through to the list, and so do `listTypography` and `listColors` (as its `typography` and `colors`). A rename or delete dialog whose row disappears from `items` (a live refresh) closes, and focus moves to the list. Both dialogs return focus to the row's ⋮ trigger when they close; after a delete, whose row is gone, focus moves to the row now in its place, the one before it, or the list. They stay open, and cannot be closed, while the host's promise is pending, and stay open while it rejects, so the host only reports the failure. Omitting `onRename` and `onDelete` makes it read-only.

```tsx
import { ProjectConversationsPanel } from '@epam/ai-dial-projects';

<ProjectConversationsPanel
  composer={<MyChatInput />}
  outputs={<MyOutputs />}
  items={[{ id: 'c1', title: 'Weekly support summary' }]}
  onRetry={() => {}}
  onOpen={(id) => {}}
  onRename={async (id, newTitle) => {}}
  onDelete={async (id) => {}}
  labels={{
    list: {
      title: 'Chats',
      openLabel: (title) => title,
      moreActionsLabel: (title) => `More actions for ${title}`,
      renameLabel: 'Rename',
      deleteLabel: 'Delete',
      loadingLabel: 'Loading chats',
      errorLabel: 'Could not load the chats',
      retryLabel: 'Retry',
      emptyTitle: 'No outputs or chats yet',
      emptyDescription: 'Your outputs and chats will appear here once started.',
    },
    renameTitle: 'Rename chat',
    renameInputLabel: 'Chat name',
    renameEmptyError: 'Enter a chat name',
    renameSaveLabel: 'Save',
    renameCancelLabel: 'Cancel',
    deleteTitle: (title) => `Delete "${title}"?`,
    deleteDescription: 'The chat will be deleted. This cannot be undone.',
  }}
/>;
```

### ProjectOutputs

A project's outputs, the files the agents of its chats saved under the project's `artifacts/` folder, for `ProjectConversationsPanel`'s `outputs` slot.

- **Layout.** A `<section>` named by its `<h2>` (`labels.title`, default `'Outputs'`), then one `AttachmentCard` per item: the same 100×100 file cards as the Details panel's context, with the name and the type icon.
- **Preview row.** The first `previewLimit` items (default `6`) render in one row that scrolls horizontally inside its column at every width, so the page itself never scrolls sideways.
- **See all.** When there are more items, a See all link (`labels.seeAllLabel(count)`, default `` `See all (${count})` ``, with `aria-expanded` and `aria-controls`) expands the section in place into a wrapping grid of every item. Show less (`labels.showLessLabel`, default `'Show less'`) collapses it again. A new `items` array keeps the expanded state.
- **Opening.** Activating a card calls `onOpenOutput` with the file name. The card whose name equals `selectedOutputName` renders selected (`aria-pressed`). Each card is named `labels.openOutputLabel(name)` (default `` `Preview ${name}` ``).
- **Read-only.** The section offers no rename, delete or upload action. The lib downloads and opens nothing; the host decides.
- **Empty.** When `items` is empty and `hasError` is `false`, it renders no section, only an empty visually hidden live region, so render it unconditionally and let it decide.
- **Error.** `hasError` shows `labels.errorLabel` (default `'Could not load outputs'`), announced through that always-mounted live region, plus a Retry button (`labels.retryLabel`, default `'Retry'`) when `onRetry` is set. When `hasError` clears after Retry, focus moves to the section heading.

```tsx
import { ProjectOutputs } from '@epam/ai-dial-projects';

<ProjectOutputs
  items={[
    { name: 'summary.md', contentType: 'text/markdown' },
    { name: 'report.pdf', contentType: 'application/pdf' },
  ]}
  onOpenOutput={(name) => {}}
  selectedOutputName={undefined}
  previewLimit={6}
  labels={{
    title: 'Outputs',
    seeAllLabel: (count) => `See all (${count})`,
    showLessLabel: 'Show less',
    openOutputLabel: (name) => `Preview ${name}`,
    errorLabel: 'Could not load outputs',
    retryLabel: 'Retry',
  }}
/>;
```

`styles.colors` fields fall back to `--text-primary` (`headingText`) and `--text-secondary` (`secondaryText`). `styles.typography` defaults to `'dial-body-semi-text'` (`titleClassName`) and `'dial-tiny-text'` (`helperClassName`).

### ProjectChatHeader

The breadcrumb bar of a project chat: a back button (`backLabel`, its arrow mirrored in RTL) and the project name, truncated with a tooltip, as a link to `projectHref`. The lib does not route: `onProjectLinkClick` receives the click, so a host router can call `event.preventDefault()` and navigate itself. `className` styles the bar (for example its border color); `nameClassName` defaults to `'dial-body-text'`.

```tsx
import { ProjectChatHeader } from '@epam/ai-dial-projects';

<ProjectChatHeader
  projectName="Q4 launch"
  projectHref="/projects/view/a1b2c3/q4"
  onBack={() => {}}
  onProjectLinkClick={(event) => {
    event.preventDefault();
  }}
  backLabel="Back to Q4 launch"
/>;
```

## Utilities

### validateProjectName

Returns the `ProjectNameError` for a name the chat BFF would reject, or `null`. It trims first, then rejects an empty name, more than `PROJECT_NAME_MAX_BYTES` (255) UTF-8 bytes, `: ; , = / \ { } % & "`, tab, control and bidi characters, and the reserved names `.`, `..`, `v`, `files`, `.dial-resource` and `.dial-folder`.

```ts
import { validateProjectName } from '@epam/ai-dial-projects';

validateProjectName('Q4/launch'); // ProjectNameError.InvalidCharacters
```

### checkContextFiles

Splits incoming `File`s into staged `Attachment`s to append and `{ name, reason }` rejections, against the files already present — stored or newly added: an allowed extension, the per-file limit, the running total, a unique name and a valid name. `getContextFilesSize` sums the bytes of every context file (a stored file's `size`, an added file's `File.size`), `isStoredContextFile` tells a `StoredProjectContextFile` from an added `Attachment`, and `filterContextFileItems` keeps the files whose name contains a trimmed query.

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

- `ProjectItem` — `{ id, name, source, parentPath?, updatedAt?, isPinned? }`, one card; `updatedAt` is shown relative to now and drives the date sort orders, and pinned items sort first.
- `ProjectsLabels` — every user-visible string, including `sourceLabels`, `folderPathLabel` and the `resultCountLabel` callback.
- `ProjectsProps` — the props of `Projects`.
- `ProjectsStyles`, `ProjectsColors`, `ProjectsTypography` — style overrides.
- `ProjectCreateFormValues` — `{ name, instructions }`.
- `ProjectCreateFormErrors` — `{ name?, context? }`, host-supplied errors.
- `ProjectCreateFormLabels` — every string of the form, including the `nameErrors` and `fileRejections` maps.
- `ProjectDropZoneLinks` — `{ fromDevice, fileManager? }`, the link elements `labels.dropZoneLabel` places in its sentence.
- `ProjectCreateFormProps` — the props of `ProjectCreateForm`.
- `ProjectCreateFormStyles`, `ProjectCreateFormColors`, `ProjectCreateFormTypography` — style overrides.
- `ContextFileLimits`, `ContextFileCheck`, `RejectedContextFile` — the input and result of `checkContextFiles`.
- `ProjectContextFile` — `Attachment | StoredProjectContextFile`, the type of `ProjectCreateForm`'s `contextFiles`; `StoredProjectContextFile` is a file already in the project (`size`, `isStored: true`, no `File`), so the same form edits a project.
- `ProjectViewProps`, `ProjectViewLabels`, `ProjectViewModel`, `ProjectContextFileItem` — the props, strings and content of `ProjectView`.
- `ProjectViewStyles`, `ProjectViewColors`, `ProjectViewTypography` — style overrides of `ProjectView`.
- `ProjectConversationListProps`, `ProjectConversationListItem`, `ProjectConversationListLabels`, `ProjectConversationListTypography`, `ProjectConversationListColors` — the props, rows, strings, typography and colours of `ProjectConversationList`.
- `ProjectConversationsPanelProps`, `ProjectConversationsPanelLabels` — the props and strings of `ProjectConversationsPanel`.
- `ProjectOutputsProps`, `ProjectOutputItem`, `ProjectOutputsLabels` — the props, cards (`{ name, contentType }`) and strings of `ProjectOutputs`.
- `ProjectOutputsStyles`, `ProjectOutputsColors`, `ProjectOutputsTypography` — style overrides of `ProjectOutputs`.
- `ProjectChatHeaderProps` — the props of `ProjectChatHeader`.

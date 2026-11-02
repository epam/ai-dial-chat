## MODIFIED Requirements

### Requirement: ProjectView is a host-agnostic presentational component in libs/projects

`libs/projects` SHALL export:

- `ProjectView`;
- the `ProjectViewProps`, `ProjectViewLabels`, `ProjectViewStyles`, `ProjectViewModel` and `ProjectContextFileItem` types;
- `ProjectConversationList` and its types (see the `project-conversations-ui` capability).

The lib SHALL NOT import `@epam/ai-dial-chat-api-client`, REST paths, feature flags, i18n, the router or app contexts.

Props:

| Prop | Type |
| --- | --- |
| `project` | `ProjectViewModel \| null`, where `ProjectViewModel` is `{ name: string; description: string; instructions: string; contextFiles: ProjectContextFileItem[] }` and `ProjectContextFileItem` is `{ name: string; contentType: string }` |
| `isLoading` | optional `boolean`, default `false` |
| `hasError` | optional `boolean`, default `false` |
| `isNotFound` | optional `boolean`, default `false` |
| `isPinned` | `boolean` |
| `isPinPending` | optional `boolean`, default `false` |
| `contextSearchQuery` | `string` |
| `onContextSearchQueryChange` | `(query: string) => void` |
| `onBack` | `() => void` |
| `onTogglePin` | `() => void` |
| `onPublish` | optional `() => void`; hidden when omitted |
| `onEdit` | optional `() => void`; hidden when omitted |
| `onShare` | optional `() => void`; hidden when omitted |
| `onDelete` | optional `() => void`; hidden when omitted |
| `onDownload` | `() => void` |
| `onContextFileClick` | `(id: string) => void`, called with a context file's name when the user activates its card; the host decides what opens |
| `selectedContextFileId` | optional `string`: the name of the context file whose card renders selected |
| `isDetailsStacked` | optional `boolean`, default `false`: renders the Details panel below the main column at every width, instead of beside it on `desktop` |
| `onRetry` | `() => void` |
| `onBrowseProjects` | `() => void` |
| `mainContent` | optional `ReactNode`: the main column's content |
| `labels` | `ProjectViewLabels` |
| `styles` | optional `ProjectViewStyles`, applied via `buildCssVars` |

**Main column.** When `mainContent` is supplied, the loaded layout renders it in a `<section>` before the Details `<aside>`:

- it is named by `labels.mainContentLabel`, a new optional label;
- it is `flex-1 min-w-0`, with `24px 32px` padding on `desktop`;
- its content is centered at the design's 748px max width.

On `mobile`, and on `desktop` while `isDetailsStacked` is `true`, the section stacks above the Details panel. Without `mainContent`, the layout is unchanged, so the Details panel is pushed to the inline end; a panel stacked by `isDetailsStacked` without `mainContent` stays at the top instead. The lib renders the node as given: the chat input and the Chats list are composed by the host.

Every declared prop SHALL be read. Read-only mode is expressed only by omitting `onEdit`, `onDelete`, `onShare` and `onPublish`. The lib has no `isReadOnly` flag, so a prop cannot contradict the callbacks.

`ProjectViewPage` maps the DTO into `ProjectViewModel` with `mapProjectDetailsToViewModel` (`libs/chat-hooks/src/project/project-mapping.ts`). Each `contentType` comes from `inferMimeTypeFromPath` (`@epam/ai-dial-chat-shared`), falling back to `application/octet-stream`.

#### Scenario: Lib has no host integration knowledge

- **WHEN** `libs/projects/src` is searched for `/api/`, `@epam/ai-dial-chat-api-client`, `useFeatureFlag`, `react-router` and `react-i18next`
- **THEN** none of them occurs

#### Scenario: Omitted callbacks hide actions

- **WHEN** `ProjectView` renders without `onEdit`, `onDelete`, `onShare` and `onPublish`
- **THEN** no Edit, Delete, Share or Publish control is rendered, and Pin and Download are

#### Scenario: Main column renders before the Details panel

- **WHEN** `ProjectView` renders a loaded project with `mainContent={<p>chats</p>}`
- **THEN** a `<section>` named by `labels.mainContentLabel` contains "chats" and precedes the Details `<aside>` in DOM order

#### Scenario: No main column without mainContent

- **WHEN** `ProjectView` renders without `mainContent`
- **THEN** no main-column `<section>` renders

#### Scenario: Details stacked on desktop

- **WHEN** `ProjectView` renders on a `desktop` viewport with `mainContent` and `isDetailsStacked`
- **THEN** the Details `<aside>` is below the main column, full width, with a top border and no inline-start border

#### Scenario: Stacked Details without a main column stays at the top

- **WHEN** `ProjectView` renders on a `desktop` viewport with `isDetailsStacked` and no `mainContent`
- **THEN** the Details `<aside>` is not bottom-aligned

### Requirement: The Details panel shows description, instructions and context

`ProjectView` SHALL render the Details panel as an `<aside>` named by its visible `<h2>` `labels.detailsLabel`:

- **Placement:** a column on the inline end side on `desktop`, running the height of the page below the header, and stacked below the header on `mobile`. While `isDetailsStacked` is `true` it is stacked below the main column on `desktop` too, so a host that shows a canvas beside the page keeps the panel and its context cards reachable.
- **Frame:** no card. The panel has the page background and only a border on its inline-start side on `desktop` (`border-inline-start`, so it flips in RTL), and a top border on `mobile`, where it is stacked, and wherever `isDetailsStacked` stacks it.
- **Size and type (design):** 488px wide on `desktop` (full width when stacked), `24px 32px` padding, `20px` between sections. The heading is `dial-body-semi-text` (16/24 semibold, `--text-primary`); the Description, Instructions and Context labels are `dial-tiny-text` (12/16, `--text-secondary`) with `4px` to their content; the description and the rendered instructions are `dial-small-text` (14/20, `--text-primary`); the Context section uses `8px` gaps and the file list `8px` top padding. The search is the kit `Search` at its standard 40px height.
- **Description:** a section headed `labels.descriptionLabel`, rendering the text in a `<p>` with preserved line breaks. Omitted when the description is empty.
- **Instructions:** a section headed `labels.instructionsLabel`, rendering `MarkdownRenderer` from `@epam/ai-dial-chat-shared`, read-only, as the catalog About tab does (`libs/catalog/src/components/Details/TabsContent/About.tsx`). Every markdown heading takes `typography.instructionsHeadingClassName` (default `dial-small-semi-text`), so a `#` line never outsizes the project title. Omitted when empty.
- **Context:** a section headed `labels.contextLabel`, containing:
  - a kit `Search` inside `<div role="search">`, named `labels.contextSearchAriaLabel`, with `labels.clearSearchLabel` on its clear action, bound to `contextSearchQuery`;
  - a `<ul>` of `AttachmentCard`s from `@epam/ai-dial-attachment-input`, one per file whose name contains the trimmed query, case-insensitively. Each shows the type icon and extension, and its name goes through `Highlight` with `query={trimmedQuery}` and `maxLines={1}`, so the full name is in a tooltip. Activating a card calls `onContextFileClick(name)`, and its accessible name is `labels.openFileLabel(name)`. The card whose name equals `selectedContextFileId` renders selected (`isSelected`).
  - an empty state: `labels.emptyContextLabel` when the project has no context files, and `labels.noContextMatchesLabel` when a query matches none.
- **Live region:** a `role="status"` `aria-live="polite"` region announces `labels.contextResultCountLabel(count)` while the trimmed query is non-empty.

`ProjectViewPage` holds `contextSearchQuery` in `useState`, initially `''`. It is not persisted.

#### Scenario: Empty description and instructions are omitted

- **WHEN** a project has `description: ''`, `instructions: ''` and two context files
- **THEN** no Description or Instructions heading renders, and the Context section does

#### Scenario: Instructions render as markdown

- **WHEN** `instructions` is `"## Steps\n- one"`
- **THEN** the panel contains an `<h2>` "Steps" styled `dial-small-semi-text` and a list item "one", and nothing is editable

#### Scenario: Context search filters and highlights

- **WHEN** the files are `tickets.csv`, `survey.xlsx` and `ticket-archive.pdf`, and the user types `ticket`
- **THEN** only `tickets.csv` and `ticket-archive.pdf` render, each with `ticket` highlighted, and the status region announces two results

#### Scenario: No capacity meter on the view page

- **WHEN** a project with context files is shown
- **THEN** no `role="meter"` element renders: how much capacity a project uses is not shown on the view page (user decision), and the capacity limit is still enforced when files are added on the edit page

#### Scenario: Clicking a file downloads it

- **WHEN** the user activates the `tickets.csv` card
- **THEN** `onContextFileClick('tickets.csv')` is called, and the lib itself downloads nothing: the title keeps its former wording because archive requires every scenario of a modified requirement to survive, and the page now opens a preview instead of a download (see "A context card no longer downloads")

#### Scenario: Selected file card

- **WHEN** `ProjectView` renders with `selectedContextFileId="tickets.csv"`
- **THEN** the `tickets.csv` card renders selected, and the other cards do not

### Requirement: Project actions run through app-owned adapters

`useProjectActions` (`apps/chat/src/hooks/projects/useProjectActions.ts`) SHALL own the side effects for one loaded project.

**Download.** `downloadProjectArchive(id)` calls `projectsApi.downloadProjectRaw` and passes the raw `Response` to `triggerBrowserDownload` (`libs/chat-hooks/src/files/browser-download.ts`) with the fallback name `{name}.zip`.

- Success calls `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.Downloaded, { name })`.
- Failure calls `showErrorNotification` with `projects.actions.downloadError`.

**Open file.** The hook no longer downloads a single context file. Activating a context card opens the file in the attachment canvas (see the `project-context-file-preview` capability), and downloading that one file is the canvas header's Download action.

**Delete.**

- The page opens `DeleteConfirmationDialog` (`@epam/ai-dial-chat-shared`). Its title is `projects.actions.deleteConfirmTitle` (interpolating `{{name}}`), and its labels are the shared confirm and cancel labels. Its body is:
  - `projects.actions.deleteConfirmDescription` when the loaded project has `conversationCount: 0`;
  - otherwise `projects.actions.deleteConfirmWithChatsDescription`, pluralised by `count` (`_one` / `_other`), which says the project's chats are deleted too.
- Confirming calls `deleteProject(id, contentVersion)`, and the dialog shows `isLoading` while the request runs.
- **Success:** `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.Deleted, { name })`, then `replacePinnedProjectId(id, null)` (the BFF already removed the pin), then `navigate(ROUTES.Projects, { replace: true })`, so Back does not reopen the deleted project.
- **`409 project-changed`:** close the dialog, show `showErrorNotification` with `projects.errors.changedElsewhere`, and call `retry()`.
- **Other failures:** `showErrorNotification` with `projects.actions.deleteError`. The dialog stays open.

**Share.** `SharePopoverContainer` is rendered with `itemId={id}` and `canEditAccess={false}`.

**Publish.** `PublishProjectPanelContainer` is rendered with `projectId`, `projectName`, `conversationCount`, `onClose` and `returnFocusRef` (the Publish trigger).

**Gating.** `onPublish`, `onEdit`, `onShare` and `onDelete` are passed to `ProjectView` only when `project.canEdit` is `true`. Pin and Download are always passed.

`NotifiableEntity` (`apps/chat/src/types/entity-notification.ts`) gains `Project`, with its entries in `apps/chat/src/utils/entity-notification.ts`.

#### Scenario: Delete confirms, deletes and navigates

- **WHEN** the user chooses Delete, then confirms
- **THEN** `deleteProject` is called with the loaded `contentVersion`, a success toast is shown, and the router is at `/projects`

#### Scenario: Delete confirmation mentions chats

- **WHEN** the loaded project has `conversationCount: 3`, and the user chooses Delete
- **THEN** the dialog body is `projects.actions.deleteConfirmWithChatsDescription_other` with `count: 3`

#### Scenario: Delete on a changed project

- **WHEN** `deleteProject` rejects with `409` and `code: 'project-changed'`
- **THEN** the "changed by someone else" toast is shown, and the project is reloaded

#### Scenario: Shared project is read-only

- **WHEN** the loaded project has `canEdit: false`
- **THEN** Edit, Delete, Share and Publish are absent, and Pin and Download work

#### Scenario: Download the archive

- **WHEN** the user chooses Download
- **THEN** `downloadProjectRaw` is called, and the browser receives `{name}.zip`

#### Scenario: A context card no longer downloads

- **WHEN** the user activates a context card on the view page
- **THEN** no browser download starts, and the file opens in the canvas

### Requirement: Project view strings flow through react-i18next

`ProjectViewPage` SHALL resolve every `ProjectViewLabels` value with `useTranslation().t()`, through `ProjectsI18nKeys` / `ButtonsI18nKeys` / `NavigationI18nKeys` members in `apps/chat/src/constants/translation-keys.ts`. The labels object is memoised with `useMemo` on `t`.

**Reused keys:**

- `navigation.back` (back);
- `buttons.publish`, `buttons.edit`, `buttons.download`, `buttons.delete`, `buttons.retry`, `buttons.cancel`;
- `basic.clearSearch`.

**New generic keys** in `en.json`, with matching `ButtonsI18nKeys` members:

- `buttons.share` ("Share");
- `buttons.pin` ("Pin");
- `buttons.unpin` ("Unpin");
- `buttons.moreActions` ("More actions").

**New `projects.view.*` keys:**

| Key | English |
| --- | --- |
| `projects.view.details` | Details |
| `projects.view.description` | Description |
| `projects.view.instructions` | Instructions |
| `projects.view.context` | Context |
| `projects.view.contextSearchPlaceholder` | Search files |
| `projects.view.contextSearchAriaLabel` | Search context files |
| `projects.view.contextResultCount_one` / `_other` | `{{count}} file found` / `{{count}} files found` |
| `projects.view.emptyContext` | No context files |
| `projects.view.noContextMatches` | No files match your search |
| `projects.view.openFile` | `Preview {{name}}` |
| `projects.view.error` | Could not load the project |
| `projects.view.notFound` | Project not found |
| `projects.view.browseProjects` | Back to projects |

**New `projects.actions.*` keys:**

| Key | English |
| --- | --- |
| `projects.actions.deleteConfirmTitle` | `Delete "{{name}}"?` |
| `projects.actions.deleteConfirmDescription` | The project and its context files will be deleted. This cannot be undone. |
| `projects.actions.deleteError` | Could not delete the project |
| `projects.actions.downloadError` | Could not download |

**Error keys:** `projects.errors.changedElsewhere` ("This project was changed by someone else. Reload to see the latest version.").

**Publish keys:** `projects.publish.panelAriaLabel` and the folder-validation keys mirrored from `conversationPublish.*`.

Every key exists in every locale file, with English placeholders where no translation exists yet.

#### Scenario: No raw literals in the page

- **WHEN** `ProjectViewPage.tsx` is inspected
- **THEN** every `t()` argument is an enum member from `translation-keys.ts`

#### Scenario: The card name says preview

- **WHEN** the view page renders the `tickets.csv` card
- **THEN** its accessible name is "Preview tickets.csv"

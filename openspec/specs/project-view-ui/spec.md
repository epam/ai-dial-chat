# project-view-ui Specification

## Purpose

The flag-gated `/projects/view/:bucket/*` page and the host-agnostic `ProjectView` lib component: data ownership in the app, the header actions (pin, publish, edit, share, download, delete), the Details panel with context search, read-only mode for shared and organization projects, states, i18n, mobile, RTL and WCAG 2.1 AAA.

## Requirements

### Requirement: The project view page renders behind the projectsEnabled flag

The application SHALL register `ROUTES.ProjectView` (`/projects/view/:bucket/*`) in `apps/chat/src/app/app.tsx` as a lazy-loaded `ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`), inside the `RouteErrorBoundary` + `Suspense` + `RouteFallback` wrapper.

The page SHALL:

- render `RouteFallback` until `useAppConfig().status` is `UserConfigStatus.Ready`;
- render `NotFoundPage` when `useFeatureFlag('projectsEnabled')` is not `true`;
- rebuild the id `projects/{bucket}/{path}` from the route params with `parseProjectRouteParams`. An unsafe or empty path renders the lib's not-found state without any request.

**Feature flag:** `projectsEnabled`. **RTL impact:** see the RTL requirement. **i18n impact:** see the i18n requirement.

#### Scenario: Flag off

- **WHEN** `projectsEnabled` is not `true` and the user opens `/projects/view/a1b2c3/q4-launch`
- **THEN** `NotFound` renders, and `ProjectsApi.getProject` is not called

#### Scenario: Nested path is addressed

- **WHEN** the user opens `/projects/view/a1b2c3/marketing/q4-launch`
- **THEN** `getProject` is called with `id: 'projects/a1b2c3/marketing/q4-launch'`

#### Scenario: Traversal in the route is refused

- **WHEN** the user opens `/projects/view/a1b2c3/../x`
- **THEN** the not-found state renders, and no request is sent

### Requirement: The app owns project data through useProject

`useProject(id: string | null, enabled: boolean)` (`apps/chat/src/hooks/projects/useProject.ts`, one hook per file, with JSDoc on why it exists) SHALL call `getProject(id, { signal })` from `apps/chat/src/server-api/projects.api.ts`, which wraps `projectsApi.getProject`. It returns `{ project, isLoading, hasError, isNotFound, retry }`:

- `project` is the `ProjectDetailsDto`, or `null`.
- The fetch runs in `useEffect` with an `AbortController`. It aborts on unmount and on an id change, and a cancelled request never sets state.
- `isLoading` is derived, as in `useProjects`: it is `true` while `enabled && id != null` and no result answers the current reload token.
- A `404` sets `isNotFound`. Any other failure sets `hasError`.
- `retry` is a stable `useCallback`.

No new React context is introduced.

#### Scenario: Successful load

- **WHEN** `getProject` resolves
- **THEN** `isLoading` becomes `false`, and `project` holds the DTO

#### Scenario: Not found

- **WHEN** `getProject` rejects with `404`
- **THEN** `isNotFound` is `true`, and `hasError` is `false`

#### Scenario: Retry after error

- **WHEN** `getProject` rejects with `503` and the user activates Retry
- **THEN** `getProject` is called again

### Requirement: ProjectView is a host-agnostic presentational component in libs/projects

`libs/projects` SHALL export:

- `ProjectView`;
- the `ProjectViewProps`, `ProjectViewLabels`, `ProjectViewStyles`, `ProjectViewModel` and `ProjectContextFileItem` types.

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
| `onOpenFile` | `(fileName: string) => void` |
| `onRetry` | `() => void` |
| `onBrowseProjects` | `() => void` |
| `labels` | `ProjectViewLabels` |
| `styles` | optional `ProjectViewStyles`, applied via `buildCssVars` |

Every declared prop SHALL be read. Read-only mode is expressed only by omitting `onEdit`, `onDelete`, `onShare` and `onPublish`. The lib has no `isReadOnly` flag, so a prop cannot contradict the callbacks.

`ProjectViewPage` maps the DTO into `ProjectViewModel` with `mapProjectDetailsToViewModel` (`apps/chat/src/utils/map-project-dto.ts`). Each `contentType` comes from `inferMimeTypeFromPath` (`@epam/ai-dial-chat-shared`), falling back to `application/octet-stream`.

#### Scenario: Lib has no host integration knowledge

- **WHEN** `libs/projects/src` is searched for `/api/`, `@epam/ai-dial-chat-api-client`, `useFeatureFlag`, `react-router` and `react-i18next`
- **THEN** none of them occurs

#### Scenario: Omitted callbacks hide actions

- **WHEN** `ProjectView` renders without `onEdit`, `onDelete`, `onShare` and `onPublish`
- **THEN** no Edit, Delete, Share or Publish control is rendered, and Pin and Download are

### Requirement: The header shows back, the name, and the project actions

The `ProjectView` header SHALL render, in inline order:

- a back kit `GhostIconButton` named `labels.backLabel`, with `IconArrowNarrowLeft` (`aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`, `rtl:scale-x-[-1]`), calling `onBack`;
- the name as the page's `<h1>`, truncated to one line with `EllipsisTooltip`, so the full name is in the tooltip;
- a Pin toggle kit `GhostIconButton`:
  - icon `IconPin` when unpinned, `IconPinFilled` when pinned;
  - a stable accessible name `labels.pinLabel`, with the state carried by `aria-pressed={isPinned}` alone, so the name never contradicts the pressed state;
  - while `isPinPending` it is `aria-disabled` and ignores activation but stays focusable, so keyboard focus is not dropped to `<body>`;
  - it calls `onTogglePin`;
- a Publish `Button` (`labels.publishLabel`) and an Edit `Button` (`labels.editLabel`), when their callbacks are supplied;
- a ⋮ kit `Dropdown` triggered by a `GhostIconButton` named `labels.moreActionsLabel`, with items Share (when `onShare`), Download and Delete (when `onDelete`). The dropdown is keyboard-operable: Enter, Space and the arrow keys come from the kit.

On `mobile`, Publish and Edit move into the ⋮ menu (before Share). The lib renders both placements and hides one through the `mobile:` / `desktop:` variants, so it never needs `useIsMobile`.

`ProjectViewPage` wires the callbacks:

- `onBack` and `onBrowseProjects` navigate to `ROUTES.Projects`;
- `onEdit` navigates to `getProjectEditRoute(id)`;
- `onTogglePin` calls `setPinnedProject(id, !isPinned)` from `useUserConfig()`;
- `onDownload` downloads the archive (see the actions requirement);
- `onShare` opens `ProjectShareOverlay`, and the page behind it is `inert` while it is open; `onPublish` opens `PublishProjectPanelContainer`, which mounts on the first open and loads the project's publish history on each open, so a folder already holding the project is flagged;
- `onDelete` opens the delete confirmation.

Every handler is memoised with `useCallback`.

#### Scenario: Pin toggles and announces state

- **WHEN** the user activates Pin on an unpinned project
- **THEN** `setPinnedProject` is called with `true`, and the button reports `aria-pressed="true"` and is still named "Pin"

#### Scenario: Long name is truncated with a tooltip

- **WHEN** the name is longer than the header width
- **THEN** it is shown on one line with an ellipsis, and its full text is available in the tooltip

#### Scenario: Mobile collapses secondary actions

- **WHEN** the viewport is in the `mobile` range
- **THEN** Publish and Edit are not in the header row, and are the first items of the ⋮ menu

### Requirement: The Details panel shows description, instructions and context

`ProjectView` SHALL render the Details panel as an `<aside>` named by its visible `<h2>` `labels.detailsLabel`:

- **Placement:** a column on the inline end side on `desktop`, running the height of the page below the header, and stacked below the header on `mobile`.
- **Frame:** no card. The panel has the page background and only a border on its inline-start side on `desktop` (`border-inline-start`, so it flips in RTL), and a top border on `mobile`, where it is stacked.
- **Size and type (design):** 488px wide on `desktop`, `24px 32px` padding, `20px` between sections. The heading is `dial-body-semi-text` (16/24 semibold, `--text-primary`); the Description, Instructions and Context labels are `dial-tiny-text` (12/16, `--text-secondary`) with `4px` to their content; the description and the rendered instructions are `dial-small-text` (14/20, `--text-primary`); the Context section uses `8px` gaps and the file list `8px` top padding. The search is the kit `Search` at its standard 40px height.
- **Description:** a section headed `labels.descriptionLabel`, rendering the text in a `<p>` with preserved line breaks. Omitted when the description is empty.
- **Instructions:** a section headed `labels.instructionsLabel`, rendering `MarkdownRenderer` from `@epam/ai-dial-chat-shared`, read-only, as the catalog About tab does (`libs/catalog/src/components/Details/TabsContent/About.tsx`). Every markdown heading takes `typography.instructionsHeadingClassName` (default `dial-small-semi-text`), so a `#` line never outsizes the project title. Omitted when empty.
- **Context:** a section headed `labels.contextLabel`, containing:
  - a kit `Search` inside `<div role="search">`, named `labels.contextSearchAriaLabel`, with `labels.clearSearchLabel` on its clear action, bound to `contextSearchQuery`;
  - a `<ul>` of `AttachmentCard`s from `@epam/ai-dial-attachment-input`, one per file whose name contains the trimmed query, case-insensitively. Each shows the type icon and extension, and its name goes through `Highlight` with `query={trimmedQuery}` and `maxLines={1}`, so the full name is in a tooltip. Activating a card calls `onOpenFile(name)`, and its accessible name is `labels.openFileLabel(name)`.
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
- **THEN** `onOpenFile('tickets.csv')` is called

### Requirement: The view page has explicit loading, error, not-found and loaded states

`ProjectView` SHALL render exactly one state:

| State | When | Renders |
| --- | --- | --- |
| Loading | `isLoading` | a kit `Spinner`, and no header actions |
| Error | `hasError` | a `<p>` with `labels.errorLabel` in the primary text colour and a Retry `GhostButton` (`labels.retryLabel`) calling `onRetry` |
| Not found | `isNotFound` | a `<p>` with `labels.notFoundLabel` in the primary text colour and a `GhostButton` (`labels.browseProjectsLabel`) calling `onBrowseProjects` |
| Loaded | otherwise, with `project != null` | the header and the Details panel |

The error and not-found titles are announced through `role="alert"`.

#### Scenario: Error and retry

- **WHEN** `hasError` is `true`
- **THEN** the error message and a Retry button render, and activating Retry calls `onRetry`

#### Scenario: Unknown project

- **WHEN** `isNotFound` is `true`
- **THEN** the not-found message renders with a button that calls `onBrowseProjects`

### Requirement: Project actions run through app-owned adapters

`useProjectActions` (`apps/chat/src/hooks/projects/useProjectActions.ts`) SHALL own the side effects for one loaded project.

**Download.** `downloadProjectArchive(id)` calls `projectsApi.downloadProjectRaw` and passes the raw `Response` to `triggerBrowserDownload` (`libs/chat-hooks/src/files/browser-download.ts`) with the fallback name `{name}.zip`.

- Success calls `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.Downloaded, { name })`.
- Failure calls `showErrorNotification` with `projects.actions.downloadError`.

**Open file.** `downloadProjectContextFile(id, fileName)` works the same way, through `downloadProjectFileRaw`.

**Delete.**

- The page opens `DeleteConfirmationDialog` (`@epam/ai-dial-chat-shared`). Its title is `projects.actions.deleteConfirmTitle` (interpolating `{{name}}`), its body is `projects.actions.deleteConfirmDescription`, and its labels are the shared confirm and cancel labels.
- Confirming calls `deleteProject(id, etag)`, and the dialog shows `isLoading` while the request runs.
- **Success:** `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.Deleted, { name })`, then `replacePinnedProjectId(id, null)` (the BFF already removed the pin), then `navigate(ROUTES.Projects, { replace: true })`, so Back does not reopen the deleted project.
- **`409 project-changed`:** close the dialog, show `showErrorNotification` with `projects.errors.changedElsewhere`, and call `retry()`.
- **Other failures:** `showErrorNotification` with `projects.actions.deleteError`. The dialog stays open.

**Share.** `SharePopoverContainer` is rendered with `itemId={id}` and `canEditAccess={false}`.

**Publish.** `PublishProjectPanelContainer` is rendered with `projectId`, `projectName`, `onClose` and `returnFocusRef` (the Publish trigger).

**Gating.** `onPublish`, `onEdit`, `onShare` and `onDelete` are passed to `ProjectView` only when `project.canEdit` is `true`. Pin and Download are always passed.

`NotifiableEntity` (`apps/chat/src/types/entity-notification.ts`) gains `Project`, with its entries in `apps/chat/src/utils/entity-notification.ts`.

#### Scenario: Delete confirms, deletes and navigates

- **WHEN** the user chooses Delete, then confirms
- **THEN** `deleteProject` is called with the loaded ETag, a success toast is shown, and the router is at `/projects`

#### Scenario: Delete on a changed project

- **WHEN** `deleteProject` rejects with `409` and `code: 'project-changed'`
- **THEN** the "changed by someone else" toast is shown, and the project is reloaded

#### Scenario: Shared project is read-only

- **WHEN** the loaded project has `canEdit: false`
- **THEN** Edit, Delete, Share and Publish are absent, and Pin and Download work

#### Scenario: Download the archive

- **WHEN** the user chooses Download
- **THEN** `downloadProjectRaw` is called, and the browser receives `{name}.zip`

### Requirement: Projects can be published through the standalone publish panel

`PublishProjectPanelContainer` (`apps/chat/src/components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx`) SHALL follow the structure of `PublishConversationPanelContainer`:

- `StandalonePublishPanel` from `@epam/ai-dial-publish-panel`;
- `usePublishFolders`, `usePublishErrorNotification` and `getPublishRules`.

It submits through `publishCatalogEntity({ entityType: CatalogPublishEntityType.Project, entityId: projectId, publishCatalogEntityDto })` from `apps/chat/src/server-api/publish.api.ts`. On success it calls `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.PublishRequested, { name })`. Its strings come from `projects.publish.*` keys, plus the shared publish keys where they exist.

`CatalogPublishEntityType` in `libs/chat-hooks/src/catalog/publish.ts` SHALL gain `'project'`. `CatalogEntityType` in `libs/chat-shared` is not changed.

#### Scenario: Publish request

- **WHEN** the user selects a folder and submits
- **THEN** `POST /api/v1/catalog/project/{encoded id}/publish` is sent, and a "publish requested" toast is shown

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
| `projects.view.openFile` | `Download {{name}}` |
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

### Requirement: The project view page is mobile-first, RTL-safe and meets WCAG 2.1 AAA

The project view page and `ProjectView` SHALL meet the following contract.

**Layout:**

- Mobile-first, with only the `mobile` / `desktop` variants.
- The page never scrolls horizontally at 320 px. The header title truncates before its buttons are pushed out.
- The Details panel stacks under the header on `mobile`.

**RTL:**

- Logical properties only (`ms-*`, `pe-*`, `start-*`, `border-s-*`, `text-start`).
- The back arrow is mirrored with `rtl:scale-x-[-1]`.
- The pin, ⋮, share, download and delete icons are not mirrored.

**Accessibility:**

- Every icon-only button has an accessible name.
- Pin uses `aria-pressed`.
- The ⋮ menu is keyboard-operable.
- The delete confirmation is a labeled dialog (`DeleteConfirmationDialog`, whose title names it).
- Context search results are announced through the `aria-live` status.
- Every Tabler icon uses `stroke={DIAL_KIT_ICON_STROKE}` and `aria-hidden`.
- Focus returns to the Publish or ⋮ trigger when the publish panel or share popover closes.
- Text colours in the lib's `var(--token, #hex)` fallbacks reach 7:1.

**Memoisation:**

- `ProjectViewPage` and `ProjectView` are wrapped in `memo`.
- The labels, the view model and the filtered file list are `useMemo`.
- Every callback passed to the lib is `useCallback`.

#### Scenario: Narrow viewport

- **WHEN** the page renders at 320 px wide with a 200-character name
- **THEN** `document.documentElement.scrollWidth` does not exceed the viewport width

#### Scenario: RTL back arrow

- **WHEN** `dir="rtl"` is set on `<html>`
- **THEN** the back icon carries `rtl:scale-x-[-1]`, and the Details panel sits on the inline end (left)

#### Scenario: Keyboard reaches every action

- **WHEN** a keyboard user tabs through the header
- **THEN** Back, Pin, Publish, Edit and the ⋮ menu receive focus in order, and the menu items are reachable with the arrow keys

### Requirement: Observability of project view actions

No new analytics event or metric SHALL be introduced. The BFF routes are covered by `MetricsInterceptor`. Failures surface to the user as toasts carrying `requestId` from `getApiErrorDetails` (`libs/chat-hooks/src/api-error/api-error.ts`), as other pages do.

#### Scenario: Failure carries the trace id

- **WHEN** `deleteProject` fails with a response that carries a trace id
- **THEN** the error toast is shown with that `requestId`

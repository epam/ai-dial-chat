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

`useProject(client, id: string | null, enabled: boolean)` (`libs/chat-hooks/src/project/use-project.ts`, exported from `@epam/ai-dial-chat-hooks/project`) SHALL call `client.getProject(id, signal)`. The pages call it with `projectsClient` (`apps/chat/src/hooks/projects/projects-client.ts`), which wraps `getProject` from `apps/chat/src/server-api/projects.api.ts` (`projectsApi.getProject`). The hook returns `{ project, isLoading, hasError, isNotFound, retry, refresh }`:

- `project` is the `ProjectDetailsDto`, or `null`.
- The fetch runs in `useEffect` with an `AbortController`. It aborts on unmount and on an id change, and a cancelled request never sets state.
- `isLoading` is derived, as in `useProjects`: it is `true` while `enabled && id != null` and no result answers the current reload token.
- A `404` sets `isNotFound`. Any other failure sets `hasError`.
- `retry` is a stable `useCallback`.
- `refresh` is a stable `useCallback` returning `Promise<ProjectRefreshOutcome>`. `ProjectRefreshOutcome` is a string enum in `libs/chat-hooks/src/project/project-refresh.ts`: `Updated = 'updated'`, `NotFound = 'not-found'`, `Failed = 'failed'`, `Skipped = 'skipped'`.
  - It re-requests `getProject` without touching `isLoading`, `hasError` or `isNotFound`.
  - On success it replaces `project` in the current result, which keeps its key, and resolves `Updated`.
  - On `404` it keeps the current `project` and resolves `NotFound`, so the page can leave (see the `project-view-live-updates` capability).
  - On any other failure it keeps the current `project` and resolves `Failed`.
  - A refresh started while no project is loaded resolves `Skipped`.
  - A newer `refresh` or an id change aborts an older one. An aborted refresh sets no state and resolves `Skipped`.

The page's derived state follows `project`: the view model, `canEdit`, `conversationCount` and the header actions. A refresh that turns `canEdit` to `false` (the project was unshared) therefore hides Edit, Delete, Share and Publish without a reload.

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

#### Scenario: Silent refresh

- **WHEN** a project is loaded and `refresh()` resolves with new instructions
- **THEN** `isLoading` stays `false` throughout, `project.instructions` is the new value, and the promise resolves `Updated`

#### Scenario: Failed refresh keeps the page

- **WHEN** `refresh()` rejects with `503`
- **THEN** `project` is unchanged, `hasError` stays `false`, and the promise resolves `Failed`

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
| `onContextFileDownload` | optional `(id: string) => void`, called with a context file's name from its card's download button; the cards show no download button when omitted |
| `isDetailsStacked` | optional `boolean`, default `false`: renders the Details panel below the main column at every width, instead of beside it on `desktop` |
| `onRetry` | `() => void` |
| `onBrowseProjects` | `() => void` |
| `mainContent` | optional `ReactNode`: the main column's content |
| `labels` | `ProjectViewLabels` |
| `styles` | optional `ProjectViewStyles`, applied via `buildCssVars` |

**Main column.** When `mainContent` is supplied, the loaded layout renders it in a `<section>` before the Details `<aside>`:

- it is named by `labels.mainContentLabel`, a new optional label;
- it is `flex-1 min-w-0`, with `24px 32px` padding on `desktop`;
- its content is centered at the design's 748px max width, with `20px` between its blocks;
- while the Details panel sits beside it on `desktop`, the header stays in place and the main column and the panel each scroll on their own (Figma node `23:24330`); wherever the panel stacks, both scroll together below the header.

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

### Requirement: The header shows back, the name, and the project actions

The `ProjectView` header SHALL render, in inline order:

- a back kit `GhostIconButton` named `labels.backLabel`, with `IconArrowNarrowLeft` (`aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`, `rtl:scale-x-[-1]`), calling `onBack` (Figma node `1:2756`);
- the name as the page's `<h1>` in `typography.titleClassName` (default `dial-h1-text`, 20/28 semibold), truncated to one line with `EllipsisTooltip`, so the full name is in the tooltip;
- a Pin kit `GhostButton` with an icon and a text label:
  - `IconPin` and `labels.pinLabel` when unpinned, `IconPinOff` (a crossed-out `IconPin` drawn in `libs/projects/src/components/IconPinOff/IconPinOff.ts`, since Tabler has none) and `labels.unpinLabel` when pinned, so the label names the action and shows the state; it has no `aria-pressed`, because a pressed state would contradict a label that already changes;
  - while `isPinPending` it is `aria-disabled` and ignores activation but stays focusable, so keyboard focus is not dropped to `<body>`;
  - it calls `onTogglePin`;
- a Publish `NeutralButton` (`IconWorldShare`, `labels.publishLabel`) and an Edit `NeutralButton` (`IconPencilMinus`, `labels.editLabel`), when their callbacks are supplied;
- a ⋮ `ActionMenu` (`@epam/ai-dial-chat-shared`) triggered by a `GhostIconButton` named `labels.moreActionsLabel`: the kit `Dropdown` on tablet and desktop, and on a phone (`useIsPhone`, below 768px) a bottom sheet titled `labels.moreActionsLabel` and closed by `labels.closeLabel` (default `'Close'`), with items Share (when `onShare`, `IconShare`), Download (`IconDownload`) and Delete (when `onDelete`, `IconTrashX`, danger). Every item carries its icon, and Publish and Edit keep theirs in the mobile menu. The dropdown is keyboard-operable: Enter, Space and the arrow keys come from the kit.

The header has a bottom border (`--pv-border`) on `desktop` only; on `mobile` it has none, and the stacked Details panel's top border is the divider below the main column.

On `mobile`, Publish and Edit move into the ⋮ menu (before Share). The lib renders both placements and hides one through the `mobile:` / `desktop:` variants; only the ⋮ menu's presentation (dropdown or sheet) reads `useIsPhone`.

`ProjectViewPage` wires the callbacks:

- `onBack` and `onBrowseProjects` navigate to `ROUTES.Projects`;
- `onEdit` navigates to `getProjectEditRoute(id)`;
- `onTogglePin` calls `setPinnedProject(id, !isPinned)` from `useUserConfig()`;
- `onDownload` downloads the archive (see the actions requirement);
- `onShare` opens `ProjectShareOverlay`, which portals to the body and makes the rest of the page `inert` while it is open; `onPublish` opens `PublishProjectPanelContainer`, which mounts on the first open and loads the project's publish history on each open, so a folder already holding the project is flagged;
- `onDelete` opens the delete confirmation.

Every handler is memoised with `useCallback`.

#### Scenario: Pin toggles and announces state

- **WHEN** the user activates Pin on an unpinned project
- **THEN** `setPinnedProject` is called with `true`, and the button is then labelled "Unpin"

#### Scenario: Long name is truncated with a tooltip

- **WHEN** the name is longer than the header width
- **THEN** it is shown on one line with an ellipsis, and its full text is available in the tooltip

#### Scenario: Mobile collapses secondary actions

- **WHEN** the viewport is in the `mobile` range
- **THEN** Publish and Edit are not in the header row, and are the first items of the ⋮ menu

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

**Open file.** The hook no longer downloads a single context file. Activating a context card opens the file in the attachment canvas (see the `project-context-file-preview` capability), and downloading that one file is the canvas header's Download action.

**Delete.**

- The page opens `ProjectDeleteConfirmation` (`apps/chat/src/components/ProjectDeleteConfirmation/ProjectDeleteConfirmation.tsx`), the app's one project delete confirmation, which renders `DeleteConfirmationDrawer` (`@epam/ai-dial-chat-shared`) — the side panel the catalog shows for an item — with a danger identity card (`identityVariant={ConfirmationPopupVariant.Danger}`) holding the project name. Its title is `buttons.delete`, and its labels are the shared confirm, cancel and close labels. It has one body whatever the chat count: the `catalog.details.delete.confirmMessage` message ("Are you sure you want to delete **name**? This action is permanent and cannot be undone."), the consequences `catalog.details.delete.consequenceSharedConfigurations` and `catalog.details.delete.consequenceUsersLoseAccess`, and the final "Cannot be undone" bullet.
- Confirming calls `deleteProject(id, contentVersion)`, and the drawer shows `isLoading` while the request runs.
- **Success:** `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.Deleted, { name })`, then `replacePinnedProjectId(id, null)` (the BFF already removed the pin), then `navigate(ROUTES.Projects, { replace: true })`, so Back does not reopen the deleted project.
- **`409 project-changed`:** close the drawer, show `showErrorNotification` with `projects.errors.changedElsewhere`, and call `retry()`.
- **Other failures:** `showErrorNotification` with `projects.actions.deleteError`. The drawer stays open.

**Share.** `ProjectShareOverlay` (`apps/chat/src/components/ProjectShareOverlay/ProjectShareOverlay.tsx`) renders `SharePopoverContainer` with:

- `itemId={id}`;
- `canEditAccess` set, so the popover offers the View / Edit access dropdown. Edit creates a link with `ShareLinkAccess.View` and `ShareLinkAccess.Edit`, which the BFF turns into `READ` + `WRITE`;
- `visibilityNote={t(ShareI18nKeys.VisibilityNoteProject)}` and `visibilityNoteEdit={t(ShareI18nKeys.VisibilityNoteEditProject)}`, so the notes name a project and its chats, not a deployment.

`SharePopoverContainer` (`apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx`) gains optional `visibilityNote?: string` and `visibilityNoteEdit?: string` props. Each one, when set, replaces its default (`ShareI18nKeys.VisibilityNote`, `ShareI18nKeys.VisibilityNoteEdit`). The catalog passes neither, so its popover is unchanged.

Changing the access in the popover requests a new link, as for catalog entities (`useShareLink`). A link already handed out keeps the permissions it was created with, and the existing revoke flow removes every recipient's access.

**Publish.** `PublishProjectPanelContainer` is rendered with `projectId`, `projectName`, `conversationCount`, `onClose` and `returnFocusRef` (the Publish trigger).

**Gating.** The page reads two flags from the loaded `ProjectDetailsDto`:

| Callback passed to `ProjectView` | Passed when |
| --- | --- |
| `onEdit` | `project.canEdit` |
| `onPublish`, `onShare`, `onDelete` | `project.canManage` |
| `onTogglePin`, `onDownload`, `onContextFileClick`, `onContextFileDownload` | always |

`PublishProjectPanelContainer` mounts only while `project.canManage`, as `ProjectShareOverlay` and `ProjectDeleteConfirmation` open only through `onShare` and `onDelete`. So a recipient with edit access (`canEdit: true`, `canManage: false`) sees Edit, and neither Publish, Share nor Delete.

New `en.json` keys, with matching `ShareI18nKeys` members:

| Key | `ShareI18nKeys` member | English |
| --- | --- | --- |
| `share.visibilityNoteProject` | `VisibilityNoteProject` | This project, its chats and its updates will be visible to users with the link. |
| `share.visibilityNoteEditProject` | `VisibilityNoteEditProject` | Anyone with the link will be able to view and edit this project and chat in it. |

Every key SHALL exist in every locale file.

`NotifiableEntity` (`apps/chat/src/types/entity-notification.ts`) gains `Project`, with its entries in `apps/chat/src/utils/entity-notification.ts`.

#### Scenario: Delete confirms, deletes and navigates

- **WHEN** the user chooses Delete, then confirms
- **THEN** `deleteProject` is called with the loaded `contentVersion`, a success toast is shown, and the router is at `/projects`

#### Scenario: Delete confirmation is a side panel

- **WHEN** the user chooses Delete
- **THEN** a side panel named `buttons.delete` opens with the catalog delete message and the bullets `catalog.details.delete.consequenceSharedConfigurations`, `catalog.details.delete.consequenceUsersLoseAccess` and the final "Cannot be undone"

#### Scenario: Delete on a changed project

- **WHEN** `deleteProject` rejects with `409` and `code: 'project-changed'`
- **THEN** the "changed by someone else" toast is shown, and the project is reloaded

#### Scenario: View-only project is read-only

- **WHEN** the loaded project has `canEdit: false` and `canManage: false`
- **THEN** Edit, Delete, Share and Publish are absent, and Pin and Download work

#### Scenario: A shared editor edits but does not manage

- **WHEN** the loaded project has `source: 'shared'`, `canEdit: true` and `canManage: false`
- **THEN** Edit is offered, Publish, Share and Delete are absent, and Pin and Download work

#### Scenario: The owner shares with edit access

- **WHEN** the owner chooses Share on their project
- **THEN** the popover shows the access dropdown and the note `share.visibilityNoteProject`
- **AND** choosing Can edit requests a link with access `['view', 'edit']` and shows `share.visibilityNoteEditProject`

#### Scenario: Download the archive

- **WHEN** the user chooses Download
- **THEN** `downloadProjectRaw` is called, and the browser receives `{name}.zip`

#### Scenario: A context card no longer downloads

- **WHEN** the user activates a context card on the view page
- **THEN** no browser download starts, and the file opens in the canvas

### Requirement: Projects can be published through the standalone publish panel

`PublishProjectPanelContainer` (`apps/chat/src/components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx`) SHALL follow the structure of `PublishConversationPanelContainer`:

- `StandalonePublishPanel` from `@epam/ai-dial-publish-panel`;
- `usePublishFolders`, `usePublishErrorNotification` and `getPublishRules`.

It submits through `publishCatalogEntity({ entityType: CatalogPublishEntityType.Project, entityId: projectId, publishCatalogEntityDto })` from `apps/chat/src/server-api/publish.api.ts`. On success it calls `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.PublishRequested, { name })`. Its strings come from `projects.publish.*` keys, plus the shared publish keys where they exist.

`CatalogPublishEntityType` in `libs/chat-hooks/src/catalog/publish.ts` SHALL gain `'project'`. `CatalogEntityType` in `libs/chat-shared` is not changed.

**Chats warning.** DIAL Core publishes a project as a whole, `conversations/` included. When `conversationCount > 0`, the container renders a kit `Notification` with the warning variant through `StandalonePublishPanel`'s `renderSummary`, after the resource title, so `libs/publish-panel` is not changed.

- Its text is `projects.publish.chatsWarning`, pluralised by `count`: "The {{count}} chats in this project are published with it."
- The warning does not block submission: publishing stays the user's choice.
- It sits inside the panel's labelled region, so screen readers read it with the summary.

#### Scenario: Publish request

- **WHEN** the user selects a folder and submits
- **THEN** `POST /api/v1/catalog/project/{encoded id}/publish` is sent, and a "publish requested" toast is shown

#### Scenario: Chats warning on a project with chats

- **WHEN** the panel opens for a project with `conversationCount: 2`
- **THEN** a warning `Notification` with `projects.publish.chatsWarning_other` (`count: 2`) renders, and Submit stays enabled

#### Scenario: No warning without chats

- **WHEN** the panel opens for a project with `conversationCount: 0`
- **THEN** no chats warning renders

### Requirement: Project view strings flow through react-i18next

`ProjectViewPage` SHALL resolve every `ProjectViewLabels` value with `useTranslation().t()`, through `ProjectsI18nKeys` / `ButtonsI18nKeys` members in `apps/chat/src/constants/translation-keys.ts`. The labels object is memoised with `useMemo` on `t`.

**Reused keys:**

- `buttons.back` (back);
- `buttons.publish`, `buttons.edit`, `buttons.download`, `buttons.delete`, `buttons.retry`, `buttons.cancel`, `buttons.close`;
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

### Requirement: The project view page is mobile-first, RTL-safe and meets WCAG 2.1 AAA

The project view page and `ProjectView` SHALL meet the following contract.

**Layout:**

- Mobile-first, with only the `mobile` / `desktop` variants.
- The page never scrolls horizontally at 320 px. The header title truncates before its buttons are pushed out.
- The Details panel stacks under the header on `mobile`.

**RTL:**

- Logical properties only (`ms-*`, `pe-*`, `start-*`, `border-s-*`, `text-start`).
- The back arrow is mirrored with `rtl:scale-x-[-1]`.
- The pin, publish, edit, ⋮, share, download and delete icons are not mirrored.

**Accessibility:**

- Every icon-only button has an accessible name.
- Pin names its action ("Pin" / "Unpin") instead of using `aria-pressed`.
- The ⋮ menu is keyboard-operable.
- The delete confirmation is a labeled dialog (`DeleteConfirmationDrawer`, whose title names it); its close control, Cancel, Escape and a backdrop press are blocked while the delete is in flight.
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

### Requirement: ProjectViewPage owns the project's outputs through useProjectArtifacts

`ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`) SHALL own the outputs state through `useProjectArtifacts(projectId)`. The page calls the shared hook `useProjectArtifacts(client, projectId)` in `libs/chat-hooks/src/project/use-project-artifacts.ts` with `projectsClient`. The page owns the state, not the section, so that the project watch can refresh it (see the `project-view-live-updates` capability). No new React context is added: the page is the only consumer.

The shared hook SHALL:

- take `client: Pick<ProjectsApiClient, 'listProjectArtifacts'>`, which must be referentially stable, and `projectId: string | null`;
- return `{ items, isLoading, hasError, retry, refresh }`, where `items` are `ProjectArtifactItemDto[]` in the BFF's newest-first order;
- read once per project id and on `retry`, starting with `isLoading: true`;
  - a `null` id is `{ items: [], isLoading: false, hasError: false }` with no request;
  - a failed read is `hasError: true` with no items;
  - a `retry` keeps `hasError` until its read settles, while a project change resets the state;
- treat `refresh()` as a silent re-read:
  - it never sets `isLoading` or `hasError`;
  - it replaces `items` on success and keeps them on failure;
  - while a read is in flight it marks that read pending, and the read lists once more before it settles, so a write during the first read is not lost;
  - it is a no-op in the error state;
- abort a request in flight on a newer `refresh`, a `retry`, a project change or unmount. It follows the `useFavicon` pattern: async/await, and an `AbortController` per request.

`ProjectsApiClient` (`libs/chat-hooks/src/project/projects-api-client.ts`) SHALL gain `listProjectArtifacts(projectId, signal?)`, which forwards to the generated `listProjectArtifacts({ id: projectId })`. `ProjectsConfiguredClient` gains the generated method's signature. The hook never constructs or configures a client.

`mapProjectArtifactsToOutputs(items)` in `libs/chat-hooks/src/project/project-mapping.ts` SHALL map each item to `ProjectOutputItem { name, contentType }`. The `contentType` is `inferMimeTypeFromPath(name)`, or `''` when that returns nothing, as `mapProjectDetailsToViewModel` maps context files. The page memoises the mapped items with `useMemo`.

The page always renders `ProjectOutputs` once the project is loaded, and passes it to `ProjectConversationsSection` as `outputs` (see the `project-conversations-ui` capability). The component itself shows no section while the first read is in flight or when there are no outputs.

**Feature flag:** none beyond the page's own `features.projectsEnabled` (`PROJECTS_ENABLED` / `PROJECTS_ENABLED_ROLES`). **Observability:** no new metric or analytics event; the BFF route is covered by `MetricsInterceptor`.

#### Scenario: A project with outputs

- **WHEN** the view page loads a project whose `listProjectArtifacts` answers `summary.md` and `report.pdf`
- **THEN** `ProjectOutputs` renders between the chat input and the Chats list with the cards `summary.md` and `report.pdf`, in that order

#### Scenario: A project without outputs

- **WHEN** `listProjectArtifacts` answers `{ items: [] }`
- **THEN** no Outputs heading or region renders, and the Chats list follows the chat input directly

#### Scenario: Outputs fail to load

- **WHEN** `listProjectArtifacts` rejects on the first read
- **THEN** the Outputs heading renders with `projects.outputs.error` and a Retry button, and activating Retry reads again

#### Scenario: A failed silent refresh keeps the cards

- **WHEN** two outputs are shown and a `refresh()` rejects
- **THEN** both cards stay, and no error renders

#### Scenario: Read-only project shows outputs

- **WHEN** a shared project (`canEdit: false`) with one output is opened
- **THEN** the Outputs section renders its card, with no chat input above it

### Requirement: ProjectOutputs is a host-agnostic presentational component in libs/projects

`libs/projects` SHALL export `ProjectOutputs` (`libs/projects/src/components/ProjectOutputs/ProjectOutputs.tsx`) and its types from `libs/projects/src/models/project-outputs-props.ts`: `ProjectOutputsProps`, `ProjectOutputItem`, `ProjectOutputsLabels`, `ProjectOutputsColors`, `ProjectOutputsTypography` and `ProjectOutputsStyles`.

| Prop | Contract |
| --- | --- |
| `items` | `ProjectOutputItem[]` (`{ name: string; contentType: string }`), in display order. The lib does not sort. |
| `onOpenOutput` | `(name: string) => void`, called when a card is activated. The host decides what opens. |
| `selectedOutputName` | optional `string`: the card that renders selected. |
| `hasError` | optional `boolean`, default `false`: renders the error text and the retry action instead of cards. |
| `onRetry` | optional `() => void`: the retry action, hidden when omitted. |
| `previewLimit` | optional `number`, default `6`: the cards shown before "See all". |
| `labels` | optional `ProjectOutputsLabels`: `title`, `seeAllLabel(count)`, `showLessLabel`, `openOutputLabel(name)`, `errorLabel`, `retryLabel`, each optional with an English default. |
| `styles` | optional `ProjectOutputsStyles` (`colors`, `typography`). |

Rendering:

- **Empty.** With no `items` and no `hasError`, it SHALL render no section, only an empty visually hidden `LiveRegion`. That region is the same node that later carries the error text, so the error is announced.
- **Section.** Otherwise it renders a `<section aria-labelledby>` whose `<h2>` is `labels.title`, styled with `typography.titleClassName`, default `'dial-body-semi-text'`. This is the same level as the Chats heading.
- **Cards.** The first `previewLimit` items render as a `<ul>` of `AttachmentCard`s from `@epam/ai-dial-attachment-input`, the same 100×100 cards as the Details panel's context files, with 8 px gaps (`gap-2`).
  - Each card is a `DisplayAttachment` with `id: name`, `status: RequestStatus.Idle` and `type: getAttachmentTypeFromMime(contentType)`.
  - It takes `onClick` → `onOpenOutput`, `isSelected` when `name === selectedOutputName`, and `labels.clickLabel = openOutputLabel(name)`.
  - A card offers no rename, delete or upload action, and the section has no add control.
- **Collapsed row.** The row is `flex-nowrap` with `overflow-x-auto` at every width, inside a `min-w-0` container, so only the row scrolls.
- **See all.** When `items.length > previewLimit`, a kit `LinkButton` after the heading reads `seeAllLabel(items.length)`. Activating it renders every item in a wrapping (`flex-wrap`) list, and the button then reads `showLessLabel` and collapses again.
  - The button carries `aria-expanded` and `aria-controls` (the list's id).
  - The expanded state is the component's own state, so a new `items` array does not reset it.
- **Error.** `hasError` renders `errorLabel` in the section, in `typography.helperClassName` (default `'dial-tiny-text'`), with that visible copy `aria-hidden`. The always-mounted polite `LiveRegion` announces the same text.
  - When `onRetry` is set, the section also renders a kit `GhostButton` labelled `retryLabel`.
  - When `hasError` turns `false` after that button was activated, focus moves to the section's `<h2>` (`tabIndex={-1}`) instead of falling to the page body.

**Colors** (`ProjectOutputsColors`, set with `buildCssVars` and read in `ProjectOutputs.module.scss`): `headingText` → `--po-heading-text`, fallback `--text-primary`, and `secondaryText` → `--po-secondary-text`, fallback `--text-secondary`.

**Isolation.** The lib gets plain data and callbacks only. It SHALL NOT know the `/api` routes, the `{projectId}/files/artifacts/{name}` locator, the generated client, the canvas or i18n. `npm run lint:check` enforces `@nx/enforce-module-boundaries` (`type:ui`).

`ProjectOutputs` is memoised with `memo`. `ProjectOutputs` and its types are documented in `libs/projects/README.md` with a compiling example.

#### Scenario: Cards beyond the preview limit are behind See all

- **WHEN** `ProjectOutputs` renders 9 items with the default `previewLimit`
- **THEN** 6 cards render, and a button named `See all (9)` has `aria-expanded="false"`

#### Scenario: See all expands and collapses in place

- **WHEN** the user activates `See all (9)`
- **THEN** 9 cards render in a wrapping list, and the button reads `Show less` with `aria-expanded="true"`
- **AND** activating it again shows 6 cards

#### Scenario: No See all when everything fits

- **WHEN** 4 items render
- **THEN** 4 cards render, and there is no See all button

#### Scenario: Activating a card

- **WHEN** the user activates the card named `Preview report.pdf`
- **THEN** `onOpenOutput` is called with `report.pdf`

#### Scenario: Selected card

- **WHEN** `selectedOutputName` is `report.pdf`
- **THEN** that card renders selected, and no other does

#### Scenario: Nothing to show

- **WHEN** `items` is empty and `hasError` is `false`
- **THEN** `ProjectOutputs` renders no section or heading, only an empty live region

#### Scenario: A failure is announced through the region mounted before it

- **WHEN** `ProjectOutputs` renders empty and then with `hasError`
- **THEN** the `status` region is the same node in both renders, and it then reads `Could not load outputs`

#### Scenario: Focus follows a successful retry

- **WHEN** the user activates Retry and the next render has items and no error
- **THEN** focus is on the Outputs heading

### Requirement: An output opens in the attachment canvas, as a context file does

`ProjectViewPage` SHALL open an output the way it opens a context file (see the `project-context-file-preview` capability). Its `onOpenOutput(name)` calls `openAttachmentCanvas(attachment, key, startCanvasRequest())` with:

- `attachment = toStoredProjectFileAttachment({ id: name, name, contentType }, projectId)`, whose `url` is the output locator `{projectId}/files/artifacts/{name}`, from `toProjectArtifactUrl` in `apps/chat/src/utils/dial-file.ts`;
- `key = toProjectPreviewKey(projectId, 'artifacts/' + name)`. A context file name cannot contain `/`, so an output and a context file with the same name are never the same preview and never both render selected.

The shared `toStoredProjectFileAttachment` (`libs/chat-hooks/src/project/project-file-preview.ts`, exported from `@epam/ai-dial-chat-hooks/project`) SHALL take the locator builder for the folder as a required parameter, so that context and output cards share it; `apps/chat/src/utils/project-file-preview.ts` binds it to the app's locator builders.

`resolveDialUrl` SHALL map an output locator to `GET /api/v1/projects/{encodeURIComponent(projectId)}/artifacts/{encodeURIComponent(name)}` (see the `project-detail-api` capability).

- The existing context-locator resolver becomes `resolveProjectFileDownloadUrl`. It recognises the `/files/context/` and `/files/artifacts/` segments and keeps the single-segment file-name rule for both.
- The shared canvas content resolvers, the canvas Download action and `resolveAbsoluteDialUrl` therefore reach outputs with no project-specific fetch.
- **Generated-client impact:** none for the canvas; it requests the route by URL.

The page derives `selectedOutputName` from the canvas `attachmentId`: the card id after the `artifacts/` prefix in the project scope, or `undefined`. It passes `isDetailsStacked` to `ProjectView` while either a context file or an output is open.

Handlers are memoised with `useCallback`.

#### Scenario: Opening an output

- **WHEN** the user activates the `report.pdf` output card of `projects/bucket-1/support`
- **THEN** one `GET /api/v1/projects/projects%2Fbucket-1%2Fsupport/artifacts/report.pdf` request is made, and the canvas shows the PDF
- **AND** the `report.pdf` output card renders selected, and the Details panel stacks below the main column

#### Scenario: Locator mapping

- **WHEN** the locator `projects/bucket-1/support/files/artifacts/Q4 deck.pptx` is resolved
- **THEN** it maps to `/api/v1/projects/projects%2Fbucket-1%2Fsupport/artifacts/Q4%20deck.pptx`
- **AND** an output locator with no file name, or a name containing `/`, resolves to nothing

#### Scenario: Same name in context and outputs

- **WHEN** the project has a context file `notes.md` and an output `notes.md`, and the output is open in the canvas
- **THEN** only the output card renders selected

### Requirement: Outputs strings, layout, RTL and accessibility

**i18n.** `apps/chat/src/hooks/projects/useProjectOutputsLabels.ts` SHALL fill every `ProjectOutputsLabels` field with `t()`, memoised on `t`, through `ProjectsI18nKeys` members in `apps/chat/src/constants/translation-keys.ts`. New keys in `apps/chat/src/i18n/locales/en.json`:

| Key (enum member) | English |
| --- | --- |
| `projects.outputs.title` (`OutputsTitle`) | `Outputs` |
| `projects.outputs.seeAll` (`OutputsSeeAll`) | `See all ({{count}})` |
| `projects.outputs.error` (`OutputsError`) | `Could not load outputs` |

It reuses the following keys rather than adding new ones:

- `buttons.showLess` (`ButtonsI18nKeys.ShowLess`) for `showLessLabel`;
- `buttons.retry` for `retryLabel`;
- `projects.view.openFile` (`Preview {{name}}`) for `openOutputLabel`.

**Mobile.** On `mobile` the section stays in the main column above the Chats list. The card row scrolls horizontally inside the column; at 320 px wide the page itself has no horizontal scroll. It uses the named breakpoints only (`mobile`, `desktop`), with no JS width check.

**RTL.** Only logical utilities are used (`gap-*`, `ms-*`/`me-*`, `ps-*`/`pe-*`, `text-start`). In RTL the row starts at the inline start (right) and scrolls towards the inline end. No directional icon is used, so nothing is mirrored. The lib never reads the language.

**Accessibility (WCAG 2.1 AAA).**

- The section is a `<section>` named by its `<h2>`.
- Every card is the `AttachmentCard`'s `role="button"` element, with the accessible name `Preview {name}` and `aria-pressed` for the selected one. It is reachable in DOM order with Tab and activated with Enter or Space.
- See all is a native button with `aria-expanded` and `aria-controls`.
- After a collapse, focus stays on the See all button.
- The error text is announced through a `LiveRegion` mounted before it, and focus moves to the heading after a successful retry.
- Focus rings are the kit's own, and the text and icon contrast comes from the kit tokens.

#### Scenario: Labels are translated

- **WHEN** the app language changes
- **THEN** the Outputs heading, See all, Show less, the card names and the error text re-render in that language

#### Scenario: No page scroll at 320 px

- **WHEN** the view page renders 6 outputs at a 320 px viewport
- **THEN** `document.documentElement.scrollWidth` equals its `clientWidth`, and the card row's own `scrollWidth` exceeds its `clientWidth`

#### Scenario: Keyboard access

- **WHEN** a keyboard user tabs from the chat input
- **THEN** focus reaches the See all button and each output card, before the Chats list

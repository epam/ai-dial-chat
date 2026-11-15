# project-context-file-preview Specification

## Purpose
Lets a user check a project's context file in place, in the shared attachment canvas, on the New project, Edit project and project view pages, before and after the project exists, without downloading it or opening the file manager.

## Requirements

### Requirement: A context file card opens the file in the attachment canvas, as a conversation attachment does

On the New project page (`/projects/new`), the edit page (`/projects/edit/:bucket/*`) and the view page (`/projects/view/:bucket/*`), activating a context file card (click, Enter or Space) SHALL open that file in `AttachmentCanvas` from `@epam/ai-dial-attachment-canvas`, on the inline-end side of the page. The canvas header shows the file name, **Download** and **Close**, with the labels the canvas already uses on conversation routes.

- The page opens the file the way `ConversationView` opens a message attachment: `useOpenAttachmentCanvas` with the app's `useAttachmentCanvasResolvers`, and a request guard from `useLatestCanvasRequest`, so the loading state, the content resolvers, the error states, the theme and the panel coordination (`onBeforeOpen`) are the conversation's. No project-specific hook, request or content resolver exists.
- The open file's card renders selected (`isSelected`, exposed as `aria-pressed`); no other card does. Activating another card replaces the preview. Re-activating the open card closes the canvas, so the card's pressed state toggles. On the view page the same holds for an Outputs card.
- **Close** closes the canvas.
- Every format a project accepts by default (`.csv`, `.pdf`, `.xlsx`) renders in its viewer, and so does any other extension the deployment allows that the canvas supports (`.txt`, `.md`, `.json`, images, `.docx`, `.pptx`). A type the canvas cannot render (the allowed extensions are configurable through `PROJECT_CONTEXT_ALLOWED_EXTENSIONS`) shows the canvas's existing unsupported state, which offers Download.
- The pages already render the not-found page when `FeatureKey.ProjectsEnabled` (`PROJECTS_ENABLED`) is off, so no preview can open without the flag.

**State ownership.** The open file is the shared `AttachmentCanvasContext` state (`useAttachmentCanvas`, provided in `apps/chat/src/AppRoot.tsx`). No new context is introduced. Each page derives its selected card from the canvas's `attachmentId`.

#### Scenario: Open a saved file from the view page

- **WHEN** the user activates the `tickets.csv` card on the view page
- **THEN** the canvas opens on the inline end with the header "tickets.csv", Download and Close, the `tickets.csv` card renders selected, and the CSV table is shown

#### Scenario: Switch to another file

- **GIVEN** `tickets.csv` is open
- **WHEN** the user activates the `report.pdf` card
- **THEN** the canvas shows `report.pdf`, and only the `report.pdf` card renders selected

#### Scenario: Close

- **GIVEN** a file is open
- **WHEN** the user activates **Close**
- **THEN** the canvas closes and no card renders selected

#### Scenario: Unsupported type

- **GIVEN** the deployment allows `.xyz` files and a project holds `data.xyz`
- **WHEN** the user activates its card
- **THEN** the canvas shows its unsupported state with a Download action

### Requirement: Unsaved files open from their local File without a request

A context file that is not stored in the project yet SHALL open from the `File` the form already holds: every file on the New project page, and every file added during the edit session (`!isStored`). That `File` comes from the device or from the file-manager picker, which downloads it into a `File` before it is staged (`apps/chat/src/hooks/projects/useProjectFileManagerPicker.ts`). The card's own attachment, which carries `file`, is what the canvas opens, and the preview SHALL cause no network request. The canvas header's Download saves that local file.

#### Scenario: Preview before the project exists

- **GIVEN** the user added `tickets.csv` from their device on `/projects/new`
- **WHEN** the user activates its card
- **THEN** the canvas shows the CSV table and no network request is made

#### Scenario: File added during an edit session

- **GIVEN** the user added `notes.txt` on the edit page and has not saved
- **WHEN** the user activates its card
- **THEN** the canvas shows the text, and no request is made to `/api/v1/projects/:id/files/notes.txt`

### Requirement: Saved files are fetched by the shared canvas resolvers through the project file endpoint

A context file stored in the project (the view page's files, and the edit page's files with `isStored`) SHALL be opened as an attachment whose `url` is its locator, `{projectId}/files/context/{fileName}` (`toProjectContextFileUrl` in `apps/chat/src/utils/dial-file.ts`). The app's `resolveDialUrl` (the same function that resolves a `files/` id for the conversation canvas) maps that locator to the BFF endpoint, so the shared content resolvers in `libs/chat-hooks/src/files/attachment-canvas.ts` fetch it, with no project-specific fetch.

**Endpoint (existing, reused unchanged).** `GET /api/v1/projects/{id}/files/{fileName}` (`downloadProjectFile` in `apps/chat-api/src/projects/projects.controller.ts`), authenticated with the session cookie. `id` is the URL-encoded project id and `fileName` a name directly under the project's `context/` folder.

```http
GET /api/v1/projects/projects%2Fbucket-1%2Fsupport/files/tickets.csv
200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="tickets.csv"
X-Content-Type-Options: nosniff
Cache-Control: private, no-store

<binary stream>
```

Errors: `400` invalid id or file name, `401` not authenticated, `403` the `projectsEnabled` feature is off for the user or DIAL Core denied access, `404` the project or file does not exist, `502` DIAL Core returned an error, `503` DIAL Core is unavailable or timed out.

**Generated-client impact: none.** The endpoint is requested by URL, as the conversation canvas requests `/api/v1/files/download`; no `chat-api` or OpenAPI change, and the generated `downloadProjectFileRaw` is not involved.

**Behavior, as for a DIAL file in a conversation.**

- The canvas opens in its loading state and shows the preview when the bytes arrive.
- A `403` shows the canvas's forbidden state; any other non-2xx status, and a network failure, show its load-error state.
- The canvas file type comes from the file name (the card's content type), not from the response header.
- The project file has no metadata URL, so the resolvers read no ETag and cache nothing, matching the BFF's `Cache-Control: private, no-store`: every activation requests the file.
- A load error offers the shared canvas's Retry (see the `canvas` capability), which requests the file again as a new request.
- A response that belongs to a request the user has superseded is discarded by the `useLatestCanvasRequest` guard, as in a conversation.

#### Scenario: Saved file loads and renders

- **GIVEN** the view page of a project that stores `tickets.csv`
- **WHEN** the user activates its card
- **THEN** one `GET /api/v1/projects/{id}/files/tickets.csv` request is made, the canvas shows a loading state, then the CSV table

#### Scenario: Forbidden

- **WHEN** the request answers `403`
- **THEN** the canvas shows the forbidden message, and no preview is shown

#### Scenario: Other failure

- **WHEN** the request answers `502`, or fails at the network
- **THEN** the canvas shows the load-error message with a Retry button, and activating it requests the file again

#### Scenario: Unchanged file on the edit page

- **GIVEN** the edit page with a stored `report.pdf` the user has not removed
- **WHEN** the user activates its card
- **THEN** the file is requested through the endpoint, the PDF renders, and the form is not modified

#### Scenario: Locator mapping

- **WHEN** the locator `projects/bucket-1/support/files/context/Q4 tickets.csv` is resolved
- **THEN** it maps to `/api/v1/projects/projects%2Fbucket-1%2Fsupport/files/Q4%20tickets.csv`, and a locator with no file name, a name containing `/`, or no `projects/` prefix resolves to nothing

### Requirement: Preview keys are project-scoped and a preview never dirties the form

The canvas `attachmentId` of a project file SHALL be `{scope}::{cardId}`, where `scope` is the project id on the edit and view pages and the fixed value `new` on the New project page, and `cardId` is the id of the card (the file name on the view page, `ProjectContextFile.id` in the form). The same file name in two projects is therefore never the same preview, and a canvas holding a conversation attachment or another project's file selects no card here.

The canvas closes when the `pathname` changes, as on every route (`useConversationPanelRouteState`), so it does not leak into the next page. Opening a preview SHALL NOT change the form's dirty state, so `useBuilderLeaveGuard` (`apps/chat/src/hooks/unsaved-changes/useBuilderLeaveGuard.ts`) does not block navigation because of a preview. As in a conversation, removing a card does not by itself close the canvas.

#### Scenario: Same name in two projects

- **WHEN** `notes.txt` is previewed in project A and then in project B
- **THEN** the two previews have different keys, and the second is loaded, not reused

#### Scenario: Preview does not trigger the leave guard

- **GIVEN** the edit page with no edits and a stored file
- **WHEN** the user previews the file and then navigates to another page
- **THEN** the "Discard unsaved changes?" dialog does not open

#### Scenario: Leaving the page

- **GIVEN** a context file is open on the view page
- **WHEN** the user navigates to `/projects`
- **THEN** the canvas is closed

### Requirement: The canvas is mounted and laid out on every project page

`AttachmentCanvasContainer` in `apps/chat/src/app/app.tsx` SHALL also be mounted on the New project, edit and view routes (`ROUTES.ProjectCreate`, `ROUTES.ProjectEdit`, `ROUTES.ProjectView`), in addition to the file-manager and conversation routes. It is not gated by the attachments-manager overlay feature, which gates only the conversation route. The project chat route keeps its conversation behavior.

- **Desktop.** The canvas takes the inline-end side and the page content shrinks beside it, as the conversation page does. Its default and resizable width are the conversation route's (`resolveCanvasWidth`), not a fixed split.
- **View page.** While the canvas holds a file of this project, `ProjectView` renders the Details panel stacked below the main column at every width (`isDetailsStacked`), so the page is the mockup's three columns: navigation, content, canvas. The Details panel and its context cards stay on the page, because the cards are how the user switches files. When the canvas closes, the panel returns to the inline-end column.
- **New project and edit pages.** The form column shrinks beside the canvas.
- **Mobile.** The canvas fills the viewport with a reachable Close. On project routes its header offers no sources-panel toggle, because those routes have no sources panel.
- No horizontal page scroll at any breakpoint.

#### Scenario: Canvas mounts on the project routes

- **WHEN** the router is at `/projects/new`, `/projects/edit/{bucket}/{path}` or `/projects/view/{bucket}/{path}`
- **THEN** the canvas container is mounted, and it is not mounted at `/projects`

#### Scenario: View page stacks Details beside the canvas

- **GIVEN** the view page on a desktop viewport
- **WHEN** a context file is open in the canvas
- **THEN** the Details panel renders below the Chats column instead of beside it, and the canvas is on the inline end

#### Scenario: Details return when the canvas closes

- **GIVEN** the Details panel is stacked because a file is open
- **WHEN** the canvas closes
- **THEN** the Details panel renders as the inline-end column again

#### Scenario: Mobile canvas is full screen

- **GIVEN** a mobile viewport
- **WHEN** the user opens a context file
- **THEN** the canvas fills the viewport, Close is reachable, and the page has no horizontal scroll

### Requirement: libs/projects exposes the preview seam and knows nothing about the canvas

`ProjectView` (`libs/projects/src/components/ProjectView/ProjectView.tsx`) and `ProjectCreateForm` (`libs/projects/src/components/ProjectCreateForm/ProjectCreateForm.tsx`) SHALL accept:

| Component | Prop | Type |
| --- | --- | --- |
| `ProjectView` | `onContextFileClick` | `(id: string) => void`, replaces `onOpenFile`; `id` is the file name |
| `ProjectView` | `selectedContextFileId` | optional `string` |
| `ProjectView` | `onContextFileDownload` | optional `(id: string) => void`; `id` is the file name. Cards show no download button when omitted |
| `ProjectView` | `isDetailsStacked` | optional `boolean`, default `false`: renders the Details panel below the main column at every width |
| `ProjectCreateForm` | `onContextFileClick` | optional `(id: string) => void`; `id` is `ProjectContextFile.id`. Cards are not clickable when omitted |
| `ProjectCreateForm` | `selectedContextFileId` | optional `string` |
| `ProjectCreateForm` | `onContextFileDownload` | optional `(id: string) => void`; `id` is `ProjectContextFile.id`. Cards show no download button when omitted |

Each context card receives `onClick` and `isSelected={id === selectedContextFileId}` on `AttachmentCard`. `ProjectCreateFormLabels` gains an optional `openFileLabel: (name: string) => string`, the accessible name of a clickable card, defaulting to `Preview {name}`; `ProjectViewLabels.openFileLabel` already exists for the view page. Each card also receives `onDownload={onContextFileDownload}`, and `ProjectCreateFormLabels` and `ProjectViewLabels` gain an optional `downloadFileLabel: (name: string) => string`, the accessible name of that button, defaulting to `Download {name}`.

The lib SHALL NOT import `@epam/ai-dial-attachment-canvas`, build a REST path, load bytes, or use `react-i18next`. How a file is opened and where its bytes come from are decided by the app. The `libs/projects` README documents the new props, and every declared prop is read.

#### Scenario: Card click reports its id

- **WHEN** the user activates the `tickets.csv` card of a `ProjectCreateForm` rendered with `onContextFileClick`
- **THEN** `onContextFileClick` is called with that file's `id`

#### Scenario: Selected card

- **WHEN** `ProjectView` renders with `selectedContextFileId="tickets.csv"`
- **THEN** only the `tickets.csv` card renders selected

#### Scenario: Form without the callback

- **WHEN** `ProjectCreateForm` renders without `onContextFileClick`
- **THEN** its cards are not clickable and keep their remove buttons

#### Scenario: Lib has no canvas knowledge

- **WHEN** `libs/projects/src` is searched for imports of `@epam/ai-dial-attachment-canvas` and `react-i18next`
- **THEN** none occurs

### Requirement: A context file card shows its full name and downloads its file without opening it

A clickable `AttachmentCard` file tile (`libs/attachment-input/src/components/AttachmentCard/Attachments/File.tsx`) SHALL show the full file name, extension included, in a kit `Tooltip` on its action button while the two-line name is clamped, and no tooltip while the name fits; the clamp is measured with `useIsVerticallyClamped` from `@epam/ai-dial-chat-shared`. The action button covers the tile, so a tooltip on the name element itself never receives the pointer.

On the New project, edit and view pages, each context card SHALL carry a download button. `useProjectFilePreview` (`libs/chat-hooks/src/project/use-project-file-preview.ts`) returns `onContextFileDownload(cardId)`, which resolves the card through `resolveContextAttachment` and calls `downloadProjectFileAttachment`: a file added in this session downloads from its own `File` with no request, and a stored file downloads from the URL the host's `resolveDownloadUrl` returns for its locator (`resolveProjectFileDownloadUrl` in `apps/chat/src/utils/dial-file.ts`). Downloading neither opens nor closes the canvas and does not mark the form as changed.

#### Scenario: Clamped name

- **WHEN** a context card's name is clamped and the user hovers or focuses the card
- **THEN** a tooltip shows the full file name

#### Scenario: Name that fits

- **WHEN** a context card's whole name fits on the card
- **THEN** hovering the card shows no tooltip

#### Scenario: Download an unsaved file

- **WHEN** the user activates the download button of a card added in the form but not saved yet
- **THEN** the browser downloads the local file and no request is sent

#### Scenario: Download a stored file

- **WHEN** the user activates the download button of a stored context file card
- **THEN** the browser downloads it from the project file endpoint, and the canvas keeps its state

### Requirement: Preview is operable by keyboard and screen reader and is RTL-safe

The preview SHALL meet the following.

- Each context card is an interactive control named by `labels.openFileLabel(name)`, reachable by Tab and activated by Enter or Space. The selected card exposes `aria-pressed="true"` and the others `aria-pressed="false"` (see the `attachment-input-lib` capability).
- Everything else about keyboard and screen-reader behavior of the open canvas is the conversation canvas's, because it is the same panel: this capability adds no Escape key, focus return or live-region announcement of its own. They are a follow-up for the shared canvas, so that the conversation gets them too.
- **Direction.** The canvas is on the inline end, so it opens on the left in RTL. The stacked Details panel uses a top border and no physical left or right classes. No directional icon is added.
- **Memoisation.** The card click handlers are `useCallback`, and the page keeps its `memo` wrapper.
- **Observability.** None: the preview emits no new telemetry or metrics.

#### Scenario: Pressed state

- **GIVEN** `tickets.csv` is open
- **WHEN** the cards are read by assistive technology
- **THEN** the `tickets.csv` card is announced as pressed and the others as not pressed

#### Scenario: RTL placement

- **GIVEN** the language is Arabic
- **WHEN** a file is open
- **THEN** the canvas is on the left edge of the page and the page content is on its right

### Requirement: Preview strings flow through react-i18next

The app SHALL resolve every user-visible string of the preview with `t()` through `ProjectsI18nKeys` in `apps/chat/src/constants/translation-keys.ts`, with matching entries in `apps/chat/src/i18n/locales/en.json`. The canvas's own labels are unchanged, and the preview adds only the card's accessible name:

| Key | English |
| --- | --- |
| `projects.create.context.open` | `Preview {{name}}`, the card's accessible name on the New project and edit pages |
| `projects.view.openFile` | `Preview {{name}}`, the card's accessible name on the view page |

#### Scenario: No raw literals

- **WHEN** the three project pages are inspected
- **THEN** every `t()` argument is an enum member from `translation-keys.ts`

### Requirement: Behaviors the conversation canvas lacks are deferred to the shared canvas

A project page SHALL behave like the conversation canvas wherever the two differ, and SHALL NOT add project-only copies of the behaviors below. They were asked for by the feature's ticket, but the conversation does not have them either, so they are follow-ups for the shared canvas (`libs/attachment-canvas`), to be built once and shared by the conversation, the file manager and the project pages:

- **Escape closes the canvas.**
- **Focus returns to the opening card** when the canvas closes.
- **Loading and failure are announced** through live regions. Until then the preview shows the canvas's own spinner and error text and announces nothing more.

Adding any of them is a change to the `canvas` capability, with the conversation and file manager routes covered by the same requirement.

#### Scenario: Escape does not close a project preview

- **GIVEN** a context file is open on a project page
- **WHEN** the user presses Escape with focus outside the canvas
- **THEN** the canvas stays open, as it does on a conversation route

### Requirement: The open card toggles the canvas and a removed file closes it

On the New project, edit and view pages, activating the card of the file the canvas shows SHALL close the canvas instead of loading the file again, so `aria-pressed` toggles; on the view page this holds for Outputs cards too. On the New project and edit pages, removing the file the canvas shows SHALL close the canvas. Each page calls `closeCanvas` from `useAttachmentCanvas`; the lib only receives `selectedContextFileId` and `onContextFileClick`.

#### Scenario: Re-activating the open card closes the canvas

- **GIVEN** `tickets.csv` is open
- **WHEN** the user activates the `tickets.csv` card again
- **THEN** the canvas closes, the card is no longer pressed, and the file is not requested again

#### Scenario: Removing the open file closes the canvas

- **GIVEN** `tickets.csv` is open on the edit page
- **WHEN** the user removes the `tickets.csv` card
- **THEN** the canvas closes

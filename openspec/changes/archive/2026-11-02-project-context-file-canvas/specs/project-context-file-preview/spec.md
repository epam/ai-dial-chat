## Purpose

Lets a user check a project's context file in place, in the shared attachment canvas, on the New project, Edit project and project view pages, before and after the project exists, without downloading it or opening the file manager.

## ADDED Requirements

### Requirement: A context file card opens the file in the attachment canvas

On the New project page (`/projects/new`), the edit page (`/projects/edit/:bucket/*`) and the view page (`/projects/view/:bucket/*`), activating a context file card (click, Enter or Space) SHALL open that file in `AttachmentCanvas` from `@epam/ai-dial-attachment-canvas`, on the inline-end side of the page. The canvas header shows the file name, **Download** and **Close**, with the labels the canvas already uses on conversation routes.

- The open file's card renders selected (`isSelected`); no other card does.
- Activating another card replaces the preview. Activating the selected card closes the canvas. **Close** and Escape close it.
- At most one project file is open at a time.
- Every format a project accepts by default (`.csv`, `.pdf`, `.xlsx`) renders in its viewer, and so does any other extension the deployment allows that the canvas supports (`.txt`, `.md`, `.json`, images, `.docx`, `.pptx`). A type the canvas cannot render (the allowed extensions are configurable through `PROJECT_CONTEXT_ALLOWED_EXTENSIONS`) shows the canvas's existing unsupported state, which offers Download.
- The pages already render the not-found page when `FeatureKey.ProjectsEnabled` (`PROJECTS_ENABLED`) is off, so no preview can open without the flag.

**State ownership.** The open file is the shared `AttachmentCanvasContext` state (`useAttachmentCanvas`, provided in `apps/chat/src/AppRoot.tsx`). No new context is introduced. Each page derives the selected card from the canvas's `attachmentId`, through `useProjectFilePreview` (`apps/chat/src/hooks/projects/useProjectFilePreview.ts`), which the three pages share.

#### Scenario: Open a saved file from the view page

- **WHEN** the user activates the `tickets.csv` card on the view page
- **THEN** the canvas opens on the inline end with the header "tickets.csv", Download and Close, the `tickets.csv` card renders selected, and the CSV table is shown

#### Scenario: Switch to another file

- **GIVEN** `tickets.csv` is open
- **WHEN** the user activates the `report.pdf` card
- **THEN** the canvas shows `report.pdf`, only the `report.pdf` card renders selected, and the canvas does not close in between

#### Scenario: Activating the selected card closes the canvas

- **GIVEN** `tickets.csv` is open
- **WHEN** the user activates the `tickets.csv` card again
- **THEN** the canvas closes and no card renders selected

#### Scenario: Close and Escape close the canvas

- **GIVEN** a file is open
- **WHEN** the user activates **Close**, or presses Escape
- **THEN** the canvas closes

#### Scenario: Unsupported type

- **GIVEN** the deployment allows `.xyz` files and a project holds `data.xyz`
- **WHEN** the user activates its card
- **THEN** the canvas shows its unsupported state with a Download action

#### Scenario: Nothing to show

- **GIVEN** a stored file whose viewer finds nothing to display
- **WHEN** the user activates its card
- **THEN** the canvas closes instead of staying in its loading state, and no card renders selected

### Requirement: Unsaved files open from their local File without a request

A context file that is not stored in the project yet SHALL open from the `File` the form already holds: every file on the New project page, and every file added during the edit session (`!isStored`). That `File` comes from the device or from the file-manager picker, which downloads it into a `File` before it is staged (`apps/chat/src/hooks/projects/useProjectFileManagerPicker.ts`). The app SHALL open it as an `Attachment` with `file`, as `skillFileToAttachment` does for skills, and the preview SHALL cause no network request. The canvas header's Download saves that local file.

#### Scenario: Preview before the project exists

- **GIVEN** the user added `tickets.csv` from their device on `/projects/new`
- **WHEN** the user activates its card
- **THEN** the canvas shows the CSV table and no network request is made

#### Scenario: File added during an edit session

- **GIVEN** the user added `notes.txt` on the edit page and has not saved
- **WHEN** the user activates its card
- **THEN** the canvas shows the text, and no request is made to `/api/v1/projects/:id/files/notes.txt`

### Requirement: Saved files load through the project file endpoint

A context file stored in the project SHALL load through the BFF's existing endpoint, then open as a local file. Stored files are the view page's files and the edit page's files with `isStored`. The canvas cannot fetch them by URL, because `resolveDialUrl` handles only `files/` ids and the file lives at `projects/{bucket}/{path}/files/context/{fileName}`.

**Endpoint (existing, reused unchanged).** `GET /api/v1/projects/{id}/files/{fileName}` (`downloadProjectFile` in `apps/chat-api/src/projects/projects.controller.ts`), authenticated with the session cookie. `id` is the project id of the route and `fileName` a name directly under the project's `context/` folder.

```http
GET /api/v1/projects/bucket-1%2Fprojects%2Fsupport/files/tickets.csv
200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="tickets.csv"
X-Content-Type-Options: nosniff
Cache-Control: private, no-store

<binary stream>
```

Errors: `400` invalid id or file name, `401` not authenticated, `403` the `projectsEnabled` feature is off for the user or DIAL Core denied access, `404` the project or file does not exist, `502` DIAL Core returned an error, `503` DIAL Core is unavailable or timed out.

**Generated-client impact: none.** The operation is `downloadProjectFile`; the app calls its raw variant `downloadProjectFileRaw` through `projectsClient.downloadProjectContextFile` (`apps/chat/src/hooks/projects/projects-client.ts`), which returns the raw `Response`. No `chat-api` or OpenAPI change.

**Content type.** The BFF forwards DIAL Core's `content-type`, as regular file downloads do. The app builds a `File` named `fileName` from the response body, typed by that header and, when it is absent, by the type inferred from the name (`inferMimeTypeFromPath`), so the canvas routes PDF and OOXML files the same way as in chats.

**States.**

- While the file loads, the canvas is open in its loading state, showing the file name, and the page announces the loading status.
- On success the canvas shows the preview.
- A `403` shows the canvas's forbidden state (`createForbiddenCanvasContent`).
- Any other failure, including a network error or a non-2xx status, shows its load-error state (`createLoadErrorCanvasContent`) and the page announces the failure.
- There is no retry control. Closing the preview and activating the card again loads the file again.
- Nothing is cached on the client, and the BFF sends `Cache-Control: private, no-store`, so every activation requests the file.
- Starting another preview or closing the canvas aborts the request in flight.

#### Scenario: Saved file loads and renders

- **GIVEN** the view page of a project that stores `tickets.csv`
- **WHEN** the user activates its card
- **THEN** one `GET /api/v1/projects/{id}/files/tickets.csv` request is made, the canvas shows a loading state, then the CSV table

#### Scenario: Forbidden

- **WHEN** the request answers `403`
- **THEN** the canvas shows the forbidden message, and no preview is shown

#### Scenario: Other failure

- **WHEN** the request answers `502`, or fails at the network
- **THEN** the canvas shows the load-error message, the page announces the failure, and the canvas offers no retry control

#### Scenario: Unsaved file that cannot be read

- **GIVEN** an unsaved file whose bytes can no longer be read (for example it was removed from disk after it was picked)
- **WHEN** the user activates its card
- **THEN** the canvas shows its load-error state, the page announces the failure, and the canvas is not left loading

#### Scenario: Close stops the download

- **GIVEN** a stored file is loading
- **WHEN** the user closes the canvas with its own Close button
- **THEN** the request in flight is aborted

#### Scenario: Unchanged file on the edit page

- **GIVEN** the edit page with a stored `report.pdf` the user has not removed
- **WHEN** the user activates its card
- **THEN** the file is requested through the endpoint, the PDF renders, and the form is not modified

### Requirement: Preview keys are project-scoped and a late response never replaces a newer preview

The canvas `attachmentId` of a project file SHALL be `{scope}::{cardId}`, where `scope` is the project id on the edit and view pages and the fixed value `new` on the New project page, and `cardId` is the id of the card (the file name on the view page, `ProjectContextFile.id` in the form). The same file name in two projects is therefore never the same preview.

A response or failure that belongs to a request the user has superseded (by activating another card, by closing the canvas, or by leaving the page) SHALL be discarded: it shows no content and no error, and it leaves no object URL behind. The stale-request guard of the canvas package (`useLatestCanvasRequest`) is the reference.

#### Scenario: Slow response for a file the user left

- **GIVEN** the request for `big.pdf` is still in flight
- **WHEN** the user activates `small.csv`, and then the `big.pdf` response arrives
- **THEN** the canvas keeps showing `small.csv`

#### Scenario: Response after Close

- **GIVEN** the request for `big.pdf` is in flight
- **WHEN** the user closes the canvas and the response arrives
- **THEN** the canvas stays closed

#### Scenario: Scope changes while a file is loading

- **GIVEN** the request for `big.pdf` of project A is in flight
- **WHEN** the page switches to project B without unmounting, and the aborted request settles
- **THEN** the canvas stays closed and nothing is announced

#### Scenario: Same name in two projects

- **WHEN** `notes.txt` is previewed in project A and then in project B
- **THEN** the two previews have different keys, and the second is loaded, not reused

### Requirement: The canvas closes with its file, its form and its page, and a preview never dirties the form

- Removing the card of the open file, on the New project and edit pages, SHALL close the canvas. Removing any other file leaves it open.
- Leaving the page SHALL close the canvas, so it does not appear on the next route. The canvas already closes on every `pathname` change; unmounting the page also closes a canvas the page opened.
- Opening, switching and closing a preview SHALL NOT change the form's dirty state, so `useBuilderLeaveGuard` (`apps/chat/src/hooks/unsaved-changes/useBuilderLeaveGuard.ts`) does not block navigation because of a preview.

#### Scenario: Removing the open file

- **GIVEN** `tickets.csv` is open on the New project page
- **WHEN** the user removes the `tickets.csv` card
- **THEN** the canvas closes

#### Scenario: Removing another file

- **GIVEN** `tickets.csv` is open and the form also holds `notes.txt`
- **WHEN** the user removes `notes.txt`
- **THEN** the canvas still shows `tickets.csv`

#### Scenario: Preview does not trigger the leave guard

- **GIVEN** the edit page with no edits and a stored file
- **WHEN** the user previews the file and then navigates to another page
- **THEN** the "Discard unsaved changes?" dialog does not open

#### Scenario: Leaving the page

- **GIVEN** a file is open on the view page
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
| `ProjectView` | `isDetailsStacked` | optional `boolean`, default `false`: renders the Details panel below the main column at every width |
| `ProjectCreateForm` | `onContextFileClick` | optional `(id: string) => void`; `id` is `ProjectContextFile.id`. Cards are not clickable when omitted |
| `ProjectCreateForm` | `selectedContextFileId` | optional `string` |

Each context card receives `onClick` and `isSelected={id === selectedContextFileId}` on `AttachmentCard`. `ProjectCreateFormLabels` gains an optional `openFileLabel: (name: string) => string`, the accessible name of a clickable card, defaulting to `Preview {name}`; `ProjectViewLabels.openFileLabel` already exists for the view page.

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

### Requirement: Preview is operable by keyboard and screen reader, is RTL-safe and meets WCAG 2.1 AAA

The preview SHALL meet the following.

- Each context card is an interactive control named by `labels.openFileLabel(name)`, reachable by Tab and activated by Enter or Space. The selected card exposes `aria-pressed="true"` and the others `aria-pressed="false"` (see the `attachment-input-lib` capability).
- Escape closes the canvas, except the Escape that cancels an IME composition. When the canvas closes by any path (Escape, Close, re-activating the card), focus returns to the card that opened it if that card is still on the page and focus has nowhere useful to be (on the page body, detached, or still inside the closed, inert panel); otherwise it is left to the browser.
- While a saved file loads, the page announces `projects.preview.loading` through a polite `role="status"` region. A failed load announces `projects.preview.error` through a `role="alert"` region. Both regions stay mounted so the first message is announced.
- **Direction.** The canvas is on the inline end, so it opens on the left in RTL. The stacked Details panel uses a top border and no physical left or right classes. No directional icon is added.
- **Memoisation.** The card handlers are `useCallback`, the card sources are `useMemo`, and the page keeps its `memo` wrapper.
- **Observability.** None: the preview emits no new telemetry or metrics.

#### Scenario: Escape returns focus

- **GIVEN** the user opened a file by activating its card with the keyboard
- **WHEN** the user presses Escape
- **THEN** the canvas closes and focus is on that card

#### Scenario: IME composition

- **GIVEN** a preview is open
- **WHEN** the user presses the Escape that cancels an IME composition in a text field
- **THEN** the canvas stays open

#### Scenario: Pressed state

- **GIVEN** `tickets.csv` is open
- **WHEN** the cards are read by assistive technology
- **THEN** the `tickets.csv` card is announced as pressed and the others as not pressed

#### Scenario: Failure is announced

- **WHEN** loading `tickets.csv` fails
- **THEN** a `role="alert"` region contains "Could not load tickets.csv"

#### Scenario: RTL placement

- **GIVEN** the language is Arabic
- **WHEN** a file is open
- **THEN** the canvas is on the left edge of the page and the page content is on its right

### Requirement: Preview strings flow through react-i18next

The app SHALL resolve every new user-visible string with `t()` through `ProjectsI18nKeys` in `apps/chat/src/constants/translation-keys.ts`, with matching entries in `apps/chat/src/i18n/locales/en.json`. The canvas's own labels are unchanged.

| Key | English |
| --- | --- |
| `projects.create.context.open` | `Preview {{name}}`, the card's accessible name on the New project and edit pages |
| `projects.preview.loading` | `Loading {{name}}` |
| `projects.preview.error` | `Could not load {{name}}` |

`projects.view.openFile` keeps its key and becomes `Preview {{name}}` (see the `project-view-ui` capability).

#### Scenario: No raw literals

- **WHEN** `useProjectFilePreview` and the three project pages are inspected
- **THEN** every `t()` argument is an enum member from `translation-keys.ts`

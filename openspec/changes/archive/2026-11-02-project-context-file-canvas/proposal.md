## Why

A project's context files are what its chats rely on, yet every project page shows a file only as a card with a name and extension. To confirm that a CSV has the expected columns or that the right PDF was attached, a user must download the file or find it in the file manager. The chat already has an attachment canvas that renders every format a project accepts, so project pages can preview in place, before creating a project and after.

Today no project page mounts the canvas: `AttachmentCanvasContainer` is rendered only for the file-manager and conversation routes (`apps/chat/src/app/app.tsx:580`), and a context card on the view page does the opposite of a preview: it triggers a browser download (`useProjectActions`, `downloadProjectContextFile`).

## What Changes

- Clicking a context file card on the **create**, **edit** and **view** pages opens the file in `@epam/ai-dial-attachment-canvas` on the end side of the page. The open file's card is marked selected; clicking another card switches the preview; **Close**, Escape or clicking the selected card again closes it. The header shows the file name, Download and Close.
- **Content sources.** Unsaved files (create, and files just added on edit) open from their local `File` with no network request. Saved files (view, and unchanged files on edit) are fetched through `GET /api/v1/projects/:id/files/:fileName`, turned into a local `File`, and opened the same way. A 403 shows the canvas's forbidden state, any other failure its load-error state, and a late response never replaces a newer preview. There is no retry control: the canvas's generic error state has none, and adding one is out of scope. Closing the preview and activating the card again loads the file again. Canvas keys are `{projectId}::{fileName}`.
- **Layout.** The canvas is mounted on the three project routes. On desktop the page content shrinks beside it and, on the view page, the Details panel stacks under the main column instead of sitting beside it, giving the mockup's three columns (navigation, content, canvas). The canvas keeps its existing resizable width. On mobile it is full screen with a reachable Close.
- **Lifecycle.** Removing the open file, leaving the page, or unmounting the form closes the canvas. Opening a preview never makes the form dirty, so `useBuilderLeaveGuard` is not triggered.
- **`libs/projects`** gains `onContextFileClick(id)` and `selectedContextFileId` on `ProjectCreateForm` and `ProjectView`, plus one new label for the card's accessible name, and `ProjectView` gains one layout prop that stacks the Details panel. The lib imports neither the canvas nor any REST path.
- **`libs/attachment-input`**: a selected, clickable `AttachmentCard` exposes `aria-pressed`. Today `isSelected` is a CSS class only.
- **BREAKING (`@epam/ai-dial-projects`):** `ProjectView`'s `onOpenFile(fileName)` is replaced by `onContextFileClick(id)`, and a context card on the view page no longer downloads the file. Download stays reachable from the canvas header; the archive download in the header is unchanged. The `projects.view.openFile` string changes from "Download {{name}}" to a preview wording.

## Capabilities

### New Capabilities
- `project-context-file-preview`: opening a project context file in the attachment canvas from the create, edit and view pages: interaction, content sources, stale-response guard, lifecycle, layout, i18n and accessibility.

### Modified Capabilities
- `project-view-ui`: a context card previews instead of downloading (`onOpenFile` becomes `onContextFileClick`), the selected card, the stacked Details layout, the "Open file" adapter, and the `projects.view.openFile` string.
- `canvas`: the container also mounts on the project create, view and edit routes, opens at the conversation default width there, and closes when the user leaves them.
- `attachment-input-lib`: a selected clickable card exposes `aria-pressed` (an added requirement; the existing selected-tile styling is unchanged).

`project-create-ui` and `project-edit-ui` get no delta: nothing they already require changes, since a clickable card still has its remove button. The new behavior on those pages is specified once, in `project-context-file-preview`.

## Impact

- **Code:** `apps/chat/src/app/app.tsx`; new `apps/chat/src/hooks/projects/useProjectFilePreview.ts` (shared by the three pages); `ProjectCreatePage`, `ProjectEditPage`, `ProjectViewPage`; `libs/projects` (`ProjectCreateForm`, `ProjectView`, their props models and README); `libs/attachment-input` (`AttachmentCard`); `apps/chat/src/constants/translation-keys.ts` and `en.json` for new strings.
- **APIs:** none new. Reuses `downloadProjectFile` (`apps/chat-api/src/projects/projects.controller.ts`), which already forwards DIAL Core's `content-type` as regular file downloads do, so PDF and OOXML viewers get the same type they get in chats. No `chat-api` or OpenAPI change.
- **Dependencies:** none. `apps/chat` already depends on the canvas package.
- **Docs:** `libs/projects/README.md` (new props), `docs/architecture.md` only if the route-to-canvas mapping is described there, `npm run validate:docs` and `npm run validate:specs`.

## Closest existing models

- Canvas fed from a local `File` with a stale guard and forbidden/load-error content: `apps/chat/src/components/CatalogView/SkillDetailsFilePreview.tsx`, `apps/chat/src/hooks/attachment/useSkillFilePreviewSync.ts`, `libs/chat-hooks/src/skill/skill-file-preview.ts:31` (`skillFileToAttachment`).
- Provider-scoped stale guard: `useLatestCanvasRequest` (`libs/attachment-canvas/src/context/AttachmentCanvasContext.tsx:165`).
- Cards to make interactive: `libs/projects/src/components/ProjectView/ProjectView.tsx:244` and `libs/projects/src/components/ProjectCreateForm/ProjectCreateForm.tsx:473`.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. Shared global canvas, app-level `useProjectFilePreview` hook** (chosen) | One canvas instance, the same width, resolvers and theming as chats; the lib stays host-agnostic; matches how conversations and the file manager already work. |
| B. A page-local `AttachmentCanvasProvider` per page (as `SkillDetailsFilePreview` does) | Isolates state, but the container is mounted once in `app.tsx`, so a local provider would not drive it; would duplicate the container per page. Rejected. |
| C. Preview inline inside the card area, without the canvas | Cannot render PDF, XLSX or DOCX without rebuilding the viewers. Rejected. |
| D. Keep download on card click and add a separate preview button | Keeps the old behaviour but adds a second affordance on every card and does not match the mockup's click-to-open. Rejected. |

## Non-goals

- Previewing `PROJECT.md` itself, editing a file's content in the canvas, highlights or citations inside project files.
- A retry control for a failed load (user decision). The canvas's generic load-error state has none, and extending the canvas lib for it is a follow-up.
- Changing the canvas lib, the BFF, or `PROJECT_CONTEXT_ALLOWED_EXTENSIONS`. A type the canvas cannot render keeps its existing "unsupported" state with Download.
- A fixed 50/50 split: the canvas keeps its current default and resizable width.

## Scope and boundary notes

- **Touches shared libs:** `libs/projects` (props), `libs/attachment-input` (`aria-pressed`). `libs/projects` gets two callbacks/values and one layout flag; it still does not import `@epam/ai-dial-attachment-canvas`, build a URL, or call `useTranslation` (the new label arrives through its `*Labels` props with an English default). Bytes loading, canvas keys, routing and i18n stay in `apps/chat`.
- **State ownership:** the open file is the shared `AttachmentCanvasContext` state (`attachmentId` = `{projectId}::{fileName}`); each page derives `selectedContextFileId` from it. No new context.
- **Assumption to confirm in review:** "the canvas replaces the Details panel" is implemented as the mockup shows it (Chat - View project - Preview): Details and the context cards remain on the page, stacked under the chats, because the cards are the only way to switch files. The Details panel does not disappear.

## i18n

New user-visible strings in the `projects` namespace: the preview accessible name of a context card (view page, replacing `projects.view.openFile`; create and edit forms), and the load-status announcement for a saved file. The canvas's own labels already exist. All go through `ProjectsI18nKeys`, with English defaults in the lib props.

## Rollback and compatibility

Behind `FeatureKey.ProjectsEnabled` / `PROJECTS_ENABLED`; no data, API or storage migration. Revert the change to restore the download-on-click card and the unmounted canvas. The only compatibility break is the `ProjectView` prop replacement noted above, in a lib whose only host is this app.

## Acceptance criteria

- On create, edit and view, clicking a context card opens it in the canvas, marks it selected, and switching and closing work (Close, Escape, re-click).
- Unsaved files preview with zero network requests; saved files load through `GET /api/v1/projects/:id/files/:fileName`.
- `.pdf`, `.csv`, `.xlsx` and `.txt` render; an unsupported type shows the unsupported state with Download; 403 and load errors show their canvas states.
- Removing the open file, closing the form or navigating away closes the canvas; a stale load never replaces a newer preview; opening a preview does not dirty the form.
- Mobile-first, RTL-safe, WCAG 2.1 AAA: full-screen canvas on mobile with no horizontal scroll, logical properties only, `aria-pressed` on the open card, Escape closes and returns focus to the opener, loading and errors announced through `aria-live`.
- `libs/projects` stays host-agnostic and its README documents the new props; `npm run validate:docs` and `npm run validate:specs` pass; frontend tests cover each source, switching, closing, removal, error and retry, and the stale guard.

## Context

See `proposal.md` for the motivation and `specs/project-context-file-preview/spec.md` for the behavior. What the code looks like today, and constrains the approach:

- **One global canvas.** `AttachmentCanvasProvider` wraps the whole app in `apps/chat/src/AppRoot.tsx`, and a single `AttachmentCanvasContainer` is mounted in `apps/chat/src/app/app.tsx`, as a flex sibling of `<main>`, for the file-manager route and the conversation route (the latter only with the attachments-manager overlay feature). Page content therefore shrinks beside the canvas on its own; a page only has to open and close it.
- **Context cards are inert on two pages and a download on the third.** `ProjectCreateForm` renders `AttachmentCard` with `onRemove` only. `ProjectView` renders it with `onOpenFile`, which `useProjectActions` turns into a browser download of one file. The view page's Details panel is an `aside` beside the main column on `desktop` (`desktop:flex-row`, `desktop:w-[488px]`) and holds the context cards.
- **Cards carry the data the canvas needs.** New files are `Attachment`s with a `File`; stored files are `StoredProjectContextFile`s with `isStored: true` and the id `stored:{name}` (`mapStoredContextFiles`). The canvas content resolvers in `libs/chat-hooks/src/files/attachment-canvas.ts` already read `attachment.file` (object URL or `file.text()`), which is how `skillFileToAttachment` works.
- **The canvas has no retry on its generic error state** (`AttachmentCanvasBody` renders the label only), and no Escape handling. `isSelected` on `AttachmentCard` is a CSS class only.
- The BFF endpoint `GET /api/v1/projects/:id/files/:fileName` and the app's `projectsClient.downloadProjectContextFile` (returns the raw `Response`) already exist from #9621.

## Goals / Non-Goals

**Goals:**
- One hook, `useProjectFilePreview`, owns every project-page preview rule, so the three pages carry no preview logic of their own.
- `libs/projects` gets only a callback, a selected id and a layout flag.
- A stale or aborted load can never change what the canvas shows.

**Non-Goals:**
- Changing `libs/attachment-canvas` (no retry control, no Escape key handling in the lib), the BFF, or the OpenAPI document.
- Caching file bytes on the client.
- The mockup's **Outputs** section, which this change does not touch (see Open Questions).

## Decisions

**D1. Share the global canvas; drive it from an app hook.** `apps/chat/src/hooks/projects/useProjectFilePreview.ts` takes `{ scope, projectId?, files }`, where `scope` is the project id (edit, view) or `new` (create), and `files` is a list of `{ id, name, contentType, file? }`: a `file` means unsaved, its absence means stored. It returns `selectedContextFileId`, `onContextFileClick(id)`, `statusMessage` and `errorMessage` for the page's live regions, and it renders nothing. Cards map to it in each page: the form pages from `contextFiles` (`isStoredContextFile` decides `file`), the view page from the project's file names. It composes the existing `useAttachmentCanvas`, `useOpenAttachmentCanvas` and `useAttachmentCanvasResolvers`, so theme, custom visualizers and `onBeforeOpen` (which closes the sources panel) behave as in chats.
- *Rejected: a page-local `AttachmentCanvasProvider` per page* (the pattern of `SkillDetailsFilePreview`). The container is mounted once in `app.tsx` and reads the root provider; a local provider would need its own container per page.
- *Rejected: reusing `useSkillFilePreview`.* It lives in `libs/chat-hooks` for skills and follows a `fileId` prop with an effect, while a project preview is event-driven (click, toggle, switch). Its error shape (`err.status`) also differs from the generated client's. Its pattern is reused, not the hook.

**D2. Event-driven open with a latest-request guard.** On click: the selected id closes the canvas; any other id starts a request.
- Unsaved: build the `Attachment` with `file` and call `openAttachmentCanvas(attachment, key)`. No request.
- Stored: `openCanvasLoading(name, key)`, then `projectsClient.downloadProjectContextFile(projectId, name, signal)`, read the body into a `Blob`, build `new File([blob], name, { type })` (`Content-Type` header, else `inferMimeTypeFromPath`, else `application/octet-stream`) and open it as above.
- Each click calls `useLatestCanvasRequest()`'s `beginRequest()` and aborts the previous `AbortController`. After the `await`, the result is applied only if the request is still current **and** the canvas still holds this key, read through a ref. The second condition covers a close or a replacement the hook did not initiate, such as the canvas's own Close button or another panel opening, because the container calls `closeCanvas` itself.
- Every open goes through one helper that also covers a resolver that throws (a local read fails) and one that returns `false` (nothing to show): the first shows the load-error state, the second closes the canvas, so it never stays in its loading state. A request whose key the canvas drops by itself (its own Close button, another panel) is aborted by an effect on the canvas key.
- Scope change without an unmount: the cleanup that closes the previous scope's canvas also clears the expected key, because an aborted request's continuation runs before React re-renders and would otherwise still pass the guard.
- Errors: a `403` opens `createForbiddenCanvasContent()`, anything else opens `createLoadErrorCanvasContent()`. The status is read from `error.response.status` for a thrown generated-client `ResponseError`, or from `response.status` when a non-OK `Response` resolves. Both shapes get a unit test, because the raw method's behavior on non-2xx is verified at implementation time, not assumed.
- *Rejected: caching bytes per file.* The BFF answers `Cache-Control: private, no-store`, files are small (project capacity is limited), and a cache would need invalidation when the file changes in another tab.

**D3. Keys and selection.** `key = ${scope}::${cardId}`. The page's selected card is `attachmentId.startsWith(`${scope}::`) ? attachmentId.slice(scope.length + 2) : undefined`, so a canvas holding a conversation attachment or another project's file selects nothing here. This is the `project-scoped` rule of the spec: the same name in two projects is two keys.

**D4. Lifecycle lives in the hook, not the pages.**
- Removing the open file: an effect watches the ids in `files` and calls `closeCanvas()` when the selected id disappears. The pages need no change to their `handleContextFilesChange`.
- Unmount: a cleanup effect closes the canvas if it holds a key of this scope (the latest `attachmentId` is kept in a ref). Navigation already closes it through `useConversationPanelRouteState`, so this covers a page replaced without a path change.
- Dirty state: the hook holds no form state and never calls `onContextFilesChange`, so `useBuilderLeaveGuard`'s `isDirty` cannot change because of a preview. A test on the edit page proves it.

**D5. Mounting and layout in `app.tsx`.**
- Mount condition becomes `isFileManagerRoute || isProjectPageRoute || (isConversationRoute && isAttachmentsManagerEnabled)`, where `isProjectPageRoute` matches `ROUTES.ProjectCreate`, `ROUTES.ProjectView` and `ROUTES.ProjectEdit` with `useMatch`. The project pages already render `NotFoundPage` when `projectsEnabled` is off, so no extra flag check is needed here.
- Width: `resolveCanvasWidth` already picks the conversation mode for any route that is not the file manager, so the default and resizable width needs no change ("as it is now").
- `leftActions` (the sources-panel toggle) is withheld on the project pages (`isMobile && !isProjectPageRoute`), because they have no sources panel. The condition is "not a project page" rather than "a conversation route" so the file manager route keeps the toggle it has today.
- View page: `ProjectViewPage` reads `useAttachmentCanvas()` and passes `isDetailsStacked={isOpen && selectedContextFileId != null}`. In `ProjectView` the flag switches the row container to a column and the aside to full width with a top border at `desktop`, using the classes mobile already uses, so there is one stacked layout, not two. The Details panel is not hidden: the context cards live in it and they are how the user switches files.

**D6. `aria-pressed` in `libs/attachment-input`.** The interactive root of the file and image tiles gets `aria-pressed` equal to `isSelected` when the tile's action is `onClick` and `isSelected` is defined; an expandable pasted tile, whose action is expanding, never gets it. The project cards are toggles (the selected card closes the canvas), so `aria-pressed` fits better than `aria-current`. *Cost:* chat message attachments also pass a boolean `isSelected`, so their tiles gain `aria-pressed="false"`. That is accepted as harmless and as an accessibility gain, and their tests are updated. *Rejected: a new opt-in prop*, which adds API for a one-line attribute.

**D7. Escape and focus return, owned by the hook** (the canvas lib has neither).
- While this scope holds an open preview, the hook listens for `keydown` on `document`. Escape calls `closeCanvas()` unless `event.defaultPrevented`, so an open popup, menu or dialog that handles Escape first keeps it.
- Escape is ignored while `event.isComposing`, so cancelling an IME composition does not close the preview.
- At click time the hook stores `document.activeElement` as the opener (the pattern of `publishTriggerRef` in `ProjectViewPage`). When a preview it opened goes from open to closed, and focus has nowhere useful to be (`document.body`, a detached element, or an element inside an `[inert]` subtree, since the canvas panel is inert once closed and browsers move focus out of it lazily), it focuses the opener if `opener.isConnected`. That covers Escape, Close and re-activating the card; a removed card is not connected, so focus is left alone.

**D8. `libs/projects` seam.** `ProjectView`: `onOpenFile` is replaced by `onContextFileClick`, plus `selectedContextFileId` and `isDetailsStacked`. `ProjectCreateForm`: optional `onContextFileClick` and `selectedContextFileId`, and `labels.openFileLabel`. Each card gets `onClick`, `isSelected` and `labels.clickLabel`, like the existing view-page card. The app supplies `openFileLabel` in `useProjectCreateFormLabels` (the edit page reuses it) and keeps `projects.view.openFile` as the view page's label. README examples are updated in the same change. *Cleanup that follows from the break:* `openFile` and its `downloadProjectContextFile` flow are removed from `useProjectActions` (`libs/chat-hooks/src/project/use-project-actions.ts` and the app wrapper), because nothing reads them any more; `projectsClient.downloadProjectContextFile` stays, since the preview hook uses it.

**D9. Announcements.** The hook returns two strings and the pages render them through one shared component, `ProjectPreviewAnnouncer`, in always-mounted regions: `projects.preview.loading` in a visually hidden polite `role="status"`, and `projects.preview.error` in a `role="alert"`. The lib forms expose no region for this, so the regions sit in the page, next to the form.

## Risks / Trade-offs

- **The raw client's behavior on non-2xx is unverified** → both a thrown `ResponseError` and a resolved non-OK `Response` are handled and tested (D2).
- **Local `File` viewers for PDF and OOXML** are proven for skills, not yet for projects → each of `.pdf`, `.csv`, `.xlsx`, `.txt` gets a test that opens a `File` through `useOpenAttachmentCanvas` and checks the content type routed.
- **Escape listener could swallow another widget's Escape** → it yields to `defaultPrevented` and is active only while this scope holds an open preview; the hook spec proves the `defaultPrevented` guard with a handler that prevents the event; the kit's own `Popup` and `SharePopover` handle Escape in React handlers that stop propagation, so the event never reaches the hook's `document` listener. No spec drives a real kit popup.
- **`aria-pressed="false"` appears on chat message tiles** → D6; their specs are updated.
- **BREAKING `ProjectView` prop** → the lib's only host is this app; the README and the `project-view-ui` spec change in the same commit.
- **A file with a wrong or missing `Content-Type`** → the canvas routes by MIME and then by extension, so a name-inferred type is the fallback and a truly unknown type lands in the unsupported state, which offers Download.
- **No client cache** → switching back to a file requests it again. Accepted for simplicity and `no-store` semantics.
- **Layout shift on the view page** when Details moves under the Chats column → intended by the mockup; the page already scrolls vertically.

## Migration Plan

One change, no data or API migration, nothing to deploy separately. Everything is behind `FeatureKey.ProjectsEnabled`. Rollback is a revert: the canvas unmounts from the project routes, cards return to inert (create, edit) and download (view), and the removed `openFile` is restored with it.

## Open Questions

- The mockup also shows an **Outputs** row of attachment cards above Chats. It is not part of the ticket and nothing here depends on it; ask design whether it belongs to a separate ticket.

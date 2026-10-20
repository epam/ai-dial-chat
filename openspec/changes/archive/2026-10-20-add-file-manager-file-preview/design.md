# Design

## Context

The File Manager package (`@epam/ai-dial-react-file-manager`) already has a host-delegated preview hook: a "Preview" row action is shown when the host passes an action label, `onPreview(path)` and a dotted-extension list `previewExtensions`; the package never reads file content. Chat does not use it. The admin app does, and only opens the file in a new tab through an authenticated route.

Chat's only File Manager renderer is `DialFileManagerShell` (`libs/chat-shared`), fed by `useDialFileManager` and hosted by `DialFileManagerPage` (`/files`) and several modals. Chat previews attachments with `attachment-canvas`: `useOpenAttachmentCanvas` plus the app's `useAttachmentCanvasResolvers`, rendered by one global `AttachmentCanvasContainer` that `app.tsx` mounts only on conversation routes while `OverlayFeature.AttachmentsManager` is enabled. `dialFileToAttachment` already turns a File Manager `DialFile` into an attachment. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Preview a file on `/files` without leaving the page, with the same renderers and states as conversation attachments.
- Reuse existing code (the File Manager hook, the canvas, the resolvers, `dialFileToAttachment`) and add no rendering code.
- Keep the surface behind one host function so it can move (popup, bottom sheet, in-manager pane) once design decides.

**Non-Goals:**
- Any change to `@epam/ai-dial-react-file-manager`.
- Preview in modals, the Copy/Move picker, or a phone-specific layout.
- A configurable extension list, an export of the canvas's extension sets, or a guard test for list drift. The list is maintained by hand in the app, as `libs/chat-hooks/src/files/source-content.ts` already does for its own copy of those sets. Widening it, even to every file, is a one-constant change.

## Decisions

1. **Host-side, using the File Manager's existing `onPreview` hook.** The file's content needs DIAL credentials and the canvas needs resolvers that live in the app; a public package cannot depend on the private `attachment-canvas`. *Alternative:* build previewers into the package, rejected in proposal.md.

2. **`onPreview` receives only a path, and that is enough.** `useDialFilePreview` finds the `DialFile` in `controller.items` by `path` (the package passes the row's own `path`, so no path conversion is needed) and calls `dialFileToAttachment(file, bucket)`. *Alternative:* widen the package's `onPreview` to pass the file, rejected as an unnecessary package change.

3. **Side panel on `/files`: mount the existing container on that route.** `app.tsx` renders `AttachmentCanvasContainer` when the route is `/files` (always) or a conversation route (with `AttachmentsManager` on). `useConversationPanelRouteState` already closes the canvas on every pathname change. The container sits beside `main` in the same flex row, so the grid shrinks and no extra layout was needed. *Alternative:* a popup with `AttachmentCanvasBody` and an isolated provider, which also covers modals and phones but needs a second surface; deferred.

4. **No `AttachmentsManager` dependency on `/files`.** That feature was introduced to enable the conversation attachments panel. The `skill-file-preview` capability already sets the precedent that previewing a file outside a conversation does not depend on it; `/files` is gated by `OverlayFeature.FileManager` and previews follow that.

5. **Width on `/files` is route-specific.** The canvas's own minimum (600 px) and the conversation default (half the viewport) would leave the grid cramped beside the navigation rail and folder tree. On `/files` the default is `clamp(33% of the viewport, 400, 640)`, additionally capped by `usePanelMaxWidth`, with a 400 px minimum; the constants live in `apps/chat/src/constants/layout.ts`. Conversation routes pass `minWidth` as `undefined` and are unchanged. Width is computed from the viewport, not from the free space beside the navigation and tree; if a screen turns out cramped, switching to the free width is the next step. *Alternative:* keep 600 px minimum everywhere, rejected because a smaller minimum is wanted on `/files` only.

6. **`AttachmentCanvasContainer` forwards `minWidth`.** The container already forwards `defaultWidth` and `maxWidth`; `minWidth` completes the trio and already exists on `AttachmentCanvas`. It is optional and additive. The JSDoc and README gain the property; the documented default was corrected to 600, the value the canvas actually uses.

7. **Shell props are optional and host-agnostic.** `previewLabel`, `onPreview` and `previewExtensions` are passed through unchanged; the shell stays free of i18n and of any knowledge of the canvas. Preview is added to the grid labels only, as the Info action is.

8. **Extension list.** A fixed, documented list of formats the canvas renders (decision recorded under Non-Goals). The File Manager gates the row action with a case-sensitive `includes` on the raw suffix, so the host lists each format in lower, UPPER and Capitalized case. The canvas itself lowercases the extension, so only the gate needs the variants. A listed file the canvas cannot render still lands in the canvas's own unsupported state with a download button, so a wrong entry degrades gracefully.

9. **A Preview that cannot open still shows something.** When `openAttachmentCanvas` resolves `false` (or the file has no URL), the hook opens the canvas with `createUnsupportedCanvasContent` (download link from `resolveDialUrl` when there is one). *Alternatives:* download the file automatically, as `ConversationSourcesPanel` does, rejected as a surprising side effect of choosing Preview; an error toast, rejected as a new dependency for a rare case.

10. **No stale-request guard.** Click-driven openers in Chat (`ConversationView`, `NewConversationComposer`) do not pass `shouldCommit`, and neither does this hook; only the effect-driven skill preview needs it. A slow earlier file can in principle overwrite a later choice; the window is small for text and Markdown, so this is accepted.

## Risks / Trade-offs

- [Phones and narrow windows on `/files` are untested] → the canvas already fills the viewport when `isMobile`; verify before widening the claim.
- [An image whose listing has no `image/*` content type is not shown as an image] → the canvas falls back to its unsupported state with download; accepted.
- [The list can drift from the canvas] → graceful degradation as in decision 8; revisit if it bites.
- [Search hits inside folders that are not loaded have no row menu] → the File Manager builds a row's menu only for rows present in its `items`, so those rows show no actions at all, Preview included; this is the package's behavior and is left alone.
- [Two surfaces will exist if modals later get preview] → the opening logic is one hook, so a second surface plugs into it.
- [The `canvas` spec's prose sections still say conversation-only] → updated directly in the same change (see tasks), since archive syncs only requirements.

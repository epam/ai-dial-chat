# Proposal

## Why

Issue #9138: users cannot see a file's contents from the File Manager; they have to download it first. The conversation view already previews attachments in a side canvas, and the File Manager package already emits a "Preview" intent (`onPreview` / `previewExtensions`), but Chat never wires it, so the row action does not exist on the `/files` page.

## What Changes

- The File Manager's "Preview" row action is turned on for the standalone `/files` page. Choosing it opens the file in the existing attachment canvas (side panel), reusing the conversation's content resolvers, so text, Markdown, JSON, CSV, HTML, PDF, Office documents and images render exactly as they do for attachments, and unsupported or failed files show the canvas's own states.
- `AttachmentCanvasContainer` is also mounted on `/files`. There it does not depend on the `AttachmentsManager` UI feature, and it opens narrower than in a conversation (minimum 400 px, default about a third of the viewport, capped at 640 px). Conversation routes keep their current behavior.
- `AttachmentCanvasContainer` forwards an optional `minWidth` to `AttachmentCanvas`.
- `DialFileManagerShell` accepts three optional props (`previewLabel`, `onPreview`, `previewExtensions`) and forwards them to the File Manager; the Preview label joins the grid action labels only.
- No change to `@epam/ai-dial-react-file-manager`. The attach, avatar and skill file-manager modals are not touched and show no Preview action.

## Capabilities

### New Capabilities
- `file-manager-preview`: the Preview row action on the standalone file manager page, which files it is offered for, how a chosen file is opened in the canvas, and what it does not cover.

### Modified Capabilities
- `canvas`: the canvas panel may also open from the file manager page; the `/files` route mounts the container without the `AttachmentsManager` feature and uses its own width bounds.
- `file-manager-shell`: the shell contract gains the optional preview props.
- `file-manager-standalone-page`: the page wires the preview props (added as a new requirement; existing requirements are unchanged).

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. Host-side: emit intent from the File Manager (already exists), render in Chat with the existing canvas.** | **Chosen.** No File Manager release, no new rendering code, same previews as conversations. The admin app already follows this split (its `onPreview` opens a tab). |
| B. Preview rendering inside `ai-dial-react-file-manager`. | Rejected. It must fetch authenticated file content and would need its own markdown/PDF/Office renderers, or the private `attachment-canvas` (not publishable, heavy dependencies). It also commits the package to a layout before design exists. |
| C. Popup or bottom sheet with `AttachmentCanvasBody` and an isolated provider (the `SkillDetailsFilePreview` pattern). | Deferred. It would also cover the attach modals and phones, but needs a second surface. The side panel is already proven on `/files`. The host hook keeps the surface behind one function, so C can be added later. |
| D. Keep the canvas conversation-only and open the file in a new tab. | Rejected. That is what the admin app does today; the issue asks for preview without leaving the manager. |

## Non-goals

- Preview in the attach, avatar or skill file-manager modals, or in the Copy/Move picker.
- A dedicated phone design. The canvas already fills the viewport on mobile; this was not verified on `/files`.
- Custom previewers, a configurable extension list, or an `AttachmentsManager`-style flag for the preview.
- Exporting `TEXT_EXTENSIONS` / `HTML_EXTENSIONS` from `attachment-canvas`, or a test that guards the extension list against canvas drift.

## Acceptance criteria

- On `/files`, a file row with a listed extension shows "Preview"; folders and unlisted extensions do not.
- Choosing it opens the file in the side panel next to the grid at about a third of the viewport, never narrower than 400 px, resizable.
- The panel opens on `/files` even when `OverlayFeature.AttachmentsManager` is disabled; conversation routes still honour the flag.
- No other file-manager host shows Preview.
- `npm run validate:specs`, `npm run validate:docs` and the affected Vitest suites pass.

## Impact

- Code: `apps/chat/src/app/app.tsx`, `apps/chat/src/constants/layout.ts`, `apps/chat/src/hooks/files/useDialFilePreview.ts` (new), `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`, `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`, `libs/attachment-canvas/src/components/AttachmentCanvasContainer/AttachmentCanvasContainer.tsx`.
- Scope flags: touches two shared libs (`chat-shared`, `attachment-canvas`), both with additive optional props. Library isolation holds: the libs receive a label, a callback, an extension list and a width; resolving the file, the DIAL bucket and the canvas resolvers stay in `apps/chat`.
- i18n: no new strings. The label reuses the existing `basic.preview` key.
- Backward compatibility: purely additive, not breaking. Rollback is reverting the change; no data or API is involved.
- Closest existing models: `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx` (the Info action's grid-only label wiring) and `apps/chat/src/components/CatalogView/SkillDetailsFilePreview.tsx` (previewing a file outside a conversation through the canvas).

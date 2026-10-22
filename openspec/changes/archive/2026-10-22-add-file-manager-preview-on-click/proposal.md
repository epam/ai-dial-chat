# Proposal

## Why

Issue #9138, follow-up: Preview on `/files` is only in the row menu. The team wants a click on a file to open its preview on that page, so the common case takes one action instead of two.

## What Changes

- On the standalone `/files` page, a click on a file row opens that file in the attachment canvas, the same way the row menu's Preview does. Folders keep opening on click.
- The click opens any file, whatever its extension; a format the canvas cannot render shows the canvas's unsupported state with a download button, as an unsupported attachment does in a conversation.
- Preview, by menu or click, also finds a file among the search results when the grid lists a search, so a hit in a folder that was never loaded opens.
- `DialFileManagerShell` accepts an optional `onTableFileClick` and forwards it to the File Manager. `useDialFilePreview` returns an `onFileClick` and takes the search results.
- No change to `@epam/ai-dial-react-file-manager`: it already reports file clicks through `onTableFileClick`. The attach, avatar and skill modals do not pass the callback, so a click there does nothing new.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `file-manager-preview`: the lookup also covers search results; new requirement for opening a preview on click.
- `file-manager-shell`: the shell contract lists the optional `onTableFileClick`.
- `file-manager-standalone-page`: the page passes the click handler and the search results to the preview hook.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. Click opens every file; the canvas decides (unsupported state with download for the rest).** | **Chosen.** It is what a conversation does for an attachment of an unknown type (`useOpenAttachmentCanvas` falls through to the unsupported content), so the page behaves the same and nothing is invented. |
| B. Click opens only files in the Preview extension list, ignores the rest. | Rejected. A click on `backup.zip` would do nothing, with no hint why, and the list would have to track the canvas. |
| C. Click on an unsupported file downloads it, as the sources panel does. | Rejected. Downloading as a side effect of a click surprises the user; the unsupported panel offers the download and leaves the choice. |
| D. Select the row on click and open the preview on double click. | Rejected. Nothing else on the page uses double click, and the File Manager reports single clicks only. |

## Non-goals

- Preview on click in the attach, avatar or skill modals, or in the Copy/Move picker.
- Keyboard activation of a row (a keyboard user keeps the row menu's Preview).
- A special case for a tap while rows are selected on a phone: a file tap opens the preview, as a folder tap opens the folder.
- Changing which files the row menu offers Preview for (the extension list).

## Acceptance criteria

- On `/files`, clicking a file row opens it in the canvas; clicking the checkbox, the row menu or a row being renamed does not.
- Clicking `backup.zip` opens the panel in its unsupported state with a download button.
- With a search active, clicking a hit, or choosing its Preview, opens the file even if its folder was never loaded.
- Clicking a folder still opens the folder; no other file-manager host opens a preview on click.
- `npm run validate:specs`, `npm run validate:docs` and the affected Vitest suites pass.

## Impact

- Code: `apps/chat/src/hooks/files/useDialFilePreview.ts`, `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`, `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`.
- Scope flags: touches the shared `chat-shared` shell with one additive optional prop; the lib stays host-agnostic (it forwards a callback and knows nothing of the canvas).
- i18n: none. RTL/a11y: none new; a click is mouse and touch only, keyboard keeps the row menu.
- Backward compatibility: additive, not breaking; revert the change to roll back.
- Closest models: the `onPreview` wiring from the `add-file-manager-file-preview` change, and `ConversationSourcesPanel` for opening an attachment whose type the canvas does not render.

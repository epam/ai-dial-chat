# Design

## Context

The File Manager reports a click on a file row through `onTableFileClick(row)` (folders navigate on their own). It skips the selection checkbox, the actions column, a row being renamed and temporary rows. Chat passes no such callback today. The preview wiring from `add-file-manager-file-preview` already turns a path into an attachment and opens it in the canvas (`useDialFilePreview`). See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One click opens a file's preview on `/files`, with no new rendering code.
- Same behavior as a conversation for a file the canvas cannot render.

**Non-Goals:**
- Anything in the File Manager package, the modals, or keyboard activation.

## Decisions

1. **Reuse the File Manager's `onTableFileClick`.** It already excludes the checkbox, the menu button and rename, so the click cannot clash with selection or editing. *Alternative:* a handler on the grid's raw `onRowClicked` through `additionalGridOptions`, rejected as it would duplicate those exclusions.
2. **Shell forwards the callback, the page owns the behavior.** `DialFileManagerShell` gets an optional `onTableFileClick`, in the style of `onPreview`; only `DialFileManagerPage` passes it, so the other hosts are unchanged.
3. **No extension gate on click.** The conversation precedent (`useOpenAttachmentCanvas` ends in `createUnsupportedCanvasContent` for an unknown type) is followed. The extension list keeps gating only the row menu.
4. **Look the file up in the search results too.** A search hit may lie in a folder that was never loaded; the row menu hides for such rows but a click is always available, so `useDialFilePreview` takes the search results and searches `items` first, then the results.
5. **`onFileClick` is a thin wrapper over `onPreview(row.path)`.** One code path for menu and click, including the unsupported fallback.

6. **Guard against overlapping previews.** With click as the main way to open a preview, quick successive opens are normal. Each preview takes a generation and passes `useOpenAttachmentCanvas` a `shouldCommit` that is true only for the latest preview while the page is mounted (the pattern `useSkillFilePreviewSync` uses); a superseded preview also skips the unsupported fallback. The listing and search results are read through refs, so `onPreview` and `onFileClick` keep their identity and the file manager does not rebuild its grid options on every refresh.
7. **Known gap: no size guard on preview.** The canvas text, code, Markdown, JSON and Office resolvers fetch a file whole (`fetch(...).then(r => r.text())`, cached in an LRU), and Chat has no preview-specific size limit: the only one is the 1 MiB gate on HTML, applied after the download. The file manager accepts uploads up to `maxAttachmentFileSizeBytes` (512 MiB by default), so a click on a very large text-like file starts a long download and render, and the row menu's Preview behaved the same. Left as is for now, to be decided later. Options noted for then: a threshold in `useDialFilePreview` using the listing's `contentLength` (open the unsupported panel with its download button above it, as for HTML); a `Content-Length` check in the shared canvas resolvers, which would also protect conversations; or showing only the start of the file.

## Risks / Trade-offs

- [A tap on a phone while rows are selected opens the preview, not a selection] → same as a folder tap navigating; the checkbox stays the way to select.
- [Two Preview paths on one page] → both go through the same `onPreview`.
- [Clicking a very large file opens the canvas on a slow download] → the canvas shows its loading state; the same as any attachment.

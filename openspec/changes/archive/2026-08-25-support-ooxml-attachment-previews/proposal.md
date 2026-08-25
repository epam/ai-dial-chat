## Why

Attachment Canvas can preview images, PDFs, JSON, markdown, HTML, and source text, but the Office Open XML formats users attach most often — DOCX, XLSX, PPTX — fall through every branch and land on the unsupported panel, where the only available action is downloading the file and leaving the conversation to read it. Every other previewable type already keeps the user in the chat; Office documents are the remaining gap.

## What Changes

- Add an `Ooxml` content type to Attachment Canvas that renders DOCX, XLSX, and PPTX inline, alongside the existing image/PDF/JSON/markdown/HTML/code renderers.
- Add an `OoxmlContent` renderer backed by format-specific `@silurus/ooxml` viewers (`DocxScrollViewer`, `XlsxViewer`, `PptxScrollViewer`), each imported through a **dynamic `import()`** so the parser bundles stay out of the initial app chunk and only load when a user actually opens an Office file.
- Route Office attachments by **MIME type first, then file extension**, so a file whose `contentType` is correct is matched even when its name has no extension, and a correctly-named file is matched even when the backend reports a generic `contentType`.
- Render loading, error, and cleanup states: a spinner while the viewer parses, an alert panel on parse/render failure, and full viewer teardown (`destroy()` plus container clearing) on unmount and on every content change.
- Make Office previews downloadable — `isDownloadable` and `downloadAttachmentContent` treat `Ooxml` like `Pdf`, triggering an anchor download of the resolved URL.
- Register `Ooxml` with the canvas context's object-URL revocation list so blob URLs created for Office files are released, matching `Image`/`Audio`/`Pdf`.
- Resolve the Office file's bytes at the **application boundary** (`apps/chat`), reusing the existing blob resolver and its LRU cache, and pass the library only a resolved URL plus a format enum — no DIAL paths, fetch logic, or auth knowledge enters `libs/attachment-canvas`.
- Add `@silurus/ooxml` as a runtime dependency of `libs/attachment-canvas`.

No breaking changes: `Ooxml` is a new member of an existing discriminated union, every new label reuses the canvas's existing `loadErrorLabel`, and files that previously reached the unsupported panel keep that behavior unless they match a supported Office format.

## Capabilities

### New Capabilities

- `attachment-canvas-ooxml-viewer`: the Office-document variant of the attachment canvas — the `Ooxml` content type and `OoxmlFileType` enum, MIME/extension format detection, the lazily-loaded `OoxmlContent` renderer with its loading/error/cleanup lifecycle, canvas routing, download and object-URL-revocation participation, and the app-boundary content resolver.

### Modified Capabilities

None. No existing spec's requirements change. `attachment-unsupported-type-error` mentions `.docx`, but only as an example of **upload** validation against a deployment's `inputAttachmentTypes` — an unrelated concern from canvas preview, and its requirements are untouched.

## Impact

**New dependency**

- `@silurus/ooxml` (`^0.80.2`) added to `libs/attachment-canvas/package.json` `dependencies`. It ships three separate entry points (`/docx`, `/xlsx`, `/pptx`), which is what makes per-format lazy loading possible.

**Library — `libs/attachment-canvas`**

| File | Change |
|---|---|
| `src/types/attachment-canvas.ts` | `AttachmentContentType.Ooxml`; new `OoxmlFileType` enum (`Docx`/`Xlsx`/`Pptx`) |
| `src/models/attachment-canvas.ts` | `OoxmlCanvasContent` interface; added to the `AttachmentCanvasContent` union |
| `src/constants/file.ts` | `OOXML_MIME_TYPES` map for the three formats |
| `src/utils/content.ts` | `getOoxmlFileType()` and `isOoxmlPreviewable()` |
| `src/components/OoxmlContent/` | New renderer plus its `.module.scss` |
| `src/components/AttachmentCanvasBody/` | `Ooxml` render branch and `overflow-hidden` body sizing |
| `src/context/AttachmentCanvasContext.tsx` | `Ooxml` added to the object-URL revocation set |
| `src/utils/download.ts` | `Ooxml` handled in `isDownloadable` and `downloadAttachmentContent` |
| `src/index.ts` | Exports `OoxmlFileType`, `OoxmlCanvasContent`, `getOoxmlFileType`, `isOoxmlPreviewable` |

**Application — `apps/chat`**

- `src/utils/attachment-canvas.ts` — new `resolveOoxmlCanvasContent(attachment, format)`, built on the existing `resolveAttachmentBlobUrl` so Office files share the blob LRU cache and the 403/network error classification already used by PDFs.
- `src/hooks/attachment/useOpenAttachmentCanvas.ts` — two routing branches: a MIME-type check before the `contentType` switch, and an extension check before the extension switch.
- `tsconfig.app.json` — project reference to `libs/attachment-canvas/tsconfig.lib.json`.

**Docs**

- `docs/architecture.md` — the `@epam/ai-dial-attachment-canvas` row now lists DOCX/XLSX/PPTX.
- `libs/attachment-canvas/README.md` — documents the new content type, enum, and utilities.

**Not affected**

- **i18n** — no new translation keys. The renderer's failure message reuses the canvas's existing `loadErrorLabel`.
- **Backend** — no `apps/chat-api` changes. Office bytes are served by the already-existing DIAL file download route.
- **Upload validation** — which file types a deployment accepts is unchanged; this is preview-only.

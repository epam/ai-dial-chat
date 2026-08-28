# attachment-canvas-ooxml-viewer Specification

## Purpose

The Office-document variant of the attachment canvas: the `Ooxml` content type, MIME/extension format detection, the lazily-loaded renderer, and routing.

## Capability: attachment-canvas-ooxml-viewer

### Overview

Adds a DOCX/XLSX/PPTX viewer to `AttachmentCanvas` as a new `Ooxml` content type. Office files are opaque ZIP containers rather than natively-renderable binaries, so they are parsed in the browser by `@silurus/ooxml`, whose three separate entry points are each loaded through their own dynamic `import()` — opening a DOCX downloads only the DOCX parser. Format is resolved from the MIME type first and the file extension second, so either signal alone is enough. The file's bytes are resolved at the application boundary and the library receives only a URL and a format enum.

---

## Requirements
### Requirement: `OoxmlFileType` enum

`libs/attachment-canvas/src/types/attachment-canvas.ts` SHALL export a string enum naming the supported Office Open XML formats:

```ts
export enum OoxmlFileType {
  Docx = 'docx',
  Xlsx = 'xlsx',
  Pptx = 'pptx',
}
```

`OoxmlFileType` SHALL be re-exported from `libs/attachment-canvas/src/index.ts` as a value export, because the application boundary constructs `OoxmlCanvasContent` and must name its members.

**Rationale:** the format is what selects the renderer, and it crosses the library boundary. A closed enum owned by the library keeps the host from passing an arbitrary MIME string the library would have to re-parse, and makes adding a format a compile-time change on both sides.

#### Scenario: enum members exist

- **WHEN** a consumer imports `OoxmlFileType` from `@epam/ai-dial-attachment-canvas`
- **THEN** `OoxmlFileType.Docx` equals `'docx'`, `OoxmlFileType.Xlsx` equals `'xlsx'`, and `OoxmlFileType.Pptx` equals `'pptx'`

---

### Requirement: `AttachmentContentType.Ooxml` enum member

`libs/attachment-canvas/src/types/attachment-canvas.ts` SHALL add `Ooxml = 'ooxml'` to the `AttachmentContentType` enum.

**Feature flag:** none. The viewer is not gated behind `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES` — it is a rendering capability of an already-available panel, available to every user who can open the attachment.

#### Scenario: enum member exists

- **WHEN** a consumer imports `AttachmentContentType` from `@epam/ai-dial-attachment-canvas`
- **THEN** `AttachmentContentType.Ooxml` equals the string `'ooxml'`

---

### Requirement: `OoxmlCanvasContent` model interface

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL export:

```ts
interface OoxmlCanvasContent {
  type: AttachmentContentType.Ooxml;
  url: string;
  format: OoxmlFileType;
}
```

- `url` — a resolved download URL or object URL for the Office file. Required; the viewer has no other source.
- `format` — selects the format-specific renderer.

`OoxmlCanvasContent` SHALL be added to the `AttachmentCanvasContent` discriminated union, and both the interface type and `OoxmlFileType` SHALL be exported from the library's public entry point.

These two fields are the **entire** library boundary contract for Office previews. The library SHALL NOT receive a MIME type, a DIAL file path, a bucket, an auth token, or a fetch function — see the app-layer resolver requirement below.

#### Scenario: OoxmlCanvasContent is part of the union

- **WHEN** a function accepts `AttachmentCanvasContent`
- **THEN** it can receive an `OoxmlCanvasContent` value without a TypeScript error

#### Scenario: content type is exported for host construction

- **WHEN** `apps/chat` imports `OoxmlCanvasContent` and `OoxmlFileType` from `@epam/ai-dial-attachment-canvas`
- **THEN** both names resolve, and the host can build a payload without `Parameters<>` gymnastics

---

### Requirement: `OOXML_MIME_TYPES` constant

`libs/attachment-canvas/src/constants/file.ts` SHALL export the canonical MIME type for each supported format:

```ts
export const OOXML_MIME_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;
```

The Office extensions SHALL NOT be added to `TEXT_EXTENSIONS`. An Office file routed to `CodeContent` or the plain-text renderer would display raw ZIP bytes.

#### Scenario: docx mime type is exact

- **WHEN** `OOXML_MIME_TYPES.docx` is read
- **THEN** it equals `'application/vnd.openxmlformats-officedocument.wordprocessingml.document'`

#### Scenario: office extensions are not text-previewable

- **WHEN** `isTextPreviewable('report.docx')` is called
- **THEN** it returns `false`

---

### Requirement: `getOoxmlFileType` and `isOoxmlPreviewable` detection utilities

`libs/attachment-canvas/src/utils/content.ts` SHALL export:

```ts
export const getOoxmlFileType = (
  name: string,
  mimeType?: string,
): OoxmlFileType | undefined
```

Resolution order SHALL be **MIME type first, then file extension**:

1. When `mimeType` is provided, normalize it — take the substring before the first `;`, trim it, and lowercase it — then look it up against `OOXML_MIME_TYPES`. On a match, return that format immediately.
2. Otherwise, take the substring after the **last** `.` in `name`, lowercase it, and look it up against the extension map. Return `undefined` when `name` contains no `.`.
3. Return `undefined` when neither signal matches.

`isOoxmlPreviewable(name, mimeType)` SHALL return `getOoxmlFileType(name, mimeType) != null`.

Both SHALL be exported from the library's public entry point.

**Rationale:** neither signal is reliable alone. DIAL attachments can carry a generic `application/octet-stream` for a correctly-named `report.docx`, and a correct `contentType` can arrive with a `name` that is a citation title with no extension. MIME is checked first because when present and canonical it is the stronger signal; extension is the fallback that covers a mislabeled `contentType`.

MIME parameters must be stripped because upstream `contentType` values are not canonically formatted.

#### Scenario: docx resolved from mime type

- **WHEN** `getOoxmlFileType('', OOXML_MIME_TYPES.docx)` is called
- **THEN** it returns `OoxmlFileType.Docx`

#### Scenario: xlsx resolved from extension when mime type is generic

- **WHEN** `getOoxmlFileType('budget.xlsx', 'application/octet-stream')` is called
- **THEN** it returns `OoxmlFileType.Xlsx`

#### Scenario: pptx resolved from extension with no mime type

- **WHEN** `getOoxmlFileType('deck.pptx')` is called
- **THEN** it returns `OoxmlFileType.Pptx`

#### Scenario: mime type with parameters is normalized

- **WHEN** `getOoxmlFileType` is called with the canonical XLSX MIME type suffixed with `; charset=utf-8`
- **THEN** it returns `OoxmlFileType.Xlsx`

#### Scenario: mime type casing is normalized

- **WHEN** `getOoxmlFileType('', OOXML_MIME_TYPES.docx.toUpperCase())` is called
- **THEN** it returns `OoxmlFileType.Docx`

#### Scenario: uppercase extension is matched

- **WHEN** `getOoxmlFileType('REPORT.DOCX')` is called
- **THEN** it returns `OoxmlFileType.Docx`

#### Scenario: mime type wins over a conflicting extension

- **WHEN** `getOoxmlFileType('data.xlsx', OOXML_MIME_TYPES.docx)` is called
- **THEN** it returns `OoxmlFileType.Docx`

#### Scenario: multi-dot name uses the last segment

- **WHEN** `getOoxmlFileType('q3.final.report.docx')` is called
- **THEN** it returns `OoxmlFileType.Docx`

#### Scenario: name with no extension and no mime type is unmatched

- **WHEN** `getOoxmlFileType('Quarterly Report')` is called
- **THEN** it returns `undefined`

#### Scenario: legacy binary office format is unmatched

- **WHEN** `getOoxmlFileType('old.doc')` is called
- **THEN** it returns `undefined`

#### Scenario: isOoxmlPreviewable mirrors getOoxmlFileType

- **WHEN** `isOoxmlPreviewable('deck.pptx')` is called
- **THEN** it returns `true`
- **AND** `isOoxmlPreviewable('notes.txt')` returns `false`

---

### Requirement: format-specific viewers are loaded with dynamic `import()`

`libs/attachment-canvas/src/components/OoxmlContent/OoxmlContent.tsx` SHALL construct its viewer through a helper that selects a viewer class per format using a **separate dynamic `import()` per format**:

| Format | Module specifier | Exported class | Options |
|---|---|---|---|
| `Docx` | `@silurus/ooxml/docx` | `DocxScrollViewer` | `{ enableTextSelection: true, refitOnResize: true, onError }` |
| `Xlsx` | `@silurus/ooxml/xlsx` | `XlsxViewer` | `{ showZoomSlider: true, onError }` |
| `Pptx` | `@silurus/ooxml/pptx` | `PptxScrollViewer` | `{ enableTextSelection: true, refitOnResize: true, onError }` |

Each module specifier SHALL be a **static string literal** inside its own `switch` arm. A computed or templated specifier defeats bundler code-splitting.

The viewers SHALL NOT be imported statically at module scope. A static import places all three parsers in the chunk that contains `libs/attachment-canvas`, which the conversation view loads eagerly — meaning every user downloads three Office parsers whether or not they open one.

The `switch` SHALL be exhaustive over `OoxmlFileType` with **no `default` arm**, so adding a future format is a compile error at this site rather than a runtime `undefined`.

The three viewer classes SHALL be typed against a locally-declared structural interface rather than their imported types:

```ts
interface OoxmlViewer {
  load(source: string | ArrayBuffer): Promise<void>;
  destroy(): void;
}
```

**Rationale:** one lifecycle to drive instead of three, and the module's static type surface stays free of the parser packages so no type-only import can become a runtime edge.

#### Scenario: opening a docx loads only the docx parser

- **WHEN** `OoxmlContent` renders content with `format: OoxmlFileType.Docx`
- **THEN** `@silurus/ooxml/docx` is imported
- **AND** neither `@silurus/ooxml/xlsx` nor `@silurus/ooxml/pptx` is imported

#### Scenario: xlsx uses the zoom slider option

- **WHEN** `OoxmlContent` renders content with `format: OoxmlFileType.Xlsx`
- **THEN** `XlsxViewer` is constructed with `showZoomSlider: true` and an `onError` callback

#### Scenario: viewer is constructed against the container element and loaded with the url

- **WHEN** `OoxmlContent` renders content `{ type: Ooxml, url: 'blob:abc', format: Docx }`
- **THEN** `DocxScrollViewer` is constructed with the component's container element
- **AND** `load('blob:abc')` is called on the resulting viewer

---

### Requirement: `OoxmlContent` renderer component

`libs/attachment-canvas/src/components/OoxmlContent/OoxmlContent.tsx` SHALL render an Office document into an uncontrolled container element, with a status overlay covering the loading and error states.

**Props interface:**

```ts
interface OoxmlContentProps {
  content: OoxmlCanvasContent;
  fileName?: string;
  loadErrorLabel: string;
}
```

The component MUST NOT read from any app-level context, call `useTranslation`, or construct any URL.

**Lifecycle.** A single `useEffect` keyed on `[content.format, content.url]` — the two inputs that require a fresh viewer — SHALL:

1. Return early when the container ref is `null`.
2. Set `isLoading` to `true` and `hasError` to `false`.
3. Await `createViewer(container, content.format, onError)`, then `await viewer.load(content.url)`, then set `isLoading` to `false`.

**Cancellation.** A `disposed` flag SHALL be set in the effect's cleanup function, and every `setState` after an `await` SHALL be guarded by it.

Because `createViewer` is itself awaited, the effect can be torn down **before a viewer object exists**. The newly-created viewer SHALL therefore be checked against `disposed` and destroyed immediately — and the load abandoned — before it is assigned to the outer reference. Without this, a fast content switch strands a live viewer that nothing holds a reference to and nothing can destroy.

**Cleanup** SHALL call `viewer?.destroy()` **and** `container.replaceChildren()`. `destroy()` is the library's contract; clearing the container is ours, because a parser that fails mid-render can leave partial DOM behind and the next viewer must start against an empty element.

**Two error channels, one error state.** Failures arrive either through the viewer's `onError` callback (a parse or render failure it detected) or as a thrown exception (a failed dynamic import, a rejected `load()`). Both SHALL set `isLoading` to `false` and `hasError` to `true`, and both SHALL check `disposed` first. They differ in cleanup:

- `onError` — the viewer is alive; the handler only flips state.
- `catch` — the viewer's state is unknown, so it SHALL `destroy()` the viewer, clear the reference, and call `container.replaceChildren()`.

**Markup.** A relatively-positioned wrapper (`relative h-full w-full overflow-hidden`) containing:

- the viewer container `<div ref>` — `role="document"`, `aria-label={fileName}`, `aria-busy={isLoading}`, filling the wrapper;
- the status overlay, rendered only while `isLoading || hasError`, absolutely positioned over the container and centered.

**Overlay content.** While loading, a `Spinner` (`size={48}`). On error, an `IconAlertTriangle` (`size={60}`, `stroke={1.5}`, `aria-hidden="true"` because the adjacent text carries the meaning) above the `loadErrorLabel` text.

**Accessibility.**

- The container SHALL carry `role="document"` and `aria-label={fileName}` so the preview is identifiable and the announced name is the file, not the viewer.
- The container SHALL carry `aria-busy={isLoading}` so the parse wait is announced, not merely visible.
- The overlay SHALL carry `aria-live="polite"`, and `role="alert"` **only** when `hasError` is `true`, so a failure is announced without the loading state raising an alert.
- Keyboard navigation inside the rendered document is the viewer's own DOM and is outside this component's control. Per the scope boundary in `.claude/rules/a11y.md`, vendor-rendered output is noted, not patched; the panel's download button remains the accessible fallback.

**i18n:** no new keys. The only user-visible string is `loadErrorLabel`, an existing required prop of the canvas already threaded through `AttachmentCanvasContainer` and already translated. An Office-specific variant would add translation work for a message indistinguishable from the PDF or image load failure.

**RTL / direction impact:** none for this component. The overlay uses `inset-0` with centered flex — both direction-agnostic — and no directional margins, padding, insets, or mirrored icons are introduced. The rendered document's own text direction is the viewer's concern.

**Styling.** `OoxmlContent.module.scss` SHALL set only the viewer and overlay backgrounds and the error icon color, and every declaration SHALL use this library's three-level chain `var(--ac-<name>, var(--<design-token>, #hex))` so each color is overridable through `AttachmentCanvasColors`, falls back to the shared design token, and finally to a literal:

- backgrounds — `var(--ac-ooxml-bg, var(--bg-layer-raised, #fcfcfc))`
- status/error text — `var(--ac-status-text, var(--text-secondary, …))`
- error icon — `var(--ac-error-icon, var(--text-error, …))`

`--ac-status-text` and `--ac-error-icon` are the canvas's existing variables, already set on the `AttachmentCanvasBody` root and inherited through the cascade. `--ac-ooxml-bg` is new and therefore requires the bidirectional mapping in `.claude/rules/libs.md`: an `ooxmlBackground?: string` field on `AttachmentCanvasColors` (documented with its `--bg-layer-raised` default) **and** an `'--ac-ooxml-bg': colors?.ooxmlBackground` entry in the `buildCssVars` call. A background painted from a bare global token with no `--ac-*` level would be the only color in the file that hosts cannot theme.

Layout stays in Tailwind. The stylesheet SHALL contain no `font-size`, `line-height`, `font-weight`, or `!important` declaration.

#### Scenario: every color is host-overridable

- **WHEN** a host passes `styles={{ colors: { ooxmlBackground: 'rebeccapurple' } }}` to the canvas
- **THEN** `--ac-ooxml-bg` is set on the body root and the Office viewer surface and its overlay both paint that color

#### Scenario: unset overrides fall back to the design token

- **WHEN** no `ooxmlBackground` is supplied
- **THEN** the viewer background resolves through `--bg-layer-raised`

**Memoisation:** none required. The component holds two booleans and one ref, and the effect's dependency array is already narrowed to the two fields that matter — `content.format` and `content.url`, not the `content` object, so a new object identity with unchanged fields does not rebuild the viewer.

#### Scenario: spinner shows while parsing

- **WHEN** `OoxmlContent` mounts and the viewer has not finished loading
- **THEN** a spinner is rendered in the overlay
- **AND** the container carries `aria-busy="true"`

#### Scenario: overlay is removed after a successful load

- **WHEN** `viewer.load()` resolves
- **THEN** neither the spinner nor the error panel is rendered
- **AND** the container carries `aria-busy="false"`

#### Scenario: container is labeled with the file name

- **WHEN** `OoxmlContent` is rendered with `fileName: 'Q3 Report.docx'`
- **THEN** the container element has `role="document"` and `aria-label="Q3 Report.docx"`

#### Scenario: viewer onError shows the error panel

- **WHEN** the viewer invokes its `onError` callback
- **THEN** the error panel renders `loadErrorLabel`
- **AND** the panel carries `role="alert"`
- **AND** the spinner is no longer rendered

#### Scenario: rejected load shows the error panel and tears down the viewer

- **WHEN** `viewer.load()` rejects
- **THEN** the error panel renders `loadErrorLabel`
- **AND** `destroy()` is called on the viewer
- **AND** the container is emptied

#### Scenario: failed dynamic import shows the error panel

- **WHEN** the dynamic `import()` for the format rejects
- **THEN** the error panel renders `loadErrorLabel`
- **AND** no unhandled rejection escapes the component

#### Scenario: loading state does not raise an alert

- **WHEN** `OoxmlContent` is in its loading state
- **THEN** the overlay carries `aria-live="polite"` and does NOT carry `role="alert"`

#### Scenario: unmount destroys the viewer and clears the container

- **WHEN** `OoxmlContent` unmounts after a successful load
- **THEN** `destroy()` is called on the viewer
- **AND** the container is emptied

#### Scenario: unmount before the viewer resolves destroys it anyway

- **WHEN** `OoxmlContent` unmounts while `createViewer` is still pending, and the viewer resolves afterwards
- **THEN** `destroy()` is called on the resolved viewer
- **AND** `load()` is never called
- **AND** no state update is attempted

#### Scenario: changing content rebuilds the viewer

- **WHEN** `content.url` changes to a different Office file
- **THEN** the previous viewer is destroyed and the container emptied
- **AND** a new viewer is constructed and loaded with the new URL

#### Scenario: changing format rebuilds the viewer

- **WHEN** `content.format` changes from `Docx` to `Xlsx`
- **THEN** the previous viewer is destroyed
- **AND** `@silurus/ooxml/xlsx` is imported and an `XlsxViewer` constructed

#### Scenario: a new content object with unchanged fields does not rebuild

- **WHEN** the parent re-renders with a new `content` object whose `url` and `format` are unchanged
- **THEN** no new viewer is constructed

#### Scenario: no state update after unmount

- **WHEN** the component unmounts while a load is in flight and that load then settles
- **THEN** no `setState` is called and no unmount warning is produced

---

### Requirement: `AttachmentCanvasBody` renders the `Ooxml` branch

`libs/attachment-canvas/src/components/AttachmentCanvasBody/AttachmentCanvasBody.tsx` SHALL add a `case AttachmentContentType.Ooxml` branch rendering:

```tsx
<OoxmlContent
  content={content}
  fileName={fileName}
  loadErrorLabel={loadErrorLabel}
/>
```

The body sizing class for `Ooxml` SHALL be `h-full overflow-hidden`, grouped with `Pdf`, `Visualizer`, `Code`, and `Html` — the viewer manages its own scrolling, so an outer scroll container would produce nested scrollbars.

The panel chrome SHALL be identical to other content types.

#### Scenario: Ooxml branch renders OoxmlContent

- **WHEN** `AttachmentCanvasBody` receives an `OoxmlCanvasContent`
- **THEN** the body contains an `OoxmlContent` element

#### Scenario: Ooxml body does not add its own scroll container

- **WHEN** `AttachmentCanvasBody` receives an `OoxmlCanvasContent`
- **THEN** the body wrapper carries `overflow-hidden`, not `overflow-auto`

---

### Requirement: Office previews are downloadable

`libs/attachment-canvas/src/utils/download.ts` SHALL treat `Ooxml` exactly as `Pdf`:

- `isDownloadable(content)` SHALL return `true` for `AttachmentContentType.Ooxml`. `url` is required on `OoxmlCanvasContent`, so no null check is needed.
- `downloadAttachmentContent(content, fileName)` SHALL call `triggerAnchorDownload(content.url, name)` for `Ooxml`, sharing the `Image`/`Audio`/`Pdf` arm.

The download button MUST remain available in every Office state, including the error panel, so a document that fails to render is still retrievable — the download is the fallback for the fidelity limits of client-side parsing.

#### Scenario: ooxml content is downloadable

- **WHEN** `isDownloadable({ type: Ooxml, url: 'blob:abc', format: Docx })` is called
- **THEN** it returns `true`

#### Scenario: download triggers an anchor download of the url

- **WHEN** `downloadAttachmentContent({ type: Ooxml, url: 'blob:abc', format: Docx }, 'report.docx')` is called
- **THEN** `triggerAnchorDownload('blob:abc', 'report.docx')` is called

#### Scenario: download is available while the error panel is shown

- **WHEN** an Office document fails to render and `onDownload` is provided
- **THEN** the panel's download button is rendered

---

### Requirement: object URLs for Office content are revoked

`libs/attachment-canvas/src/context/AttachmentCanvasContext.tsx`'s `getRevocableObjectUrl` SHALL include `AttachmentContentType.Ooxml` alongside `Image`, `Audio`, and `Pdf` in the set of content types whose `url` is revoked when the canvas closes or its content is replaced.

**Rationale:** the app-layer resolver can produce an object URL from a fetched blob or a locally-picked `File`. Office documents are among the largest attachments the canvas handles, so a leaked blob costs disproportionately more memory than a leaked icon. This is a correctness requirement, not tidiness.

#### Scenario: ooxml object url is revoked on close

- **WHEN** the canvas holds `OoxmlCanvasContent` with a `blob:` URL and the canvas is closed
- **THEN** `URL.revokeObjectURL` is called with that URL

#### Scenario: ooxml object url is revoked when content is replaced

- **WHEN** the canvas holds `OoxmlCanvasContent` with a `blob:` URL and different content is opened
- **THEN** `URL.revokeObjectURL` is called with the previous URL

---

### Requirement: `resolveOoxmlCanvasContent` app-layer resolver

`libs/chat-hooks/src/files/attachment-canvas.ts` SHALL export, from `@epam/ai-dial-chat-hooks`:

```ts
export const resolveOoxmlCanvasContent = async (
  attachment: DisplayAttachment,
  resolvers: AttachmentCanvasUrlResolvers,
  format: OoxmlFileType,
): Promise<OoxmlCanvasContent | ErrorCanvasContent | null>
```

The function SHALL delegate to the existing `resolveAttachmentBlobUrl` helper and then:

- return `{ type: AttachmentContentType.Ooxml, url: result, format }` when the helper yields a URL string;
- return the helper's `ErrorCanvasContent` unchanged when it yields one;
- return `null` when the helper yields `undefined` (no source available).

This is the same three-way shape as `resolvePdfCanvasContent`, and reusing `resolveAttachmentBlobUrl` is deliberate: Office files inherit the blob LRU cache, the `403 → Forbidden` / other-failure → `LoadFailed` classification, and support for locally-picked `File`s, DIAL download URLs, `previewUrl`, and inline base64 — identically to PDFs, with no duplicated fetch logic.

**Adapter contract (library isolation).** This function keeps host knowledge out of `libs/attachment-canvas`. The fetch, the blob cache, and the HTTP status classification live in `libs/chat-hooks`, which is host-agnostic; the genuinely app-specific part — DIAL URL construction, CSRF/auth — is injected as the `resolvers` argument by `apps/chat/src/hooks/attachment/useAttachmentCanvasResolvers.ts`, which binds this function and exposes it to the canvas hook as `resolveOoxmlContent(attachment, format)`. What crosses into `libs/attachment-canvas` is a resolved `url` string and an `OoxmlFileType` — nothing more. No new backend endpoint is introduced; Office bytes are served by the existing DIAL file download route.

#### Scenario: dial attachment resolves to an object url

- **WHEN** `resolveOoxmlCanvasContent` is called with an uploaded DIAL `.docx` attachment
- **THEN** it returns `{ type: Ooxml, url: <object url>, format: Docx }`

#### Scenario: forbidden fetch is classified

- **WHEN** the underlying fetch returns HTTP 403
- **THEN** it returns an `ErrorCanvasContent` with `errorType: Forbidden`

#### Scenario: network failure is classified as load failed

- **WHEN** the underlying fetch throws a network error
- **THEN** it returns an `ErrorCanvasContent` with `errorType: LoadFailed`

#### Scenario: no source available returns null

- **WHEN** the attachment has no file, no DIAL URL, no `previewUrl`, and no inline data
- **THEN** it returns `null`

#### Scenario: the format argument is passed through unchanged

- **WHEN** `resolveOoxmlCanvasContent(attachment, resolvers, OoxmlFileType.Pptx)` resolves successfully
- **THEN** the returned payload's `format` is `OoxmlFileType.Pptx`

---

### Requirement: routing — Office attachments open the `Ooxml` content type

The canvas hook's internal `openFileCanvas` SHALL add **two** Office branches — in `libs/attachment-canvas/src/hooks/useOpenAttachmentCanvas/useOpenAttachmentCanvas.ts` — each placed immediately before the dispatch that consumes the same signal:

1. **MIME branch** — before the `switch (contentType)`: call `getOoxmlFileType('', contentType)`; when it yields a format, resolve and open the canvas.
2. **Extension branch** — before the `switch (ext)`: call `getOoxmlFileType(fileName)`; when it yields a format, resolve and open the canvas.

Each branch SHALL call the injected `resolvers.resolveOoxmlContent(attachment, format)`, then `openCanvas(content ?? createUnsupportedCanvasContent(resolvers.resolveContentUrl(attachment)), attachment.name, canvasAttachmentId)`, then return `true`.

Both branches SHALL return `true` even when resolution fails, because the attachment **was** recognized as a supported Office format. The unsupported panel — which still offers a download when a URL is available — is the correct outcome, and returning `false` would make the caller fall back to a bare browser download and lose the panel entirely.

**Placement rationale:** two branches rather than one consolidated earlier check. Each Office check runs immediately ahead of the switch keyed on the same signal, so the pairing is local and survives edits to either switch. A single earlier check would read as unrelated to both.

**State ownership:** no new state. Canvas content and visibility remain owned by `AttachmentCanvasContext` via `useAttachmentCanvas().openCanvas`; this hook only resolves and dispatches.

#### Scenario: correct docx mime type opens the canvas

- **WHEN** the user opens an attachment whose `contentType` is the canonical DOCX MIME type
- **THEN** `openCanvas` is called with `OoxmlCanvasContent { format: Docx }`

#### Scenario: xlsx extension with a generic mime type opens the canvas

- **WHEN** the user opens `budget.xlsx` whose `contentType` is `application/octet-stream`
- **THEN** `openCanvas` is called with `OoxmlCanvasContent { format: Xlsx }`

#### Scenario: pptx extension opens the canvas

- **WHEN** the user opens `deck.pptx`
- **THEN** `openCanvas` is called with `OoxmlCanvasContent { format: Pptx }`

#### Scenario: correct mime type with an extension-less name opens the canvas

- **WHEN** the attachment's `name` is `'Quarterly Report'` and its `contentType` is the canonical XLSX MIME type
- **THEN** `openCanvas` is called with `OoxmlCanvasContent { format: Xlsx }`, not `UnsupportedCanvasContent`

#### Scenario: unresolvable office file opens the unsupported panel

- **WHEN** an Office attachment is recognized but `resolveOoxmlCanvasContent` returns `null`
- **THEN** `openCanvas` is called with `UnsupportedCanvasContent` carrying the DIAL download URL
- **AND** `openFileCanvas` returns `true`

#### Scenario: forbidden office file opens the error panel

- **WHEN** an Office attachment's fetch returns HTTP 403
- **THEN** `openCanvas` is called with `ErrorCanvasContent { errorType: Forbidden }`

#### Scenario: pdf routing is unchanged

- **WHEN** the user opens a `application/pdf` attachment
- **THEN** `openCanvas` is called with `PdfCanvasContent`, and no Office branch is taken

#### Scenario: text routing is unchanged

- **WHEN** the user opens `notes.md`
- **THEN** `openCanvas` is called with `MarkdownCanvasContent`, and no Office branch is taken

#### Scenario: legacy binary office format still falls through

- **WHEN** the user opens `old.doc` with a generic `contentType`
- **THEN** no Office branch is taken and the existing fallback behavior applies

---

### Requirement: `@silurus/ooxml` dependency and documentation

`libs/attachment-canvas/package.json` SHALL declare `@silurus/ooxml` (`^0.80.2`) under `dependencies` — a runtime dependency of the library, not a peer, because the library imports it directly and hosts do not configure it.

`libs/attachment-canvas/README.md` SHALL document the new content type, the `OoxmlFileType` enum with its members, and the `getOoxmlFileType` / `isOoxmlPreviewable` utilities, with examples using the exact exported names and the required props of `OoxmlCanvasContent`.

`docs/architecture.md` SHALL update the `@epam/ai-dial-attachment-canvas` row to name the Office formats among the supported types.

`npm run validate:docs` SHALL pass — it checks that every name a lib README imports is actually exported.

#### Scenario: dependency is declared

- **WHEN** `libs/attachment-canvas/package.json` is read
- **THEN** `dependencies` contains `@silurus/ooxml`

#### Scenario: readme names match the public exports

- **WHEN** `npm run validate:docs` runs
- **THEN** it passes, confirming every name the README imports is exported from the package

#### Scenario: architecture doc lists the office formats

- **WHEN** the `@epam/ai-dial-attachment-canvas` row in `docs/architecture.md` is read
- **THEN** it names DOCX, XLSX, and PPTX among the supported attachment types


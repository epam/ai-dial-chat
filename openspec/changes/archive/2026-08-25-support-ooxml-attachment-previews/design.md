## Context

Attachment Canvas (`libs/attachment-canvas`) renders a `AttachmentCanvasContent` discriminated union, one branch per content type, inside a shared panel that supplies the header, download button, and error/unsupported states. Adding a preview format has an established shape in this library, most recently followed by the HTML and code viewers: add an enum member, add a model interface to the union, add a detection utility over MIME/extension, add a renderer component, wire a branch in `AttachmentCanvasBody`, and add an app-side resolver that turns a `DisplayAttachment` into the new payload.

DOCX, XLSX, and PPTX currently match no branch and land on the unsupported panel. What makes them different from every format already supported is that they are **opaque ZIP containers**, not text or a natively-renderable binary. The browser can display a PDF and an image without help; a DOCX has to be unzipped, its XML parsed, and its layout reconstructed. That work needs a third-party parser, and that parser is large.

Two constraints shape everything below:

- **Library isolation** (`AGENTS.md` §Library isolation). `libs/attachment-canvas` may not know DIAL file paths, auth, or fetch semantics. Whatever crosses into the library must already be resolved.
- **Bundle budget.** `apps/chat` lazy-loads routes and keeps the initial chunk small. A parser for three Office formats cannot sit in the initial chunk to serve a preview most sessions never open.

## Goals / Non-Goals

**Goals:**

- Render DOCX, XLSX, and PPTX inline in the existing canvas panel, with the same chrome, download affordance, and error surface as other formats.
- Keep the Office parsers out of the initial bundle — they load only when a user opens an Office file, and only the one format needed.
- Detect format reliably when either the MIME type or the file extension is trustworthy, without requiring both.
- Keep all DIAL/host knowledge at the application boundary.
- Handle the full lifecycle: loading, parse failure, render failure, unmount, and content switch — no leaked viewers, DOM, or blob URLs.

**Non-Goals:**

- **Editing.** Read-only preview. No writes back to DIAL.
- **Legacy binary Office formats** (`.doc`, `.xls`, `.ppt`). Different container entirely — a separate parser and a separate change.
- **Text extraction from Office documents** — no copy-to-clipboard, no in-document search, no citation/annotation anchoring. The viewer owns its DOM; we do not model its content.
- **Server-side conversion.** No `apps/chat-api` involvement.
- **Byte-identical fidelity with Microsoft Office.** Best-effort client-side rendering.
- **Upload validation changes.** Which types a deployment accepts is untouched; this is preview-only.

## Decisions

### Client-side parsing over server-side conversion

**Chosen:** parse in the browser.

A server-side route converting Office → PDF or HTML would give better fidelity and a single well-understood output format. It was rejected because it needs a converter runtime (LibreOffice or equivalent) in the API deployment, turns every preview into a CPU-heavy backend job with its own queueing, timeout, and cache-invalidation design, and requires the backend to read file bytes it otherwise only proxies. That is a disproportionate amount of new infrastructure for a preview, and it would put a new scaling surface in `apps/chat-api` where none exists today. Client-side parsing puts the cost on the one machine that already has the file open and asked to see it.

The trade-off accepted: parse time and memory land on the user's device, and very large workbooks will be slower than a server render would be.

### `@silurus/ooxml` over per-format libraries

**Chosen:** one dependency covering all three formats, with separate entry points per format.

The alternative was assembling best-in-class single-format libraries — `mammoth` or `docx-preview` for DOCX, SheetJS for XLSX, and something bespoke for PPTX. Rejected on two grounds: PPTX has no comparable well-maintained standalone renderer, so the presentation case would have stayed unsupported; and three libraries mean three different APIs, three lifecycle models, and three error channels to normalize behind one component.

`@silurus/ooxml` matters specifically because it publishes `@silurus/ooxml/docx`, `/xlsx`, and `/pptx` as **separate entry points**. A single-entry package covering three formats would force all three parsers into whichever chunk imported it, defeating the split below. The package's structure is what makes per-format lazy loading possible, and that is the deciding factor.

### Dynamic `import()` per format, resolved inside the effect

**Chosen:** `await import('@silurus/ooxml/docx')` inside a `switch` on the format, called from the load effect.

A static top-level import of all three viewers would put every parser in the chunk containing `libs/attachment-canvas`, which the conversation view imports eagerly — so every user pays for three Office parsers on first paint whether or not they ever open one. Lazy-loading the whole `OoxmlContent` component via `React.lazy` at the `AttachmentCanvasBody` branch would fix the initial-chunk problem but still bundle all three parsers together, so opening a DOCX would download the XLSX and PPTX parsers too.

Splitting at the format boundary means opening a DOCX downloads exactly the DOCX parser. The `createViewer` helper is a `switch` over `OoxmlFileType` with one `import()` per arm, which also gives the bundler three statically-analyzable specifiers — a computed specifier would defeat code splitting.

The switch is exhaustive over the enum with no `default`, so `noImplicitReturns` makes adding a future format a compile error at this site rather than a silent runtime `undefined`.

### An imperative viewer inside a React effect, with a structural interface

`@silurus/ooxml` viewers are imperative: construct against a container element, `load()` a source, `destroy()` when done. They mutate DOM React does not own. This is wrapped in a single `useEffect` keyed on `[content.format, content.url]` — the two inputs that require a fresh viewer — with an uncontrolled `<div ref>` as the container.

The three viewer classes are typed against a **locally declared structural interface**, not their imported types:

```ts
interface OoxmlViewer {
  load(source: string | ArrayBuffer): Promise<void>;
  destroy(): void;
}
```

`createViewer` returns this narrow shape so `OoxmlContent` has one lifecycle to drive rather than three. It also keeps the module's static type surface free of the parser packages, so no type-only import can accidentally become a runtime edge.

**Teardown is the delicate part**, and it has three distinct races:

- A `disposed` flag, set in the cleanup function, guards every `setState` after an `await` — the standard cancelled-flag rule in `AGENTS.md`.
- The dynamic `import()` and `createViewer` are themselves awaited, so the effect can be torn down *before a viewer object exists*. The local `nextViewer` is checked against `disposed` and destroyed immediately if the effect is already dead, before being assigned to the outer `viewer`. Without this, a fast content switch strands a live viewer with no reference to destroy it.
- Cleanup calls `viewer?.destroy()` **and** `container.replaceChildren()`. `destroy()` is the library's contract, but the container is ours, and a parser that fails mid-render can leave partial DOM behind. Clearing it ourselves means the next viewer always starts against an empty element.

### Two error channels, one error state

Failures arrive two ways: the viewer's `onError` callback (a parse or render problem it detected and reported) and a thrown exception (a failed dynamic import, a rejected `load()`). Both resolve to the same `hasError` state and the same panel.

They differ in cleanup. `onError` fires with the viewer alive and possibly showing partial content, so the handler only flips state. The `catch` path destroys the viewer, clears the container, and drops the reference, because the viewer's state after a throw is unknown. Both check `disposed` first.

### Format detection: MIME first, then extension

`getOoxmlFileType(name, mimeType)` tries MIME, then falls back to extension. Neither signal alone is sufficient: DIAL attachments can carry a generic `application/octet-stream` for a correctly-named `report.docx`, and a correct `contentType` can arrive with a name that is a citation title carrying no extension. Checking both, in this order, means either signal is enough.

MIME normalization strips parameters and lowercases (`application/…sheet; charset=utf-8` → `application/…sheet`) since `contentType` values are not canonically formatted upstream.

This produces **two routing branches** in `useOpenAttachmentCanvas`, not one, and their placement is deliberate: the MIME check sits before the `contentType` switch and the extension check before the extension switch. Each Office check therefore runs immediately ahead of the dispatch that uses the same signal. Collapsing them into one earlier check would work today but would read as unrelated to either switch, and would drift the moment either switch changes.

Both branches consume `resolveOoxmlCanvasContent`'s `null` as "no source available" and fall back to `createUnsupportedCanvasContent(resolveDialUrl(attachment))`, so an Office file we recognize but cannot fetch still offers a download rather than silently failing to open.

### The library boundary: a URL and a format enum

`OoxmlCanvasContent` carries `url: string` and `format: OoxmlFileType`. That is the whole contract.

`apps/chat/src/utils/attachment-canvas.ts` owns everything else: `resolveOoxmlCanvasContent` delegates to the existing `resolveAttachmentBlobUrl`, inheriting the blob LRU cache, the `403 → Forbidden` / other-failure → `LoadFailed` classification, and support for locally-picked `File`s, DIAL download URLs, `previewUrl`, and inline base64 — for free, and identically to how PDFs already behave. The library never learns a DIAL path or that a fetch happened.

The format enum, not a raw MIME string, is what crosses the boundary. The library switches on a closed set it owns rather than re-parsing a host-supplied string, so adding a format is a compile-time change on both sides.

### Object-URL revocation

Because the resolver can hand over a blob URL, `Ooxml` joins `Image`, `Audio`, and `Pdf` in the canvas context's revocation set. Office files are the largest attachments here — a leaked workbook blob costs far more than a leaked icon — so this is a memory correctness requirement, not a tidiness one.

### No new i18n keys

The renderer's only user-visible string is its failure message, and it takes the canvas's existing `loadErrorLabel` — already translated, already threaded through `AttachmentCanvasContainer`. Introducing an Office-specific variant would add translation work for a message a user cannot distinguish from the PDF or image load failure. Per `AGENTS.md`, the library takes the string as a required prop and never calls `t()` itself.

### Styling

`OoxmlContent.module.scss` sets only the viewer surface and overlay backgrounds and the error icon color, reading the canvas's existing `--ac-status-text` / `--ac-error-icon` variables so Office previews theme with the rest of the panel. Layout stays in Tailwind. Direction is inherited: the overlay uses `inset-0` and centered flex, both direction-agnostic, so there is no RTL-specific work in this component — the document's own text direction is the viewer's concern.

## Risks / Trade-offs

**Rendering fidelity will not match Microsoft Office** → Accepted, and it is the core trade-off of client-side parsing. Complex layouts, embedded objects, and uncommon fonts may render imperfectly. The download button is always present, so the authoritative file is one click away. The panel is a preview, not a substitute for the editor.

**Parse cost lands on the client for large files** → A large workbook or deck can be slow to parse and memory-hungry, on low-end hardware especially. Mitigated by the spinner (`aria-busy` while loading, so the wait is announced, not just visible) and by the fact that a user opts in per file. Not mitigated: there is no size gate. The HTML viewer has a 1 MiB `srcdoc` ceiling because oversized `srcdoc` is silently *truncated* by browsers — a correctness bug. A large DOCX is merely slow, so the same gate would trade a working slow preview for a guaranteed unsupported panel. If field reports show pathological cases, a gate falling through to `UnsupportedCanvasContent` is the additive follow-up.

**A third-party parser now handles untrusted file bytes** → `@silurus/ooxml` parses user-supplied ZIP/XML in the main-thread context of the app. A malformed or hostile document could crash the parser or exercise a parser bug. Contained by: the `catch`/`onError` paths degrade to the error panel instead of taking down the canvas, and the parser is not given app credentials or context. It is not sandboxed the way the HTML viewer's iframe is, which is the residual risk — an iframe was rejected here because the viewers need direct DOM access to the container they render into.

**A new runtime dependency on a small package** → `@silurus/ooxml` is not a widely-adopted library with the ecosystem weight of SheetJS. Supply-chain and abandonment risk is real. It is confined to `libs/attachment-canvas` and reached only through `createViewer` behind the `OoxmlViewer` structural interface, so a swap means rewriting one function, not the component, the model, or the routing. Version is pinned by caret to `^0.80.2` in the library's `dependencies`.

**Bundle growth even with splitting** → Three parsers ship in the deployed asset set even if most users download none. Mitigated by per-format `import()`: the initial chunk is unaffected, and worst case a user downloads one parser. The regression to guard against is someone converting a dynamic `import()` here to a static one, which would silently move all three into the eager chunk with no test failure.

**Accessibility of an opaque rendered document** → The container carries `role="document"` and `aria-label={fileName}`, and the status overlay uses `aria-live="polite"` with `role="alert"` on failure, so load and error transitions are announced. But the DOM inside is the parser's, and its heading structure, reading order, and table semantics are outside our control — a spreadsheet rendered to a canvas or an unlabeled grid is not navigable the way our own markup would be. Per the scope boundary in `.claude/rules/a11y.md`, vendor-rendered output is noted rather than patched. The download path remains the accessible fallback, and this is the weakest part of the change.

**Silent format-detection gaps** → An Office file arriving with both a generic MIME type and an extension-less name matches nothing and reaches the unsupported panel. This is a strictly better outcome than today for every file where either signal is present, and the unsupported panel still offers download, so the failure mode is a missing preview rather than a broken one.

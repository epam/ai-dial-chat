## Context

Issue [#8837](https://github.com/epam/ai-dial-chat/issues/8837): in
Catalog → Skill details → Details, picking a PDF supporting file shows
"Failed to load file" instead of the document.

The read path, traced end to end:

```
CatalogView (renderContentFilePreview)
  → SkillDetailsFilePreview            apps/chat/src/components/CatalogView/
      · useSkillFilePreview({fileId, onLoadFile})      libs/chat-hooks/src/skill/
      · onLoadFile = onLoadSkillDetailsFile            libs/chat-hooks/src/catalog/useSkillItemDetails.ts
          → resolveSkillFileDownloadPath(fileId, skillPath)
          → api.downloadSkillFile(bucket, path, filePath)       → Response
          → readSkillFileBytes(response)                        → Uint8Array | null
      · skillFileToAttachment(node, {bytes, mimeType})  → Attachment { file: File }
      · useOpenAttachmentCanvas → resolvePdfCanvasContent
          → resolveAttachmentBlobUrl → URL.createObjectURL(file)
          → { type: Pdf, url: blob: }
  → SkillFilePreview                    apps/chat/src/components/SkillFilePreview/
      → AttachmentCanvasBody            libs/attachment-canvas/
          → lazy PdfContent → DocumentPreview (@epam/ai-dial-react-pdf-highlighter)
```

### Confirmed findings

**F1 — the download is rejected on size, and its error label is the reported
string.** `readSkillFileBytes`
(`libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts:378`) returns `null`
when the declared `content-length` or the actual byte length exceeds
`SKILL_MANIFEST_MAX_BYTES` = `256 * 1024`
(`libs/chat-hooks/src/skill/skill-types.ts:23`). `onLoadSkillDetailsFile`
(`useSkillItemDetails.ts:207`) then throws
`'File exceeds the preview size limit'`; that has no `status`, so
`useSkillFilePreview` classifies it `SkillPreviewErrorKind.Generic`;
`SkillDetailsFilePreview` opens `createLoadErrorCanvasContent()`; and
`AttachmentCanvasBody` renders `loadErrorLabel`, which resolves to
`"Failed to load file"` (`apps/chat/src/i18n/locales/en.json:953`) — verbatim
the string in the issue's screenshot. The cap is manifest-sized; almost every
real PDF exceeds it, which is why the issue reproduces both with one
attachment and with several, and why the failure is immediate rather than
dependent on rendering.

This is also currently *specified* behaviour — `openspec/specs/skill-details-panel/spec.md`
carries the scenario "The manifest's own size guard still applies to every
other file" — so the fix needs a spec delta, not just a code edit.

**F2 — the skill preview never configures the PDF worker.**
`SkillFilePreview.tsx` renders `AttachmentCanvasBody` with no
`configurePdfWorker`, whereas `apps/chat/src/app/app.tsx:576` passes the
app-owned initializer from `apps/chat/src/utils/pdf.ts`. Consequences, read
from the code:

- `PdfContent` initialises `preparationState` to `Ready` when the prop is
  absent (`PdfContent.tsx:207`), so `DocumentPreview` mounts with no gate.
- `@epam/pdf-highlighter-kit`'s `core/pdf-engine.js:3-6` assigns
  `GlobalWorkerOptions.workerSrc =
  'https://unpkg.com/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs'` at
  **module-evaluation time**, guarded by `if (!workerSrc)`. `PdfContent`
  imports the vendor statically, so that assignment happens as soon as the
  lazy `PdfContent` chunk loads — before any effect. The app's initializer
  assigns unconditionally, so when it *is* passed it wins; when it is not, the
  CDN URL stands.
- Therefore skill PDF rendering depends on outbound `unpkg.com` access, or on
  the page-level chat canvas having already run the initializer in the same
  session. Both Catalog details and Skill Builder are affected — they share
  `SkillFilePreview`.

**F3 — existing tests cannot catch either defect.**
`apps/chat/src/components/CatalogView/tests/SkillDetailsFilePreview.spec.tsx:25`
mocks `../../SkillFilePreview/SkillFilePreview` away, so no test in the repo
renders the real `AttachmentCanvasBody` from a skill surface, and no test
feeds the preview loader a body over 256 KB.

### Hypotheses not confirmed

- Whether F2 alone would show "Failed to load file" in the reporter's
  environment is **unverified**: a failing CDN worker surfaces through the
  vendor viewer, not through `createLoadErrorCanvasContent`, and the
  precise rendering is pending browser verification (see Open Questions).
  F1 fully accounts for the reported screenshot on its own.
- MIME misclassification, blob-URL lifetime, and `resolveSkillFileDownloadPath`
  were each traced and found sound: Core's `application/octet-stream` is
  deliberately dropped so `inferMimeTypeFromPath` runs
  (`useSkillItemDetails.ts:214-218`), `resolveAttachmentBlobUrl` takes the
  `'file' in attachment` branch and creates the blob URL synchronously
  (`attachment-canvas.ts:295`), and the provider is keyed by `fileId` so each
  selection owns its canvas. None of these are changed here.

## Goals / Non-Goals

**Goals:**

- A valid PDF supporting file of realistic size renders in skill details on a
  freshly loaded page, with no prior PDF open anywhere in the app.
- The same guarantee for Skill Builder, which shares the component.
- Regression coverage that fails on either defect, reaching the real
  application-to-viewer boundary rather than a mocked `SkillFilePreview`.
- Loading, forbidden (403), and genuine load-failure states stay distinct.

**Non-Goals:**

- Any change to `libs/attachment-canvas`' public API, the viewer, or the
  vendor PDF packages.
- Any change to `apps/chat/src/utils/pdf.ts` itself, or to how the worker
  asset is bundled.
- Streaming or chunked PDF delivery, a preview-size UX (progress, "too large"
  affordance), server-side rendering, or thumbnail generation.
- The textual Content-tab read path (`onLoadContentFile` / `readSkillManifest`)
  and the `SKILL.md` size guard.

## Decisions

### D1 — Remove the byte cap from the preview read path only, via a separate reader

`onLoadSkillDetailsFile` will read the response through a new size-unbounded
reader rather than `readSkillFileBytes`. `readSkillFileBytes` and
`readSkillManifest` keep their current capped behaviour and signatures, so
`SKILL.md` parsing and `onLoadContentFile` are untouched.

Shape: a new exported
`readSkillFilePreviewBytes(response): Promise<Uint8Array>` in
`libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts`, next to the
existing readers, that returns `new Uint8Array(await response.arrayBuffer())`
and never returns `null`. `onLoadSkillDetailsFile` consequently loses its
`'File exceeds the preview size limit'` throw; every other failure mode it
raises (non-OK status with `status` attached, unparseable id, no open skill)
is unchanged, which is what keeps forbidden/load-error/loading distinguishable.

*Alternatives considered.* (a) Add an optional `maxBytes` parameter to
`readSkillFileBytes` with `Number.POSITIVE_INFINITY` passed from the preview
path — rejected: a nullable return that can never be null at one call site
forces a dead `if (bytes == null)` branch and an unbounded sentinel reads as
an accident. (b) Raise `SKILL_MANIFEST_MAX_BYTES` to a large preview-sized
value — rejected: it weakens the manifest parse guard, which exists so an
oversized `SKILL.md` is never decoded into a string. (c) Introduce a second
constant `SKILL_FILE_PREVIEW_MAX_BYTES` — rejected per the decision recorded
for this change: previews are read in full and the only remaining size guard
is the manifest's.

### D2 — `SkillFilePreview` imports the app's initializer directly

`SkillFilePreview` will `import { configurePdfWorker } from '../../utils/pdf'`
and pass it to `AttachmentCanvasBody`, rather than accepting it as a prop.

Rationale: `SkillFilePreview` already lives in `apps/chat` and already imports
app-owned modules (`useTheme`, `AttachmentCanvasI18nKeys`), so the host/lib
boundary is not crossed — the runtime configuration stays in the app, exactly
where AGENTS.md's library-isolation rule puts it, and `libs/attachment-canvas`
continues to receive it only as an injected callback. Threading a prop instead
would force both call sites (`SkillDetailsFilePreview` and
`pages/SkillEditor/SkillEditor.tsx:338`) to import and forward the same app
module, with no added flexibility.

Idempotence and laziness are preserved without new machinery:
`configurePdfWorker` memoises its own promise (`utils/pdf.ts:10`) and
`PdfContent` memoises `preparationPromise` at module scope
(`PdfContent.tsx:71`), so the initializer runs at most once per successful
resolution across every canvas in the app. Both `pdfjs-dist` imports inside it
stay dynamic, so nothing is pulled into the eager bundle. Because
`configurePdfWorker` is a module-level `const`, its identity is stable and
`PdfContent`'s preparation effect does not re-run on re-render.

`PdfContent` already gates `DocumentPreview` on the preparation promise
resolving (`PdfContent.tsx:220-235`), so passing the prop is sufficient to get
"await initialization before document rendering" — no change in the lib.

*Alternative considered.* Configure the worker once at app startup instead of
per PDF open — rejected: it defeats the deliberate laziness that keeps
`pdfjs-dist` out of the initial bundle.

### D3 — Regression coverage at three levels, with an honest jsdom boundary

1. **Hook/reader level** (`libs/chat-hooks`): a `downloadSkillFile` response
   whose body and `content-length` both exceed `SKILL_MANIFEST_MAX_BYTES`
   resolves `onLoadSkillDetailsFile` with the full bytes instead of throwing;
   `readSkillManifest`'s own cap still rejects an oversized `SKILL.md`.
2. **Integration level** (`apps/chat`): render `SkillDetailsFilePreview`
   **without** mocking `SkillFilePreview`, with a valid minimal PDF fixture
   padded past 256 KB. Assert the canvas resolves to
   `AttachmentContentType.Pdf` with a `blob:` URL (not the load-error state)
   and that the `configurePdfWorker` reaching `PdfContent` is the app's
   initializer and is awaited before the viewer mounts. Only
   `@epam/ai-dial-react-pdf-highlighter`'s `DocumentPreview` is stubbed — it
   needs a real worker and a canvas, neither of which jsdom provides.
3. **Unit level** (`apps/chat`): `SkillFilePreview` forwards
   `configurePdfWorker` to `AttachmentCanvasBody`. This is the single
   assertion that fails today and would fail again if the wiring were dropped.

The fixture is a real, parseable minimal PDF (`%PDF-1.4` header, one page
object, `xref`, `%%EOF`) padded with a comment/stream block to cross the old
cap, so the size path is genuinely exercised and the bytes are valid input for
a real parser. What jsdom **cannot** establish is that pdf.js rasterises the
document; that remains a browser-verification item, and the plan says so
rather than implying the unit suite proves rendering.

### D4 — Cross-cutting behaviour that must not regress

Nothing in this change touches these, and the specs restate them so the
implementation is held to them: the `AttachmentCanvasProvider key={fileId}`
isolation, the `cancelled`-flag race protection in `useSkillFilePreview`, the
`isCurrent = attachmentId === path` staleness gate in `SkillFilePreview`, blob
URL cleanup, the 403 → forbidden classification, and the inline preview's
`role="group"` + accessible name. No new user-visible string is introduced, so
there are no new i18n keys; RTL impact is none (no new layout or directional
icon); the surface is not feature-flag gated; no endpoint, DTO, generated
client method, cache, rate limit, or telemetry event changes.

## Risks / Trade-offs

- **[Unbounded read of a large supporting file can exhaust tab memory]** → The
  read is user-initiated, one file at a time, and the previous selection's
  content is discarded on change with its blob URL revoked. DIAL Core caps the
  skill package itself, so the practical ceiling is the package limit rather
  than "any size". Accepted deliberately per the recorded decision; if a
  ceiling is wanted later it should come with a distinct "too large to preview"
  state rather than the generic load error.
- **[Removing the cap widens what the preview will attempt to render]** → Type
  handling is unchanged: a non-previewable type still resolves to the shared
  unsupported state via `getAttachmentTypeFromMime` /
  `inferMimeTypeFromPath`, now merely for larger files too.
- **[F2's fix could be a no-op if the reporter's environment can reach unpkg]**
  → The change is still correct (a deployment must not depend on an external
  CDN), but it means F1 must be treated as the primary fix and the browser
  verification must confirm the issue is actually gone, not just that the
  worker is now local.
- **[The vendor could reassert its own `workerSrc` in a future version]** →
  The app's assignment is unconditional and runs after the vendor module
  evaluates, so today's order is safe; a vendor bump should re-check
  `core/pdf-engine.js` and `utils/worker-loader-simple.js`.
- **[Integration test grows brittle if it over-asserts vendor internals]** →
  Assert only the injected `configurePdfWorker` and the resolved canvas
  content type/URL scheme, never `DocumentPreview`'s internal props.

## Migration Plan

No data migration, no config change, no deployment ordering constraint. The
change is a pure frontend fix shipped in one commit; rollback is a revert,
which restores the 256 KB cap and the CDN worker fallback. The two spec deltas
(`skill-details-panel`, `skill-file-preview`) land in the same change and are
folded into `openspec/specs/` at archive time.

## Open Questions

Pending browser verification (none blocks implementation; all are
confirmation steps recorded in tasks):

1. What the reporter's environment actually shows for F2 in isolation — a
   blank viewer, a vendor error, or a console-only failure — and whether
   `unpkg.com` is reachable there at all.
2. Whether any real skill PDF is small enough (<256 KB) to have worked before
   this change; if one exists, it is the cleanest way to observe F2 by itself.
3. Whether the padded-fixture size used in tests should track
   `SKILL_MANIFEST_MAX_BYTES` by reference (preferred) or a literal, once the
   constant is no longer applied on that path.

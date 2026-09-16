## Why

Selecting a PDF supporting file in Catalog → Skill details → Details renders
"Failed to load file" instead of the document
([#8837](https://github.com/epam/ai-dial-chat/issues/8837)). Two independent
code-level defects sit on that path, and both must be fixed for a PDF to
render on a freshly loaded page:

1. **The preview download rejects the file before it is ever decoded.**
   `onLoadSkillDetailsFile` reads every supporting file through
   `readSkillFileBytes`, which returns `null` for any body over
   `SKILL_MANIFEST_MAX_BYTES` (256 KB — a cap sized for `SKILL.md` frontmatter,
   not for binaries). The loader then throws, `useSkillFilePreview` classifies
   the failure as `Generic`, and the canvas renders
   `createLoadErrorCanvasContent()` — whose label is literally
   `"Failed to load file"`, the exact string in the issue's screenshot.
   Virtually every real PDF exceeds 256 KB, which is why the issue reproduces
   with a single attachment and with several.

2. **The PDF viewer is mounted without the app's worker.** `SkillFilePreview`
   renders `AttachmentCanvasBody` without `configurePdfWorker`, while the
   page-level canvas in `apps/chat/src/app/app.tsx` passes the app's
   initializer. With the prop omitted, `PdfContent` skips its preparation gate
   and `@epam/pdf-highlighter-kit` falls back to its CDN worker
   (`https://unpkg.com/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs`,
   `cdnFallback: true`), so skill PDF rendering silently depends on either
   outbound CDN access or on another PDF having already initialized
   `GlobalWorkerOptions.workerSrc` in the same page session. This affects
   Skill Builder's preview identically, since both surfaces share
   `SkillFilePreview`.

Defect 1 fully explains the reported symptom; defect 2 is a confirmed code
difference whose user-visible effect in a CDN-reachable dev environment is
still pending browser verification, but which would block the issue's
"renders after a fresh reload, without opening another PDF first" acceptance
criterion regardless.

## What Changes

- Remove the manifest-sized byte cap from the skill-details **preview**
  download path. A picked supporting file's bytes are read in full; the
  256 KB guard remains on `SKILL.md` and on the textual Content-tab read
  (`readSkillManifest` / `onLoadContentFile`), which are unchanged.
- **BREAKING** (spec-level, not API-level): the `skill-details-panel`
  requirement that a supporting file over `SKILL_MANIFEST_MAX_BYTES` resolves
  to the canvas load-error state is withdrawn. Oversized previews now load.
- Pass the app-owned `configurePdfWorker` initializer from
  `apps/chat/src/utils/pdf.ts` through `SkillFilePreview` to
  `AttachmentCanvasBody`, so both Catalog skill details and Skill Builder
  configure `pdfjs-dist`'s worker before the viewer mounts, exactly as the
  page-level canvas already does. The initializer stays in the app; no lib
  gains runtime configuration knowledge.
- Add regression coverage at the application-to-viewer boundary that the
  current tests cannot provide: the existing
  `SkillDetailsFilePreview.spec.tsx` mocks `SkillFilePreview` away, so no test
  exercises the real renderer. New coverage asserts (a) a PDF larger than
  256 KB resolves to PDF canvas content rather than the load-error state, and
  (b) `SkillFilePreview` forwards a `configurePdfWorker` that is awaited
  before `DocumentPreview` mounts, using a valid minimal PDF fixture where
  parsing is actually exercised.

Out of scope: the attachment-canvas viewer itself, the PDF worker
initializer's implementation, any dependency bump, and any UI change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-details-panel`: the supporting-file preview download no longer
  applies `SKILL_MANIFEST_MAX_BYTES`; the oversized-file load-error scenario
  is replaced. The preview renderer must supply the host's PDF worker
  initializer.
- `skill-file-preview`: Skill Builder's shared `SkillFilePreview` must supply
  the host's PDF worker initializer, so a PDF renders on first open without
  depending on the page-level canvas having run first.

## Impact

Code:

- `libs/chat-hooks/src/catalog/useSkillItemDetails.ts` —
  `onLoadSkillDetailsFile` stops applying the manifest size guard.
- `libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts` — a size-unbounded
  read path for preview bytes alongside the existing capped
  `readSkillFileBytes`/`readSkillManifest`.
- `apps/chat/src/components/SkillFilePreview/SkillFilePreview.tsx` — forwards
  `configurePdfWorker`.
- Tests: `apps/chat/src/components/CatalogView/tests/SkillDetailsFilePreview.spec.tsx`,
  `apps/chat/src/components/SkillFilePreview/tests/`,
  `libs/chat-hooks/src/catalog/tests/`.
- Docs: `libs/chat-hooks/README.md` if an exported name changes;
  `openspec/specs/` deltas via the normal archive flow.

No change to endpoints, DTOs, the generated client, dependencies, or the
`@epam/ai-dial-attachment-canvas` public API. Memory characteristics change:
a large supporting file is now read into a `Uint8Array` and a blob URL, which
is why the removed cap is a deliberate, recorded trade-off rather than an
oversight.

## Verification

Confirmed in the browser after the fix: Catalog → skill `snyk-jira-ingest`
(3 files) → Details → the `VOUCHER_N1473533LZECML.pdf` supporting file renders
its document in the inline preview instead of "Failed to load file". This is
the reported symptom (issue #8837) gone, and it exercises F1 — the file is a
real PDF over the former 256 KB preview cap.

The PDF worker source was confirmed in DevTools on the same open:
`http://localhost:4207/@fs/.../node_modules/pdfjs-dist/build/pdf.worker.min.mjs`
— the app's own asset (served by Vite from the local install), not
`https://unpkg.com/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs`. F2's fix
therefore takes effect: the viewer no longer depends on outbound CDN access
or on a chat PDF having initialized `GlobalWorkerOptions.workerSrc` first.

### Open Questions 1 and 2 — recorded outcome

Neither was observed in isolation, and the change shipped without them:

1. What F2 alone looks like in the reporter's environment was never seen
   separately, because F1 (the 256 KB cap) rejected every real PDF before the
   viewer was reached. After both fixes the preview renders and the worker
   resolves locally, so there is no remaining path on which to observe F2 by
   itself. It stays a code-level finding, confirmed by the worker URL above
   rather than by a distinct user-visible failure mode.
2. No skill PDF under `SKILL_MANIFEST_MAX_BYTES` was found, so the "cleanest
   way to observe F2 by itself" did not materialise.

Consequently the design's "confirmed vs hypothesised" split stands as written:
F1 is the confirmed cause of the reported screenshot; F2 is a confirmed code
difference whose isolated user-visible effect was never reproduced.

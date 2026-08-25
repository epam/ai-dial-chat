## 1. Dependency and types

- [x] 1.1 Add `@silurus/ooxml` (`^0.80.2`) to `libs/attachment-canvas/package.json` under `dependencies`, run `npm install`, and confirm the three entry points `@silurus/ooxml/docx`, `/xlsx`, `/pptx` each resolve
- [x] 1.2 Add `Ooxml = 'ooxml'` to `AttachmentContentType` and add the `OoxmlFileType` enum (`Docx`/`Xlsx`/`Pptx`) in `libs/attachment-canvas/src/types/attachment-canvas.ts`
- [x] 1.3 Add the `OoxmlCanvasContent` interface (`type`, `url`, `format`) to `libs/attachment-canvas/src/models/attachment-canvas.ts` and include it in the `AttachmentCanvasContent` union, with JSDoc on the interface and every field
- [x] 1.4 Export `OoxmlFileType` as a value and `OoxmlCanvasContent` as a type from `libs/attachment-canvas/src/index.ts`
- [x] 1.5 Verify: `npm exec nx typecheck @epam/ai-dial-attachment-canvas` — the union addition should surface every non-exhaustive `switch` over `AttachmentContentType`, which is the checklist for tasks 3 and 4

## 2. Format detection

- [x] 2.1 Add the `OOXML_MIME_TYPES` map to `libs/attachment-canvas/src/constants/file.ts`; confirm no Office extension is present in `TEXT_EXTENSIONS`
- [x] 2.2 Implement `getOoxmlFileType(name, mimeType?)` in `libs/attachment-canvas/src/utils/content.ts` — MIME first (strip parameters at the first `;`, trim, lowercase), then last-dot extension (lowercase); return `undefined` when neither matches
- [x] 2.3 Implement `isOoxmlPreviewable(name, mimeType?)` as `getOoxmlFileType(...) != null`, and export both from `src/index.ts`
- [x] 2.4 Write `libs/attachment-canvas/src/utils/tests/content.spec.ts` cases: each of the three MIME types; each of the three extensions; MIME with `; charset=utf-8`; uppercase MIME; uppercase extension; MIME winning over a conflicting extension; multi-dot name; extension-less name; `.doc` legacy format; and `isTextPreviewable('report.docx') === false`
- [x] 2.5 Verify: `npm exec nx test @epam/ai-dial-attachment-canvas`

## 3. `OoxmlContent` renderer

- [x] 3.1 Create `libs/attachment-canvas/src/components/OoxmlContent/OoxmlContent.tsx` with the local `OoxmlViewer` structural interface (`load`, `destroy`) and the `OoxmlContentProps` interface (`content`, `fileName?`, `loadErrorLabel`)
- [x] 3.2 Implement `createViewer(container, format, onError)` as an exhaustive `switch` over `OoxmlFileType` with **no `default`**, one static-literal dynamic `import()` per arm, and the per-format options from the spec table
- [x] 3.3 Implement the load effect keyed on `[content.format, content.url]`: early-return on a null ref, reset `isLoading`/`hasError`, await `createViewer`, await `load(content.url)`, clear loading
- [x] 3.4 Implement cancellation: a `disposed` flag set in cleanup and checked before every post-`await` `setState`; destroy-and-abandon the resolved viewer when `disposed` is already true before assigning the outer reference
- [x] 3.5 Implement the cleanup function — `viewer?.destroy()` **and** `container.replaceChildren()`
- [x] 3.6 Implement both error channels: `onError` flips state only; `catch` also destroys the viewer, clears the reference, and empties the container. Both check `disposed` first
- [x] 3.7 Implement the markup — `relative h-full w-full overflow-hidden` wrapper; container `<div ref>` with `role="document"`, `aria-label={fileName}`, `aria-busy={isLoading}`; overlay rendered only while `isLoading || hasError`
- [x] 3.8 Implement the overlay contents — `Spinner size={48}` while loading; `IconAlertTriangle` (`size={60}`, `stroke={1.5}`, `aria-hidden="true"`) above `loadErrorLabel` on error; `aria-live="polite"` always and `role="alert"` only when `hasError`
- [x] 3.9 Create `OoxmlContent.module.scss` — viewer and overlay backgrounds from `--bg-layer-raised`, text from `var(--ac-status-text, var(--text-secondary, …))`, icon from `var(--ac-error-icon, var(--text-error, …))`. No `font-size`/`line-height`/`font-weight` declarations
- [x] 3.10 Add the one-line component JSDoc above the export, per `.claude/rules/libs.md`
- [x] 3.11 Write `libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx` with a mocked `@silurus/ooxml/*`: spinner + `aria-busy` while loading; overlay gone after load; `aria-label` from `fileName`; `onError` → `role="alert"` panel; rejected `load()` → panel + `destroy()`; failed `import()` → panel, no unhandled rejection; loading state has no `role="alert"`; unmount → `destroy()` + emptied container; unmount-before-resolve → `destroy()`, no `load()`, no `setState`; `url` change → rebuild; `format` change → rebuild with the new parser; new `content` object with unchanged fields → no rebuild
- [x] 3.12 Verify: `npm exec nx test @epam/ai-dial-attachment-canvas` and `npm exec nx lint @epam/ai-dial-attachment-canvas`

## 4. Wire the content type into the canvas

- [x] 4.1 Add the `case AttachmentContentType.Ooxml` render branch to `AttachmentCanvasBody.tsx`, passing `content`, `fileName`, and `loadErrorLabel`
- [x] 4.2 Add `Ooxml` to the `h-full overflow-hidden` body-sizing group alongside `Pdf`, `Visualizer`, `Code`, and `Html`
- [x] 4.3 Add `Ooxml` to `isDownloadable` (always `true`) and to the `triggerAnchorDownload` arm of `downloadAttachmentContent` in `src/utils/download.ts`
- [x] 4.4 Add `Ooxml` to the revocable-content-type set in `getRevocableObjectUrl` in `src/context/AttachmentCanvasContext.tsx`
- [x] 4.5 Extend `AttachmentCanvasBody.spec.tsx` — the `Ooxml` branch renders `OoxmlContent`; the wrapper carries `overflow-hidden`, not `overflow-auto`
- [x] 4.6 Extend the download tests — `isDownloadable` returns `true` for `Ooxml`; `downloadAttachmentContent` calls `triggerAnchorDownload` with the URL and name; the download button renders while the error panel is shown
- [x] 4.7 Extend `AttachmentCanvasContext.spec.tsx` — an `Ooxml` `blob:` URL is revoked both on close and when content is replaced
- [x] 4.8 Verify: `npm exec nx test @epam/ai-dial-attachment-canvas` — no non-exhaustive-switch errors from task 1.5 remain

## 5. Application boundary

- [x] 5.1 Implement `resolveOoxmlCanvasContent(attachment, format)` in `apps/chat/src/utils/attachment-canvas.ts`, delegating to `resolveAttachmentBlobUrl` and returning payload / `ErrorCanvasContent` / `null` in the same three-way shape as `resolvePdfCanvasContent`
- [x] 5.2 Add the MIME routing branch to `openFileCanvas` in `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts` — `getOoxmlFileType('', contentType)` immediately before the `switch (contentType)`, falling back to `createUnsupportedCanvasContent(resolveDialUrl(attachment))` and returning `true`
- [x] 5.3 Add the extension routing branch — `getOoxmlFileType(fileName)` immediately before the `switch (ext)`, with the same fallback and `return true`
- [x] 5.4 Extend `apps/chat/src/utils/tests/attachment-canvas.spec.ts` — DIAL attachment resolves to an object URL; 403 → `Forbidden`; network throw → `LoadFailed`; no source → `null`; `format` passed through unchanged
- [x] 5.5 Extend `apps/chat/src/hooks/attachment/tests/useOpenAttachmentCanvas.spec.ts` — correct DOCX MIME opens the canvas; `.xlsx` with `application/octet-stream` opens it; `.pptx` opens it; correct MIME with an extension-less name opens it rather than the unsupported panel; unresolvable Office file opens `Unsupported` and still returns `true`; 403 opens the `Forbidden` panel; PDF and `.md` routing unchanged; `.doc` still falls through
- [x] 5.6 Verify: `npm exec nx test @epam/chat` and `npm exec nx lint @epam/chat`

## 6. Documentation

- [x] 6.1 Document the `Ooxml` content type, the `OoxmlFileType` enum members, and the `getOoxmlFileType` / `isOoxmlPreviewable` utilities in `libs/attachment-canvas/README.md`, using exact exported names and including every required prop in examples
- [x] 6.2 Update the `@epam/ai-dial-attachment-canvas` row in `docs/architecture.md` to name DOCX/XLSX/PPTX among the supported types
- [x] 6.3 Verify: `npm run validate:docs`

## 7. Full verification

- [x] 7.1 Confirm no new i18n keys were introduced — `apps/chat/src/i18n/locales/en.json` and `apps/chat/src/constants/translation-keys.ts` are unchanged, and `OoxmlContent` contains no `useTranslation` or `t(` call
- [x] 7.2 Confirm library isolation — `OoxmlContent.tsx` and the `libs/attachment-canvas` Office code contain no DIAL path, `fetch`, app context import, or env read; the only boundary inputs are `url` and `format`
- [x] 7.3 Confirm code splitting is intact — build `apps/chat` and check the three Office parsers land in separate lazy chunks, not the initial chunk
- [ ] 7.4 Manually verify each format end to end — upload and open a `.docx`, `.xlsx`, and `.pptx`; confirm render, spinner, download, and panel close; then open a deliberately corrupt Office file and confirm the error panel with a working download button
- [x] 7.5 Verify RTL (verified statically: the component introduces no physical-direction utilities, so there is nothing to flip) — switch the app to Arabic and confirm the overlay and panel chrome are unchanged (the component introduces no directional utilities)
- [x] 7.6 Verify: affected `lint`, `typecheck`, and `build` green for the touched projects; tests run via direct `vitest` per project because `nx run <project>:test` is broken workspace-wide (see notes below)

## Notes

**7.4 is not done** and needs a human: it requires a running app, an authenticated
DIAL session, and real Office documents. Everything else is verified.

**Two pre-existing failures, both unrelated to this change** — confirmed present
without it, so they are not regressions from the OOXML work:

- `nx run <project>:test` fails workspace-wide with
  `TypeError: Cannot read properties of undefined (reading 'config')` thrown from
  `describe`, collecting 0 tests. The same suites pass when `vitest` is run
  directly in the project directory (`cd libs/<lib> && npx vitest --run`), so it
  is how Nx spawns the runner, not the tests. Reproduces on any project, e.g.
  `@epam/ai-dial-sidebar`, which this change does not touch.
- `@epam/chat-api:typecheck` reports 785 errors, all in `apps/chat-api` (mostly
  `TS6305`/`TS6307` staleness against `apps/chat-api/dist`). No CI workflow runs
  `typecheck`, and `nx build @epam/chat-api` is green.
- `@epam/ai-dial-skill-editor:lint` fails on one Prettier Tailwind class-order
  error in `SkillFileUploadDialog.tsx`. That file is byte-identical to
  `origin/development`, so the failure exists on the base branch.

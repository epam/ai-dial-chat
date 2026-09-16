## 1. Preview read path — drop the manifest byte cap (RC1)

- [x] 1.1 Add `readSkillFilePreviewBytes(response: Response): Promise<Uint8Array>` to `libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts`, beside the existing readers: `new Uint8Array(await response.arrayBuffer())`, no size check, never `null`. JSDoc must say why it has no ceiling and that `readSkillFileBytes`/`readSkillManifest` keep theirs.
- [x] 1.2 Export it from the entry points that already export `readSkillFileBytes` (`libs/chat-hooks/src/index.ts` and `libs/chat-hooks/src/entry-points/catalog.ts` — check which currently re-export it and match).
- [x] 1.3 Switch `onLoadSkillDetailsFile` (`libs/chat-hooks/src/catalog/useSkillItemDetails.ts:185-222`) to the new reader and delete the `if (bytes == null) throw new Error('File exceeds the preview size limit')` branch. Leave the non-OK-status throw (with `status` attached), the `No skill details are open` throw, the folder guard, and the `application/octet-stream` MIME handling exactly as they are.
- [x] 1.4 Confirm `readSkillFileBytes` and `readSkillManifest` are untouched and still used by the manifest fetch and `onLoadContentFile`; `SKILL_MANIFEST_MAX_BYTES` stays at `256 * 1024`.
- [x] 1.5 Unit tests in `libs/chat-hooks/src/catalog/tests/` — `onLoadSkillDetailsFile` resolves the full bytes for a response whose `content-length` header **and** body both exceed `SKILL_MANIFEST_MAX_BYTES`; a `403` still rejects with `status: 403`; a non-403 non-OK still rejects; `readSkillManifest` still returns `null` for an oversized `SKILL.md`.
- [x] 1.6 Run `npm run test:file -- libs/chat-hooks/src/catalog/tests/<file>.spec.ts` for each touched suite.

## 2. PDF worker wiring (RC2)

- [x] 2.1 In `apps/chat/src/components/SkillFilePreview/SkillFilePreview.tsx`, import `configurePdfWorker` from `../../utils/pdf` and pass it to `AttachmentCanvasBody`. Do not add a prop for it, do not change `apps/chat/src/utils/pdf.ts`, and keep both of its `pdfjs-dist` imports dynamic.
- [x] 2.2 Verify no other `AttachmentCanvasBody`/`AttachmentCanvasContainer`/`AttachmentCanvas` call site in `apps/chat` is still missing the prop (`grep -rn "AttachmentCanvasBody" apps/chat/src`), and wire any that is.
- [x] 2.3 Unit test in `apps/chat/src/components/SkillFilePreview/tests/SkillFilePreview.spec.tsx` (create the folder if absent): the `configurePdfWorker` handed to `AttachmentCanvasBody` is the app's initializer. This single assertion must fail on the pre-change code.
- [x] 2.4 Confirm no regression in the page-level canvas: `apps/chat/src/app/app.tsx:576` still passes the same initializer and `apps/chat/src/utils/tests/pdf.spec.ts` still passes.

## 3. Integration coverage at the application-to-viewer boundary

- [x] 3.1 Add a minimal valid PDF fixture helper under `apps/chat/src/components/CatalogView/tests/` (or a shared test-fixtures location if one exists): `%PDF-1.4` header, catalog/pages/page objects, `xref`, `trailer`, `%%EOF`, padded with a PDF comment block so the total length exceeds `SKILL_MANIFEST_MAX_BYTES`. Derive the padding target from the constant, not a literal (design Open Question 3).
- [x] 3.2 Add an integration test that renders `SkillDetailsFilePreview` **without** mocking `../../SkillFilePreview/SkillFilePreview`, stubbing only `@epam/ai-dial-react-pdf-highlighter`'s `DocumentPreview` (and `PageThumbnail` if the import requires it). Assert the resolved canvas content is `AttachmentContentType.Pdf` with a `blob:` URL, that "Failed to load file" is absent, and that the stubbed `DocumentPreview` mounts only after the `configurePdfWorker` promise resolves.
- [x] 3.3 Keep the existing mocked `SkillDetailsFilePreview.spec.tsx` cases (race protection, 403 → forbidden, file-switch isolation) intact — add the new file/cases rather than converting the whole suite.
- [x] 3.4 Assert only the injected callback and the resolved content type/URL scheme; do not assert `DocumentPreview`'s internal props (design risk note).
- [x] 3.5 Add a non-PDF case through the real `SkillFilePreview` (e.g. a `.md` file) asserting `configurePdfWorker` is never invoked.
- [x] 3.6 Run `npm run test:file --` for each new/changed app suite.

## 4. Verification

- [x] 4.1 `npm run verify:changed`.
- [x] 4.2 `npm run validate:docs` — run it if any README or `docs/**` file was touched, and update `libs/chat-hooks/README.md` if `readSkillFilePreviewBytes` becomes part of the documented public API.
- [x] 4.3 `npm run verify:full` once, before declaring the change complete.
- [x] 4.4 Confirm no lib gained host knowledge: `libs/attachment-canvas` still only receives `configurePdfWorker` as a callback, and `libs/chat-hooks` gained no URL, endpoint, or runtime-config knowledge (AGENTS.md §Library isolation).

## 5. Browser verification (manual — cannot be established by the unit suites)

- [x] 5.1 Fresh reload → Catalog → a skill with one PDF supporting file → Details → pick the PDF: it renders. Confirm in DevTools that the worker request goes to the app's own bundled `pdf.worker` asset and **not** to `unpkg.com`.
- [x] 5.2 Repeat on a skill with several attachments, including a non-PDF, and switch between them: each shows its own document.
- [x] 5.3 Fresh reload → open a chat PDF attachment **first**, then the skill PDF: still works (no ordering dependency either way).
- [x] 5.4 Skill Editor / Skill Builder: select a PDF supporting file after a fresh reload — renders, same worker source.
- [x] 5.5 Close and reopen the details panel, and switch skills, then pick a PDF: the correct document shows; no stale document and no global attachment canvas opening.
- [x] 5.6 Confirm the three failure states stay distinguishable in the real app: loading (slow file), forbidden (a 403 file), and a genuine failure (a corrupt/deleted file).
- [x] 5.7 Check the preview at a mobile width and a desktop width: no horizontal page overflow, internal scrolling works, toolbar hidden as before (`hidePdfToolbar`).
- [x] 5.8 Record answers to design Open Questions 1 and 2 — what F2 looks like in isolation, and whether any sub-256 KB skill PDF existed that worked before this change — in the proposal or the PR description, so the "confirmed vs hypothesised" split in the design stays accurate.
- [x] 5.9 Console check: no new errors or warnings on the preview path.

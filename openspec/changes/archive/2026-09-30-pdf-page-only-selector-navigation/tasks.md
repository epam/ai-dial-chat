## 1. Page-only fallback

Architecture guard: the change stays inside `libs/quotations` (pure selector parsing) and tests in `libs/chat-hooks`; no host, endpoint, or export change. Use extensionless relative imports.

- [x] 1.1 Add internal `readPdfSelectorPage` and a second fallback pass to `getAnnotationPdfPage` in `libs/quotations/src/utils/annotation.ts`; update the `readPdfSelectorBox` and `getAnnotationPdfPage` comments to describe the one-directional agreement.

  **Verification:** `npm exec nx test @epam/ai-dial-quotations`, `npm exec nx lint @epam/ai-dial-quotations`.

- [x] 1.2 Update `libs/quotations/src/utils/tests/annotation.spec.ts`: non-finite geometry falls back to its page; page-only `pdf_region` yields a page and no highlight; geometry wins over an earlier page-only selector; invalid pages and non-PDF types yield `undefined`.

  **Verification:** `npm exec nx test @epam/ai-dial-quotations`.

- [x] 1.3 Update `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts`: a malformed `pdf_region` keeps its page with no highlight; a page-only `html_tag` citation opens its page; a citation without `body.selector` leaves `page` undefined.

  **Verification:** `npm exec nx test @epam/ai-dial-chat-hooks`, `npm exec nx lint @epam/ai-dial-chat-hooks`.

- [x] 1.4 Update the `getAnnotationPdfPage` entry in `libs/quotations/README.md`.

  **Verification:** `npm run validate:docs`.

- [x] 1.6 Add an invisible page-anchor highlight in `annotationToPdfCanvasContent` for an annotation with a page but no matching generated highlight, sharing its shape with `referenceAttachmentToPdfCanvasContent`; cover the single and grouped cases in `attachment-canvas.spec.ts`.

  **Verification:** `npm exec nx test @epam/ai-dial-chat-hooks`, `npm exec nx lint @epam/ai-dial-chat-hooks`.

- [ ] 1.5 Manually verify in the app: preview a PDF citation whose annotation has `[{ type: 'pdf_region', page: 2 }]` and confirm the viewer opens page 2 with no visible highlight; confirm a geometry-backed citation still highlights and scrolls as before.

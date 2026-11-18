## 1. Lib

- [x] 1.1 In `libs/quotations/src/utils/tests/annotation.spec.ts`, cover page 1 from a page-only `pdf_region`, a `pdf_bbox` and a `#page=1` URL returning `undefined`; move the title-mentions-page cases to page 3.
- [x] 1.2 Return `undefined` for page 1 in `getCitationGroupPage` and update its JSDoc and `libs/quotations/README.md`.

## 2. App tests

- [x] 2.1 `citation-labels.spec.ts`: the page label uses page 5; add a page-1 case with the plain labels.
- [x] 2.2 `ConversationMessageItem.spec.tsx`: label and copy tests use page 2, a new test keeps the plain label for page 1, and the canvas tests whose fixtures cite page 1 find the marker by the plain accessible name and still assert page 1 is opened.

## 3. Verify

- [x] 3.1 `quotations` and `chat` tests, lint, `npm run validate:specs`, `npm run validate:docs`.

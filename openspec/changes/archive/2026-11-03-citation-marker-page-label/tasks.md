## 1. Lib helper (`libs/quotations`)

- [x] 1.1 Add failing tests in `libs/quotations/src/utils/tests/annotation.spec.ts` for `getCitationGroupPage`, one per `citation-marker` scenario: `pdf_bbox` page, page-only `pdf_region`, `#page=N` URL fallback, no page, title mentions page (`page 1`, `(p. 3)`, `P.3`, `pp. 3-5`, `pg 3`, `#page=4`), and digits in the file name (`Group1-2.pdf`) not suppressing.
- [x] 1.2 Implement `getCitationGroupPage(group)` in `libs/quotations/src/utils/annotation.ts` (design D2/D3) with a one-line JSDoc, and re-export it from `libs/quotations/src/index.ts`.
- [x] 1.3 Add failing tests in `libs/quotations/src/utils/tests/citation-injection.spec.ts` for the optional `formatLabel` parameter of `replaceCitTagsWithSourceNames`: the default is unchanged, formatter output replaces the tag, the output is Markdown-escaped, and unresolved tags stay untouched.
- [x] 1.4 Implement the `formatLabel` parameter (default `group.sourceName`) and update its JSDoc.
- [x] 1.5 Update `libs/quotations/README.md` Utilities: document `getCitationGroupPage` and the `formatLabel` argument with compiling examples. Run `npm run validate:docs`.

## 2. App labels (`apps/chat`)

- [x] 2.1 Add `CitationsI18nKeys.MarkerLabelWithPage`, `MarkerLabelWithPageAndOverflow` and `MarkerAriaLabelWithPage` to `apps/chat/src/constants/translation-keys.ts`, plus the `citations.marker.*` values to `apps/chat/src/i18n/locales/en.json`.
- [x] 2.2 In `ConversationMessageItem.tsx`, extract one label builder (keyed by `getCitationGroupPage(group)`) that returns `{ label, labelWithOverflow, ariaLabel }`. Use it in `buildCitationLabels` (marker + card `ariaLabel`) and in the reference-list `CitationDropdown` labels, replacing the duplicated inline `t()` calls.
- [x] 2.3 Pass a `formatLabel` built from the same builder's single-citation `label` to `replaceCitTagsWithSourceNames` in `copyContent`.
- [x] 2.4 Extend `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`: a pill with a page reads `clm.pdf, p. 1` with accessible name `Citation from clm.pdf, page 1`; a title `clm.pdf, page 1` stays unchanged; a non-PDF source keeps the name only; copied content contains `clm.pdf, p. 1`.

## 3. Verify

- [x] 3.1 Run the `lean-verification` skill on the slice (`quotations` + `chat` test/lint/typecheck) and `npm run validate:specs`.
- [ ] 3.2 Check by hand in the running app: a PDF `<cit>` pill shows the page, clicking it opens the canvas at that page with the bbox highlighted, and a title-with-page source shows no duplicate.

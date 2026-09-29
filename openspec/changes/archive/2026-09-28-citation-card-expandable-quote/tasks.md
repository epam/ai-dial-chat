## 1. Library slice

- [x] 1.1 Add overflow measurement, the `LinkButton` toggle, and the expanded height cap to `libs/quotations/src/components/CitationCard/CitationCard.tsx`; add `showMore` / `showLess` to `CitationCardLabels`.
  - Verification: `npm exec nx -- run-many -t test,lint,typecheck -p @epam/ai-dial-quotations`.
- [x] 1.2 Cover fits / expand / collapse / reset-on-switch in `CitationCard.spec.tsx`; add the new labels to the `CitationDropdown` and `useCitationMarkdownComponents` specs.
  - Verification: rerun the quotations test target.

## 2. Host wiring and docs

- [x] 2.1 Pass `buttons.showMore` / `buttons.showLess` in both label builders in `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`.
  - Verification: `npm exec nx -- run-many -t typecheck,lint -p chat` (requires `node_modules` in sync with `development`).
- [x] 2.2 Document the toggle and the new labels in `libs/quotations/README.md`.
  - Verification: `npm run validate:docs`.

## 3. Manual check

- [x] 3.1 Open a citation whose quote exceeds six lines on desktop and mobile widths, in LTR and RTL; confirm the toggle, the scroll cap, and keyboard access.

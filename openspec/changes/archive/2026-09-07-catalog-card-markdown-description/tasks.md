## 1. Render description through MarkdownRenderer

- [x] 1.1 In `libs/catalog/src/components/CardGrid/Card.tsx`, import `MarkdownRenderer` and `MarkdownRendererClassNames` from `@epam/ai-dial-chat-shared`.
- [x] 1.2 Add a module-level constant (e.g. `DESCRIPTION_MARKDOWN_COMPONENTS = { img: () => null }`) so it stays referentially stable across renders per the design's memoization note.
- [x] 1.3 Replace the `<p>{item.description}</p>` block (`Card.tsx:162-176`) with a `<div>` carrying the current `line-clamp-2 min-h-[2lh] break-words` + `styles.description` classes, `onClick`/`onKeyDown` handlers that call `event.stopPropagation()`, and a `MarkdownRenderer` child rendering `item.description`, passing a `classNames` map that maps `p`/`ul`/`ol`/`h1`..`h6` to `descriptionClassName` and the `components` constant from 1.2.
- [x] 1.4 Run `npm run test:file -- libs/catalog/src/components/CardGrid/tests/Card.spec.tsx` — confirm existing tests still pass before adding new ones.

## 2. Test coverage for Markdown, HTML-like, and plain-text descriptions

- [x] 2.1 In `libs/catalog/src/components/CardGrid/tests/Card.spec.tsx`, add a case asserting a Markdown-formatted description (e.g. `**bold** text`) renders the formatted output, not literal `**` characters.
- [x] 2.2 Add a case asserting an HTML-like description (e.g. `<span style='color:red'>text</span>`) renders the sanitized text content without the literal tag markup or the `style` attribute taking effect.
- [x] 2.3 Add a case asserting a plain-text description (no Markdown/HTML) still renders unchanged.
- [x] 2.4 Add a case asserting a Markdown link in the description renders as a real, clickable `<a>` element.
- [x] 2.5 Add a case asserting clicking a description link does not also invoke the card's `onClick` (details-view) callback.
- [x] 2.6 Add a case asserting a long/multi-line description keeps the wrapper's `line-clamp-2 min-h-[2lh]` classes (per the existing `container.querySelector` convention already used in this spec file for class assertions).
- [x] 2.7 Run `npm run test:file -- libs/catalog/src/components/CardGrid/tests/Card.spec.tsx` — confirm all new and existing cases pass.

## 3. Documentation

- [x] 3.1 Update `libs/catalog/README.md`'s `Card` section to describe that `description` now renders as sanitized Markdown (matching `AboutTab`'s behavior), noting the suppressed inline-image rendering and the 2-line clamp.
- [x] 3.2 Run `npm run validate:docs` — confirm the updated README still passes README-coverage and link checks.

## 4. Full verification

- [x] 4.1 Run `npm run verify:full` once to confirm the complete change (lint, typecheck, tests, build) is clean.

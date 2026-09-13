## Context

`Card` (`libs/catalog/src/components/CardGrid/Card.tsx:162-176`) renders `item.description` as a plain `<p>` with `line-clamp-2 min-h-[2lh] break-words`. `CatalogItem.description` is free-text that can contain Markdown syntax or HTML-like snippets (`<span style='color:red'>`), which today render literally instead of being interpreted. `AboutTab` (`libs/catalog/src/components/Details/TabsContent/About.tsx:1-52`), the description panel shown when a catalog item's details view is open, renders the same field through `MarkdownRenderer` from `@epam/ai-dial-chat-shared`, giving the same underlying text two different renderings depending on which surface shows it.

`MarkdownRenderer` (`libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`) already owns the sanitization pipeline (`rehypeRaw` → `rehypeKatex` → `rehypeSanitize` over `defaultSchema`) and exposes `classNames` (per-element class overrides) and `components` (full `ReactMarkdown` component overrides) as its only extension points. `@epam/ai-dial-chat-shared` is already a peer dependency of `@epam/ai-dial-catalog` (used by `AboutTab`), so no new dependency is needed.

`Card` is a fixed-height virtualized grid cell: `CARD_HEIGHT = 248` (`libs/catalog/src/constants/virtual-grid.ts:5`) allocates the description slot exactly `44px` for 2 lines at `22px` line-height. `Card` is also the single component used for every viewport (desktop and mobile only change grid column count, not card markup), so there is no separate mobile code path to update.

`libs/quotations/src/components/CitationCard/CitationCard.tsx` already solves an equivalent problem: it wraps `MarkdownRenderer` inside a `line-clamp-6` container with a `classNames` map matching the surrounding typography, so multi-block Markdown output (separate `<p>`/`<ul>` elements) still truncates as if it were one clamped text block. This is a shipped, tested precedent for the same technique `Card` needs.

## Goals / Non-Goals

**Goals:**

- Render `Card`'s description through `MarkdownRenderer`, matching `AboutTab`'s rendering behavior (same sanitization, same Markdown feature set) for Markdown, HTML-like, plain-text, and link content.
- Preserve the description slot's exact footprint: 2-line clamp, `44px`/`2lh` minimum height, no change to `CARD_HEIGHT` or card layout.
- Keep the fix inside `libs/catalog`; make no changes to `MarkdownRenderer` or any other `libs/chat-shared` file.
- Keep desktop and mobile behavior identical, since both share the same `Card` markup.

**Non-Goals:**

- Changing `MarkdownRenderer`'s public API, sanitization schema, or supported Markdown feature set.
- Touching `FavoriteCard`, `InfoCard`, or list-view rendering — none of them render `item.description` today.
- Introducing a new shared "truncated Markdown" component in `libs/chat-shared`; `Card` and `CitationCard` each keep their own thin wrapper with card-specific typography, matching how `CitationCard` already does it rather than adding a new shared abstraction for two call sites.

## Decisions

### Reuse `MarkdownRenderer` via `classNames`/`components`, not a new prop on it

`Card` will wrap `MarkdownRenderer` in the same container that currently holds the clamped `<p>`, moving the `line-clamp-2 min-h-[2lh] break-words` classes onto that wrapper `<div>` and passing:

- `classNames: { p, ul, ol, h1..h6 }` all mapped to the existing `descriptionClassName` (default `'dial-small-paragraph-text'`), so any heading/list Markdown collapses to the card's single typography step instead of introducing larger heading fonts that would blow the `44px` budget — mirroring `AboutTab`'s "flatten every heading to one class" pattern (`About.tsx:16-17`).
- `components: { img: () => null }`, since an inline image at full intrinsic size would overflow the fixed-height card and `MarkdownRenderer` has no size-constrained image mode; suppressing it is consistent with a card summary context where images were never expected.

**Alternatives considered:**

- _Add a new `truncateLines`/`maxHeight` prop to `MarkdownRenderer` itself._ Rejected: `CitationCard` already proves the wrapper-`div` + `classNames` approach works without touching `MarkdownRenderer`, and a new prop would widen `MarkdownRenderer`'s public API for a need only two call sites have, both of which are already served by the existing extension points.
- _Strip Markdown/HTML to plain text with a regex before rendering, instead of using `MarkdownRenderer`._ Rejected: the proposal's explicit requirement is to reuse the About tab's rendering approach, not to hide it; a bespoke stripper would reintroduce exactly the duplicated-logic problem the proposal calls out.
- _Extract a new shared `TruncatedMarkdown` component in `libs/chat-shared` used by both `Card` and `CitationCard`._ Rejected for this change: the two call sites' `classNames` maps differ enough (card typography vs. quote typography, clamp-2 vs. clamp-6) that a shared wrapper would need its own prop surface anyway; consolidating them is a separate refactor with its own risk, not required to fix the bug reported here.

### Truncation stays CSS-only (`line-clamp`), not a text-length pre-truncation

Continue relying on the CSS `line-clamp-2` visual truncation (as `CitationCard` does) rather than pre-truncating the Markdown source string by character count. Pre-truncating raw Markdown/HTML text risks cutting mid-tag or mid-syntax (e.g. inside `<span style=`), producing broken markup for the renderer to sanitize. `line-clamp` truncates the rendered DOM after sanitization, which is safe regardless of where the cut falls.

### Nested interactive content: links inside the card's `role="button"` root

`Card`'s root carries `role="button"` with an `onClick` (opening the item's details). A Markdown-rendered `<a>` inside the description is a second interactive/focusable element nested inside that button-role container, which WCAG flags as a nesting violation (a link cannot be a valid descendant of a button). This already exists in principle wherever a description could contain a bare URL rendered as text, but `MarkdownRenderer` will now render `[text](url)` and autolinked URLs as real `<a>` elements, making the violation concrete.

**Decision:** stop propagation on the description wrapper's `onClick`/`onKeyDown` (mirroring how the existing footer star button already stops propagation to avoid triggering the card's own click) is not sufficient by itself, since the nesting violation is structural, not a click-handling bug. For this change, links render as plain inline text via `components: { a: 'span' }`-equivalent styling (keep the anchor semantics off; render the link text without an `href`) is rejected because it silently drops link functionality the About tab provides. Instead, keep the `<a>` real (so `MarkdownRenderer`'s existing link styling/target/rel behavior is unchanged) and call `event.stopPropagation()` in a small wrapper `onClick` on the description container so a click on the link navigates instead of also opening the details view; document the remaining `role="button"`-contains-`<a>` structural nesting as an accepted limitation carried over unchanged from `AboutTab`, which has the same shape (a `<div>` panel does not have `role="button"`, so `AboutTab` doesn't actually hit this — `Card` is the first place this nesting appears). Flag this explicitly as an **Open Question** below rather than silently shipping a known AAA gap.

### Library isolation

No host/external integration knowledge is introduced. `MarkdownRenderer` is already consumed the same way by `AboutTab` inside `libs/catalog`; this change adds a second, sibling call site inside the same lib, with no new prop threading through to `apps/chat`. `Card`'s existing `styles.typography.descriptionClassName` prop remains the single source of description typography, consistent with `.claude/rules/libs.md`'s "typography as props" rule.

## Risks / Trade-offs

- **[Risk]** Multi-block Markdown output (e.g. a list) inside a `line-clamp-2` container may clip visually between list items in a way that looks different from clipping mid-sentence in a plain paragraph → **Mitigation:** this is the exact situation `CitationCard` already ships with `line-clamp-6`; visually verify with a Markdown list fixture during implementation and accept CSS line-clamp's standard behavior (already an accepted trade-off in the shipped precedent).
- **[Risk]** A nested `<a>` inside the card's `role="button"` root is a structural a11y nesting violation not present before this change → **Mitigation:** see Open Questions; needs an explicit reviewer decision before `tasks.md` locks in the final approach.
- **[Risk]** `rehypeSanitize`'s `defaultSchema` could theoretically allow some element whose default styling (e.g. `<code>` block padding, `<table>` borders) doesn't fit a `44px` slot → **Mitigation:** the same schema is already exercised by `AboutTab` and `CitationCard` without incident; `classNames`/`components` overrides above address the two elements (headings, images) most likely to overflow, and `overflow: hidden` from `line-clamp` bounds the rest regardless of internal element sizing.
- **[Trade-off]** Suppressing `img` rendering means a description that intentionally includes an inline image (rare, but possible) loses that content in the card summary while still showing it in the About tab → accepted, since a full-size image cannot fit a `44px`/2-line slot and no thumbnailing mode exists in `MarkdownRenderer`.

## Migration Plan

Purely additive rendering change to one component; no data migration, no API change, no feature flag needed. Rollback is a single revert of the `Card.tsx` diff (and its test/README additions) with no follow-on cleanup, since no schema, storage, or dependency changes are involved.

## Open Questions

- Should the nested-`<a>`-inside-`role="button"` structural issue be fixed in this change (e.g. by changing the card root's interaction pattern), or filed as a separate a11y follow-up and documented as a known limitation in `specs/catalog-card-description-markdown/spec.md`? This design assumes the latter (document as a limitation, stop-propagation only) to keep this change scoped to the description-rendering bug; confirm before writing `tasks.md`.

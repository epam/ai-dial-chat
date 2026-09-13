## Why

Catalog grid cards (`libs/catalog/src/components/CardGrid/Card.tsx:162-176`) render `item.description` as plain text, so Markdown syntax and HTML-like snippets (e.g. `<span style='color:red'>`) show up literally instead of being rendered. The "About" detailed-view panel (`libs/catalog/src/components/Details/TabsContent/About.tsx`) already renders the same field correctly through the shared `MarkdownRenderer`, so a card's summary and its own detail view disagree about what the description actually says.

## What Changes

- Render `Card`'s description through `MarkdownRenderer` (`@epam/ai-dial-chat-shared`) instead of a raw `<p>{item.description}</p>`, reusing the same sanitization pipeline (`rehypeRaw` → `rehypeKatex` → `rehypeSanitize`) the About tab already relies on — no changes to `MarkdownRenderer` itself.
- Pass a card-specific `classNames`/`components` map so headings, lists, and paragraphs collapse onto the card's existing `descriptionClassName` typography and inline images are suppressed, keeping the rendered output inside the current `line-clamp-2 min-h-[2lh]` truncation box and the `CARD_HEIGHT = 248` budget (`libs/catalog/src/constants/virtual-grid.ts:2`).
- Follow the precedent already shipped in `libs/quotations/src/components/CitationCard/CitationCard.tsx`, which wraps `MarkdownRenderer` in a line-clamped container the same way — no novel truncation mechanism is introduced.
- Extend `libs/catalog/src/components/CardGrid/tests/Card.spec.tsx` with cases for Markdown formatting, HTML-like input, plain text, links, and long/truncated content.
- Update `libs/catalog/README.md`'s `Card` section to describe the new Markdown rendering behavior.

## Capabilities

### New Capabilities

- `catalog-card-description-markdown`: Catalog grid cards render item descriptions through the shared sanitized Markdown renderer, matching the About tab's rendering behavior while preserving card truncation, layout, RTL, and accessibility.

### Modified Capabilities

(none — no existing spec covers card-grid description rendering)

## Impact

- `libs/catalog/src/components/CardGrid/Card.tsx` — description rendering changes from raw text to `MarkdownRenderer`.
- `libs/catalog/src/components/CardGrid/tests/Card.spec.tsx` — new test cases.
- `libs/catalog/README.md` — documentation update for the changed `Card` behavior.
- No changes to `libs/chat-shared/src/components/MarkdownRenderer/*` (consumed as-is) and no new dependency (`@epam/ai-dial-chat-shared` is already a peer dependency of `@epam/ai-dial-catalog`).
- `FavoriteCard`, `InfoCard`, and list-view rendering are out of scope — they do not render `item.description`.

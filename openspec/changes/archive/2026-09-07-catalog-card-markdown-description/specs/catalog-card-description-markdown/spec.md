## ADDED Requirements

### Requirement: Catalog card descriptions render as sanitized Markdown

`Card` (`libs/catalog/src/components/CardGrid/Card.tsx`) SHALL render `item.description` through `MarkdownRenderer` (`@epam/ai-dial-chat-shared`), the same sanitized rendering pipeline (`rehypeRaw` → `rehypeKatex` → `rehypeSanitize`) already used by the About-tab detailed view (`AboutTab`), instead of rendering it as raw text. The card SHALL NOT introduce any separate Markdown-parsing or HTML-stripping logic of its own.

#### Scenario: Markdown syntax renders as formatted text

- **WHEN** `item.description` contains Markdown syntax (e.g. `**bold**`, a bullet list, or a link)
- **THEN** the card displays the formatted result (bold text, list markup, a clickable link) instead of the literal Markdown characters

#### Scenario: HTML-like content is sanitized, not shown as literal text

- **WHEN** `item.description` contains an HTML-like snippet such as `<span style='color:red'>text</span>`
- **THEN** the card renders the text content without the literal angle-bracket markup, and without applying the disallowed `style` attribute — matching how `AboutTab` renders the same input

#### Scenario: Plain text renders unchanged

- **WHEN** `item.description` contains no Markdown or HTML syntax
- **THEN** the card displays the text exactly as before this change, with no visual regression

### Requirement: Card layout, truncation, and dimensions are preserved

Rendering the description as Markdown SHALL NOT change the card's fixed height (`CARD_HEIGHT`, `libs/catalog/src/constants/virtual-grid.ts`), the description slot's 2-line clamp, or its `44px`/`2lh` minimum height. Long or richly formatted descriptions (multiple paragraphs, headings, lists, inline images) SHALL be visually truncated to fit the existing slot rather than growing the card or overflowing its bounds.

#### Scenario: Long Markdown content is clamped to two lines

- **WHEN** `item.description` renders to more than two lines of content (e.g. a multi-paragraph description or a long list)
- **THEN** the card shows only the first two lines with an ellipsis, and the card's total height is unchanged from before this change

#### Scenario: Headings collapse to the description's typography

- **WHEN** `item.description` contains Markdown headings (`#`, `##`, etc.)
- **THEN** the headings render using the same typography class as the card's body text (`descriptionClassName`), not a larger heading font size

#### Scenario: Inline images do not render

- **WHEN** `item.description` contains a Markdown image (`![alt](url)`)
- **THEN** the card does not render the image element, avoiding a fixed-size card overflowing from an arbitrarily large image

### Requirement: Card description supports links, RTL, and accessibility

Links inside the rendered description SHALL remain clickable and SHALL NOT trigger the card's own `onClick` navigation (the card root carries `role="button"`). The rendered description has no directional layout of its own beyond what `MarkdownRenderer` already provides via CSS logical properties, and requires no new ARIA roles beyond what the card root already exposes.

#### Scenario: Clicking a description link does not open the card's details view

- **WHEN** a user clicks a link rendered inside the card's description
- **THEN** the link's own navigation occurs and the card's `onClick` (opening the item's detail view) is not also triggered

#### Scenario: Description text direction follows the ambient RTL context

- **WHEN** the active locale is RTL (e.g. Arabic)
- **THEN** the rendered description's text alignment and any logical-property-based spacing follow the inherited `dir="rtl"` from `MarkdownRenderer`'s existing CSS, with no card-specific RTL overrides needed

#### Scenario: Card remains a single accessible control despite a nested link

- **WHEN** the description contains a rendered `<a>` element inside the card's `role="button"` root
- **THEN** this is a known, documented limitation carried by this change (a link nested inside a button-role container); no new focus trap or keyboard-navigation regression is introduced beyond this pre-existing nesting shape, since the click-stopPropagation on the description keeps link activation distinct from card activation

## Non-functional notes

- **State/hooks ownership**: No new React state, context, or hook is introduced; `Card` remains a presentational component receiving `item` and `styles` as props.
- **API/backend impact**: None. `item.description` is already fetched by existing catalog data flows; this change only affects client-side rendering.
- **i18n**: No new user-visible strings or translation keys are introduced.
- **RTL/direction**: Covered above — `MarkdownRenderer` already renders using CSS logical properties inherited from the ambient `dir` attribute; no card-specific RTL handling is added.
- **Feature flags**: None — not gated behind `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES`.
- **Memoization**: The `classNames`/`components` objects passed to `MarkdownRenderer` SHALL be defined as stable module-level constants (not recreated per render), consistent with how `AboutTab` builds its `classNames` map inline from stable inputs; no `useMemo`/`useCallback` is required since these values do not depend on props that change per render.
- **Accessibility**: WCAG 2.1 AAA — covered above (link nesting is documented as an accepted limitation, not newly introduced UI needing fresh ARIA attributes).
- **Observability/telemetry**: None — no new metrics or analytics events.
- **Rate limiting**: Not applicable — no new endpoint.
- **Caching**: Not applicable — no new cached data.

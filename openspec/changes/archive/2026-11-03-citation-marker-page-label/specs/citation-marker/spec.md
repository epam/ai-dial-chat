## ADDED Requirements

### Requirement: Citation group page resolved for the marker label

`libs/quotations/src/utils/annotation.ts` SHALL export `getCitationGroupPage(group: AnnotationGroup): number | undefined`, re-exported from `@epam/ai-dial-quotations`, that returns the 1-based PDF page a citation group's marker refers to:

1. `getAnnotationPdfPage(group.primaryAnnotation)` when it returns a page (the `pdf_bbox` / `pdf_region` selector page — the same page the Preview action opens);
2. otherwise `parsePdfPageReference(group.sourceUrl)?.page` when non-null (a reference attachment's `#page=N` fragment);
3. otherwise `undefined`.

The function SHALL return `undefined` regardless of the resolved page when `group.sourceName` already mentions a page — because some sources write the page into the attachment title the pill displays. A page mention is a case-insensitive match of a page token followed by optional `.`/`:`/whitespace and a digit, where the page token is one of `page`, `pages`, `pg`, `pp`, `p` (each as a whole word), or the `#page=` fragment. A bare number in the name (e.g. `Group1-2.pdf`), or a `p`+digits run inside a word (e.g. `p2p.pdf`, `map3.pdf`), SHALL NOT count as a page mention.

The function is pure, does no formatting, and returns no user-visible text.

**i18n**: none (the lib returns a number; wording belongs to the host).
**RTL**: none — pure data transformation.
**Feature flag**: none.

#### Scenario: Page taken from a pdf_bbox selector

- **WHEN** the group's primary annotation has `body.selector = { type: 'pdf_bbox', page: 3, x1: 0, y1: 0, x2: 10, y2: 10 }` and `sourceName` is `"clm.pdf"`
- **THEN** `getCitationGroupPage` returns `3`

#### Scenario: Page-only pdf_region selector still yields a page

- **WHEN** the primary annotation's selector is `{ type: 'pdf_region', page: 1 }` with no box and `sourceName` is `"clm.pdf"`
- **THEN** `getCitationGroupPage` returns `1`

#### Scenario: Page taken from a reference URL fragment

- **WHEN** the primary annotation has no PDF selector and `group.sourceUrl` is `"files/abc/clm.pdf#page=4"`
- **THEN** `getCitationGroupPage` returns `4`

#### Scenario: No page information

- **WHEN** the primary annotation has no PDF selector and `sourceUrl` has no `#page=` fragment
- **THEN** `getCitationGroupPage` returns `undefined`

#### Scenario: Title already names the page

- **WHEN** the primary annotation's selector page is `1` and `sourceName` is `"clm.pdf, page 1"`
- **THEN** `getCitationGroupPage` returns `undefined`

#### Scenario: Abbreviated page mention in the title suppresses the page

- **WHEN** the selector page is `3` and `sourceName` is any of `"report.pdf (p. 3)"`, `"report.pdf, P.3"`, `"report.pdf pp. 3-5"`, `"report.pdf pg 3"`
- **THEN** `getCitationGroupPage` returns `undefined`

#### Scenario: Digits in the file name are not a page mention

- **WHEN** the selector page is `2` and `sourceName` is `"Group1-2.pdf"`
- **THEN** `getCitationGroupPage` returns `2`

---

### Requirement: Host marker label includes the cited page

The chat app SHALL build every citation marker's labels from `getCitationGroupPage(group)`: in `buildCitationLabels` (inline and stage citations) and in the message-level reference list in `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`.

- When the helper returns a page `N`:
  - `markerLabels.label` = `t(CitationsI18nKeys.MarkerLabelWithPage, { source, page: N })` → `"{{source}}, p. {{page}}"`
  - `markerLabels.labelWithOverflow` = `t(CitationsI18nKeys.MarkerLabelWithPageAndOverflow, { source, page: N, count })` → `"{{source}}, p. {{page}} +{{count}}"`
  - `markerLabels.ariaLabel` and `cardLabels.ariaLabel` = `t(CitationsI18nKeys.MarkerAriaLabelWithPage, { source, page: N })` → `"Citation from {{source}}, page {{page}}"`
- When it returns `undefined`, the existing `MarkerLabel` / `MarkerLabelWithOverflow` / `MarkerAriaLabel` strings SHALL be used unchanged.

Clicking the marker keeps its current behaviour (open the canvas at the cited page and highlight a non-empty box).

**i18n keys** (`CitationsI18nKeys`, `apps/chat/src/i18n/locales/en.json`): `citations.marker.labelWithPage`, `citations.marker.labelWithPageAndOverflow`, `citations.marker.ariaLabelWithPage`.
**RTL**: text only; the separator and abbreviation are inside the translated string, so a RTL locale controls ordering.
**Accessibility**: the accessible name spells out "page" rather than the "p." abbreviation.
**Feature flag**: none.

#### Scenario: Pill shows file name and page

- **WHEN** an assistant message cites `<cit data-id="00000"></cit>` resolved to an annotation with `attachment.title = "clm.pdf"` and selector page `1`
- **THEN** the pill reads `"clm.pdf, p. 1"` and its accessible name is `"Citation from clm.pdf, page 1"`

#### Scenario: Pill with overflow shows page and count

- **WHEN** a group with page `2` and source `"clm.pdf"` holds three annotations
- **THEN** the pill reads `"clm.pdf, p. 2 +2"`

#### Scenario: Source that writes its own page is not duplicated

- **WHEN** the resolved annotation has `attachment.title = "clm.pdf, page 1"` and selector page `1`
- **THEN** the pill reads `"clm.pdf, page 1"` (unchanged from today)

#### Scenario: Non-PDF citation keeps today's label

- **WHEN** the citation's source has no page (e.g. a web link or a DOCX range)
- **THEN** the pill reads the source name only, as today

## ADDED Requirements

### Requirement: Copied citation text matches the marker label

`replaceCitTagsWithSourceNames(content, groups, fallbackGroups?, formatLabel?)` exported from `@epam/ai-dial-quotations` SHALL accept an optional fourth parameter `formatLabel: (group: AnnotationGroup) => string`. Each supported `<cit data-id="…"></cit>` element that resolves to a group SHALL be replaced by `formatLabel(group)`, Markdown-escaped exactly as `sourceName` is today; when `formatLabel` is omitted the replacement SHALL remain `group.sourceName`. Unresolved tags SHALL stay untouched.

The chat app's Copy actions SHALL pass a `formatLabel` that returns the same text as the group's single-annotation marker label (`MarkerLabelWithPage` when `getCitationGroupPage` returns a page, otherwise `MarkerLabel`), so a copied citation matches what the pill shows.

**i18n**: none in the lib; the app reuses the `citations.marker.*` keys.
**RTL**: none — text transformation.
**Feature flag**: none.

#### Scenario: Default replacement is unchanged

- **WHEN** `replaceCitTagsWithSourceNames` is called without `formatLabel` for content `"555 <cit data-id=\"00000\"></cit>"` whose group's `sourceName` is `"clm.pdf"`
- **THEN** it returns `"555 clm.pdf"`

#### Scenario: Formatter output replaces the tag

- **WHEN** it is called with `formatLabel = () => "clm.pdf, p. 1"` for the same content
- **THEN** it returns `"555 clm.pdf, p. 1"`

#### Scenario: Formatter output is Markdown-escaped

- **WHEN** `formatLabel` returns `"a|b_c.pdf, p. 1"`
- **THEN** the replacement is `"a\|b\_c.pdf, p. 1"`

#### Scenario: Copying a message keeps the page

- **WHEN** the user copies an assistant message whose `<cit>` resolves to `clm.pdf` with selector page `1`
- **THEN** the clipboard text contains `"clm.pdf, p. 1"`

## ADDED Requirements

### Requirement: HTML citation normalization preserves PDF document locations

Raw `html_tag` normalization SHALL retain an optional supplied annotation index and `body.selector` in object or array form, independently of the `target.selector` that identifies the inline `<cit>` marker. A later quote-only delta SHALL NOT erase the existing body selector. This is an additive PDF-navigation contract; non-PDF routing remains unchanged.

#### Scenario: Raw PDF citation with zero-area coordinates

- **WHEN** an indexed raw citation has an html-tag target and a `pdf_bbox` body selector with page 3 and all-zero coordinates
- **THEN** its normalized annotation retains the index, marker target and document selector and can resolve navigation page 3

#### Scenario: Array body selectors

- **WHEN** a raw citation supplies a body selector array with PDF locations
- **THEN** normalization retains the valid selector objects as an array

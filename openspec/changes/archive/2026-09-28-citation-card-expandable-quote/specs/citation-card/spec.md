## ADDED Requirements

### Requirement: `CitationCard` lets the user expand a clamped quote

`CitationCard` SHALL render `body.quote` clamped to six lines by default. When, and only when, the collapsed quote overflows that clamp, it SHALL render a "Show more" toggle (`LinkButton`, `ElementSize.Small`) below the quote. Overflow SHALL be measured from the rendered element (`scrollHeight > clientHeight`) and re-measured on resize while collapsed.

Activating the toggle SHALL lift the clamp and cap the quote at `min(20rem, 50vh)` with vertical scrolling; the expanded quote SHALL be keyboard-focusable (`tabIndex=0`). The toggle's label SHALL switch to "Show less", and activating it again SHALL restore the clamp.

The toggle SHALL expose `aria-expanded` reflecting the state and `aria-controls` pointing at the quote element. The card SHALL reset to collapsed whenever the active annotation or its quote changes, including navigation through the switcher.

`CitationCardLabels` SHALL include required `showMore` and `showLess` strings. The chat app SHALL supply them from `buttons.showMore` and `buttons.showLess`; the library SHALL NOT read i18n itself.

#### Scenario: Quote that fits shows no toggle

- **WHEN** the active annotation's quote fits within six lines
- **THEN** no "Show more" toggle is rendered

#### Scenario: Overflowing quote expands into a scrollable region

- **WHEN** the quote overflows six lines and the user activates "Show more"
- **THEN** the clamp is removed, the quote is capped at `min(20rem, 50vh)` and scrolls, the toggle reads "Show less" with `aria-expanded="true"`

#### Scenario: Expanded quote collapses again

- **WHEN** the quote is expanded and the user activates "Show less"
- **THEN** the six-line clamp is restored and the toggle reads "Show more" with `aria-expanded="false"`

#### Scenario: Switching citations resets to collapsed

- **WHEN** the quote is expanded and the user navigates to another annotation with the switcher
- **THEN** the newly shown quote is collapsed

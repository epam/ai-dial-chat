## Why

### Problem

`CitationCard` clamps `body.quote` to six lines with no way to read the rest. Quotes that list dataset facets (frequency, country, series, business line, date range) routinely exceed that budget, so the tail is cut off with an ellipsis, and "Open in browser" opens the whole source rather than the quoted excerpt.

### Solution

Keep the six-line clamp as the default and add a "Show more" / "Show less" toggle that appears only when the collapsed quote actually overflows. The expanded quote is height-capped and scrolls on its own, so a very long quote cannot push the popup off-screen.

## What Changes

- `CitationCard` measures the collapsed quote (`scrollHeight > clientHeight`, re-measured via `ResizeObserver`) and renders a `LinkButton` toggle only on overflow.
- Expanded: the clamp is lifted and the quote is capped at `min(20rem, 50vh)` with `overflow-y-auto` and `tabIndex=0`.
- The toggle carries `aria-expanded` / `aria-controls`; every citation, including one reached through the switcher, opens collapsed.
- **BREAKING (lib API)**: `CitationCardLabels` gains required `showMore` and `showLess`. The chat app supplies the existing `buttons.showMore` / `buttons.showLess` keys; no new i18n strings.

### Non-goals

No change to how quotes are grouped, previewed, downloaded, or opened; no full-quote view in the Sources panel; no change to the collapsed six-line budget.

### Acceptance criteria

A quote that fits shows no toggle. An overflowing quote can be expanded to a scrollable region and collapsed again, from mouse and keyboard, on mobile and desktop. Switching citations resets to collapsed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `citation-card`: long quotes can be expanded in place.

## Impact

`libs/quotations` (`CitationCard`, its labels type, specs, README) and the chat app's label wiring in `ConversationMessageItem`. Library isolation is preserved: labels arrive from the host. RTL relies on logical layout only; no directional icons are added.

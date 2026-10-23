# catalog-favorites-strip Specification

## Purpose

Defines how `@epam/ai-dial-catalog`'s `Favorites` strip lays out and pages the user's favorited items: a paginated grid on desktop, a single swipeable row below the desktop breakpoint, and the host's option to drop the pager.

## Requirements

### Requirement: On desktop the favorites are a paginated grid

`Favorites` (`libs/catalog/src/components/Favorites/Favorites.tsx`) SHALL, at or above the desktop breakpoint (`useIsMobile` from `@epam/ai-dial-chat-shared` is `false`), render the favorites sorted by `updatedAt` (newest first) as a grid whose column count comes from `useFavColumns` (`libs/catalog/src/utils/use-fav-columns.ts`) and whose page holds two rows. When the favorites outnumber one page, the strip header SHALL show a pager — previous and next `GhostIconButton`s with RTL-mirrored chevrons and a `page / total` counter — and each page change SHALL remount the page's cards so their fade-in replays. The grid and section heights SHALL be locked to the first page's size so a shorter last page does not shift the layout.

#### Scenario: The desktop grid pages through the favorites

- **WHEN** ten favorites render at a 1024px viewport (four columns, eight cards per page)
- **THEN** the first page shows eight cards and the counter reads `1 / 2`, and pressing next shows the remaining two cards with the counter at `2 / 2`

### Requirement: Below the desktop breakpoint the favorites are one swipeable row

When `useIsMobile` is `true`, `Favorites` SHALL render every favorite in a single horizontally scrolling row (`grid-flow-col`, `overflow-x-auto`, a hidden scrollbar, mandatory inline snap to each card's start) where each card is `min(85%, 320px)` wide so the next card peeks in. Cards SHALL keep stable keys so swiping does not replay their fade-in, the height lock and the FLIP reposition animation SHALL not apply, and a switch between the row and the grid (viewport resize across the breakpoint) SHALL reset the strip to page 1.

The pager SHALL stay, with one page per card: pressing previous or next scrolls the row smoothly so the target card's inline-start edge meets the row's inline-start padding edge (`getRowScrollDelta` in `libs/catalog/src/utils/favorites-row.ts`, physical-direction aware in RTL), and a user swipe updates the counter to the card nearest the inline-start edge, or to the last card once the row is scrolled to its end (`getRowActiveIndex`).

While a pager-started scroll is on its way, scroll frames SHALL NOT move the counter off the tapped page: the counter holds until the row reaches that card, the scroll ends (`scrollend`), or the user touches the row, so it never flickers back and a second tap mid-scroll advances from the tapped page. A tap whose target card is already in place SHALL NOT start a scroll.

#### Scenario: A phone shows every favorite in one row

- **WHEN** ten favorites render below the desktop breakpoint
- **THEN** all ten cards are in one horizontally scrollable row with no column template, and the counter reads `1 / 10`

#### Scenario: The pager steps the row one card at a time

- **WHEN** three favorites render below the desktop breakpoint and the user presses next
- **THEN** the counter reads `2 / 3`, the row scrolls smoothly to the second card, and all three cards stay mounted

#### Scenario: A swipe moves the counter

- **WHEN** the user swipes the row until the third of three cards is at its start
- **THEN** the counter reads `3 / 3`

#### Scenario: A quick double tap reaches the third card

- **WHEN** the user presses next twice while the first smooth scroll is still near the first card
- **THEN** the counter never drops back to `1 / 3`, previous stays enabled, and the second tap scrolls the row to the third card with the counter at `3 / 3`

### Requirement: The host can drop the favorites pager

`FavoritesProps.isPaginationHidden` (default `false`) SHALL remove the pager: the desktop grid then renders every favorite at once and the mobile row can only be swiped. `CatalogProps.isFavoritesPaginationHidden` (default `false`) SHALL be forwarded by `Catalog` to its `Favorites` as `isPaginationHidden`.

#### Scenario: Hidden pagination shows the whole desktop grid

- **WHEN** ten favorites render at a 1024px viewport with `isPaginationHidden`
- **THEN** all ten cards are rendered and no previous/next buttons exist

#### Scenario: Hidden pagination leaves the mobile row swipe-only

- **WHEN** three favorites render below the desktop breakpoint with `isPaginationHidden`
- **THEN** all three cards are in the row and no previous/next buttons exist

### Requirement: The mount animation always releases the wrapper height

The strip's mount-time grow animation SHALL clear the wrapper's inline `height` and `transition` both when the transition ends (or its 400ms fallback fires) and when the effect is cleaned up, so a StrictMode re-run mid-transition cannot leave the wrapper stuck at its mount-time height.

#### Scenario: StrictMode does not leave a gap below the strip

- **WHEN** `Favorites` mounts inside `StrictMode` and 400ms pass
- **THEN** the wrapper around the strip has no inline height

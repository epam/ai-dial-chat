# responsive-breakpoints Specification

## Purpose

The single responsive boundary between the `mobile` and `desktop` bands (1280px) and the requirement that every viewport-width mechanism resolves to the same band.

## Requirements

### Requirement: A single responsive breakpoint boundary at 1280px

The app SHALL use exactly two responsive bands: `mobile` for viewports up to **1279px** and `desktop` for **1280px and wider**. Every mechanism that branches on viewport width SHALL resolve to the same band — the named Tailwind screens (`mobile: { max: '1279px' }`, `desktop: { min: '1280px' }` in the root `tailwind.config.js`), the JS hook `useBreakpoint` (`apps/chat/src/hooks/breakpoint/useBreakpoint.ts`, query `(min-width: 1280px)`), the lib-level `useIsMobile` (`libs/chat-shared/src/hooks/useIsMobile.ts`, query `(max-width: 1279px)`), the overlay manager's mobile detection (`libs/chat-overlay`, `MOBILE_BREAKPOINT_PX = 1279`), and any SCSS `@media` mirror of the boundary. Tablet-class viewports (769–1279px, iPad Mini/Air/Pro included) SHALL receive the mobile presentation on every surface — two-column layouts become single-column, overlay pickers become bottom sheets, and mobile chrome (sticky action footers, flipped dividers, 16px gutters) stays in effect.

**Documented exception — Scheduled Tasks search-focus cutoff.** `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.module.scss` declares `.sortControlHidden { @media (max-width: 767px) { display: none; } }`. `ScheduledTasks.tsx` applies `styles.sortControlHidden` to the sort-control wrapper only while `isSearchFocused` is true, so below 768px the sort control hides while the search field is focused and the search (`flex-1`) takes the full row; from 768px up — the tablet part of the mobile band included — both controls stay visible regardless of focus and the search width does not change on focus. Per the code comment, this is a phone-width affordance deliberately finer than the mobile band (≤1279px), written in the SCSS module (rather than as a Tailwind variant) for the same cascade reason as `.createButton`. A companion `useLayoutEffect` in `ScheduledTasks.tsx` closes an open sort menu when focus hides the trigger, detecting the hidden state from the DOM rather than duplicating the 767px literal. This is the only viewport-width cutoff that does not mirror the 1279/1280 boundary; it does not create a third presentation band for any other part of the surface, which still follows the two-band rule above, and no other surface SHALL introduce another cutoff without recording it here.

Baseline specs that still reference a 769px desktop boundary (e.g. `app-editor-flow`, `catalog-content-file-picker`, `catalog-content-file-preview`, `catalog-primary-action`, `file-manager-standalone-page`, `usage-dashboard-lib`) are superseded by this requirement's boundary and SHALL be re-baselined to 1280px when those capabilities are next modified.

#### Scenario: Tablet-class viewport keeps the mobile presentation

- **WHEN** the viewport is between 769px and 1279px (e.g. iPad Pro at 1024px)
- **THEN** every app surface renders its mobile presentation — stacked columns, bottom-sheet pickers, and mobile form chrome — identical to a phone viewport

#### Scenario: Desktop presentation starts at 1280px

- **WHEN** the viewport is 1280px or wider
- **THEN** surfaces render their desktop presentation (multi-column layouts, popover pickers, header action bars) exactly as they did at the previous 769px boundary

#### Scenario: All boundary mechanisms stay in sync

- **WHEN** the boundary is checked in Tailwind `desktop:`/`mobile:` variants, the `useBreakpoint` hook, the lib `useIsMobile` hook, the overlay manager, or an SCSS `@media` mirror
- **THEN** all of them resolve a given viewport width to the same band
- **AND** the only width check that does not mirror the 1279/1280 boundary is the documented Scheduled Tasks `.sortControlHidden` `@media (max-width: 767px)` cutoff

#### Scenario: Scheduled Tasks hides the sort control on search focus only below 768px

- **WHEN** the Scheduled Tasks search field is focused at a viewport width of 767px or less
- **THEN** `.sortControlHidden` sets the sort-control wrapper to `display: none`, the search expands to the full row, and an open sort menu is closed

#### Scenario: Scheduled Tasks keeps the sort control visible from 768px up

- **WHEN** the Scheduled Tasks search field is focused at a viewport width between 768px and 1279px
- **THEN** the sort control stays visible and the search width does not change, while the rest of the surface keeps its mobile presentation

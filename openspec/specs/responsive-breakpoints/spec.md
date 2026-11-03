# responsive-breakpoints Specification

## Purpose

The default layout boundary between the `mobile` and `desktop` bands (1280px), with scoped 768px policies for menus, Catalog Create placement and right-panel overlays.

## Requirements

### Requirement: A single responsive breakpoint boundary at 1280px

The app SHALL retain two default layout bands: `mobile` for viewports up to **1279px** and `desktop` for **1280px and wider**. Every mechanism implementing the default layout policy SHALL resolve to the same band — the named Tailwind variants (`@custom-variant mobile (@media (max-width: 1279px));` and `@custom-variant desktop (@media (min-width: 1280px));` in `tools/tailwind/theme.css`), the JS hook `useIsMobile` (`libs/chat-shared/src/hooks/useIsMobile.ts`, query `(max-width: 1279px)`, used by the app and the libs alike), the overlay manager's mobile detection (`libs/chat-overlay`, `MOBILE_BREAKPOINT_PX = 1279`), and any SCSS `@media` mirror of the boundary. Tablet-class viewports SHALL retain the mobile layout except for the explicit menu, Catalog Create placement and right-panel policies below. Navigation, conversation panel, general forms/editors/dialogs and mobile chrome SHALL keep their existing policy.

**Scoped surface policies.** The shared breakpoint module SHALL add an inclusive 768px boundary. Switchable action/selection menus SHALL use phone sheets below 768px and anchored desktop menus from 768px. Catalog SHALL use the floating Create button below 768px and the normal labeled header button from 768px. Right panels SHALL use bounded overlays at 768px <= width < 1280px, preserving existing phone and desktop behavior outside that interval. Shared media hooks SHALL own subscriptions only; existing components SHALL retain open/selection state. JS, new named Tailwind variants and participating SCSS mirrors SHALL agree on these intervals, including fractional widths. Existing useIsMobile, mobile/desktop variants and overlay-manager semantics SHALL remain unchanged. The tablet-right-panels and responsive-menu-presentation capabilities define the adopted surfaces; this is not a global layout migration.
**Documented exception — Scheduled Tasks search-focus cutoff.** `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.module.scss` declares `.sortControlHidden { @media (max-width: 767px) { display: none; } }`. `ScheduledTasks.tsx` applies `styles.sortControlHidden` to the sort-control wrapper only while `isSearchFocused` is true, so below 768px the sort control hides while the search field is focused and the search (`flex-1`) takes the full row; from 768px up — the tablet part of the mobile band included — both controls stay visible regardless of focus and the search width does not change on focus. Per the code comment, this is a phone-width affordance deliberately finer than the mobile band (≤1279px), written in the SCSS module (rather than as a Tailwind variant) for the same cascade reason as `.createButton`. A companion `useLayoutEffect` in `ScheduledTasks.tsx` closes an open sort menu when focus hides the trigger, detecting the hidden state from the DOM rather than duplicating the 767px literal. This exception remains unchanged alongside the scoped menu and right-panel policies; other surfaces SHALL NOT introduce new cutoffs without documenting them here.

Baseline specs that still reference a 769px desktop boundary (e.g. `app-editor-flow`, `catalog-content-file-picker`, `catalog-content-file-preview`, `catalog-primary-action`, `file-manager-standalone-page`, `usage-dashboard-lib`) are superseded by this requirement: default layout remains at 1280px; enumerated menus and right panels follow the scoped 768px policies. They SHALL be re-baselined accordingly when next modified.

#### Scenario: Tablet-class viewport keeps the mobile presentation

- **WHEN** the viewport is from 768px inclusive to less than 1280px (e.g. iPad Pro at 1024px)
- **THEN** default layout surfaces retain mobile presentation; enumerated menus use desktop controls and right panels use bounded overlays

#### Scenario: Desktop presentation starts at 1280px

- **WHEN** the viewport is 1280px or wider
- **THEN** surfaces render their desktop presentation (multi-column layouts, popover pickers, header action bars) exactly as they did at the previous 769px boundary

#### Scenario: All boundary mechanisms stay in sync

- **WHEN** the boundary is checked in Tailwind `desktop:`/`mobile:` variants, the `useIsMobile` hook, the overlay manager, or an SCSS `@media` mirror
- **THEN** all of them resolve a given viewport width to the same band
- **AND** `libs/chat-shared/src/constants/tests/breakpoint-sync.spec.ts` asserts that `tools/tailwind/theme.css` contains both `@custom-variant` declarations with the `MOBILE_MAX_WIDTH_PX` / `DESKTOP_BREAKPOINT_PX` literals
- **AND** the new surface-policy checks are synchronized separately, alongside the unchanged Scheduled Tasks `.sortControlHidden` `@media (max-width: 767px)` cutoff

#### Scenario: Scheduled Tasks hides the sort control on search focus only below 768px

- **WHEN** the Scheduled Tasks search field is focused at a viewport width of 767px or less
- **THEN** `.sortControlHidden` sets the sort-control wrapper to `display: none`, the search expands to the full row, and an open sort menu is closed

#### Scenario: Scheduled Tasks keeps the sort control visible from 768px up

- **WHEN** the Scheduled Tasks search field is focused at a viewport width between 768px and 1279px
- **THEN** the sort control stays visible and the search width does not change, while unrelated layout behavior remains unchanged

#### Scenario: Exact and fractional scoped boundaries
- **WHEN** the viewport is 767px or fractionally below 768px
- **THEN** phone menus and existing mobile panels remain active
- **WHEN** it reaches 768px, 1024px, 1279px or fractionally below 1280px
- **THEN** menus use desktop presentation and right panels use tablet overlays
- **WHEN** it reaches 1280px
- **THEN** existing desktop panel presentation resumes and menus remain desktop

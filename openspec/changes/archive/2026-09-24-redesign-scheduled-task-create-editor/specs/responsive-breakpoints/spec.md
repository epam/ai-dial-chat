# responsive-breakpoints — desktop boundary moved to 1280px

## ADDED Requirements

### Requirement: A single responsive breakpoint boundary at 1280px

The app SHALL use exactly two responsive bands: `mobile` for viewports up to **1279px** and `desktop` for **1280px and wider**. Every mechanism that branches on viewport width SHALL resolve to the same band — the named Tailwind screens (`mobile: { max: '1279px' }`, `desktop: { min: '1280px' }` in the root `tailwind.config.js`), the JS hook `useBreakpoint` (`apps/chat/src/hooks/breakpoint/useBreakpoint.ts`, query `(min-width: 1280px)`), the lib-level `useIsMobile` (`libs/chat-shared/src/hooks/useIsMobile.ts`, query `(max-width: 1279px)`), the overlay manager's mobile detection (`libs/chat-overlay`, `MOBILE_BREAKPOINT_PX = 1279`), and any SCSS `@media` mirror of the boundary. Tablet-class viewports (769–1279px, iPad Mini/Air/Pro included) SHALL receive the mobile presentation on every surface — two-column layouts become single-column, overlay pickers become bottom sheets, and mobile chrome (sticky action footers, flipped dividers, 16px gutters) stays in effect.

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

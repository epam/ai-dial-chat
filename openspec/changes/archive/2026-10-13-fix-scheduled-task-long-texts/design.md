# Design: fix scheduled-task long-text rendering

## Context

Retroactive design record for the implemented fix on `fix/scheduled-task-view-mode-long-texts`. All decisions below are reflected in the code and verified by the specs named in `tasks.md`.

## Decisions

### 1. Card description: wrap-don't-stretch, fixed clamp contract

`ScheduledTaskCard`'s description is `min-w-0` + `[overflow-wrap:anywhere]` inside the fixed-height card (`ScheduledTaskCard.tsx`), so an unbreakable token wraps within the card instead of pushing it past the grid track. The clamp is `line-clamp-3 max-h-[72px]` (3 × the default step's 24px line-height) on desktop and two lines below the breakpoint. A dynamic line pool (the design's 1+3/2+2/3+1 split) was analyzed and deferred: pure CSS cannot place the `line-clamp` ellipsis on the last visible line when the box is flex-shrunk below the clamp count, and whole-line arithmetic would require every card zone to be a multiple of the line-height. The agreed future mechanism (a small `useLineClampBudget` hook reading the rendered line height) is recorded in project memory, not implemented here.

### 2. Header title: width contract + kit tooltip

Both title copies (desktop header `<h1>`, mobile/tablet standalone row) carry `min-w-0 max-w-[600px]` — `min-w-0` lets the flex child shrink below its nowrap min-content so truncation engages; the 600px cap stops a long single line (phones never reach the cap). The text renders through the kit's `EllipsisTooltip` (`text` + `className`), giving ellipsis + tooltip-only-when-clipped + the full name as `aria-label` — the same mechanism the card title uses via `Highlight`.

### 3. Details description: words wrap whole

`whitespace-pre-wrap [overflow-wrap:anywhere]` replaces `break-all` (which allowed breaks between any two characters and chopped ordinary words at every column edge). Typography stays at the single-line field step (`dial-small-text`, 14px/20px) via the existing `fieldValueClassName`. The ink is a dedicated `.description` rule reading `var(--stdv-description-text, var(--text-primary, #1b212d))` — chained through the theme token so it flips in dark mode (a bare `#1b212d` literal would render near-black on a dark background), with the design's literal as the last-resort fallback and the view's `styles.colors.descriptionText` as the override channel, mirroring the existing `--stdv-subtitle-text` cascade.

### 4. Instructions: scoped classNames record, shared presets untouched

The built-in viewer call in `ScheduledTaskConfigurationSection` passes a module-level record: `{ ...COMPACT_MARKDOWN_CLASS_NAMES, ul/ol: 'dial-small-paragraph-text …' }`. Rationale: the renderer's list base classes set no font, so `<li>` inherits the ambient font (14/20) while COMPACT's paragraphs render 14/24 — the `ul`/`ol` override puts list items on the prose step. Mutating the shared presets instead was rejected: they reach every markdown consumer (chat assistant messages, attachment canvas, quotations), and a scheduled-task fix must not reflow those surfaces. Module-level const keeps the memoized `MDMessageViewer` reference stable.

### 5. Prop hygiene

`descriptionSizeClassName` (duplicate default of `descriptionClassName` on the same element — CSS source order silently decided the winner) was collapsed into `descriptionClassName`, whose docs now state the clamp-cap coupling.

## Library isolation

Every change is inside `libs/scheduled-tasks`: overrides arrive as props (`styles.typography.descriptionClassName`, `styles.colors.descriptionText`) or flow through existing shared constants passed via the viewer's `classNames` prop. No routing, i18n, env, or host knowledge entered the lib.

## RTL / direction impact

None beyond what existed: the title tooltip and wrapping are direction-agnostic (no directional utilities introduced; the back arrow's existing `rtl:scale-x-[-1]` is unchanged).

## Accessibility

- While clipped, the header title's full text remains the accessible name (`EllipsisTooltip` sets `aria-label`).
- No focus or keyboard behavior changed; the card's activation contract is untouched.

## Observability / caching

None — presentational rendering only.

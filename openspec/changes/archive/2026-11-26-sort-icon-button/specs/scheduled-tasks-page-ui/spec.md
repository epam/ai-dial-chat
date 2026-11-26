## MODIFIED Requirements

### Requirement: Scheduled Tasks page supports RTL and meets AAA accessibility defaults

All directional layout in the Scheduled Tasks header, toolbar and empty state MUST use Tailwind logical properties (`ms/me`, `ps/pe`, `text-start/end`) instead of physical ones, per `.claude/rules/rtl.md`. Any directional icon MUST be mirrored in RTL via `rtl:scale-x-[-1]` or an equivalent. The sort glyph `IconArrowsSort` is symmetric and is not mirrored. The search input MUST have an accessible label.

The sort control MUST be the icon-only `SortMenuButton` from `@epam/ai-dial-chat-shared`:

- It is named, and tooltipped, by `labels.sortLabel` (`ButtonsI18nKeys.Sort`) whichever option is applied.
- It shows no visible text.
- It exposes its expanded/collapsed state via `aria-expanded`.
- It marks the applied option `aria-checked="true"` in the opened menu.
- `ScheduledTasksProps.sortIcon` replaces the glyph. `undefined` or `null` draws the default `IconArrowsSort`, because an icon-only trigger needs a glyph.
- `ScheduledTasksColors.sortButtonText` colours the glyph through the button's `colors.icon` (fallback `--text-secondary`).

While the search is focused below 768px, the sort control stays hidden as it is today.

#### Scenario: Page mirrors under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the header, toolbar, and empty state lay out mirrored with no hard-coded left/right offsets breaking the mirrored layout

#### Scenario: Sort control is an icon button named "Sort"

- **WHEN** the page renders with First to run applied
- **THEN** the toolbar has a button named "Sort" with no visible text next to the search, and no button is named "First to run"

#### Scenario: Sort control exposes expanded state

- **WHEN** the user opens the sort menu
- **THEN** the sort trigger has `aria-expanded="true"` and the currently active sort option is marked `aria-checked="true"`

#### Scenario: Search input is labeled

- **WHEN** the search input renders
- **THEN** it has a localized accessible name (via `aria-label` or an associated `<label>`) distinct from its placeholder text, and its clear action has a localized accessible name

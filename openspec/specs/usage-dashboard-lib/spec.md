# usage-dashboard-lib Specification

## Purpose

Defines the host-agnostic `@epam/ai-dial-usage-dashboard` library: the presentational
`UsageLimitCardGroup`/`UsageLimitCard` components that render the Usage settings page's
aggregate cost-limit cards, and the `ModelLimitsSection` component that renders the per-model
limits table below them — their public prop/label/color contracts, status-driven visual
treatment, accessibility, and responsive/RTL behavior. The library renders already-normalized
display models only: it never interprets raw DTOs, formats currency, computes percentages, or
derives status — that stays in `libs/chat-hooks` (see the `usage-data-hook` and `usage-model-limits`
capabilities). It has no dependency, direct or transitive, on the generated
`@epam/ai-dial-chat-api-client`; that boundary is mechanically enforced (see below).

## Requirements

### Requirement: Host-agnostic usage-dashboard library

The system SHALL provide a buildable React library `libs/usage-dashboard`
(package `@epam/ai-dial-usage-dashboard`, Nx tag `type:ui`), scaffolded via an Nx generator and
matching the inferred-target structure used by `libs/settings-panel` (no hand-written
`project.json`; `package.json` carries `"nx": { "tags": ["type:ui"] }`; build/test come from the
`@nx/vite` and `@nx/vitest` inferred plugins via `vite.config.mts`). The library SHALL import only
`react`, `react-dom`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and
`@tabler/icons-react` as peer/runtime dependencies.

The library SHALL NOT depend on `@epam/ai-dial-chat-api-client` in any form. It SHALL NOT appear in
`package.json` (`dependencies`, `peerDependencies`, or `optionalDependencies`), in a
`tsconfig.lib.json` project reference, or in a `vite.config.mts` resolve/test alias. The narrow
generated-client exceptions recorded in AGENTS.md §Library isolation cover `libs/chat-api-client` and
`libs/chat-hooks` only; they do not extend to this presentational package.

The library SHALL render already-normalized display models supplied by its host. All interpretation
of DIAL Core responses — generated DTO field selection, the unlimited sentinel
(`total >= 2 ** 53`), status thresholds, shared currency and number formatting, deployment-type
filtering, and deployment joins — SHALL happen in response adapters outside this library.
Host-specific locale and icon resolution, translated strings, and reset-time formatting SHALL
remain host-supplied callbacks or parameters. The host passes the results in through `UsageLimitCardData`, `ModelLimitRow`,
`ModelLimitPeriodStatuses`, and the components' label props; in AI DIAL Chat those adapters live in
`libs/chat-hooks` (see the `usage-model-limits` and `usage-data-hook` capabilities), under the
narrow `chat-hooks` DIAL-Core-response-adapter exception recorded in AGENTS.md §Library isolation —
never in this presentational package itself.

The library SHALL NOT import any `server-api/*` wrapper, any app
context/hook/feature-flag/env/routing/storage/analytics module, or `react-i18next`. Every
user-visible string SHALL arrive as a prop; no component SHALL accept a translate callback, a
locale, a timezone, or a raw timestamp.

#### Scenario: Module boundary lint passes
- **WHEN** `npm exec nx lint usage-dashboard` runs
- **THEN** `@nx/enforce-module-boundaries` reports no violations, confirming the library depends
  only on `chat-shared`-tier, UI-kit, and `@tabler/icons-react` packages

#### Scenario: No generated-client, server-api, or i18n imports
- **WHEN** the library's source is inspected
- **THEN** no file imports `@epam/ai-dial-chat-api-client` or any of its subpaths,
  `apps/chat/src/server-api/*`, or `react-i18next`/`i18next`

#### Scenario: Manifest and build configuration carry no client edge
- **WHEN** `libs/usage-dashboard/package.json`, `tsconfig.lib.json`, and `vite.config.mts` are
  inspected
- **THEN** none of them names `@epam/ai-dial-chat-api-client` as a dependency, a peer, a project
  reference, or an alias

### Requirement: Generated-client imports are mechanically prevented from returning

The repository SHALL enforce the library's generated-client boundary with checks that fail a build
or test run, rather than relying on review. The enforcement SHALL be scoped to this boundary and
SHALL reuse existing repository conventions; it SHALL NOT introduce a new repository-wide
architecture-rule framework, tag hierarchy, or dependency-analysis layer.

Two checks SHALL be in place:

1. **Source and barrel.** `libs/usage-dashboard/eslint.config.mjs` SHALL declare a project-scoped
   `no-restricted-imports` rule rejecting `@epam/ai-dial-chat-api-client` and its subpaths, so a
   direct import or a re-export through `src/index.ts` fails `npm exec nx lint usage-dashboard`.
   The existing `@nx/dependency-checks` configuration in that file SHALL continue to fail an import
   the manifest does not declare, covering the same boundary from the manifest side.
2. **Emitted artifacts and real installation.** A packed-consumer check SHALL scan the library's
   built `dist/**/*.js` and `dist/**/*.d.ts` for the `@epam/ai-dial-chat-api-client` specifier and
   for re-exported generated DTO type names, and SHALL install the packed tarball into a dependency
   tree isolated from the workspace's own `node_modules` and `@epam/source` aliases, containing only
   the library's documented peers and deliberately **not** the generated client. It SHALL follow the
   shape of the existing `tools/attachment-canvas-consumer-fixture` and
   `tools/reusable-workflows-consumer-fixture` projects and reuse
   `libs/chat-hooks/e2e-fixtures/harness.mjs`, because an in-checkout fixture would let an
   "uninstalled" peer resolve from the workspace root and pass for the wrong reason.

#### Scenario: A reintroduced source import fails lint
- **WHEN** a file under `libs/usage-dashboard/src/**` imports a value or type from
  `@epam/ai-dial-chat-api-client`
- **THEN** `npm exec nx lint usage-dashboard` fails, naming the restricted import

#### Scenario: A leak through the barrel or an emitted declaration fails the artifact scan
- **WHEN** the library is built and its `dist` JavaScript or `.d.ts` output references
  `@epam/ai-dial-chat-api-client` or re-exports a generated DTO type name
- **THEN** the packed-consumer check fails and names the offending emitted file

#### Scenario: A consumer installs and renders without the generated client
- **WHEN** the packed tarball is installed into an isolated tree holding only the documented peers
  (`react`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`, and their own required peers), with
  no `@epam/ai-dial-chat-api-client` and no workspace alias
- **THEN** the consumer typechecks, bundles, imports `./styles.css`, and renders
  `UsageLimitCardGroup` and `ModelLimitsSection` from normalized fixture data

### Requirement: UsageLimitCardGroup and UsageLimitCard public API

The library SHALL export from `src/index.ts`: the components `UsageLimitCardGroup` and
`UsageLimitCard`, the string enum `UsageLimitStatus` (`Default = 'default'`,
`RunningLow = 'runningLow'`, `LimitReached = 'limitReached'`), and the types
`UsageLimitCardData`, `UsageLimitCardGroupLabels`, `UsageLimitCardGroupColors`,
`UsageLimitCardGroupTypography`, `UsageLimitCardGroupProps`, `UsageLimitCardProps`.

`UsageLimitCardData` SHALL carry only normalized, already-formatted data: `title`,
`periodDescription`, `used: number`, `total: number`, `usedLabel: string`, `totalLabel?: string`,
`remainingLabel?: string`, `isUnlimited?: boolean`, `usedPercent?: number` (not pre-clamped — may
exceed 100), `status: UsageLimitStatus`, `progressAriaLabel: string`, and the optional preformatted
reset-time trio `resetLabel?: string`, `resetIsoValue?: string`, `resetAriaLabel?: string`. The
library SHALL treat `used`/`total` as opaque numeric values used only to drive the `ProgressBar`'s
`value`/`max`/`aria-valuenow` and SHALL NOT recompute percentages, currency formatting, or the
unlimited-sentinel check from them.

The reset-time fields SHALL be preformatted strings produced by the host. `resetLabel` is the
visible text, `resetIsoValue` is the machine-readable instant for a `<time dateTime>` attribute, and
`resetAriaLabel` is the spoken form, which names the timezone in full rather than as an offset. The
library SHALL NOT parse, format, or timezone-shift them, SHALL NOT import `Intl`, and SHALL NOT accept a locale, timezone, or raw `resetsAt` value.
When `resetLabel` is absent the card SHALL render exactly as it did before reset times existed.

`UsageLimitCardGroupProps` SHALL accept a required `cards: UsageLimitCardData[]` (in display
order), a required `labels: UsageLimitCardGroupLabels`, and an optional
`styles?: { colors?: UsageLimitCardGroupColors; typography?: UsageLimitCardGroupTypography }`.
`UsageLimitCard` SHALL accept `data: UsageLimitCardData`, `labels: UsageLimitCardGroupLabels`, and
the same optional `styles`.

#### Scenario: Multiple cards rendered
- **WHEN** `UsageLimitCardGroup` is rendered with a `cards` array of two or more entries
- **THEN** it renders one independent, equally-sized box per entry, in array order, each showing
  its own title, badge, used amount, progress bar, and captions — with no shared container or
  divider between boxes

#### Scenario: Single card provided
- **WHEN** `UsageLimitCardGroup` is rendered with a `cards` array containing exactly one entry
- **THEN** it renders a single full-width `UsageLimitCard` box for that entry

#### Scenario: No cards provided
- **WHEN** `UsageLimitCardGroup` is rendered with an empty `cards` array
- **THEN** it renders nothing (returns `null`)

#### Scenario: Standalone UsageLimitCard
- **WHEN** `UsageLimitCard` is rendered directly with a `UsageLimitCardData` value
- **THEN** it renders the same title/badge/amount/progress/caption content as one card inside
  `UsageLimitCardGroup`

#### Scenario: Reset line renders below the caption row
- **WHEN** `UsageLimitCardData` carries `resetLabel` and `resetIsoValue`
- **THEN** the card renders `resetLabel` below its existing caption row inside a `<time>` element
  whose `dateTime` attribute is `resetIsoValue`, and the positions of the existing title, badge,
  amount, progress bar, and captions are unchanged

#### Scenario: Card without a reset label is unchanged
- **WHEN** `resetLabel` is absent
- **THEN** no `<time>` element and no reset line are rendered, and the card is visually identical
  to its pre-change output

#### Scenario: Unlimited card still renders its reset line
- **WHEN** `isUnlimited` is `true` and `resetLabel` is present
- **THEN** the card renders the unlimited treatment (used amount and badge only, no ratio) together
  with the reset line

### Requirement: Status-driven visual treatment

The library SHALL render a status badge for every card, regardless of status:
`UsageLimitStatus.Default` with the default (blue) accent and a badge reading
`labels.defaultBadgeLabel`; `UsageLimitStatus.RunningLow` with the warning (amber) accent, a badge
reading `labels.runningLowBadgeLabel`, and a warning-colored progress fill;
`UsageLimitStatus.LimitReached` with the error (red) accent, a badge reading
`labels.limitReachedBadgeLabel`, and an error-colored progress fill. Color SHALL NOT be the only
indicator of status: the badge text and the used-percent caption are always present regardless of
color perception.

The prominent figure on every card SHALL be `data.usedLabel`. When `data.isUnlimited` is not
`true` and `data.totalLabel` is present, the library SHALL render a caption next to the prominent
figure built from `labels.usedOfTotalLabel({ total: data.totalLabel })`. When `data.isUnlimited` is
`true`, the library SHALL render `data.usedLabel` without a progress bar, without the
used-of-total/remaining captions, and without a used-percent label — but SHALL still render the
status badge (an unlimited budget is always treated as `UsageLimitStatus.Default`, i.e.
"within limits").

When `data.usedPercent` is `>= 100` (finite, capped case), the library SHALL clamp both the
rendered progress-bar fill width and the visible used-percent label at 100 — a percentage over 100
is not shown to the user. Only `progressAriaLabel` (surfaced as the progress bar's
`aria-valuetext`) SHALL still reflect the actual, uncapped percentage supplied by the caller, so a
screen-reader user is not misled about the real figure.

#### Scenario: Default status renders the "within limits" badge
- **WHEN** a card's `data.status` is `UsageLimitStatus.Default`
- **THEN** the card renders a badge with `labels.defaultBadgeLabel` text and the default accent

#### Scenario: Running-low badge and accent
- **WHEN** a card's `data.status` is `UsageLimitStatus.RunningLow`
- **THEN** the card renders a badge with `labels.runningLowBadgeLabel` text and applies the warning
  color token to the progress fill and the prominent amount text

#### Scenario: Limit-reached badge and accent
- **WHEN** a card's `data.status` is `UsageLimitStatus.LimitReached`
- **THEN** the card renders a badge with `labels.limitReachedBadgeLabel` text and applies the error
  color token to the progress fill and the prominent amount text

#### Scenario: Unlimited card shows no ratio but still shows a badge
- **WHEN** a card's `data.isUnlimited` is `true`
- **THEN** the card shows `data.usedLabel`, the `labels.defaultBadgeLabel` badge, and no progress
  bar, used-of-total caption, remaining caption, or used-percent label

#### Scenario: Over-100% visual and label clamp preserves the real value only in the accessible text
- **WHEN** a card's `data.usedPercent` is `137`
- **THEN** the rendered progress-bar fill visually stops at 100% width, the visible used-percent
  label reads `100%`, and only the accessible `aria-valuetext` reads the real, uncapped `137%`

### Requirement: Accessibility

Each card's progress element SHALL be exposed with an accessible name (from `data.title`) and
`aria-valuetext` set to `data.progressAriaLabel`. Each status badge SHALL expose its status as
readable text (not an icon-only or color-only indicator). The library SHALL NOT introduce its own
`aria-live` region — loading and error feedback are the host's responsibility (see
`usage-data-hook` capability); the library only renders the data it is given.

Contrast: any `#hex` fallback used in the three-tier CSS-variable chain for the prominent amount
text SHALL resolve to at least 7:1 against its paired background fallback (WCAG AAA), per
`.claude/rules/a11y.md`.

#### Scenario: Progress bar has an accessible name and value text
- **WHEN** a capped (non-unlimited) card is rendered
- **THEN** its progress element exposes `role="progressbar"`, an accessible name derived from
  `data.title`, and `aria-valuetext` equal to `data.progressAriaLabel`

#### Scenario: Badge text is readable, not color-only
- **WHEN** a card renders any status badge
- **THEN** the badge's accessible text content equals the corresponding `labels.*BadgeLabel` string

### Requirement: Responsive and RTL layout

`UsageLimitCardGroup` SHALL use only the repository's `mobile:`/`desktop:` Tailwind breakpoints. On
mobile, cards SHALL stack vertically at full width with no horizontal overflow at a 360px viewport
width. On desktop, cards SHALL render side by side, one column per entry in `cards`, via a
card-count-driven CSS grid (a `--uld-card-count` custom property set from `cards.length`) so the
layout generalizes to any number of cards without a hard-coded column count. There is no shared
container or divider between cards, so no directional border/divider logic applies at the group
level; any internal RTL-sensitive positioning within a single card (e.g. the badge's placement
relative to the title) SHALL use logical Tailwind/CSS properties. The library takes no `dir` prop
unless a lib consumer explicitly needs a direction override, and SHALL NOT import i18n or read
language state to determine direction — direction is inherited from the ancestor `dir` attribute.

#### Scenario: No horizontal overflow on mobile
- **WHEN** `UsageLimitCardGroup` is rendered in a 360px-wide viewport with multiple cards present
- **THEN** the container and its children do not cause horizontal page scroll

#### Scenario: Desktop column count tracks the number of cards
- **WHEN** `UsageLimitCardGroup` is rendered at the desktop breakpoint with three cards
- **THEN** the three cards render in three equal-width columns side by side

### Requirement: ModelLimitsSection public API

The library SHALL export `ModelLimitsSection`; the string enums `ModelLimitStatus`
(`WithinLimits`, `RunningLow`, `LimitReached`, `NoLimit`, `Unavailable`) and
`ModelLimitMetricKind` (`Finite`, `Unlimited`, `Unavailable`); and the types
`ModelLimitMetricCell`, `ModelLimitPeriodCell`, `ModelLimitPeriodStatus`,
`ModelLimitPeriodStatuses`, `ModelLimitRow`, `ModelLimitsLabels`, `ModelLimitsColors`,
`ModelLimitsTypography`, `ModelLimitsStyles`, and `ModelLimitsSectionProps`. `ModelLimitsPeriod`
SHALL no longer be exported.

`ModelLimitMetricCell` SHALL retain its normalized `kind`, preformatted labels, optional uncapped
finite `usedPercent`/`status`, and required `ariaLabel`. The library SHALL not recompute percentage,
status, formatting, unlimited classification, or supporting-label selection. It MAY receive a
host-provided `supportingLabel` for an unlimited metric, such as `Follows cost limit`.

`ModelLimitPeriodCell` SHALL contain `tokens: ModelLimitMetricCell` and
`cost: ModelLimitMetricCell`.

**BREAKING — period property rename.** The three fixed periods SHALL be named for the calendar
windows they represent, not for trailing durations. `ModelLimitRow` SHALL contain identity fields,
`day: ModelLimitPeriodCell`, `week: ModelLimitPeriodCell`, `month: ModelLimitPeriodCell`, and
host-derived `status: ModelLimitStatus`. `ModelLimitPeriodStatuses` SHALL contain `day`, `week`, and
`month`. The former names `last24Hours`, `last7Days`, and `last30Days` SHALL NOT be exported or
accepted.

`ModelLimitPeriodStatus` SHALL contain the host-derived `status: ModelLimitStatus`, an optional
`tooltipLabel`, and the optional preformatted reset trio `resetLabel?: string`,
`resetIsoValue?: string`, `resetAriaLabel?: string`, carrying the same host-formatted-strings-only
contract as `UsageLimitCardData`.

`ModelLimitsLabels` SHALL contain heading, Item/day/week/month/Status column labels
(`dayColumnLabel`, `weekColumnLabel`, `monthColumnLabel`), accessible Tokens/Cost context, model
type, metric state, status badge, and empty-state strings. It SHALL NOT require period-selector or
Requests labels.

`ModelLimitsSectionProps` SHALL accept `rows`, `labels`, and optional `styles`,
plus normalized overall Cost statuses/tooltips for the three fixed headers; it
SHALL NOT accept `period` or `onPeriodChange`. The library SHALL not derive header status, tooltip
copy, or reset text from row data.

#### Scenario: Fixed comparison exports are available
- **WHEN** a consumer imports from `@epam/ai-dial-usage-dashboard`
- **THEN** the fixed comparison component/types are importable, including `ModelLimitPeriodCell`,
  and `ModelLimitsPeriod` is absent from the supported public contract

#### Scenario: Period properties use calendar names
- **WHEN** a consumer constructs a `ModelLimitRow` or `ModelLimitPeriodStatuses`
- **THEN** the compiler requires `day`, `week`, and `month`, and rejects `last24Hours`,
  `last7Days`, and `last30Days`

#### Scenario: Multiple rows render in supplied order
- **WHEN** `ModelLimitsSection` receives multiple rows
- **THEN** it renders one row per entry in array order with Item, three period cells, and Status

#### Scenario: Empty rows preserve the section shell
- **WHEN** `rows` is empty
- **THEN** the heading and count `0` remain visible and the body shows `emptyStateLabel`, with no
  selector or blank table body

#### Scenario: Period header renders its reset line
- **WHEN** a `ModelLimitPeriodStatus` carries `resetLabel`
- **THEN** that period's column header renders the column label and, beneath it, `resetLabel` inside
  a `<time>` element whose `dateTime` is `resetIsoValue`

#### Scenario: Period header without a reset label is unchanged
- **WHEN** a `ModelLimitPeriodStatus` carries no `resetLabel`
- **THEN** the header renders the column label and its status indicator exactly as before

### Requirement: Fixed period comparison columns

`ModelLimitsSection` SHALL render exactly the fixed columns Item, the calendar day period, the
calendar week period, the calendar month period, and Status, labelled from
`labels.dayColumnLabel`, `labels.weekColumnLabel`, and `labels.monthColumnLabel`. It SHALL not
render a period selector, a minute/hour option, standalone Cost/Tokens/Requests columns, or Requests
content. Every period column SHALL render both the Tokens and attributed Cost supplied for that
period without visible Tokens or Cost subheaders.

Column labels SHALL NOT describe the periods as trailing or rolling windows.

#### Scenario: Header contains only requested columns
- **WHEN** rows are present
- **THEN** the desktop header order is Item, day, week, month, Status and no period selector or
  Requests header is rendered

#### Scenario: Periods remain visible simultaneously
- **WHEN** a row is rendered
- **THEN** all three period cells exist at once and no user action is required to compare them

### Requirement: Model limits heading reflects the rendered row count

The library SHALL render `labels.headingLabel` as the section title and `rows.length` as a separate,
visually secondary count in the same semantic heading, so the number of models shown is always
visible next to the "Model limits" title.

#### Scenario: Heading reflects row count
- **WHEN** `ModelLimitsSection` is rendered with 5 rows
- **THEN** the heading contains `labels.headingLabel` followed by a separately styled count `5`

### Requirement: Per-metric cell rendering by kind

Within each period cell, Tokens SHALL render using the existing finite/unlimited/unavailable
treatment. A finite token metric SHALL show `usedLabel / totalLabel` and an accessible progress bar;
the fill SHALL be clamped to `[0, 100]` while `aria-valuetext` preserves the host-provided uncapped
meaning. Unlimited Tokens SHALL show `usedLabel` and `noLimitLabel` without a progress bar.
Unavailable Tokens SHALL show `unavailableLabel` without a progress bar.

Cost SHALL render in the same period cell as only its normalized attributed-spend label when
present, or `unavailableLabel` when Unavailable. It SHALL NOT visibly render `costLabel`,
`totalLabel`, `noLimitLabel`, a per-model Cost cap, or a progress bar. The localized `costLabel`
SHALL remain available as non-visual accessible context. The component SHALL render the
host-provided value and SHALL not derive or format it. A finite token progress bar SHALL render
directly below the token value, and Cost SHALL render on its own line below that progress bar.

Each finite token progress fill color SHALL reflect that token cell's own metric status, independent
of the row's overall Status and other periods.

#### Scenario: Period cell stacks finite Tokens progress and attributed Cost
- **WHEN** a period contains finite Tokens `4K / 10K` at 40% and normalized Cost `$3.20 spent`
- **THEN** the same period cell renders `4K / 10K`, then its token progress bar, then `$3.20 spent`
  on a separate line, without a visible Cost label, per-model Cost limit, No limit text, or Cost
  progress bar

#### Scenario: Unlimited Tokens render without progress
- **WHEN** a period's Tokens kind is `Unlimited` with host-provided supporting label
  `Follows cost limit`
- **THEN** it renders the token used value plus `Follows cost limit` and no progress bar

#### Scenario: Unavailable metrics remain explicit
- **WHEN** either metric in a period is `Unavailable`
- **THEN** that metric renders `unavailableLabel`, distinct from `noLimitLabel`, without borrowing
  data from the other metric or period

#### Scenario: Over-limit tokens clamp only visual fill
- **WHEN** a finite token metric has `usedPercent: 137`
- **THEN** visual progress is capped at 100 while `aria-valuetext` retains the host's real value

### Requirement: Overall row status

The library SHALL render the host-provided `row.status`: `WithinLimits`, `RunningLow`, and
`LimitReached` as their labelled status treatments; `NoLimit` and `Unavailable` as localized plain
secondary text. Color SHALL never be the only status indicator. The library SHALL NOT inspect or
aggregate period metrics to derive Status.

#### Scenario: Limit reached displays the error treatment
- **WHEN** `row.status` is `LimitReached`
- **THEN** the Status column renders `limitReachedBadgeLabel` with the error accent and visible text

#### Scenario: Neutral statuses remain distinct
- **WHEN** `row.status` is `NoLimit` or `Unavailable`
- **THEN** the corresponding localized label renders as plain text and the two states remain
  textually distinguishable

### Requirement: Model identity rendering reuses `DeploymentIcon`

Each row SHALL render its model avatar via the `chat-shared` `DeploymentIcon` component (`src:
row.avatarSrc`, `initialsName: row.name`) at 40×40px with a 12px radius. The identity text SHALL
render `labels.modelTypeLabel` above a single line containing the model name and, when present,
`row.version`. The library SHALL NOT import any `libs/catalog` component or any new heavy peer
dependency to render model identity.

#### Scenario: Row without an avatar URL falls back to initials
- **WHEN** a row's `avatarSrc` is `undefined`
- **THEN** `DeploymentIcon` renders its initials-based fallback derived from `row.name`

#### Scenario: Long names remain accessible when visually truncated
- **WHEN** a row's `name` is long enough to be visually truncated in the identity cell
- **THEN** the full `name` text remains available to assistive technology (e.g. via the element's
  accessible name or a tooltip), not only the visually truncated text

### Requirement: Model limits table responsive and RTL layout

`ModelLimitsSection` SHALL use mobile-first styles, only the repository `mobile:`/`desktop:`
breakpoints, and logical directional properties/classes. At desktop widths it SHALL render one
aligned five-column grid: Item, Today, This week, This month, and Status. Each period
column SHALL group its Tokens and Cost content without vertical column borders. Every desktop row's
grid items SHALL be centered along the vertical axis while preserving their horizontal text/content
alignment. Token progress tracks SHALL retain the available period-cell width, and the attributed
Cost line SHALL remain below the progress track or token supporting state.

At mobile widths each semantic row SHALL stack identity, three visibly labelled period sections,
and a visibly labelled Status in one subtree. Overall Cost status indicators SHALL remain available
beside the corresponding visible mobile period label. It SHALL not create page-level horizontal
overflow at 360px, hide any period, or mount separate desktop/mobile component trees. Long content
SHALL wrap or truncate without obscuring the accessible value. The status icons are
direction-agnostic and SHALL NOT be mirrored.

#### Scenario: Mobile preserves all periods without horizontal page scroll
- **WHEN** the section renders at 360px with long model and metric values
- **THEN** Item, all three labelled periods, and Status remain available in stacked rows without
  horizontal page overflow

#### Scenario: Desktop aligns fixed comparison columns
- **WHEN** the section renders at 769px or wider
- **THEN** header and rows share the same five grid tracks and Tokens/Cost remain grouped beneath
  their matching period header; each row cell's content is vertically centered without changing
  horizontal alignment

#### Scenario: RTL inherits through logical layout
- **WHEN** an RTL `dir` ancestor is present
- **THEN** directional spacing/alignment follows the document direction without language checks,
  physical-direction utilities, or duplicated markup

### Requirement: Model limits accessibility

The section SHALL expose a programmatically named table containing the row count and SHALL preserve
`table`, `rowgroup`, `row`, `columnheader`, and `cell` semantics on desktop and mobile. Each period
column header SHALL programmatically cover both Tokens and Cost in its corresponding cells; each
finite token progress bar SHALL have a period-specific accessible name and host-provided full
`aria-valuetext`. Mobile visible labels SHALL not replace or break the table associations.
Decorative empty-state and avatar imagery SHALL remain hidden from assistive technology where
redundant. A running-low/reached period status indicator SHALL be keyboard-focusable, expose its
complete host-provided tooltip as an accessible name, and provide at least a 44×44 CSS-pixel touch
target where it is shown on mobile.

#### Scenario: Overall Cost status is explained from the period header
- **WHEN** the day overall Cost status is `LimitReached`
- **THEN** its header renders an error indicator whose accessible tooltip explains that the overall
  day Cost limit is reached and models cannot be used until the period resets

#### Scenario: Table name includes rendered row count
- **WHEN** the section has 7 rows
- **THEN** its accessible table name includes the Model tokens limits label and count `7`

#### Scenario: Period progress has unambiguous context
- **WHEN** assistive technology reaches a model's week token progress bar
- **THEN** its accessible name identifies the week period and Tokens and its value text provides full
  used/total information

#### Scenario: Mobile retains one semantic table
- **WHEN** CSS stacks a row at mobile width
- **THEN** the same semantic table/row/cell nodes remain available and reading order is Item,
  Today, This week, This month, Status

---

### Requirement: Reset-time rendering is responsive, RTL-safe, and accessible

Every reset line the library renders SHALL satisfy the library's existing responsive, RTL, and
accessibility rules — on a `UsageLimitCard` and in a `ModelLimitsSection` period header alike.

- It SHALL use only logical or direction-agnostic spacing utilities; no `ml-*`/`mr-*`, `pl-*`/`pr-*`,
  `left-*`/`right-*`, or `text-left`/`text-right` class SHALL be introduced for it.
- It SHALL contain no icon, and therefore no directional icon mirroring is required.
- It SHALL wrap rather than force horizontal overflow at mobile width, and SHALL NOT introduce a new
  breakpoint.
- It SHALL render inside a `<time>` element carrying `dateTime={resetIsoValue}`.
- When `resetAriaLabel` is supplied, that text SHALL render on a visually-hidden sibling and the
  visible `<time>` SHALL be marked `aria-hidden`. It SHALL NOT be applied as `aria-label` on the
  `<time>` itself, which has no implicit ARIA role and therefore does not reliably support one.
  When the field is absent, the visible text is the line's accessible name.
- It SHALL NOT alter the card's `progressAriaLabel` or the period header's existing status-indicator
  `aria-label`.

#### Scenario: No horizontal overflow on mobile with a long reset label
- **WHEN** the group and section render at mobile width with a long formatted reset label
- **THEN** the label wraps within its container and no horizontal scrollbar appears

#### Scenario: Layout mirrors under RTL
- **WHEN** an ancestor sets `dir="rtl"`
- **THEN** the reset line mirrors with the rest of the card or header, with no element pinned to a
  physical side by a class introduced for it

#### Scenario: Reset time is machine-readable
- **WHEN** a reset line renders
- **THEN** its `<time>` element exposes the original UTC instant via `dateTime`, independent of the
  localized visible text

#### Scenario: Reset line does not displace existing accessible names
- **WHEN** a card with a reset line renders
- **THEN** the progress bar's `aria-valuetext` and the badge text are unchanged from a card without
  one

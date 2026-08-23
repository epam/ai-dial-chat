## Context

`useUsageData` (`apps/chat/src/hooks/useUsageData.ts:25-78`) already calls `getUserLimits()` and
`getUserUsage()` (`apps/chat/src/server-api/user-limits.ts:4-8`, wrapping the generated
`UserApi.getUserLimits`/`getUserUsage`) via `Promise.allSettled`, and returns
`{ limits, usage, isLoading, error }`. Both responses are typed `UserLimitStatsResponseDto` and
carry identical top-level global fields: `dayCostStats` (trailing 24h) and `monthCostStats`
(trailing 30d), each `{ used: number; total: number }`
(`openspec/specs/user-usage-limits-api/spec.md:24-41`). `total >= 2**53` is the unlimited sentinel;
per-deployment `*CostStats` are always unlimited-total attributed spend and never sum to the global
figure (`openspec/specs/user-usage-limits-api/spec.md:41`) — the design's own page caption ("Per-model
figures below sum to the totals…") is aspirational copy for the future per-model table and is **not**
implemented by this change (see Risks).

`UsageTab` (`apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx:9-20`) is an empty container.
`openspec/specs/usage-data-hook/spec.md:90-96` currently asserts no `libs/*` package will be created
for this data — this design supersedes that requirement.

The closest existing UI precedent is `libs/catalog/src/components/Details/TabsContent/Limits.tsx`
(cost/token progress rows with `ProgressBar`, a 75%/100% two-tier status, `isUnlimited` handling) and
`apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx:37,112` (a 90% single threshold,
`USAGE_LIMIT_THRESHOLD_PERCENT`). Neither can be imported by the new library: `Limits.tsx` lives in
`@epam/ai-dial-catalog`, and `UsageLimitsControl` is an app component with its own hook/popover
concerns. `libs/settings-panel` is the structural reference for the new library (no `project.json`;
Nx infers the project from `package.json`'s `"nx": { "tags": [...] }` block, `libs/settings-panel/package.json:26-30`;
build/test come from Nx's inferred `@nx/vite` + `@nx/vitest` plugins via `vite.config.mts`, not
custom executors).

## Goals / Non-Goals

**Goals:**
- Ship a host-agnostic `@epam/ai-dial-usage-dashboard` library rendering exactly the two aggregate
  cards (daily, monthly) shown in Figma node `503-41119`.
- Keep all DTO/unlimited-sentinel/threshold/formatting logic in `apps/chat`; the library receives a
  fully normalized, typed prop shape.
- Add per-request error visibility to `useUsageData` and wire deduplicated, localized notifications.
- Settle the 75% vs. 90% warning-threshold discrepancy between `Limits.tsx` and `UsageLimitsControl`
  explicitly for this new surface.

**Non-Goals:**
- The "By model" table (separate future change).
- Any backend/OpenAPI change, new endpoint, new React Context, polling, or caching change.
- Reconciling per-deployment spend against the global total, or implementing the page-level caption
  text shown in the full Figma frame (that caption describes the future per-model table, not these
  two cards).
- Refactoring `libs/catalog`'s `Limits.tsx` — it is read for behavioral reference only, not extracted.

## Decisions

### D1: New dedicated library over reusing `libs/catalog` or staying in `apps/chat`

Reusing `Limits.tsx` would require the new library to depend on `@epam/ai-dial-catalog` (a peer,
domain-specific package) purely to reach a private, non-exported component — violates the module
boundary rule for `type:ui` libs (import from `chat-shared` only,
`AGENTS.md` §Module boundary rules). Keeping the cards in `apps/chat` would work but forecloses the
future embed/reuse case the same way `settings-panel` was extracted. **Decision: new
`libs/usage-dashboard` library**, matching proven visual/status behavior (thresholds, unlimited
handling, `ProgressBar` usage) rather than importing it.

### D2: Library scaffolding — Nx generator vs. hand-copy of `settings-panel`

`libs/settings-panel` has no `project.json`; Nx 22's `@nx/vite/plugin` and `@nx/vitest` plugins
(registered in `nx.json`) infer `build`/`test`/`lint` targets straight from `vite.config.mts` +
`eslint.config.mjs`. The implementation task list requires running the actual generator
(`@nx/react:library` with `--bundler=vite --unitTestRunner=vitest --buildable`, exact flags TBD via
`--help`/dry-run — see tasks) rather than hand-copying files, so the scaffold matches whatever the
installed Nx/`@nx/react` version currently emits (peer-dep versions, ESLint config shape, etc.), then
adjust `package.json`'s `"nx".tags` to `["type:ui"]` and trim generated boilerplate (app.tsx demo
component, default styling) to match `settings-panel`'s shape. Package name
`@epam/ai-dial-usage-dashboard`, `"private": true`, peer deps `react`, `@epam/ai-dial-ui-kit`,
`@epam/ai-dial-chat-shared`.

### D3: Public API surface (final — see D13 for the revision that produced this shape)

```ts
// libs/usage-dashboard/src/models/usage-limit-card-props.ts
export enum UsageLimitStatus {
  Default = 'default',
  RunningLow = 'runningLow',
  LimitReached = 'limitReached',
}

/** One aggregate cost-budget card's fully normalized, preformatted data. */
export interface UsageLimitCardData {
  /** Card title, e.g. "Today" / "This week" / "This month". */
  title: string;
  /** Accessible description of the rolling window, e.g. "Last 24 hours" — not visible, but conveyed to assistive tech (see a11y). */
  periodDescription: string;
  /** Raw used amount (already clamped to `>= 0` by the app mapper). */
  used: number;
  /** Raw total amount. Ignored for rendering the ratio when `isUnlimited` is true. */
  total: number;
  /** Preformatted used amount, e.g. "$3.60". Always the card's prominent figure. */
  usedLabel: string;
  /** Preformatted total amount, e.g. "$4.00", used in the "used of $X" caption. Omitted when `isUnlimited`. */
  totalLabel?: string;
  /** Preformatted remaining amount, e.g. "$0.40", used in the "$X left" caption. Omitted when `isUnlimited`. */
  remainingLabel?: string;
  /** Whether the app mapper detected the unlimited sentinel (`total >= 2**53`) or the stat was missing/invalid. */
  isUnlimited?: boolean;
  /** Not pre-clamped — may exceed 100. Ignored when `isUnlimited`. */
  usedPercent?: number;
  /** Status the app mapper derived from `usedPercent` against the agreed thresholds (see D4). */
  status: UsageLimitStatus;
  /** Accessible value text for the progress bar (`aria-valuetext`), e.g. "$3.60 of $4.00, 90% used". */
  progressAriaLabel: string;
}

/** Localized, non-amount strings the card group needs that aren't part of a specific card's data. */
export interface UsageLimitCardGroupLabels {
  /** Badge text for `UsageLimitStatus.Default`, e.g. "Within limits" — every status shows a badge. */
  defaultBadgeLabel: string;
  /** Badge text for `UsageLimitStatus.RunningLow`, e.g. "Running low". */
  runningLowBadgeLabel: string;
  /** Badge text for `UsageLimitStatus.LimitReached`, e.g. "Limit reached". */
  limitReachedBadgeLabel: string;
  /** Caption next to the prominent used amount, e.g. `({ total }) => \`used of ${total}\`` . */
  usedOfTotalLabel: (params: { total: string }) => string;
  /** Caption below the progress bar, e.g. `({ remaining }) => \`${remaining} left\`` . */
  remainingCaptionLabel: (params: { remaining: string }) => string;
  /** Trailing progress-bar percent label, e.g. `({ percent }) => \`${percent}%\`` . */
  usedPercentLabel: (params: { percent: number }) => string;
}

export interface UsageLimitCardGroupColors { /* --uld-* CSS var overrides, see libs.md */ }
export interface UsageLimitCardGroupTypography { /* title/amount/badge class overrides */ }

export interface UsageLimitCardGroupProps {
  /** Cards to render, in display order. Each is its own independent, equally-sized box. Empty array renders nothing. */
  cards: UsageLimitCardData[];
  labels: UsageLimitCardGroupLabels;
  styles?: { colors?: UsageLimitCardGroupColors; typography?: UsageLimitCardGroupTypography };
}

export interface UsageLimitCardProps {
  data: UsageLimitCardData;
  labels: UsageLimitCardGroupLabels;
  styles?: { colors?: UsageLimitCardGroupColors; typography?: UsageLimitCardGroupTypography };
}
```

Exports from `libs/usage-dashboard/src/index.ts`: `UsageLimitCardGroup`, `UsageLimitCard`,
`UsageLimitStatus`, and every type above. `UsageLimitCard` has a legitimate standalone use (a
single-card degraded state when the mapper can only produce one card, or a future compact widget),
so both are exported per AGENTS.md's "smallest useful public API" guidance. `UsageLimitCardGroup`
maps `cards` to independent `UsageLimitCard` boxes in a CSS grid (mobile: 1 column; desktop: one
column per card, driven by a `--uld-card-count` CSS variable so the component supports any card
count without a fixed 2-card assumption).

Why not put `isUnlimited` derivation or percent math in the library: `UsageLimitCardData` already
carries pre-derived `status`/`usedPercent`/labels, so the library does zero DTO interpretation —
matching the "app-level DTO adapter" alternative chosen over "library computes from raw stats",
which would have required the library to know the `2**53` sentinel (an upstream/API-specific
constant, not presentation logic).

### D4: Warning threshold — 75% (revised from an initial 90%)

`Limits.tsx:50` already uses 75%; `UsageLimitsControl.tsx:37,112` uses 90%
(`USAGE_LIMIT_THRESHOLD_PERCENT`, a different surface's own threshold, left untouched). The first
implementation of this change matched `UsageLimitsControl`'s 90%, but the user explicitly corrected
this against the final design reference ("после 75% должен быть желтый... до 75 синий"/"after 75%
should be yellow... below 75 blue"). **Decision: 75%**, applied by the app-level mapper:
- `usedPercent < 75` → `UsageLimitStatus.Default` (blue, "within limits")
- `75 <= usedPercent < 100` → `UsageLimitStatus.RunningLow` (amber, "running low")
- `usedPercent >= 100` → `UsageLimitStatus.LimitReached` (red, "limit reached")

Exact boundaries (75.0% exactly, 100.0% exactly) are covered by dedicated tests.

### D5: Data-contract edge cases (app-mapper behavior)

Handled entirely in `apps/chat/src/utils/map-usage-data-to-dashboard.ts`, not the library:
- **Missing/invalid stat** (`undefined`, `used`/`total` not finite, negative `total`): that period
  is **omitted from the `cards` array entirely** — `UsageLimitCardGroup` then renders only the
  remaining, usable periods (its grid adapts to `cards.length`). This mirrors
  `isUsableLimitStats`/`shouldShowLimitStats` in `map-deployment-limits-to-catalog.ts:78-93`.
- **Negative `used`**: clamped to `0` before formatting (`Math.max(0, stats.used)`, matching
  `map-deployment-limits-to-catalog.ts:104`).
- **`used` over `total`** (finite case): `remaining = max(total - used, 0)` (never negative);
  the progress bar's visual fill clamps to 100%, but `usedPercent` itself is the true, uncapped
  ratio and `usedLabel` shows the true (unclamped) spend — the library must never imply spend is
  capped at 100% of the visible total.
- **Unlimited (`total >= 2**53`)**: mapper sets `isUnlimited: true`, omits `totalLabel`/
  `remainingLabel`/`usedPercent`, and forces `status: UsageLimitStatus.Default`; card shows
  `usedLabel` only, no progress bar, no "used of"/"left" captions. The badge still renders (every
  status shows one, per D13) reading `defaultBadgeLabel` ("Within limits") — an unlimited budget is
  always, definitionally, within limits.
- **NaN anywhere**: treated as invalid → same as "missing" above (period omitted).

### D6: `limits ?? usage` fallback for the aggregate fields

Per `openspec/specs/user-usage-limits-api/spec.md:41`, both endpoints report the **same** global
`dayCostStats`/`weekCostStats`/`monthCostStats` (they differ only in the per-deployment
`deployments` map, which these cards never read). **Decision:** the mapper reads
`(limits?.dayCostStats ?? usage?.dayCostStats)` and the weekly/monthly equivalents — i.e. prefer
`limits`, fall back to `usage`, for each field independently. This means if `/user/limits` fails but
`/user/usage` succeeds, the cards still render from `usage`'s copy of the same global figures, and
vice versa. This fallback is safe specifically because these are the same global aggregate, not
deployment-scoped data — do not generalize this pattern to per-deployment fields.

### D7: Per-request error state on `useUsageData`

Replace the single `error: Error | undefined` with:
```ts
export interface UseUsageDataResult {
  limits: UserLimitStatsResponseDto | undefined;
  usage: UserLimitStatsResponseDto | undefined;
  isLoading: boolean;
  limitsError: Error | undefined;
  usageError: Error | undefined;
}
```
`error` is removed (no consumer currently reads it outside `UsageTab`'s not-yet-written
integration, so this is not a breaking change to any shipped surface). Each field is set
independently per `Promise.allSettled` branch, preserving the existing cancelled-flag/unmount
handling (`useUsageData.ts:37,45,72-74`).

### D8: Notifications — one effect, two-way dedup

`UsageTab` owns a `useEffect` keyed on `[limitsError, usageError]` (mirroring the existing pattern at
`apps/chat/src/components/CatalogView/CatalogView.tsx:311-314`, which already relies on effect-
dependency identity as its dedup mechanism — `NotificationContext` itself has no dedup,
`apps/chat/src/context/NotificationContext.tsx:61-64`):
- Both `undefined` → no notification.
- Exactly one defined → `showErrorNotification({ message: t(UsageI18nKeys.PartialLoadError) })`,
  one notification.
- Both defined → a single `showErrorNotification({ message: t(UsageI18nKeys.FullLoadError) })`, not
  two.
- Because the effect is keyed on the `Error` object identities from state (not on every render), and
  `useUsageData` only calls `setState` once per fetch cycle (on mount, or when `enabled` flips true),
  the notification fires exactly once per failed fetch cycle — re-renders that don't change
  `limitsError`/`usageError` identity do not re-fire it.
- Neither notification includes the raw `Error.message` (which may echo upstream response text) —
  only the localized static copy.
- `showErrorNotification`'s underlying toast already renders through the app's existing
  `aria-live`/`role="alert"` notification surface (no new a11y plumbing needed here — the design
  doesn't introduce a new notification primitive, just a new call site).

### D9: Responsive layout (revised — see D13)

Each card is its own independent, equally-sized box (`bg-layer-raised`, rounded, own padding) — no
shared outer container and no divider between cards. Desktop: cards render side by side via CSS
grid, one column per card
(`desktop:grid-cols-[repeat(var(--uld-card-count),minmax(0,1fr))]`, with `--uld-card-count` set from
`cards.length`); this generalizes to any card count without a hard-coded 2- or 3-column class.
Mobile (`< desktop:` breakpoint): `grid-cols-1`, cards stack full-width. Implemented entirely with
Tailwind's `mobile:`/`desktop:` tags per AGENTS.md, no custom breakpoints, no `window.innerWidth`
reads — the library takes no layout input from the host beyond CSS cascade/`dir`. Because there is
no divider, there is no left/right logical-property concern for card boundaries; only the
individual card's own internal RTL behavior (badge position, caption alignment) still relies on
logical properties (`ms-auto`, etc.).

### D10: Currency

Per user decision: USD-only, app-formatted. The mapper uses the existing
`Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })`
pattern already established at `apps/chat/src/utils/map-deployment-limits-to-catalog.ts:72-76`, and
passes only the resulting strings (`usedLabel`/`totalLabel`/`remainingLabel`) into the library. The
library never imports `Intl`-currency logic itself and takes no `currency` prop — if a future change
needs multi-currency, that's a new mapper concern, not a library API change, since the library
already treats amounts as opaque preformatted strings plus a raw `number` (used only for the
progress-bar's numeric `value`/`aria-valuenow`).

### D11: Unlimited card visibility

Per user decision: render as "Unlimited" (not omitted). Matches D5.

### D12: Page header (title + description)

The Figma frame shows a page-level header above the cards: a bold "Usage" title and a one-line
description ("Cost, tokens and requests are metered independently — each can carry its own limit
per day, week and month."). This is page chrome, not card data, so it is implemented directly in
`UsageTab` (`apps/chat`) with two new `UsageI18nKeys` entries — it does not touch
`libs/usage-dashboard`, since the library's contract is the cards only.

`SettingsPage.tsx` already renders the page's sole `<h1>` (`sr-only`, `BasicI18nKeys.Settings`).
**Decision:** the Usage header's title is an `<h2>`, sized with the design's prominent scale-class
(`dial-h1-text`) so it visually matches the Figma weight without creating a second `<h1>` on the
page — consistent with `.claude/rules/a11y.md`'s heading-structure guidance ("a panel's title bar
should render as `<h1>` ... or the appropriate level for its nesting"). The header renders
unconditionally (not gated on `isLoading`), matching the design where only the cards region shows a
loading state.

### D13: Redesign to three cards with an independent-box layout (supersedes D3/D9's original shapes)

After the first implementation shipped (two cards — Daily/Monthly — sharing one raised container
with a logical divider, remaining-amount as the prominent figure, badge hidden for the default
status), the user supplied a more complete design reference showing three independent cards
("Today" / "This week" / "This month"), each its own rounded box with no shared container or
divider, an **always-visible** status badge (including a "Within limits" badge for the default
status), and the **used amount** — not the remaining amount — as the prominent figure, with
"used of $X" next to it and "$Y left" / "Z%" captions below the progress bar.

**Decision:** adopt the new reference as authoritative and rework the library, mapper, and
`UsageTab` accordingly, rather than keeping the two designs side by side behind a flag — the first
screenshot was an earlier, less complete iteration of the same feature, not a deliberately distinct
mode. Concretely:
- **Three periods, not two.** `dayCostStats`/`weekCostStats`/`monthCostStats` are all read from the
  same top-level `UserLimitStatsResponseDto` shape (`weekCostStats` was already documented in
  `openspec/specs/user-usage-limits-api/spec.md`'s example response but out of this change's
  original scope). Card titles/period text: "Today"/"Last 24 hours",
  "This week"/"Last 7 days", "This month"/"Last 30 days".
- **`UsageLimitCardGroupProps.daily`/`.monthly` → `cards: UsageLimitCardData[]`.** An array
  generalizes to any number of periods and removes the special-cased "one vs. two provided" branch
  the discrete-prop shape needed; the mapper now simply omits unusable periods from the array
  (see D5) instead of returning a partial object.
- **No shared container/divider.** Each card owns its own background (`--uld-card-bg`, previously
  the group's `--uld-container-bg`) and rounded corners. The group is now just a responsive grid
  (`grid-cols-1` mobile, `desktop:grid-cols-[repeat(var(--uld-card-count),minmax(0,1fr))]`) — no
  `UsageLimitCardGroup`-level CSS module is needed any more (moved the one color var it owned onto
  the card).
- **Badge always visible.** `UsageLimitStatus.Default` gains a badge label
  (`defaultBadgeLabel`, "Within limits", new `--uld-default-badge-*` color vars — see D14 for the
  corrected token values). The earlier "no badge for Default" behavior is removed.
- **Prominent figure flips from remaining to used.** `usedLabel` is now always shown prominently;
  `totalLabel` feeds a new `usedOfTotalLabel` caption ("used of $4.00") next to it, and
  `remainingLabel` feeds a new `remainingCaptionLabel` caption ("$0.40 left") below the progress
  bar alongside the (reworded, "%"-only) `usedPercentLabel`. `scopeLabel` ("All models") is dropped
  from the model entirely — the new design has no visible subtitle row, and per `libs.md`'s "every
  declared prop must be read" rule an unrendered field should not exist on the public API.
- **Temp mock (§ separate, non-spec change)** — `usage-tab-temp-mock.ts`'s stand-in data was
  extended with a `weekCostStats` entry to match; this file remains outside the OpenSpec artifacts
  since it is an explicitly temporary, to-be-deleted workaround for the backend currently returning
  502, not a designed capability.

### D14: Visible-percent clamp and exact color-token correction (pixel-precision pass against the exported Figma CSS)

Two further corrections against the same Figma export used for D13:

**Visible percent is capped at 100.** The card's trailing `%` caption previously showed the real,
uncapped `usedPercent` (e.g. `137%`) to match the progress-bar's `aria-valuetext`. The user
confirmed the *visible* number must never exceed 100 — a percentage over 100 reads as broken to an
end user, even though the underlying spend can exceed the total. **Decision:** the library clamps
only the visible label (`Math.min(Math.round(data.usedPercent), 100)`); `progressAriaLabel` (and
therefore `aria-valuetext`) still carries the true, uncapped percentage, so a screen-reader user
still gets the real figure. `usedPercent` itself stays uncapped on `UsageLimitCardData` — the app
mapper's contract (D5) doesn't change, only where the display-time clamp happens.

**Exact color tokens, not approximated hex.** D13's first pass invented plausible-looking hex
fallbacks (`#d1f0dc`/`#059669` for the "within limits" badge, a single shade for each status's
text *and* bar) without checking the repo's actual token set. The user supplied the Figma CSS
directly, which let every color be matched to an exact existing token in the **root**
`tailwind.config.js` (not the `@epam/ai-dial-ui-kit` package's own theming vars, which is a
narrower set — the app's root config layers additional semantic tokens on top, and libs inherit
them via `tailwind.config.js`'s `presets: [require('../../tailwind.config.js')]`):

| Status | Text (amount + badge) | Progress-bar fill | Badge background |
| --- | --- | --- | --- |
| Default ("within limits") | `--text-info` `#1D4ED8` | `--text-control-blue-hover` `#5976E9` | `--bg-success` `#DBF1EB` (badge text: `--text-success` `#007274`) |
| RunningLow | `--text-warning` `#7F6300` | `--text-warning-icon` `#EEC840` | `--bg-warning` `#FAF0CF` |
| LimitReached | `--text-error` `#AE2F2F` | `--bg-control-error-active` `#CC4545` | `--bg-error` `#F3D6D8` |

Each status's text and bar-fill tokens are deliberately different shades of the same hue (confirmed
directly from the Figma export, e.g. `This week`'s `$11.20` figure is `#1D4ED8` while its bar fill
is `#5976E9`) — the brighter/lighter token works as a decorative fill but would fail text contrast,
so text always uses the darker token. Note the **badge** colors follow the status's semantic
family (warning/success/error), not the accent hue — a `Default`/"within limits" card's *figure* is
blue but its *badge* is green, matching the Figma export exactly. Added `defaultProgressColor` and
`errorProgressColor` to `UsageLimitCardGroupColors` to complete the text/bar split for all three
statuses (`warningProgressColor` already existed from D13).

## Risks / Trade-offs

- **[Risk]** The full Figma frame's page-level caption ("Per-model figures below sum to the totals…")
  contradicts the documented non-reconciliation between per-deployment and global cost stats
  (`openspec/specs/user-usage-limits-api/spec.md:41`). → **Mitigation:** that caption belongs to the
  future per-model-table change (explicitly out of scope here); this change does not implement any
  page-level copy that claims reconciliation. Flagged as an open question below for whoever scopes
  that follow-up.
- **[Risk]** Removing `UseUsageDataResult.error` is a signature change to an already-merged hook. →
  **Mitigation:** confirmed via grep that no code outside `useUsageData.ts` itself and its spec
  currently reads `.error`; `UsageTab` (the only consumer) is rewritten in this same change.
- **[Risk]** `limits ?? usage` fallback could mask a real difference if the two endpoints ever
  diverge in the global fields (they're not contractually guaranteed identical, only documented as
  representing "the caller's global cost budget" from both). → **Mitigation:** documented as a
  deliberate, narrow exception in D6; per-deployment data is never merged this way.
- **[Trade-off]** Scaffolding via a fresh Nx generator run (D2) instead of copying `settings-panel`
  means the new lib's generated ESLint/TS config may differ slightly from `settings-panel`'s (Nx/
  `@nx/react` version drift). → Accepted: tasks include diffing the generated config against
  `settings-panel` and reconciling anything that would make the new lib inconsistent (e.g. tags,
  externals list).

## Open Questions

- Should the future per-model-table change revise the page-level caption to avoid implying
  reconciliation, or intentionally keep "sums to the totals" as a simplification for end users? (Not
  blocking this change; flagged for that change's proposal.)
- Exact Nx generator invocation and flags are resolved in tasks.md via `--help`/dry-run rather than
  guessed here, per AGENTS.md's "never guess CLI flags" rule.

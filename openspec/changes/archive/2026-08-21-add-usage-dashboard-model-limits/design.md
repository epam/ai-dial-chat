## Context

The Usage page (`apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`) already renders three
aggregate cost-limit cards via `useUsageData()` → `mapUsageDataToDashboard()` →
`UsageLimitCardGroup` (`@epam/ai-dial-usage-dashboard`). `useUsageData` already fetches
`GET /api/v1/user/limits` and `GET /api/v1/user/usage` (→ `usage: UserLimitStatsResponseDto`,
including `usage.deployments: Record<string, DeploymentLimitsResponseDto>`) on mount. **This change
needs no new endpoint call** — `usage.deployments` already carries the full set of Cost/Token/
Request stat fields this table needs, for every deployment the caller has actually used.

**Data-source correction (superseding an earlier draft of this design)**: the original design read
`limits.deployments` instead, reasoning from `openspec/specs/user-usage-limits-api/spec.md:26,80`
that only `GET /api/v1/user/limits` guarantees every accessible model (including zero-usage ones),
while `usage.deployments` is restricted to the trailing 30 days. That guarantee is real, but
confirmed against actual production payloads, `usage.deployments` is what the table should read: it
already contains the exact same per-deployment stat shape (`day`/`week`/`month` Cost/Token stats,
`hour`/`day` Request stats) for every model the caller has meaningfully interacted with, without
needing to reconcile two per-deployment sources. The accepted trade-off is that a model the caller
has never used will not appear as a zero-usage row — see the updated "Zero-usage" scenario in the
`usage-model-limits` spec.

The design adds a per-model "Model limits" table below the existing cards, reusing this same
already-fetched `usage` payload, joined with model identity from the existing `DeploymentsContext`
(`apps/chat/src/context/DeploymentsContext.tsx:37-93`, `useDeployments().items: DeploymentItemDto[]`).

## Goals / Non-Goals

**Goals:**
- Render one row per accessible model (`DeploymentItemDtoTypeEnum.Model`) with cost/tokens/requests/status,
  entirely from data already in memory (no new fetch, no new endpoint).
- Keep `libs/usage-dashboard` host-agnostic per the existing `usage-dashboard-lib` capability:
  the new section takes normalized rows and a controlled period, and knows nothing about Core DTOs,
  the `2**53` sentinel, or `apps/chat`'s deployment/model contexts.
- Reuse existing shared building blocks (`DeploymentIcon`/`InitialsAvatar` from `chat-shared`,
  `ProgressBar` from ui-kit) instead of duplicating them or reaching into `libs/catalog`.

**Non-Goals** (carried from proposal, restated for design scope):
- No backend/OpenAPI/generated-client changes; no new endpoint.
- No invented weekly/monthly per-model request statistics or finite per-model cost budgets — the
  upstream contract does not provide them (`openspec/specs/user-usage-limits-api/spec.md:54`: "its
  `total` is always the unlimited sentinel").
- No changes to `UsageLimitCardGroup`/`UsageLimitCard`'s existing behavior or to the
  `usage-data-hook` capability's fetch/notification contract — this feature is a pure consumer of
  data that capability already produces.
- No search/sort/filter/pagination on the table; no changes to `libs/catalog`.

## Decisions

### 1. Extend `usage-dashboard-lib`; do not touch `libs/catalog`, do not extract a new shared lib

Four options were compared, per the proposal's "Existing reuse candidates" requirement:

| # | Option | Verdict |
|---|--------|---------|
| 1 | Extend `usage-dashboard-lib` with new normalized types/components | **Selected** |
| 2 | Extract a new generic "metric progress" primitive into a shared location | Rejected — no second consumer exists today |
| 3 | Reimplement the small amount of presentation logic, reusing ui-kit `ProgressBar` | Folded into #1 (this *is* what #1 does) |
| 4 | Import/extend `libs/catalog`'s `LimitsTab` directly | Rejected |

`libs/catalog/src/components/Details/TabsContent/Limits.tsx` (252 lines) is architecturally the
closest existing implementation — status thresholds (`Limits.tsx:39-54`, warning at ratio `>= 0.75`,
danger at `>= 1`), unlimited detection (`Limits.tsx:29-33`, trusts a pre-mapped `row.isUnlimited`
boolean), and `ProgressBar` usage (`Limits.tsx:148-201`) are all patterns worth *copying the idea
of*, but the component itself is not reusable as-is:
- It is tagged `"publishable"` (`libs/catalog/package.json:29-32`) and pulls in `ag-grid-community`,
  `@epam/ai-dial-publish-panel`, `@tabler/icons-react` as peer deps — heavy baggage for a lean
  `type:ui` lib whose only current peers are `react`, `@epam/ai-dial-ui-kit`, and
  `@epam/ai-dial-chat-shared` (`libs/usage-dashboard/package.json:20-24`).
- Its data model (`UsageLimitProgressRow`, `libs/catalog/src/models/item-details-data.ts:66-83`) is
  a single flat row per *stat line* (e.g. one row per `dayTokenStats`), not a table with distinct
  Cost/Tokens/Requests columns per model and a computed overall row status — the shape this feature
  needs is different enough that adapting it would mean rewriting most of the component anyway.
- The root `eslint.config.mjs:42-47` module-boundary `depConstraints` are currently a wildcard
  (`sourceTag: '*' → onlyDependOnLibsWithTags: ['*']`), so lint would not catch a `catalog` →
  `usage-dashboard` import today — but the repo's `AGENTS.md` "Library isolation" section and this
  change's own goal of keeping `usage-dashboard` lean make it the wrong call regardless of what lint
  currently permits. Confirming this with `npm exec nx lint usage-dashboard` after implementation is
  still a task (nothing here should regress once the constraint is tightened later).

Extracting a shared "metric progress" primitive (option 2) is rejected for the same reason
`usage-dashboard-lib`'s own spec already gives for not sharing `UsageLimitCard` more broadly: a
one-off extraction with a single consumer is speculative generalization. If `libs/catalog`'s
`LimitsTab` and the new Model-limits table converge on a third near-identical need later, that is
the point to extract, not now.

### 2. Model avatar: reuse `DeploymentIcon` (+ `InitialsAvatar`) from `chat-shared`, not `catalog`'s `AppIdentity`

`libs/catalog/src/components/AppIdentity/AppIdentity.tsx` is the closest existing "avatar + type +
name + version" composite (props at `AppIdentity.tsx:13-38`: `icon?`, `type`, `name`, `version?`,
`size`, …), but it lives in `catalog` and pulls in the same heavy peer deps rejected in Decision 1.

Its actual avatar rendering is composed from `DeploymentIcon` (`AppIdentity.tsx:78-88`), which lives
in `libs/chat-shared` — **already a peer/runtime dependency of `usage-dashboard`**
(`libs/usage-dashboard/package.json:20-24`) and exported from `chat-shared`'s public barrel
(`libs/chat-shared/src/index.ts:35`). `DeploymentIcon` (`libs/chat-shared/src/components/DeploymentIcon/DeploymentIcon.tsx:28-38`)
takes `src?`, `size`, `initialsName`, an optional `fallback`, and falls back to `InitialsAvatar`
(same lib) when no image loads. Both are host-agnostic — no i18n, no server-api, no app context.

**Decision**: the new row's avatar renders `DeploymentIcon` directly (size per design, `initialsName`
= the row's display name), with the name/version/type text composed locally in the new
`ModelLimitRow` presentation component using the library's own typography-class props (per
`openspec/lib-styling-guide.md`), instead of importing `AppIdentity`. This gets the exact visual
building block the design calls for without pulling `catalog`'s dependency chain into
`usage-dashboard`.

### 3. Period selector: `DialSegmentedControl` (1.0), not `Tabs` (2.0)

Per the ui-kit MCP lookup: `Tabs` (2.0) exists but its semantics are "tab panels" navigation
(`getEntityDetails("component","Tabs")`: "renders the tabs only; the panels stay with the
consumer", ARIA tabs pattern). `DialSegmentedControl` (1.0) has **no 2.0 replacement listed** in the
MCP search result ("Use instead" column empty) and its description — "a single-select control for
switching between a small set of mutually exclusive, equally-sized options" — matches the design's
visual segmented control exactly. Per `AGENTS.md`/`all-tsx.md`, a `Dial*` (1.0) component is
acceptable specifically when the MCP lookup shows no 2.0 equivalent.

**Decision**: use `DialSegmentedControl` for the three-option period selector (Last 24 hours / Last
7 days / Last 30 days), rendered inside the library and driven by the controlled
`period`/`onPeriodChange` props specified in the proposal. Its options carry the localized period
labels from the host via `labels`.

### 4. Table markup: an ARIA grid built from `div`s laid out with CSS Grid, not a native `<table>`

A native `<table>` cannot reflow into a stacked mobile card layout with CSS alone (the requirement:
"no horizontal page overflow at 360px … maintains information parity … uses CSS layout unless
separate mounted subtrees are genuinely necessary"). Two mounted subtrees (a `<table>` for desktop, a
card list for mobile) would violate "genuinely necessary" — the structural content is identical,
only the layout direction changes.

**Decision**: implement one `role="table"` tree (`role="rowgroup"`, `role="row"`,
`role="columnheader"`, `role="cell"` on plain `div`s), laid out as a 5-column CSS Grid on
`desktop:` and as a single-column stacked grid on the mobile-first base styles, where each mobile
row repeats the column's accessible label inline (e.g. a small "Cost" caption above the cost cell)
so information parity holds without a second component tree. This mirrors the existing
`UsageLimitCardGroup` desktop/mobile split (`libs/usage-dashboard/src/components/UsageLimitCardGroup/UsageLimitCardGroup.tsx:16-19`,
a `--uld-card-count`-driven grid), generalized from "N equal cards" to "N rows, 5 columns."

### 5. Status threshold: 75%, matching both existing repo conventions

Two independent existing implementations already use 75% as the "running low" boundary:
`libs/catalog/src/components/Details/TabsContent/Limits.tsx:45-54` (`ratio >= 0.75` → `Warning`) and
`apps/chat/src/utils/map-usage-data-to-dashboard.ts:15,29-36`
(`RUNNING_LOW_THRESHOLD_PERCENT = 75`). This is not "copying the aggregate-card threshold
automatically" in the sense the proposal warns against — it is picking the value the rest of the
codebase already treats as this product's definition of "running low" for a usage/limits ratio, for
two independent features. The screenshot's "$10 / $12" (≈83%) row being labeled "Running low" is
consistent with a 75% threshold (83% > 75%) and does not contradict it. **Confirmed by product**:
75% is the final threshold, matching this decision and the delta specs' scenario numbers as written
— no further sign-off needed on this point.

### 6. Cost column: attributed spend + "No limit" only, never a progress bar or finite status

Per `openspec/specs/user-usage-limits-api/spec.md:54` ("per-deployment cost is separately attributed
spend against no per-deployment cap — its `total` is always the unlimited sentinel"), the per-model
cost metric is always rendered as the `Unlimited` cell kind: an attributed-spend used value plus "No
limit", never a progress bar, never contributing a finite status to the row. This is a **data
contract fact**, not a UI choice — there is no code path in which a finite per-model cost total can
appear under the current backend contract. If per-model cost budgets are ever added upstream, that
is a new capability, not a fallback to invent here.

### 7. Weekly/monthly requests: explicit "Not available", never "No limit"

`LimitStatsDto` has no `weekRequestStats`/`monthRequestStats` fields
(`openspec/specs/user-usage-limits-api/spec.md:28-50` example response — only `hourRequestStats`,
`dayRequestStats` exist). For `Last 7 days`/`Last 30 days`, the Requests cell renders the
`Unavailable` cell kind (distinct from `Unlimited`) with a localized "Not available" string and an
accessible explanation — never silently reusing `dayRequestStats`, and never rendered identically to
"No limit" (the proposal is explicit that these must be visually and semantically distinct). This
metric is excluded from status calculation per the `Unavailable`-metrics rule.

### 8. Formatting: plain localized numbers, no compact notation, for this iteration

The repo has no existing `notation: 'compact'` usage anywhere (verified by search) and four already
near-duplicate cost/number formatters
(`apps/chat/src/utils/map-usage-data-to-dashboard.ts:18-22`,
`apps/chat/src/utils/map-deployment-limits-to-catalog.ts:68-76`,
`apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx:39-41`,
`libs/catalog/src/components/Details/TabsContent/Limits.tsx:21-23`). Introducing a fifth ad hoc
formatter with a new compact-notation mode is scope creep for this change and doubles the
accessible-label testing surface (compact visible text + separate full accessible text) for a
behavior the screenshot does not clearly require (only cost values are shown, at `$10 / $12` scale).

**Decision**: format tokens/requests with grouped, non-compact `Intl.NumberFormat` (`used / total`,
e.g. `12,345 / 50,000`), matching every existing formatter's style, and use the same currency
formatting pattern as `map-usage-data-to-dashboard.ts` for cost. Compact notation is deferred; see
Open Questions. The four-formatter duplication itself is called out as a candidate for a future,
separate cleanup — not folded into this change per the proposal's non-goal "no unrelated catalog
refactoring."

### 9. Period state ownership and re-derivation, not refetch

The selected period is `useState` inside `UsageTab` (no new context — matches the "React Context +
custom hooks" state convention and the proposal's explicit "no new React Context" non-goal).
Changing it only changes which `*Stats` field the adapter reads off the *already-fetched*
`usage.deployments` map; `useUsageData` is untouched and is not re-invoked. This is why
`usage-data-hook` is **not** a modified capability for this change — its fetch/error/notification
contract is consumed as-is.

### 10. New capability, not a new `usage-data-hook` requirement

The new `usage-model-limits` capability owns: the period `useState`, the DTO+metadata adapter
(`apps/chat/src/utils/`, new file), and the `UsageTab` integration point (rendering the new section
below `UsageLimitCardGroup`). `usage-data-hook`'s existing requirement ("Usage tab renders the
aggregate limit cards") is not modified — it remains true; the tab now also renders more content
below what that requirement already describes. Reusing the existing "Deduplicated error
notifications" requirement means the new section shows **no notification of its own**: a
`usageError` already produces exactly one notification per the existing contract, and since the
model-limits table's only data source is the same `usage` fetch, no second failure signal exists to
notify about.

### 11. Row set and order come from `usage.deployments` alone, not from `items`

An earlier version of the adapter ordered rows by `items`' (catalog) order first, appending any
`usage.deployments` entry absent from `items` afterward — reasoning that the catalog's own
accessible-model ordering was the more "natural" order to show. Confirmed against real payloads,
this was the wrong call for two reasons: (1) it made row order depend on whether
`useDeployments().items` had finished loading yet — before it loads, every row falls into the
"absent from items" bucket in `usage.deployments` key order, then re-shuffles into catalog order
once `items` arrives, a visible reflow the user should never see; and (2) the table's purpose is to
show exactly what `usage.deployments` reports, nothing more and nothing less — `items` should only
ever *enrich* a row (name/version/avatar), never decide whether it exists or where it sits.

**Decision**: row set and order are `Object.keys(usage.deployments)`, full stop. `items` is
consulted per-ID only to look up display metadata for a matched row.

### 12. Period set expanded from three to five: Last minute / Last hour added

The original design deliberately restricted the selector to Last 24 hours / Last 7 days / Last 30
days, reasoning that the upstream contract's actual granularities (minute/hour/day/week/month
across the three metric families) didn't need full exposure. Confirmed against real production
payloads, this was too conservative: `minuteTokenStats`/`minuteCostStats` carry real, non-sentinel
per-model limits (e.g. `minuteTokenStats: { total: 10000, used: 0 }`) that a caller may genuinely
want to watch, and `hourRequestStats` is the *only* sub-day granularity the Requests family has at
all — omitting it means the table never shows a request rate limit tighter than "per day," even
when one exists.

**Decision**: extend `ModelLimitsPeriod` to five values — `LastMinute`, `LastHour`, `Last24Hours`,
`Last7Days`, `Last30Days`, in that order in the selector. Extend `PeriodFieldMapping`'s `cost` and
`tokens` keys to optional (mirroring the pre-existing optional `requests` key from Decision 7), so
a period with no field for a given metric family renders that cell `Unavailable` via the same
mechanism already used for Requests on `Last7Days`/`Last30Days`:

| Period | Cost | Tokens | Requests |
|---|---|---|---|
| `LastMinute` | `minuteCostStats` | `minuteTokenStats` | *(none — Unavailable)* |
| `LastHour` | *(none — Unavailable)* | *(none — Unavailable)* | `hourRequestStats` |
| `Last24Hours` | `dayCostStats` | `dayTokenStats` | `dayRequestStats` |
| `Last7Days` | `weekCostStats` | `weekTokenStats` | *(none — Unavailable)* |
| `Last30Days` | `monthCostStats` | `monthTokenStats` | *(none — Unavailable)* |

`LastHour` is a genuine edge case where two of three columns are always `Unavailable` for every
row — accepted deliberately, since Requests has no other sub-day option and inventing one would
violate the "never invent data the backend doesn't provide" non-goal.

### 13. Drop the `limits` fetch from `useUsageData` entirely

`useUsageData` previously called both `getUserLimits()` and `getUserUsage()` via
`Promise.allSettled`, using `limits` for the aggregate cards' top-level cost fields (with a
`limits ?? usage` fallback) and, in an earlier draft, for the model-limits table. Once the
model-limits table moved to `usage.deployments` (Context above), the only remaining reason to call
`getUserLimits()` was the aggregate cards' global cost budget. Confirmed against real production
payloads, `GET /api/v1/user/usage`'s top-level `dayCostStats`/`weekCostStats`/`monthCostStats` carry
that same real global budget — the `user-usage-limits-api` capability already documents these as
"identical field names and semantics" to `GET /api/v1/user/limits`'s top-level fields. The `limits`
fetch was therefore fetching data the page never actually needed a second copy of.

**Decision**: `useUsageData` now calls only `getUserUsage()`. `UseUsageDataResult` drops
`limits`/`limitsError`; `map-usage-data-to-dashboard.ts` drops its `limits` parameter and the
`limits ?? usage` fallback, reading every field from `usage` directly. This is a modification to
the already-shipped `usage-data-hook` capability (see its delta spec), not a new capability —
the hook's *shape* changes, but its role (fetch on mount, expose loading/error state, deduplicate
notifications) does not. The previous partial-vs-full-failure notification distinction collapses to
a single failure mode, since there is now only one fetch that can fail. `apps/chat/src/server-api/user-limits.ts`'s
`getUserLimits()` wrapper is left in place, unused, per that capability's own "wrapper functions
MAY be unused" allowance — removing it is out of scope here and would be premature if a future
feature needs the full-catalog guarantee `limits.deployments` provides.

## Risks / Trade-offs

- **[Trade-off] Selecting "Last hour" shows Cost and Tokens as `Unavailable` for every row** —
  there is no `hour`-granularity field for either metric family upstream → *Mitigation*: this is
  accepted per Decision 12; the alternative (omitting "Last hour" entirely) would hide the only
  sub-day Requests figure the contract offers, which is worse. If product feedback shows this reads
  as broken rather than intentional, revisit by pairing the period label with a short explanatory
  caption — not by inventing hourly Cost/Token data.
- **[Risk] A model the caller has never used will not appear as a zero-usage row**, since
  `usage.deployments` (unlike `limits.deployments`) is restricted to the trailing 30 days
  (`openspec/specs/user-usage-limits-api/spec.md:80`) → *Mitigation*: this is an accepted trade-off
  from the data-source correction described in Context above, not a bug — the table's purpose is to
  show consumption for models the caller actually exercises, and re-adding `limits.deployments` as a
  fallback source would reconstitute the two-source reconciliation problem this correction removed.
- **[Risk] Joining `usage.deployments` (keyed by deployment ID) against `DeploymentsContext.items`
  can miss metadata for IDs that exist in one source but not the other** (e.g. a model deployment
  that was removed from the catalog list but still has historical usage data) → *Mitigation*: per
  the proposal, render the raw deployment ID with a generic/fallback avatar (`DeploymentIcon` with no
  `src`, `initialsName` = the ID) rather than dropping the row; this is directly testable.
- **[Risk] `useDeployments().items` includes non-model types (`Application`, `Toolset`)** → the
  adapter must filter to `type === DeploymentItemDtoTypeEnum.Model` before joining, otherwise applications
  with matching IDs (unlikely, but IDs are DIAL Core–wide) could be mis-joined → *Mitigation*: filter
  explicitly and cover it with a test ("only models, never applications/toolsets" — restating the
  existing `user-usage-limits-api` guarantee that `deployments` itself is model-only, defensively, on
  the join side too).
- **[Risk] `DeploymentItemDto.displayName` is `LocalizedText` (`string | Record<string, string>`),
  not a plain string** → rendering it directly as `row.name` would show a raw locale-map object for
  deployments with per-locale translations → *Mitigation*: resolve it the same way
  `DeploymentsContext.tsx:109-130` already does — `resolveLocalizedText(item.displayName,
  activeLocale) || item.id` — inside the adapter, using `useLanguage().language` as `activeLocale`.
- **[Risk] `ModelLimitStatus` naming collides conceptually with the existing `UsageLimitStatus`**
  (different value sets: `WithinLimits/RunningLow/LimitReached/NoLimit/Unavailable` vs
  `Default/RunningLow/LimitReached`) → *Mitigation*: keep them as two distinct exported enums (the
  card group's aggregate status and the model-limits row status are genuinely different domains —
  the row status has two states the card status does not need, `NoLimit` and `Unavailable`); document
  the distinction in the README so callers don't conflate them.
- **[Risk] The ARIA-grid-via-divs table pattern (Decision 4) is more implementation and testing
  surface than a native `<table>`** → *Mitigation*: this is a one-time cost paid once for the
  section; the responsive-design skill's established mobile-first patterns (`useBreakpoint`-free CSS
  reflow) apply directly, and role/label assertions are straightforward RTL queries.
- **[Trade-off] Not implementing compact number notation now (Decision 8) means very large token
  totals render as long grouped numbers** (e.g. `4,500,000 / 10,000,000`) rather than `4.5M / 10M`.
  Accepted for this iteration; flagged as an open question rather than silently decided against.

## Migration Plan

Purely additive — no data migration, no flag-gated rollout beyond the existing
`settingsPageEnabled` feature flag the Usage tab already sits behind
(`apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx:13`,
`useFeatureFlag('settingsPageEnabled')`). Rollback is a revert of the `UsageTab` integration point
and the library export additions; the existing aggregate-cards behavior is untouched and needs no
rollback of its own. No backend coordination is required since no endpoint changes.

## Open Questions

1. ~~**Running-low threshold**~~ — **Resolved: 75%**, confirmed by product. Matches Decision 5 and
   the delta specs' scenario numbers as written; no change needed.
2. **Compact token/request notation**: confirm whether `900K / 1.0M`-style compact display is
   required for this iteration, or whether plain grouped numbers (Decision 8) are acceptable for now.
3. **Mobile presentation**: confirm the stacked-card-with-inline-column-labels approach (Decision 4)
   matches product's intended mobile design, since the supplied screenshot is desktop-only.
4. **Formatter consolidation**: the four independent cost/number formatters (Decision 8) are a
   candidate for a follow-up cleanup change — confirm this is out of scope here (per the proposal's
   non-goals) rather than bundled in.

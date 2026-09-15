## Why

DIAL Core now returns a `resetsAt` timestamp on every day/week/month cost and token stat, and those
timestamps expose the fact that the periods are **calendar** windows with UTC boundaries
(`2026-09-16T00:00:00Z`, `2026-09-21T00:00:00Z`, `2026-10-01T00:00:00Z`) — not the rolling windows
Settings → Usage has always claimed. Today the tab labels them "Last 24 hours", "Last 7 days" and
"Last 30 days", the DTO does not carry `resetsAt` at all, and a user who hits a limit is told
"Models can't be used until it resets" with no way to learn when that is.

## What Changes

- **BREAKING (user-facing copy):** replace the rolling-window labels in Settings → Usage — "Last 24
  hours" / "Last 7 days" / "Last 30 days" — with calendar-period wording, and drop the "rolling"
  vocabulary from DTO descriptions, prop JSDoc, READMEs and `docs/architecture.md`. The
  `ModelLimitPeriodStatuses` / `ModelLimitRow` property names `last24Hours` / `last7Days` /
  `last30Days` are renamed to `day` / `week` / `month` across `@epam/ai-dial-usage-dashboard`'s
  public API, which is a **BREAKING** change for any external consumer of that package.
- Add an optional `resetsAt` (ISO-8601 UTC instant) to the backend `LimitStatsDto`, mirrored into the
  regenerated `@epam/ai-dial-chat-api-client`. The BFF keeps passing Core's payload through
  unmodified — no server-side parsing, normalization, or synthesis of reset boundaries.
- Render reset times on the three aggregate cost cards and in the Model limits period headers,
  formatted from Core's timestamp in the viewer's locale and timezone with an explicit timezone
  label, never derived from the browser's own calendar arithmetic.
- Re-fetch `GET /api/v1/user/usage` when the earliest displayed reset boundary passes while the tab
  is open, so post-reset figures always come from a fresh Core response. Usage is never locally
  zeroed and limits are never locally restored.
- Define behaviour for absent, unparseable, already-past, and mutually-inconsistent `resetsAt`
  values: the reset affordance degrades to nothing, and the rest of the card renders as it does now.
- Preserve every existing invariant: field mapping, the `>= 2^53` unlimited sentinel, status
  thresholds, and the per-deployment "attributed spend, no cap" cost treatment — while making the
  per-deployment cost path tolerate a genuinely finite `total` rather than assuming it away.
- Keep all DTO interpretation in `apps/chat` adapters; `libs/usage-dashboard` receives only
  preformatted display strings and never sees a raw timestamp, `Intl` call, or timezone.

## Capabilities

### New Capabilities

- `usage-period-reset-times`: the `resetsAt` contract end to end — DTO field and semantics,
  calendar-period (not rolling) meaning, normalization at the app edge, localized display with an
  explicit timezone, degradation rules for missing/invalid/stale timestamps, and boundary-triggered
  re-fetch.

### Modified Capabilities

- `user-usage-limits-api`: `LimitStatsDto` gains an optional `resetsAt`; the documented period
  semantics change from trailing/rolling windows to calendar day/week/month with UTC boundaries.
- `usage-dashboard-lib`: `UsageLimitCardData` and `ModelLimitPeriodStatus` gain optional
  preformatted reset-label fields; the fixed period property names change from
  `last24Hours`/`last7Days`/`last30Days` to `day`/`week`/`month`, with matching label props.
- `usage-model-limits`: the period-to-field mapping and its column labels are restated in calendar
  terms; per-deployment cost stops being defined as *always* unlimited and becomes
  sentinel-detected like every other metric.
- `usage-data-hook`: `useUsageData` gains a caller-driven re-fetch trigger so the Usage tab can
  request fresh data when a reset boundary elapses.

## Impact

**Backend** — `apps/chat-api/src/openapi/openapi-response.dto.ts` (`LimitStatsDto` + the four
top-level `*CostStats` descriptions), `apps/chat-api/src/deployments/user-limits.controller.ts`
(`@ApiOperation` descriptions), and `apps/chat-api/src/deployments/tests/user-limits.controller.integration.spec.ts`.

**Generated client** — `libs/chat-api-client/openapi.json` and `src/generated/**` via
`npm run openapi` + `npm run openapi:check`.

**Libraries** — `libs/usage-dashboard` (`models/usage-limit-card-props.ts`,
`models/model-limits-props.ts`, `utils/map-usage-data-to-dashboard.ts`,
`utils/map-user-usage-to-model-limits.ts`, `UsageLimitCard`, `ModelLimitsSection` and its
`PeriodCell`/`PeriodStatusIndicator`, `README.md`); `libs/chat-hooks`
(`usage/useUsageData/useUsageData.ts`, `README.md`).

**App** — `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`,
`apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json` plus every other
locale bundle, and a new app-edge reset-time formatting utility under `apps/chat/src/utils/`.

**Docs** — `docs/architecture.md` (the `/api/v1/user/usage` row and the `usage-dashboard` library
description), `libs/usage-dashboard/README.md`, `libs/chat-hooks/README.md`; verified with
`npm run validate:docs`.

**Known contract gap** — `@epam/ai-dial-typescript-sdk@0.1.1` still types
`CostItemLimitStats`/`ItemLimitStats` as `{ total?: number; used?: number }` with no `resetsAt`, and
`libs/chat-api-client/openapi.json` has no such field either. The BFF already casts the SDK response
(`result.data as unknown as UserLimitStatsResponseDto`), so the field survives at runtime, but the
contract is unverifiable from any in-tree artifact. This change proceeds on the reported Core
behaviour and records a documentation request; see `design.md`.

**Out of scope** — the header `UsageLimitsControl` popover and `libs/catalog`'s Limits tab. Both
consume `LimitStatsDto`, so the widened type reaches them, but neither gains reset-time UI here.

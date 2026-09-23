## MODIFIED Requirements

### Requirement: Reset-time normalization at the application edge

All interpretation of `resetsAt` SHALL happen in `apps/chat`, never in a hand-authored library.
`apps/chat/src/utils/usage-reset-time.ts` SHALL expose a formatter with this contract:

```ts
export interface ResetTimeDisplay {
  resetsAtMs: number;
  isoValue: string;
  label: string;
  ariaLabel: string;
}

export const formatUsageResetTime: (
  resetsAt: string | undefined,
  activeLocale: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) => ResetTimeDisplay | undefined;
```

The formatter:

- SHALL parse with `Date.parse` and return `undefined` when the result is `NaN`
- SHALL return `undefined` when `resetsAt` is `undefined` or an empty string
- SHALL format the visible `label` via `Intl.DateTimeFormat(activeLocale, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'shortOffset' })`, and the spoken `ariaLabel` with the same components but `timeZoneName: 'long'`.
  The components are named individually rather than through `dateStyle`/`timeStyle` because
  ECMA-402 forbids combining either style shorthand with `timeZoneName` — that combination throws a
  `TypeError` at construction, which under the rules below would make the formatter return
  `undefined` on every platform and render the reset affordance permanently dead. These options
  reproduce a medium date and a short time while still carrying the offset.
- SHALL resolve the viewer's zone through `Intl.DateTimeFormat().resolvedOptions().timeZone` inside a
  `try`/`catch`, matching the defensive pattern in `libs/chat-hooks/src/shared/browser-timezone.ts`,
  and SHALL return `undefined` if any `Intl` call throws
- SHALL set `isoValue` to the original `resetsAt` string, for a `<time dateTime>` attribute
- SHALL NOT derive a reset boundary from the browser's own calendar — no local midnight, no
  "start of week", no date arithmetic on `new Date()`

The result SHALL be passed into `libs/usage-dashboard` as preformatted strings only.
`libs/usage-dashboard` SHALL NOT import `Intl`, receive a locale or timezone, or receive a raw
`resetsAt` value. The library holds no reset-time mapper at all: the adapters that consume
`formatResetTime` are app-owned, in `apps/chat/src/utils/map-usage-data-to-dashboard.ts` and
`apps/chat/src/utils/map-user-usage-to-model-limits.ts`.

`UsageTab` SHALL supply the formatter to the app-owned `mapUsageDataToDashboard` and
`mapOverallCostLimitsToPeriodStatuses` adapters as a `formatResetTime` callback, following the
existing `resolveIconUrl` / `resolveDisplayName` callback pattern, and SHALL wrap it in `useCallback`
so the adapters' `useMemo` dependencies stay stable. `mapUserUsageToModelLimits` does not take the
callback: reset times are rendered per period header, not per row.

Because both adapters are now app-owned, they SHALL type the callback against this module's own
`ResetTimeDisplay` interface directly. The structural stand-ins that existed only so the library
would not import an app type — the exported `ResetTimeDisplayLike` and `FormatResetTime` types in
`@epam/ai-dial-usage-dashboard` — SHALL be removed; the two shapes are field-for-field identical, so
no behaviour depends on the distinction.

#### Scenario: UTC boundary is rendered in the viewer's timezone
- **WHEN** `resetsAt` is `2026-09-16T00:00:00Z` and the viewer's resolved zone is `Europe/Warsaw`
  (UTC+2)
- **THEN** `label` names 16 September at 02:00 and includes the offset (`GMT+2`), and `resetsAtMs`
  equals `Date.parse('2026-09-16T00:00:00Z')`

#### Scenario: Timezone is always stated
- **WHEN** any `resetsAt` is formatted
- **THEN** the visible `label` contains a timezone designator, so a UTC boundary shown in local time
  is never ambiguous

#### Scenario: Library never interprets a timestamp
- **WHEN** `libs/usage-dashboard`'s sources are inspected
- **THEN** no file parses, formats, or timezone-shifts a `resetsAt` value, constructs a `Date`, or
  calls a date/time `Intl` API, and no file receives a raw `resetsAt` at all — the library's props
  carry only the preformatted `resetLabel` / `resetIsoValue` / `resetAriaLabel` strings; the
  module-boundary lint passes

#### Scenario: App-owned adapters pass reset strings straight through
- **WHEN** the app-owned `mapUsageDataToDashboard` and `mapOverallCostLimitsToPeriodStatuses`
  adapters run
- **THEN** each passes its raw `resetsAt` straight to `formatUsageResetTime` and stores only the
  strings returned, present-or-all-absent as a trio, exactly as before the adapters moved out of the
  library

> The library's pre-existing `Intl.NumberFormat` instances for Tokens formatting are unaffected —
> the constraint is on date/time interpretation, not on `Intl` as a namespace. Those instances now
> live with the app-owned adapters; the library's remaining components format nothing.


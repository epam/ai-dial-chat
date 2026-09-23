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
`resetsAt` value. The presentational library holds no reset-time mapper at all: the adapters that
consume `formatResetTime` (`mapUsageDataToDashboard`, `mapOverallCostLimitsToPeriodStatuses`) live in
`libs/chat-hooks/src/usage/` — the narrow, explicitly justified location recorded in AGENTS.md
§Library isolation, not `libs/usage-dashboard`.

`UsageTab` SHALL supply the formatter to `mapUsageDataToDashboard` and
`mapOverallCostLimitsToPeriodStatuses` (both imported from `@epam/ai-dial-chat-hooks`) as a
`formatResetTime` callback, following the existing `resolveIconUrl` / `resolveDisplayName` callback
pattern, and SHALL wrap it in `useCallback` so the adapters' `useMemo` dependencies stay stable.
`mapUserUsageToModelLimits` does not take the callback: reset times are rendered per period header,
not per row.

Because `libs/chat-hooks` must not import the app's own `ResetTimeDisplay` type (a library importing
an app type is exactly the coupling AGENTS.md §Library isolation forbids in the other direction),
`libs/chat-hooks/src/usage/` SHALL declare its own structural `ResetTimeDisplay`-shaped type and
type `formatResetTime` against it. The two shapes SHALL be field-for-field identical
(`resetsAtMs: number`, `isoValue: string`, `label: string`, `ariaLabel: string`), so `UsageTab`'s
`formatUsageResetTime` return value satisfies the library's type with no adapter or cast at the call
site. `@epam/ai-dial-usage-dashboard` SHALL continue to export neither `ResetTimeDisplayLike` nor
`FormatResetTime` — that removal, made when the adapters first left the presentational library, is
unaffected by which non-presentational location they live in now.

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

#### Scenario: The adapters pass reset strings straight through
- **WHEN** the `mapUsageDataToDashboard` and `mapOverallCostLimitsToPeriodStatuses` adapters run
- **THEN** each passes its raw `resetsAt` straight to `formatUsageResetTime` and stores only the
  strings returned, present-or-all-absent as a trio, exactly as before either relocation

#### Scenario: The library's own type never crosses into the app

- **WHEN** `libs/chat-hooks/src/usage/`'s source is inspected
- **THEN** it declares its own `ResetTimeDisplay`-shaped type rather than importing
  `apps/chat/src/utils/usage-reset-time.ts`'s `ResetTimeDisplay`, and `UsageTab`'s
  `formatUsageResetTime` return value is accepted with no cast at the call site

> The library's pre-existing `Intl.NumberFormat` instances for Tokens formatting are unaffected —
> the constraint is on date/time interpretation, not on `Intl` as a namespace. Those instances live
> with the adapters in `libs/chat-hooks`; the presentational library's remaining components format
> nothing.

# Design

## Context

See `proposal.md` for motivation. Current state that shapes the approach:

- `libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts` builds UTC cron fields with a reference `Date` and reads UTC getters (`buildCronFields`, `buildCronWindowBoundary`) and inverts them in `parseCronFields`. Helpers `getUtcDayShift`, `toUtcCronDayOfMonth`, `toLocalDayOfMonth` (`libs/chat-hooks/src/shared/cron-day-of-month.ts`) and the weekday maps (`cron-weekday.ts`) exist only for this shifting.
- `libs/scheduled-tasks/src/validation/scheduled-task-validation.ts` takes an injected `now: Date` and checks `runAt` and the activity-window boundaries against the **browser-local** clock.
- chat-api (`apps/chat-api/src/scheduled-tasks/`) maps the body to the scheduler in `scheduled-tasks.mapper.ts` (`toUpstreamTrigger`, `assertValidCronWindow` using `new Date(...)`) and has no zone field.
- DIAL Scheduler (sibling repo `dial-scheduler`, `documentation/api_contract.md`) accepts a top-level `timezone` per schedule. Cron fields and offset-less `date`/`start_date`/`end_date` are local wall time in it. A PUT without `timezone` resets it to `UTC`. DST gap: fires once shifted forward. Repeat: fires once at the first occurrence.
- `getBrowserTimezone` already exists in `libs/chat-hooks/src/shared/browser-timezone.ts`.
- The Time field uses the kit `Calendar` in `CalendarMode.Time` with `showTimezone` (a text hint only) in `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx`.

## Goals / Non-Goals

**Goals**

- Send local wall time plus an IANA zone; make DST drift impossible on our side.
- One pure wall-clock helper module reused by validation, mapping and display.
- A picker built from kit parts with no host knowledge in the lib.

**Non-Goals**

- Any frontend UTC arithmetic, polyfill or date library.
- Virtualised lists unless measurement shows a need (see Decision 6).
- Per-run time-zone display on run history (`next_run_time` and run timestamps stay absolute UTC instants formatted by existing code).

## Decisions

### 1. Send local wall time + `timezone`; do not convert in the browser

The mapping stops using `Date` UTC getters. `buildCronFields` returns `{ hour, minute, day_of_week?, day? }` exactly as entered; `values.timezone` becomes the top-level body field. `getUtcDayShift`, `toUtcCronDayOfMonth`, `toLocalDayOfMonth` and the weekday shifting are deleted along with their tests. `monthly` day `31` is sent as `'31'` (the scheduler handles short months), so the `'last'` rewrite also goes.

*Alternatives*: Temporal / `@date-fns/tz` plus UTC on the wire (rejected: duplicates scheduler logic, and a disagreement on a gap or repeat would be a silent bug); keep UTC conversion and store the zone only for display (rejected: does not fix drift).

### 2. Existing tasks read back as `UTC`, unchanged

The reverse mapper reads fields as stored and sets `timezone` from the DTO (`'UTC'` if absent). A legacy task opens as "07:00 UTC" rather than "09:00 local". This is the only behaviour that guarantees "existing tasks keep their run times" without a data migration, and the zone shown next to the time makes it explicit. A one-time `date` with `Z` or an offset (all legacy ones) is converted into the task's zone with `Intl` so the run-at field shows the right wall time; new one-time tasks are stored offset-less.

*Alternative*: re-interpret legacy fields in the browser zone (rejected: it changes what the task does on save and is wrong for any viewer outside the creator's zone).

### 3. Where the code lives

| Piece | Location | Why |
|---|---|---|
| Pure wall-clock helpers: `getZonedNow`, `instantToZonedDateTime`, `isNonexistentLocalTime`, `shiftForwardOverGap` | `libs/scheduled-tasks/src/utils/zoned-wall-clock.ts`, exported from the lib index | Validation (in this lib) and the mapper (in `chat-hooks`) both need them. `AGENTS.md` lets `chat-hooks` import a feature lib's pure functions and types, never hooks or components, so one implementation serves both. `Intl` is a platform API, not host knowledge. |
| Zone catalogue: list, offsets, abbreviations, sort, search terms | `libs/chat-hooks/src/shared/timezones.ts`, exported from the `scheduled-tasks` entry | Non-rendering code, next to `browser-timezone.ts`; keeps the lib free of catalogue logic. |
| `TimezoneOption` type, picker, labels, colors | `libs/scheduled-tasks` | The lib defines the contract; the host fills it. |
| `timezone` in create/update/response DTOs, validation | `apps/chat-api/src/scheduled-tasks/dto/`, `scheduled-tasks.mapper.ts` | Backend knowledge stays at the app edge. |
| Wiring, `t()` labels, default zone | `apps/chat/src/pages/ScheduledTaskCreatePage`, `ScheduledTaskEditPage`, `apps/chat/src/hooks/scheduled-tasks`, `apps/chat/src/utils/map-scheduled-task-dto.ts` | App edge. |

No new React context: the selected zone is a form field (`values.timezone`) like every other field, and the option list is a memoised pure value (`useMemo`) computed once in the page via the chat-hooks helper. No new hook is needed in `apps/chat/src/hooks`; the page composes the helper and `useScheduledTaskFormLabels`.

### 4. `TimezoneOption` contract (lib ↔ host)

```ts
interface ScheduledTaskTimezoneOption {
  id: string;                // IANA id sent to the API
  offsetLabel: string;       // "GMT+01:00"
  offsetMinutes: number;     // for ordering; host already sorted
  abbreviation?: string;     // "CET" — only when Intl returns letters
  searchTerms: string[];     // lower-cased: offset variants, id with spaces, winter + summer abbreviations
}
```

The host passes a **sorted** array and `browserTimezoneId`; the lib renders the two groups, filters by substring against `searchTerms`, and highlights with the kit `Highlight` on `offsetLabel`, the id and the abbreviation. The lib never calls the catalogue helper, never reads the browser zone and never imports i18n; every string comes from `ScheduledTaskTimezoneLabels` (English defaults), every color from a `*Colors` prop (`buildCssVars`), every `dial-*-text` class from a `*ClassName` prop.

### 5. Catalogue rules (`chat-hooks/shared/timezones.ts`)

- **Ids**: `Intl.supportedValuesOf('timeZone')` guarded by `try/catch` (older engines throw) with `UTC` always added. V8 lists legacy names (`Asia/Calcutta`, `Europe/Kiev`), so a small rename table maps them to current names for display and ids that resolve to the same zone collapse into one row (`Etc/UTC` beside `UTC`). The rename runs after `resolvedOptions().timeZone`, which V8 turns back into the legacy name. Saved task values are never rewritten; `findTimezoneOption` maps a saved legacy id to its current row, and DIAL Scheduler accepts both spellings.
- **Offset**: `Intl.DateTimeFormat('en-US', { timeZoneName: 'longOffset' })` at an injected `now`; the bare `GMT` an engine returns for UTC is normalised to `GMT+00:00`. `offsetMinutes` is parsed from it.
- **Abbreviation**: `timeZoneName: 'short'` in the active locale; used only when it contains no digit and is not a `GMT±` form. It is locale-dependent (Berlin: `CET` in `en-GB`, `GMT+1` in `en-US`) and may be absent for many zones; the row layout copes either way.
- **Search terms**: offset with and without leading zero and sign, the id with `_` and `/` replaced by spaces, and the abbreviation computed at both a January and a July reference date, so `CEST` finds Berlin in November.
- **Sort**: ascending `offsetMinutes`, then `id` with a locale-independent compare. The browser zone is passed separately and rendered first under "Your time zone".
- **Clock**: the catalogue takes `now: Date`, so tests pin DST states.

### 6. Picker composition from the UI kit

Confirm every entity with the `@epam/ai-dial-ui-kit` MCP tools before use (`searchEntity`/`getEntityDetails`); never grep the package. Planned parts, all 2.0 components:

- `Dropdown` with `renderOverlay` and `overlayRole = DropdownOverlayRole.Dialog` (named by `overlayAriaLabel`) around a trigger link — popover on desktop; on phones (`useIsPhone`) the same overlay content in the kit's bottom-sheet presentation if the kit offers one, otherwise a full-width fixed panel.
- `Search` for the field (magnifier and clear button included), focused on open, passing the typed value as `searchQuery` downwards.
- `MenuItem` rows with `role="option"` inside a `role="listbox"`, `MenuItemMark` for the selected row; section headings as plain captions (kit typography classes via props).
- `Highlight` for matched text (`.claude/rules/search-results-highlight.md`).
- `NoDataContent` for no results (`live`), plus a kit `LiveRegion` mounted before its text to announce the result count.
- The trigger is the existing link-button pattern in the kit (verify the name with the MCP tool) with a Tabler chevron using `stroke={DIAL_KIT_ICON_STROKE}`, mirrored when needed.

`Select` with `searchable` was considered and rejected: it has no grouped headings, no custom filter predicate and no per-part highlighting, which Figma needs.

**List size**: about 420 rows of simple elements is under a thousand DOM nodes, which renders fine; no virtualisation dependency is added (none exists in `package.json`). Rows are memoised (`React.memo`) and the filtered array is `useMemo`'d on `(options, query)`. If profiling in the task list shows a problem, add CSS `content-visibility: auto` on rows before reaching for a library.

### 7. Validation and DST hint

`validateScheduledTaskFormValues` keeps its injected `now: Date` and gains the selected zone from `values.timezone`; it converts `now` to wall time in that zone with `getZonedNow` and compares strings/dates in wall-clock terms. New code `TimezoneInvalid` for an empty or `Intl`-rejected id. The create form shows the DST-gap hint (non-blocking) through `isNonexistentLocalTime`; the message is a `*Labels` function taking the shifted time. No hint for repeats, matching the scheduler's "first occurrence" rule.

### 8. chat-api

Follow `apps/chat-api/AGENTS.md` (URI versioning, thin controller, validated DTO, allowlist `@Matches`, typed exceptions); no new endpoint, so no new operationId.

- `CreateScheduledTaskBodyDto` gains optional `timezone` (`@IsOptional @IsString @MaxLength(64) @Matches(/^[A-Za-z0-9_+\-/]+$/)` plus an `@IsIanaTimezone()` validator that constructs `Intl.DateTimeFormat` and catches `RangeError`); `UpdateScheduledTaskBodyDto` inherits it; `ScheduledTaskDto` gains `timezone`.
- `scheduled-tasks.mapper.ts` forwards `timezone` (default `'UTC'`) in `toUpstreamSchedulePayload` and maps the upstream value back (default `'UTC'`).
- `assertValidCronWindow` currently compares `new Date(end) <= new Date(start)`. For two offset-less values, `Date` would use the *server's* zone and could misorder around the server's own DST. The check parses offset-less values as UTC wall-clock (`...Z` appended) so only the ordering matters; mixed values are compared as instants using the task's zone via a small helper. Offset-less `date` must pass `@IsISO8601()` (it does by default); add a test.
- Update always forwards the zone, because a PUT without one resets it to `UTC` upstream.
- `scheduled-tasks-list-cache.service.ts` caches list entries; the new field must be part of the cached DTO and the cache must be invalidated on update as it already is (verify, no new TTL).
- Regenerate with `npm run openapi` and `npm run openapi:check`, then build/lint `libs/chat-api-client` (never hand-edit generated files). `apps/chat/src/server-api/scheduled-tasks.api.ts` already wraps the generated client; it needs no new method.

### 9. Display

`formatScheduledTaskScheduleLabel` and `toScheduledTaskItem` (`libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts`) already take host-translated templates. Add a `zoneSuffix(zone)` label and append it only when the task zone differs from `getBrowserTimezone()`. Wall times in the label are the stored ones (no browser conversion); the one-time `date` label formats the instant in the task's zone (`Intl` with `timeZone`).

### 10. Cross-cutting rules applied

- **Library isolation**: no `/api` path, client, storage, env or routing in `libs/*`. The lib receives `options`, `value`, `onChange`, `labels` only.
- **i18n**: lib strings via `*Labels` with English defaults; app fills with `t()` and `ScheduledTasksI18nKeys` entries (keys listed in the spec).
- **RTL**: logical classes (`ms-*`, `ps-*`, `text-start`, `inset-s-*`); chevron mirrored; the popover is placed with the kit's logical placement.
- **A11y**: dialog name, focus to search on open, focus return on close, `aria-activedescendant`/arrow-key navigation, `LiveRegion` for counts and empty state (target WCAG 2.1 AAA contrast via kit tokens).
- **Mobile-first**: `useIsPhone` for the bottom-sheet presentation; no `sm:/md:` prefixes.
- **Feature gating**: scheduled tasks stay behind their existing feature key; no new flag.
- **Telemetry**: none.

## Risks / Trade-offs

- **Engine variance in `Intl.supportedValuesOf`** (Chrome may omit `UTC` and list legacy names; Node 24 omits `UTC`) → add `UTC`, collapse aliases by canonical form, unit-test with a stubbed `Intl`, never rename on save.
- **Abbreviation is locale-dependent and often missing** → show only when letters, never rely on it for identity; search also matches both seasons' abbreviations. Design must accept rows without one.
- **Legacy tasks now show UTC times** → intended; the zone beside the time and the card suffix make it visible. Users may need to re-pick their zone once.
- **One-time `date` in a DST gap** → scheduler behaviour is verified only through `zoneinfo`, not by a scheduler test → hint in the form; ask the scheduler team to add the test.
- **Figma mock inconsistencies** (Berlin as `EST`, two placeholders) → treated as mock data; confirm with design before final copy.
- **Rolling back after release** → tasks saved with another zone would be misread by the old code. Mitigation: deploy chat-api first, then the frontend; rollback is the reverse and needs a data note.
- **Server TZ in the window-order check** → parse offset-less values as UTC wall time (Decision 8).

## Migration Plan

1. Deploy DIAL Scheduler with `timezone` (already shipped, migration backfills `UTC`).
2. Deploy chat-api: `timezone` optional, defaults to `UTC`; old frontends keep working (they send UTC fields without a zone).
3. Deploy the frontend. New and edited tasks carry a zone; untouched tasks stay `UTC`.
4. Rollback: revert the frontend first, then chat-api; no schema change in this repo.

## Open Questions

- Whether the kit offers a bottom-sheet presentation for `Dropdown` on phones, or the lib supplies a full-width panel (answered when the kit entity is read; does not change specs or tasks).
- Whether `cron.timezone`-aware next-run preview should appear in the form (out of scope here).

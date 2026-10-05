# scheduled-tasks-reuse-contract Specification

## Purpose

Define the public validation, request lifecycle, presentation and stylesheet contracts that let applications reuse Scheduled Tasks without private DOM or CSS patches.
## Requirements
### Requirement: Shared schedule validation returns host-translatable field errors

`@epam/ai-dial-scheduled-tasks/validation` SHALL export a pure validator over existing form values and explicit clock/lead options. It SHALL validate all active schedule fields, description length (500), display-name length (256) and control characters, instructions length (50000) and activity boundaries defined in design.md section 4. The same entry SHALL export `validateScheduledTaskTextField(field, value)` for a single `displayName`/`description`/`prompt` value (checked trimmed; an empty value passes) so a host can report `DisplayNameTooLong`, `DisplayNameControlCharacters`, `DescriptionTooLong` or `PromptTooLong` while the user types. Errors SHALL identify a field and a typed code, with no translated strings, network calls or ambient clock reads. Inactive draft fields SHALL not invalidate another repeat mode.

#### Scenario: Text fields over their limits return typed codes

- **WHEN** a draft has a 257-character display name, a 501-character description and 50001-character instructions
- **THEN** validation returns `DisplayNameTooLong`, `DescriptionTooLong` and `PromptTooLong` for those fields; a display name containing a tab returns `DisplayNameControlCharacters`

#### Scenario: Weekly and monthly require valid day selections

- **WHEN** a weekly/monthly draft has an empty or out-of-range day
- **THEN** validation returns a dayOfWeek/dayOfMonth error and cannot report the draft as valid.

#### Scenario: Numeric and time boundaries are enforced

- **WHEN** hourly minute is negative, 60, fractional or nonnumeric, or daily time is not valid HH:mm
- **THEN** validation returns an error for the active field; minute 0 and 59 and valid HH:mm remain accepted.

#### Scenario: One-time and activity dates are validated deterministically

- **WHEN** the caller supplies now and a one-time run less than the configured lead ahead, or malformed dates, or an activity `endDate` earlier than `startDate`
- **THEN** validation returns the corresponding field error (`EndDateInvalid` for the ordering case); changing the injected clock changes the lead check predictably.

#### Scenario: A same-day activity window is valid

- **WHEN** a draft's activity `startDate` and `endDate` are the same `YYYY-MM-DD` date
- **THEN** validation returns no `endDate` error, because the end boundary is built as end of day (`CronWindowEdge.End`)

#### Scenario: Activity boundaries changed into the past are rejected

- **WHEN** a valid `startDate` or `endDate` is earlier than the local date of the injected `now`
- **THEN** validation returns `StartDateInPast` or `EndDateInPast` for that field, overriding an ordering error on the same field, unless the value equals the `originalStartDate`/`originalEndDate` option the edit form was hydrated with

#### Scenario: Inactive fields and optional description do not block valid schedules

- **WHEN** a valid daily draft retains an old hourly-minute value and has empty description
- **THEN** validation succeeds; a description above 500 characters instead returns its own error.

Validation options SHALL additionally accept `isSkillsSupported?: boolean`, and `originalStartDate?`/`originalEndDate?` (local `YYYY-MM-DD`) that exempt an unchanged hydrated activity boundary from the past-date rule. Skill-bearing values require explicit true; instruction-only callers remain compatible without that option. The pure shared `isSkillSelectionUnsupported` predicate SHALL determine capability errors from the reference, not metadata. `SkillUnsupported` SHALL identify `skillUrls`; `InstructionsOrSkillRequired` SHALL identify `prompt` when both content alternatives are absent. Stable codes SHALL be string-enum members translated by the host.

#### Scenario: Configuration validation matrix

- **WHEN** support is true/false/undefined, skill is present/absent, and prompt is nonblank/empty/whitespace
- **THEN** instruction-only is valid regardless of support, a present skill requires explicit true, a supported skill permits blank prompt, and neither content alternative is invalid

#### Scenario: Default options fail closed only for a skill

- **WHEN** an existing host omits the support option
- **THEN** instruction-only behavior is preserved and adding a skill returns `SkillUnsupported`
### Requirement: Checked preparation never silently changes schedule frequency

`@epam/ai-dial-chat-hooks/scheduled-tasks` SHALL export checked create/update body preparation using the shared validator before existing conversion. Failure SHALL return field error codes without a body. Success SHALL preserve the existing UTC, weekday, description and activity-window semantics. Existing unchecked mapper signatures SHALL remain compatible and document their validated-input precondition.

#### Scenario: Invalid weekly draft has no request body

- **WHEN** checked create or update preparation receives Weekly with no day
- **THEN** the result contains a day error and no daily cron body can be submitted through this path.

#### Scenario: Valid conversion preserves current semantics

- **WHEN** valid weekly, monthly, hourly or one-time values are prepared in supported timezones
- **THEN** the result has the selected frequency and matches the existing conversion, including non-whole-hour offsets and activity boundaries.

Checked create/update preparation SHALL pass capability options into shared validation and preserve the selected skill references, carried as `skillUrls?: string[]` on the form values. Create (`mapFormValuesToCreateBody`) SHALL omit `skillUrls` when the array is unset or empty and otherwise send it de-duplicated; update from a complete hydrated draft (`mapFormValuesToUpdateBody`) SHALL always send `skillUrls: [...new Set(values.skillUrls ?? [])]`, so an unset/cleared selection serializes as `[]`. The BFF update treats an omitted `skillUrls` as preserving the saved references and `[]` as removing them. Reverse mapping SHALL accept empty-string prompt with a skill and SHALL not depend on catalog metadata. No invalid combination SHALL produce a request body.

#### Scenario: Skill-only checked preparation round-trips

- **WHEN** a supported skill-only draft is prepared, persisted, and mapped back
- **THEN** its reference and empty prompt survive with the established schedule semantics

#### Scenario: Clearing the skill on update sends an empty array

- **WHEN** a hydrated edit draft has its skill removed and is prepared for update
- **THEN** the update body contains `skillUrls: []`, which the BFF applies as removing the saved references

### Requirement: Schedule description depends only on trigger data

chat-hooks SHALL export a typed trigger descriptor independent of model/prompt/editability and localization. It SHALL distinguish common frequencies, supported interval/custom expressions and invalid input; retain the original custom expression and source timezone; and accept deterministic conversion context. The host SHALL supply translated formatting with an explicit locale.

#### Scenario: Missing task configuration does not change a daily label

- **WHEN** the same daily trigger is displayed with and without model/prompt metadata
- **THEN** both descriptors and host-formatted repeat labels are identical.

#### Scenario: Displayable but uneditable expression remains intact

- **WHEN** a valid custom cron cannot be represented by the editor
- **THEN** description preserves its expression and timezone; edit mapping remains fail-closed.

#### Scenario: Malformed date cannot crash the page

- **WHEN** a trigger contains an invalid date value
- **THEN** the descriptor reports Invalid and the host renders its translated fallback without throwing an Intl error.

### Requirement: Scheduler transport is composed from an injected configured client

chat-hooks SHALL export a scheduler facade over an already configured generated client and reusable list/history hooks over that facade. It SHALL not configure auth, CSRF, endpoints or app state. UI libraries SHALL have no generated-client imports. Canonical response normalization SHALL be explicit: the facade's page operations reject a response whose `items` is not an array with a `TypeError`, so malformed responses SHALL not become successful empty lists. No legacy `results`-envelope adapter exists; `apps/chat/src/server-api/scheduled-tasks.api.ts` passes the generated client directly to `createScheduledTasksApiClient`, and any legacy-envelope compatibility a host needs belongs in its own adapter.

#### Scenario: Independent host supplies its own client

- **WHEN** a consumer injects a fake/configured client without parent app providers
- **THEN** facade operations and hooks work through that client and do not access parent routes, globals, auth or contexts.

#### Scenario: Malformed page responses are errors

- **WHEN** the injected client resolves a list or run-history response without an `items` array
- **THEN** the facade throws a `TypeError` ('Scheduled tasks API returned a malformed page response') rather than reporting an empty-state success.

### Requirement: Pagination updates are scoped to the current request generation

Shared list/history hooks SHALL own request state, abort signals, generation guards, pagination offsets and duplicate suppression. Query/sort/task/refetch/client/enable changes and unmount SHALL invalidate outstanding initial and incremental requests. All success/error/finally state updates SHALL check identity even when the transport ignores abort. Defaults SHALL be list 20/history 10/debounce 300ms with documented configuration. No persistent cache or automatic retries of failed requests SHALL be introduced. `useScheduledTaskRuns` additionally performs background refresh of page 0, merged into loaded runs via `mergeRunsById` (known ids replaced in place, unseen ids prepended, absent ids kept): it polls every 15s while a run is in progress and stops after 20 consecutive unchanged or failed polls; it fires a one-shot refresh 5s after a future `nextRunTime` option; and a refresh missed while `document.visibilityState` is not `visible` is caught up once when the tab becomes visible.

#### Scenario: Old sort page cannot append to a new result

- **WHEN** a list loadMore is pending, sort or debounced search changes, and the old response resolves after the new first page
- **THEN** only current-query items, offset, hasMore, errors and loading flags remain.

#### Scenario: Old task history cannot append to another task

- **WHEN** task A pagination is pending and the hook switches to task B
- **THEN** A's eventual success or failure cannot change any B state.

#### Scenario: Refresh and disable invalidate all pending work

- **WHEN** refetch, disable, client replacement or unmount happens while requests are pending
- **THEN** old work is cancelled and ignored, including its finally updates.

#### Scenario: Run history refreshes in the background while a run is in progress

- **WHEN** the loaded history contains an in-progress run and the tab is visible
- **THEN** page 0 is re-fetched every 15s and merged by id, and polling stops after 20 consecutive polls that change nothing

#### Scenario: Run history refreshes once after the next run time

- **WHEN** the hook receives a future `nextRunTime`
- **THEN** one background refresh fires 5s after that instant

#### Scenario: Repeated load-more activation issues one request

- **WHEN** loadMore is activated multiple times before the next render
- **THEN** only one request for that page is issued; duplicate response ids do not create duplicate rows.

### Requirement: Incremental errors preserve results and support targeted retry

Hooks SHALL expose initialError and loadMoreError separately with retryLoadMore. Incremental failure SHALL retain loaded records and the failed offset; retry SHALL request that offset without clearing results. New query generations SHALL clear obsolete errors.

#### Scenario: Failed list pagination keeps visible cards

- **WHEN** the first page succeeded and the next page fails
- **THEN** the cards remain and retry targets the failed page rather than restarting at offset 0.

#### Scenario: Failed history pagination keeps visible runs

- **WHEN** history loadMore fails and then retry succeeds
- **THEN** old runs remain, the new runs append once, and the incremental error clears.

### Requirement: Styles and customization work through installed public package entries

Documented scheduled-tasks/styles.css SHALL supply internal structural dependency styles, including builder-form. UI-kit theme/base imports SHALL be documented separately. Affected styles SHALL be scoped against host utility collisions. Public customization SHALL cover design.md section 3 without DOM mutation, private selectors, SVG-path hiding, relative node_modules imports or app providers.

#### Scenario: An external app gets the correct border with documented imports

- **WHEN** a consumer imports only documented theme/base and scheduler CSS entries
- **THEN** the form header resolves Stroke/Tertiary and all scheduler structural styles without a hidden builder-form import.

#### Scenario: Host utility CSS cannot change scheduler layout

- **WHEN** host desktop utilities use769px or1280px thresholds and are loaded before or after scheduler CSS
- **THEN** the same scheduler container has the same intended layout, and unrelated host elements are unchanged.

#### Scenario: Per-instance overrides remain local

- **WHEN** two scheduler instances use different documented color/layout/typography settings
- **THEN** each instance resolves its own settings without style leakage.

### Requirement: A built-package consumer proves reuse and documents migration

A parent-owned external fixture SHALL install packed distribution artifacts with dependency closure, without source aliases or app imports. Package/type contract tests SHALL cover all scheduler surfaces, alternate strings/styles/icons, typed exports and public CSS imports. The fixture SHALL provide a production build for manual checks of computed styles, container-responsive layout, editor placeholders and selector interactions. Source-text assertions alone SHALL NOT count as installed-package verification. Documentation SHALL map every F01-F15 finding to public replacement APIs. Implementation SHALL migrate the parent but SHALL not require editing an external application repository to pass.

#### Scenario: Scheduler root and subpath exports stay compatible

- **WHEN** a scheduler API is added to chat-hooks/scheduled-tasks
- **THEN** the same API is exported by the root chat-hooks barrel and covered by the existing entry-point parity guard.

#### Scenario: Packed artifacts expose the complete contract

- **WHEN** the fixture installs the built packages and typechecks/renders its scheduler flow
- **THEN** public imports resolve and all surfaces work without root app providers or unpublished source files.

#### Scenario: Adoption guide removes the known workarounds

- **WHEN** a maintainer follows the documented consumer migration map
- **THEN** the guide identifies replacements for observers, private CSS, duplicated hooks/formatters, deep CSS imports and local form label duplication.

#### Scenario: Validation has an independently importable distribution entry

- **WHEN** an installed consumer imports scheduled-tasks/validation without source aliases
- **THEN** its JavaScript and declarations resolve and validation executes without mounting UI.

#### Scenario: Built structural CSS retains module identity

- **WHEN** scheduler styles compose builder-form structural styles
- **THEN** selectors match the builder JavaScript CSS Module names and do not style unrelated host header/title/container classes.

#### Scenario: Explicit display timezone preserves trigger meaning

- **WHEN** a host supplies timeZone and referenceDate to the trigger descriptor
- **THEN** supported simple UTC schedules produce local time/weekday fields using that date's offset; additional constraints remain Custom, invalid numeric ranges are Invalid, and monthly midnight rollover remains Custom when a shifted day cannot be represented identically across short months.

#### Scenario: Explicit seconds preserve cron frequency

- **WHEN** a cron includes `second: '*'` or a nonzero second expression
- **THEN** the descriptor returns Custom with the original expression; an explicit zero second may use a supported minute-level description.

### Requirement: Skill support is consumable through built library contracts

The reusable selector SHALL be exported by `@epam/ai-dial-skills`; form/summary/detail values, labels and errors by `@epam/ai-dial-scheduled-tasks`; pure validation by its `/validation` entry; DTO mapping and checked preparation by both the root `@epam/ai-dial-chat-hooks` and `/scheduled-tasks` entry. Existing optional-free instruction-only callers SHALL remain compatible. Public props and host wiring SHALL be documented in each affected README with correct exports and complete examples.

The existing packed `tools/scheduled-tasks-consumer-fixture` SHALL exercise skill selection/removal, shared validation, preparation, skill-only hydration, and read-only fallback using built artifacts without source aliases or app providers. Hand-authored libs SHALL NOT acquire API routes, client setup, app context imports, flags, auth, storage, i18n, navigation, or deployment objects. The existing `chat-hooks` configured-client exception SHALL remain narrow. Styles SHALL ship through existing public stylesheet contracts.

#### Scenario: External host composes the whole flow

- **WHEN** a consumer installs the built packages and passes a skill value, support boolean, labels, catalog renderer, and callbacks
- **THEN** its form and detail render and its checked preparation works without importing `apps/chat` or copying capability/content rules

#### Scenario: Existing host remains compatible

- **WHEN** a host omits all new optional props and submits an instruction-only task
- **THEN** existing code typechecks and the established form/validation behavior remains available

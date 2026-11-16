# Spec Delta

## Purpose

Defines how a scheduled task's IANA time zone is chosen, listed, labelled, searched, persisted and shown, so a task keeps its local wall-clock schedule across daylight-saving changes.

## ADDED Requirements

### Requirement: A scheduled task carries an IANA time zone

Every create and update of a scheduled task SHALL send a `timezone` that is an IANA identifier (for example `Europe/Berlin`). New tasks SHALL default to the browser's zone, or `UTC` when the browser reports none. A task read back without a zone SHALL be treated as `UTC`. Legacy identifiers (for example `Asia/Calcutta`) SHALL be sent exactly as the user selected or the task returned them, never renamed.

#### Scenario: New task defaults to the browser zone

- **WHEN** the create form opens in a browser whose zone is `Europe/Warsaw`
- **THEN** the selected zone is `Europe/Warsaw` and the Time field's zone hint shows it

#### Scenario: Update always sends the zone

- **WHEN** the user saves an edited task without touching the zone
- **THEN** the update body still contains the task's `timezone`, so the scheduler does not reset it to `UTC`

#### Scenario: Legacy identifier is not renamed on save

- **WHEN** a task is saved with `Asia/Calcutta` and read back
- **THEN** the form resubmits `Asia/Calcutta` unchanged, and the picker lists that zone under its current name `Asia/Kolkata`

### Requirement: Existing tasks keep their run times

A task that has no stored zone or reads back as `UTC` SHALL open in the edit form with zone `UTC` and its stored fields shown unchanged as UTC wall time. The form SHALL NOT reinterpret them in the browser's zone.

#### Scenario: Legacy daily task opens in UTC

- **WHEN** a task with cron `hour: 7, minute: 0` and zone `UTC` is opened by a viewer in `Europe/Berlin`
- **THEN** the form shows time `07:00` and zone `UTC`, and saving unchanged sends `hour: 7` with `timezone: UTC`

#### Scenario: Legacy one-time task shows its instant in the task zone

- **WHEN** a task with `date: 2026-07-24T07:00:00.000Z` and zone `UTC` is opened
- **THEN** the run-at field shows `2026-07-24T07:00`

### Requirement: Time zone picker opens from the Time field

Under the Time field (daily, weekly, monthly, custom), the Run-at field (one-time) and the Minute field (hourly), the form SHALL show a "Change timezone" link with a chevron that flips while the picker is open. The picker SHALL open as a popover (a bottom sheet on phones) containing a search field, a "Your time zone" group with the browser zone, and an "All time zones" group.

#### Scenario: Link opens the picker and focus moves to search

- **WHEN** the user activates "Change timezone"
- **THEN** the popover opens and keyboard focus is in the search field

#### Scenario: Selecting a zone closes the picker

- **WHEN** the user selects a row
- **THEN** the zone value updates, the popover closes and focus returns to the link

#### Scenario: Escape closes without changing

- **WHEN** the picker is open and the user presses Escape
- **THEN** the picker closes, the zone is unchanged and focus returns to the link

### Requirement: Time field shows the selected zone at its end

The Time field of daily, weekly, monthly and custom schedules SHALL show the selected zone as `(GMT±HH:MM) <IANA id>` inside the input at its trailing edge, before the clock button that opens the hour and minute list, with the "Change timezone" link below the input. The text SHALL follow the selected zone, not the viewer's, SHALL truncate rather than cover the time, and SHALL show the bare identifier when the zone is not in the list. The run-at and minute fields show the zone beside the link.

#### Scenario: Zone inside the time input

- **WHEN** the selected zone is `Europe/Berlin`
- **THEN** the Time input shows `(GMT+01:00) Europe/Berlin` at its end and the link sits below it

#### Scenario: Clock button stays

- **WHEN** the zone is shown inside the Time input
- **THEN** the clock button remains at the input's end and still opens the hour and minute list

#### Scenario: Zone changes the text

- **WHEN** the user picks `Asia/Tokyo`
- **THEN** the text inside the Time input reads `(GMT+09:00) Asia/Tokyo`

#### Scenario: Zone missing from the list

- **WHEN** the task's zone is `Asia/Calcutta` and the list only has `Asia/Kolkata`
- **THEN** the Time input shows `Asia/Calcutta`

### Requirement: Zone list is the full IANA list with a fixed row format

The picker SHALL list every value of `Intl.supportedValuesOf('timeZone')` plus `UTC`, with aliases collapsed to one row under the current name (`Asia/Calcutta` is shown as `Asia/Kolkata`). Each row SHALL read `GMT±HH:MM  <IANA id> • <abbreviation>` with the zone's current offset, and the abbreviation is the first letters-only short name `Intl` gives for the active locale, then English, shown only when one exists. The selected row SHALL be marked.

#### Scenario: Row format with an abbreviation

- **WHEN** the active locale yields `CET` for `Europe/Berlin` in November
- **THEN** its row reads `GMT+01:00  Europe/Berlin • CET`

#### Scenario: Row without an abbreviation

- **WHEN** `Intl` yields only `GMT+5:30` for `Asia/Kolkata`
- **THEN** its row reads `GMT+05:30  Asia/Kolkata` with no bullet or abbreviation

#### Scenario: UTC is always present

- **WHEN** the platform's supported list omits `UTC`
- **THEN** the picker still contains a `UTC` row at offset `GMT+00:00`

### Requirement: Zone list is sorted by offset then name

Within "All time zones" rows SHALL be ordered by current UTC offset ascending (most negative first) and, within one offset, alphabetically by IANA identifier. The browser zone SHALL additionally appear first under "Your time zone".

#### Scenario: Offset then alphabetical order

- **WHEN** the list is rendered with no search text
- **THEN** `America/St_Johns` (`GMT-03:30`) precedes `Atlantic/Cape_Verde` (`GMT-01:00`), and `Africa/Tunis` precedes `Europe/Amsterdam` and `Europe/Berlin` at `GMT+01:00`

#### Scenario: Browser zone is pinned

- **WHEN** the browser zone is `Europe/Berlin`
- **THEN** "Your time zone" contains `Europe/Berlin` first, and it is also present in its sorted position under "All time zones"

### Requirement: Search matches offset, city and abbreviation with highlighting

The search field SHALL filter rows case-insensitively against the offset text, the identifier (underscores treated as spaces) and the abbreviation, and SHALL highlight the matched text in each part. A query such as `3:30` SHALL match both `GMT-03:30` and `GMT+03:30`. An abbreviation or region-name query SHALL match a zone whose summer or winter abbreviation or long name contains it, so `CEST` or `Central European` finds `Europe/Berlin` in any month.

#### Scenario: City prefix

- **WHEN** the user types `Ber`
- **THEN** rows `Atlantic/Bermuda` and `Europe/Berlin` remain and `Ber` is highlighted in each

#### Scenario: Offset fragment

- **WHEN** the user types `3:30`
- **THEN** `America/St_Johns` and `Asia/Tehran` remain with `3:30` highlighted in the offset

#### Scenario: Summer abbreviation in winter

- **WHEN** the user types `CEST` in November
- **THEN** `Europe/Berlin` is listed

#### Scenario: Region name

- **WHEN** the user types `Central Europe` in an `en-US` browser
- **THEN** `Europe/Berlin` and `Africa/Tunis` are listed, and `CET` finds them too

#### Scenario: Group headings hide during search

- **WHEN** the search text is non-empty
- **THEN** results show as one flat list without the two group headings

### Requirement: Search results and empty state are announced

While the query is non-empty the picker SHALL announce the result count through a live region that is mounted before its text. When nothing matches it SHALL show an empty state and announce it politely.

#### Scenario: Count is announced

- **WHEN** the user types `Ber`
- **THEN** a polite live region announces the number of matching rows

#### Scenario: No results

- **WHEN** the query matches no zone
- **THEN** the empty state is shown and a polite live region announces it

### Requirement: Wall-clock fields are evaluated in the selected zone

The Run-at, Time, Start date and End date values SHALL be interpreted as wall time in the selected zone. The "in the past" checks for run-at and for start/end dates SHALL compare against the current wall time in that zone, not the browser's. Changing the zone SHALL keep the entered wall-clock values.

#### Scenario: Past check uses the selected zone

- **WHEN** the instant is `2026-03-10T16:00Z` (17:00 in `Europe/Berlin`, `2026-03-11 01:00` in `Asia/Tokyo`), the browser zone is `Europe/Berlin`, the user picks `Asia/Tokyo` and enters run-at `2026-03-11T00:30`
- **THEN** the run-at is reported as in the past, although it would be in the future as a Berlin wall time

#### Scenario: Changing the zone keeps the entered time

- **WHEN** the user entered `09:00` and then switches the zone from `Europe/Berlin` to `Asia/Tokyo`
- **THEN** the Time field still shows `09:00`

### Requirement: DST gap hint for a one-time run

When a one-time run-at does not exist in the selected zone (it falls inside a spring-forward gap), the form SHALL show a non-blocking hint that the task will run at the next valid time, shifted forward by the length of the gap. Saving SHALL remain allowed.

#### Scenario: Missing local time

- **WHEN** run-at is `2027-03-28T02:30` and the zone is `Europe/Berlin`
- **THEN** the hint is shown naming the shifted time `03:30` and Save stays enabled

#### Scenario: Repeated local time shows no hint

- **WHEN** run-at is `2027-10-31T02:30` and the zone is `Europe/Berlin`
- **THEN** no hint is shown (the task fires once, at the first occurrence)

### Requirement: Schedule labels name a non-browser zone

The schedule label on the task card and detail view SHALL append the task's zone when it differs from the browser's zone, for example `Daily at 09:00 (Europe/Berlin)`, and SHALL NOT append it when equal. Times in the label SHALL be the task's wall-clock times, not converted to the browser zone.

#### Scenario: Zone differs

- **WHEN** a daily 09:00 task has zone `Asia/Tokyo` and the browser zone is `Europe/Berlin`
- **THEN** the label is `Daily at 09:00 (Asia/Tokyo)`

#### Scenario: Zone equals the browser zone

- **WHEN** both zones are `Europe/Berlin`
- **THEN** the label is `Daily at 09:00`

### Requirement: Picker strings come from labels

All picker strings SHALL come from a labels prop with English defaults, filled in the app with i18n keys, and the lib SHALL import no i18n.

#### Scenario: Labels are supplied by the host

- **WHEN** the app renders the form
- **THEN** every picker string is a translated label, using the keys `scheduledTasks.create.timezoneChangeLabel`, `timezoneDialogAriaLabel`, `timezoneSearchPlaceholder`, `timezoneSearchAriaLabel`, `timezoneYourZone`, `timezoneAllZones`, `timezoneListAriaLabel`, `timezoneNoResults`, `timezoneNoResultsDescription`, `timezoneResultsCount`, `timezoneGapHint` and `timezoneInvalid` (all under `scheduledTasks.create`), the shared `basic.clearSearch`, and `scheduledTasks.card.scheduleZoneSuffix` for the schedule label

### Requirement: Picker is accessible, RTL-safe and mobile-first

The popover SHALL be a named dialog, rows SHALL be keyboard-navigable (arrow keys, Enter), a directional icon SHALL mirror in RTL (the picker's chevron points down and is not mirrored), layout SHALL use logical properties, and the list of roughly 420 zones SHALL render without noticeable delay.

#### Scenario: Keyboard selection

- **WHEN** the user types `Berlin`, presses ArrowDown and Enter
- **THEN** `Europe/Berlin` is selected

#### Scenario: RTL layout

- **WHEN** the page direction is RTL
- **THEN** the picker opens, filters and selects as in LTR, and its stylesheet uses logical properties only

#### Scenario: Phone layout

- **WHEN** the viewport is a phone
- **THEN** the picker opens as a full-width bottom sheet with the search field fixed at its top

## ADDED Requirements

### Requirement: Card status is derived by getScheduledTaskStatus and rendered by a status pill

`libs/scheduled-tasks` SHALL export `ScheduledTaskStatus` (`Scheduled = 'scheduled' | Paused = 'paused' | Completed = 'completed'`) and `getScheduledTaskStatus(item: ScheduledTaskItem): ScheduledTaskStatus`, which resolves visual status with fixed precedence: an explicit `item.presentationStatus` (the pre-existing override field, restored unchanged from the pre-change card) wins; else `item.isCompleted` → `Completed`; else `item.isActive === false` → `Paused`; else `Scheduled` (`isActive: true` and `undefined` both resolve to `Scheduled`). `ScheduledTaskCard` SHALL render exactly one status element via an internal `ScheduledTaskStatusPill` component taking pre-resolved `status`, `text`, and optional class props — the card SHALL NOT inline per-status branches.

#### Scenario: Completed item resolves to the completed status

- **WHEN** `getScheduledTaskStatus` is called with `{ isCompleted: true, isActive: false }`
- **THEN** it returns `ScheduledTaskStatus.Completed` (completed wins over paused)

#### Scenario: An explicit presentationStatus wins over the derived statuses

- **WHEN** `getScheduledTaskStatus` is called with `{ presentationStatus: 'active', isCompleted: true }` or `{ presentationStatus: 'paused', isCompleted: true }`
- **THEN** it returns the status matching `presentationStatus`, not the derived one

#### Scenario: Paused item resolves to the paused status

- **WHEN** `getScheduledTaskStatus` is called with `{ isCompleted: false, isActive: false }`
- **THEN** it returns `ScheduledTaskStatus.Paused`

#### Scenario: Active or undefined-active item resolves to the scheduled status

- **WHEN** `getScheduledTaskStatus` is called with `{ isCompleted: undefined, isActive: true }` or with `isActive` omitted
- **THEN** it returns `ScheduledTaskStatus.Scheduled`

### Requirement: Completed card shows a Completed badge in place of the schedule pill

When a card's status is `Completed`, `ScheduledTaskStatusPill` SHALL render a rounded-full badge (matching the Paused badge's shape and layout) containing a check icon and the `labels.completedBadgeLabel` text (English default `'Completed'`). The check icon SHALL be `aria-hidden` with `stroke={DIAL_KIT_ICON_STROKE}` and `DIAL_ICON_SIZE.SM` — the badge text is the accessible signal. The badge SHALL NOT include a date. The card's status area SHALL render exactly one element — never a badge and a schedule pill together.

#### Scenario: Completed card renders badge-only, no schedule pill

- **WHEN** a `ScheduledTaskItem` with `isCompleted: true` and a populated `scheduleLabel` is rendered
- **THEN** the "Completed" badge is shown and the schedule pill text is not rendered

#### Scenario: Completed badge icon is hidden from assistive technology

- **WHEN** the completed badge renders
- **THEN** its check icon carries `aria-hidden` and the badge's accessible name is exactly the label text

#### Scenario: Completed badge label is localized

- **WHEN** the Scheduled Tasks page renders a completed card
- **THEN** the badge text comes from `labels.completedBadgeLabel`, which `ScheduledTasksPage` populates from a new `ScheduledTasksI18nKeys` member whose value is defined in `en.json` and every other locale file, following the existing `scheduledTasks.card.*` key pattern

#### Scenario: Completed badge mirrors in RTL without code changes

- **WHEN** the page renders with `dir="rtl"` and a completed card is present
- **THEN** the badge lays out mirrored via the same logical-property cascade as the paused badge (it is a centered inline pill with a symmetric check icon, so no icon mirroring applies), with no dedicated RTL code path

### Requirement: Completed badge theming mirrors the Paused badge contract

`ScheduledTaskCardColors` SHALL gain `completedBadgeBackground`, `completedBadgeBorder`, and `completedBadgeText` (CSS vars `--stc-completed-bg` / `--stc-completed-border` / `--stc-completed-text`, set on the card root via `buildCssVars` and consumed by the status pill's stylesheet), and `ScheduledTaskCardTypography` SHALL gain `completedBadgeClassName` (default a `dial-*-text` scale class). The badge background SHALL default to transparent (both the Paused and Completed badges — only the schedule pill keeps a filled background), with the badge-text fallback chain `var(--stc-completed-text, var(--text-secondary, #57647a))` treating the badge as muted/secondary UI text (the repo's documented secondary-text exception), matching the Paused badge's treatment.

#### Scenario: Color overrides reach the completed badge

- **WHEN** a card is rendered with `styles.colors.completedBadgeText` set
- **THEN** the completed badge's text color resolves from `--stc-completed-text`

#### Scenario: Defaults apply without overrides

- **WHEN** a completed card is rendered with no `styles` prop
- **THEN** the badge renders with the stylesheet's token fallbacks and the default typography class

#### Scenario: Completed badge text uses the secondary text token by default

- **WHEN** the completed badge renders with no color overrides
- **THEN** its text and icon color resolves from `var(--text-secondary, #57647a)`, the same muted treatment as the Paused badge

## MODIFIED Requirements

### Requirement: Card active state is populated from the BFF isActive field

`map-scheduled-task-dto.ts` SHALL map `ScheduledTaskDto.isActive` to `ScheduledTaskItem.isActive` and `ScheduledTaskDto.isCompleted` to `ScheduledTaskItem.isCompleted` in `mapScheduledTaskDtoToItem`, with no reinterpretation of either value — the frontend SHALL NOT re-derive active/paused/completed state from `nextRunTime`, `triggerType`, run history, or any other field itself; both derivations are owned entirely by the BFF (see `scheduled-tasks-api`'s "Scheduled task active state field" and "Scheduled task completed-state field"). When `ScheduledTaskDto.isActive` is `undefined`, `ScheduledTaskItem.isActive` SHALL be `undefined`; when `ScheduledTaskDto.isCompleted` is `undefined` or `false`, the card resolves its status exactly as it does today — `isActive: true` or `undefined` renders the schedule pill, `isActive: false` renders the "Paused" badge, and only `isCompleted: true` renders the "Completed" badge.

#### Scenario: isActive false maps through to the card

- **WHEN** a `ScheduledTaskDto` with `isActive: false, isCompleted: false` is mapped and rendered
- **THEN** the resulting `ScheduledTaskItem.isActive` is `false`, and the card shows the "Paused" badge

#### Scenario: isActive true maps through to the card

- **WHEN** a `ScheduledTaskDto` with `isActive: true` is mapped and rendered
- **THEN** the resulting `ScheduledTaskItem.isActive` is `true`, and the card shows the schedule pill

#### Scenario: Missing isActive does not throw and shows the schedule pill

- **WHEN** a `ScheduledTaskDto` omits `isActive`
- **THEN** the resulting `ScheduledTaskItem.isActive` is `undefined`, mapping does not throw, and the card shows the schedule pill (not the "Paused" badge)

#### Scenario: isCompleted true maps through and renders the Completed badge

- **WHEN** a `ScheduledTaskDto` with `isCompleted: true, isActive: false` is mapped and rendered
- **THEN** the resulting `ScheduledTaskItem.isCompleted` is `true` and the card shows the "Completed" badge (not the "Paused" badge, not the schedule pill)

#### Scenario: isCompleted false or omitted leaves today's behavior untouched

- **WHEN** a `ScheduledTaskDto` with `isCompleted: false` or without `isCompleted` is mapped and rendered
- **THEN** the card renders exactly as it does before this change (schedule pill or "Paused" badge per `isActive`)

## MODIFIED Requirements

### Requirement: History run rows lead with the status icon and distinguish not-yet-viewed runs

Each run row in the History section SHALL show its status icon at the row start, at the kit MD icon size (`DIAL_ICON_SIZE.MD`) and the kit-wide icon weight (`DIAL_KIT_ICON_STROKE`). The timestamp SHALL follow the icon, and a fixed 12px slot SHALL sit at the row end. The end slot SHALL show the chevron on an expandable failed run (`status: Error` with non-empty `errorText`), the unread dot on any other row whose run is unread, and nothing otherwise. The row states and the accordion behavior are those of the `scheduled-task-detail-page` requirement "History rows show skeleton loading, status icon, timestamp, and duration". `ScheduledTaskConversationHistorySection` renders the same `ScheduledTaskRunHistoryList`, so the sources-panel History and the detail page cannot drift.

The row (pill) SHALL carry `px-3` (12px) horizontal padding on both sides, replacing the former end-only padding and its SCSS start-padding override. An expanded failed run's details region SHALL start at the timestamp's start edge, not under the status icon.

Viewed-row timestamps SHALL render at `dial-small-paragraph-text` (14px/24px). Rows whose run is not yet viewed (`isUnread`) SHALL render at `dial-small-paragraph-semi-text` (14px/24px, weight 600). Each surface can override this through the `runTimestampUnreadClassName` typography prop. `ScheduledTaskHistorySection` SHALL pass it through, with a default on its own 14/20 scale (`dial-small-semi-text`).

`ScheduledTaskConversationHistorySection` SHALL pass `labels.openConversationLabel` through to the list. The chat app's `apps/chat/src/components/ConversationSourcesPanel/TaskHistorySection/TaskHistorySection.tsx` SHALL fill it from the i18n key `scheduledTasks.detail.historyOpenConversationLabel`.

The History accordion's content region SHALL use a 12px inline-start inset (`contentClassName="ps-3"`), overriding the kit's 16px start padding.

RTL: `ps-3` and `px-3` are logical utilities, so the row order flips with `dir` automatically. The chevron is not mirrored.

#### Scenario: Status icon leads the row

- **WHEN** a run row renders
- **THEN** the status icon is the first element inside the row's start group, before the timestamp, at `DIAL_ICON_SIZE.MD` with the `DIAL_KIT_ICON_STROKE` weight

#### Scenario: Not-yet-viewed rows render semibold

- **WHEN** a row's run has `isUnread: true`
- **THEN** its timestamp carries `dial-small-paragraph-semi-text` while viewed rows carry `dial-small-paragraph-text`

#### Scenario: Unread dot sits at the row end

- **WHEN** a row's run has `isUnread: true` and the row is not an expandable failed run
- **THEN** the unread dot renders inside the reserved 12px slot at the row's end, so the timestamp width is identical across rows

#### Scenario: Failed run in the sources panel expands in place

- **WHEN** a task conversation's sources-panel History shows an `Error` run with `errorText`
- **THEN** the row's end slot shows the chevron instead of the dot
- **AND** activating the row reveals the error text under it, starting at the timestamp's edge
- **AND** the current-run highlight on any other row is unchanged

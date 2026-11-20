## MODIFIED Requirements

### Requirement: Schedule labels name a non-browser zone

The schedule label on the task card SHALL append the task's zone when it differs from the browser's zone, for example `Daily at 09:00 (Europe/Berlin)`, and SHALL NOT append it when equal. The detail view's "Repeats" label SHALL always append the task's zone, even when it equals the browser's, so it can be read next to the detail page's other zone-labelled values (see `scheduled-task-detail-page`). The detail view gets this by calling `buildScheduleLabel` (`apps/chat/src/utils/map-scheduled-task-dto.ts`) with `alwaysShowTimezone` set. Times in the label SHALL be the task's wall-clock times, not converted to the browser zone.

#### Scenario: Zone differs

- **WHEN** a daily 09:00 task has zone `Asia/Tokyo` and the browser zone is `Europe/Berlin`
- **THEN** the label is `Daily at 09:00 (Asia/Tokyo)` on both the card and the detail view

#### Scenario: Zone equals the browser zone

- **WHEN** both zones are `Europe/Berlin`
- **THEN** the card label is `Daily at 09:00`, and the detail view's Repeats label is `Daily at 09:00 (Europe/Berlin)`

## RENAMED Requirements

FROM: ### Requirement: Progress is a contract on the job, not rendered by the queue
TO: ### Requirement: Progress is rendered only as the collapsed-state aggregate

## MODIFIED Requirements

### Requirement: Progress is rendered only as the collapsed-state aggregate

`progress.percent` and `progress.units` SHALL be computed and carried on the job for hosts to read.
A job's own progress SHALL NOT be rendered on its row: an `InProgress` row shows the indeterminate
UI kit `Spinner` (see `conversation-panel-transfer-queue-ui`). The single exception is the
collapsed queue's aggregate indicator, which SHALL derive its value from `progress.percent` across
all jobs. Neither `libs/chat-shared` nor `libs/conversation-panel` SHALL render or construct a
translated unit string.

#### Scenario: The row surfaces activity, not completion

- **GIVEN** a job whose `progress` is `{ percent: 36, units: { completed: 3, total: 10, kind: Attachment } }`
- **WHEN** the row renders
- **THEN** neither the percentage nor the unit counts appear in the row's DOM or in any of its ARIA
  attributes

#### Scenario: The collapsed aggregate may read the percent

- **GIVEN** a collapsed queue holding jobs whose `progress.percent` values are `20` and `60`
- **WHEN** the queue renders
- **THEN** the aggregate indicator's value is `40`, derived from those percents

#### Scenario: The contract is still available to the host

- **GIVEN** a host reading `jobs` from `useConversationExport` or `useConversationImport`
- **WHEN** attachment units complete
- **THEN** `progress.percent` advances monotonically and `progress.units` reports the counts

#### Scenario: Per-job monotonicity does not imply queue monotonicity

- **GIVEN** a collapsed queue whose only job has settled at `100`
- **WHEN** a freshly enqueued job at `0` joins it
- **THEN** the aggregate value drops to `50`, and no job's own `percent` has decreased

## MODIFIED Requirements

### Requirement: Detail page header shows back navigation and title, plus an Edit action once loaded

The detail page header SHALL render a back-navigation control and the task's `displayName` as its title on the start side. Activating the back control SHALL navigate to `ROUTES.ScheduledTasks`. Once the task has loaded successfully, the header SHALL additionally render an outlined Edit button with a pencil icon (`IconEdit` from `@tabler/icons-react`) and a localized "Edit" label on the inline-end side. Activating Edit SHALL navigate to `getScheduledTaskEditRoute(scheduleId)` for the task currently being viewed. The header SHALL NOT render Delete, Active-toggle, or Run-now controls in this iteration, and SHALL NOT render the Edit button while the task is loading or failed to load.

#### Scenario: Back control returns to the list

- **WHEN** the user activates the back control on the detail page
- **THEN** the app navigates to `ROUTES.ScheduledTasks`

#### Scenario: Header shows back, title, and Edit once the task has loaded

- **WHEN** the detail page renders with a successfully loaded task
- **THEN** the header contains a back control and the task's `displayName` on the start side, an outlined Edit button with `IconEdit` and a localized "Edit" label on the end side, and no Delete/Active-toggle/Run-now control is present

#### Scenario: Edit button is absent while loading or on error

- **WHEN** the detail page is still fetching the task, or the task fetch has failed
- **THEN** the header does not render the Edit button

#### Scenario: Activating Edit navigates to the edit route for the current task

- **WHEN** the user activates the Edit button while viewing `/scheduled-tasks/sched_123`
- **THEN** the app navigates to `getScheduledTaskEditRoute('sched_123')`, which resolves to `/scheduled-tasks/sched_123/edit`

#### Scenario: Edit button is keyboard accessible

- **WHEN** a keyboard user tabs to the Edit button and presses Enter or Space
- **THEN** the same navigation occurs as with a pointer click, and the button exposes an accessible name of "Edit" (or the localized equivalent)

### Requirement: Presentational ScheduledTaskDetailView stays host-agnostic

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTaskDetailView` component accepting only props: localized label strings (including an Edit button label), detail field values (`description`, model display value, schedule label), either `instructionsMarkdown: string` or a `renderInstructions: (markdown: string) => ReactNode` callback, a runs list plus `{ runsHasMore, runsIsLoadingMore, runsSkeletonCount, onRunsLoadMore }`, top-level `isLoading`/`error` flags and their History-scoped counterparts, an `onBack` callback, and an optional `onEdit?: () => void` callback. When `onEdit` is supplied, the component SHALL render the Edit button described above in an end-side header slot; when `onEdit` is omitted, no Edit button SHALL render. The component SHALL NOT import `@epam/chat-api-client`, any routing module, i18n, or auth/env/analytics modules — all host/external knowledge, including the `scheduleId`-based navigation target, is resolved by the host page and passed in via the `onEdit` callback per the repo's library-isolation rule.

#### Scenario: Lib has no host or integration imports

- **WHEN** `libs/scheduled-tasks`'s `ScheduledTaskDetailView` source is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, routing, feature-flag, auth, env, or analytics modules

#### Scenario: Instructions rendering is delegated when a callback is supplied

- **WHEN** `ScheduledTaskDetailView` renders with a `renderInstructions` callback supplied
- **THEN** the Instructions content is produced by calling that callback with the `prompt` markdown string, rather than the lib rendering markdown itself

#### Scenario: onBack is invoked without the lib performing navigation

- **WHEN** the user activates the back control rendered by `ScheduledTaskDetailView`
- **THEN** `onBack` is called exactly once, and the lib performs no `navigate`/history call itself

#### Scenario: onEdit is invoked without the lib performing navigation

- **WHEN** the user activates the Edit button rendered by `ScheduledTaskDetailView`
- **THEN** `onEdit` is called exactly once, and the lib performs no `navigate`/history call or `scheduleId` resolution itself

#### Scenario: Edit button renders only when onEdit is supplied

- **WHEN** `ScheduledTaskDetailView` renders with `onEdit` left `undefined`
- **THEN** no Edit button is present in the header, regardless of loading state

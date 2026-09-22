# @epam/ai-dial-scheduled-tasks

## Overview

Presentational components for a host app's Scheduled Tasks feature: a page shell (`ScheduledTasks`) with a header, search/sort toolbar, and a flat grid of task cards (`ScheduledTaskCardGrid`, `ScheduledTaskCard`), plus a create-task form (`ScheduledTaskCreateForm`). All user-visible strings, callbacks, and state (loading, error, search query, sort key, form values, validation errors) are provided by the consuming app via props; this lib has no knowledge of routing, feature flags, i18n, or any backend API — it performs no date/locale formatting or data fetching of its own.

Use this lib when building a host app's Scheduled Tasks pages: wire up i18n, feature-flag gating, data fetching, and local UI state (search query, sort key, form values) at the app level, then render `<ScheduledTasks />` for the list page and `<ScheduledTaskCreateForm />` for the create page with the resolved strings, items, and handlers.

## Installation

Requires UI Kit ^0.15.0-dev.9 or later with the public `/editors` entry.
The Markdown loader uses that entry, and library builds keep UI Kit subpaths
external to preserve the editor's dynamic boundary in consuming applications.

```json
{
  "dependencies": {
    "@epam/ai-dial-scheduled-tasks": "*"
  }
}
```

## Peer Dependencies

Import `@epam/ai-dial-scheduled-tasks/styles.css` once in the host. It includes
the structural CSS required by `@epam/ai-dial-builder-form`; import UI Kit
base/theme styles once at the host root.

- `react`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-chat-shared`

## Components

The optional `className`, icon, `styles`, and layout props are per-instance.
Typed values take precedence over the package's CSS-variable fallbacks, which
then use host theme tokens. Omitting an icon retains the default; `null` hides
it while preserving the control's accessible name and keyboard behaviour.

### ScheduledTasks

Page shell: header with title/subtitle/create action, a search + sort toolbar, an optional `banner` slot, and a content region that shows a loading spinner, an error with retry, the empty state, a no-results state, or a section-grouped card grid, depending on `isLoading`/`error`/`items`.

The sort control's trigger shows the active option's label, falling back to `labels.sortLabel` when `sortKey` matches no option. Inside the menu each option is a `menuitemcheckbox` whose `aria-checked` marks the sort currently in effect, with a check icon carrying the same meaning visually; picking one reports through `onSortChange` and closes the menu. The lib never sorts `items` — it renders them in the order it receives them.

`banner` renders between the toolbar and the content region, in every content-region state (loading, error, empty, populated). It is opaque `ReactNode` content — the host app decides what it contains (e.g. a status notice); the lib attaches no behavior or styling to it beyond layout placement.

```tsx
import {
  ScheduledTasks,
  ScheduledTasksSortKey,
} from '@epam/ai-dial-scheduled-tasks';

<ScheduledTasks
  labels={{
    title: 'Scheduled tasks',
    subtitle:
      'Automate recurring tasks with scheduled runs, or execute them on demand whenever you need.',
    createButtonLabel: 'New task',
    searchPlaceholder: 'Search scheduled tasks...',
    searchAriaLabel: 'Search scheduled tasks by name',
    clearSearchLabel: 'Clear scheduled tasks search',
    sortLabel: 'Sort',
    sortOptions: [
      { value: ScheduledTasksSortKey.FirstToRun, label: 'First to run' },
      { value: ScheduledTasksSortKey.LastToRun, label: 'Last to run' },
    ],
    emptyStateLabel: 'No scheduled tasks yet',
    noResultsLabel: 'No results',
    errorLabel: 'Something went wrong',
    retryLabel: 'Retry',
  }}
  onCreateClick={() => {}}
  searchQuery=""
  onSearchQueryChange={() => {}}
  sortKey={ScheduledTasksSortKey.FirstToRun}
  onSortChange={() => {}}
  items={[]}
  banner={<div>Log in required to run scheduled tasks offline.</div>}
/>;
```

### ScheduledTaskCard

A single scheduled task rendered as a card: title, optional description/prompt preview, schedule pill, and optional location breadcrumb and "new" badge. When `onCardClick` is supplied, the whole card becomes an activatable element (click or Enter/Space) reporting the task id.

`item.presentationStatus` takes precedence over the legacy `isActive` flag;
when omitted, `isActive` retains its existing behavior. Supply
`labels.completedBadgeLabel` for localized completed-state copy.

```tsx
import { ScheduledTaskCard } from '@epam/ai-dial-scheduled-tasks';

<ScheduledTaskCard
  item={{
    id: 'sched_1',
    displayName: 'Competitor Updates',
    scheduleLabel: 'Every Monday 12:00',
  }}
  onCardClick={(id) => {}}
/>;
```

### ScheduledTaskCardGrid

`ScheduledTaskCardGrid` renders a responsive grid of `ScheduledTaskCard`s for a list of items, in the order received — no grouping or client-side sorting.

### ScheduledTaskCreateForm

Presentational create-task form: a back-navigable header, display name, a one-shot/recurring schedule section (with an optional Start date / End date pair bounding a recurring schedule's activity window), a Model or Agent field, a description field, and a markdown Instructions editor. Field values and validation errors are supplied by the host app; the Model or Agent field's control is a fully-composed `modelSelector` element the host renders — the lib wraps it with the field's required label and error message. Every other field, including the masked time-of-day picker (shown when `repeat` is "daily", "weekly", or "monthly"), is lib-owned: the picker shows the viewer's timezone hint and validates its visible draft on blur, since the ui kit's masked time input only reports complete `HH:mm` values through `onChange` — while that blur error is set, Save stays disabled so a half-typed draft cannot be saved as the stale last-complete value. Every blur reports the visible draft through `onFieldChange('time', …)` — complete or not — so a host that clears a field's error on change also clears its own `errors.time` without the value having to change; the blur pass validates the draft separately and keeps showing its own message for incomplete ones. The one-shot run-at picker is the internal `ScheduledTaskRunAtField` component: it cannot select a moment earlier than the field's mount time — the earliest selectable moment is pinned when the field mounts, so past days render unselectable while the mount date and future days stay selectable. The form's only internal state is the time field's blur error, which resets when a repeat switch hides the field.

`isSubmitting` disables Cancel and Save **and** gives Save a busy affordance — a spinner, `aria-busy`, and an announcement of `labels.submittingLabel` (default `'Saving'`). Save is equally disabled whenever a required field is empty or the time draft is invalid, so the affordance is the only thing that separates "submitting" from "not ready".

```tsx
import {
  ScheduledTaskCreateForm,
  ScheduledTaskRepeat,
} from '@epam/ai-dial-scheduled-tasks';

<ScheduledTaskCreateForm
  labels={{/* ... */}}
  values={{
    displayName: '',
    repeat: ScheduledTaskRepeat.Daily,
    time: '09:00',
    minute: '0',
    startDate: '',
    endDate: '',
    modelId: '',
    prompt: '',
  }}
  errors={{}}
  modelSelector={<button type="button">Select Model or Agent</button>}
  modelLabelId="model-label"
  onFieldChange={(field, value) => {}}
  onBack={() => {}}
  onCancel={() => {}}
  onSubmit={() => {}}
  isSubmitting={false}
  markdownEditorTheme="light"
/>;
```

### ScheduledTaskDetailView

Presentational detail page for a single scheduled task: a back-navigable header with an optional Edit action, a Details/Configuration body (description, model/agent, recurrence, activity window, read-only markdown instructions), and a paginated History panel listing past runs with a status icon, timestamp, and duration per row, with a "Show more" button (not scroll-triggered) for loading further pages. A run row renders as clickable only when its item carries a non-empty `conversationId` and `onRunClick` is supplied — rows without a `conversationId` stay static even if `onRunClick` is passed for the list. A row whose item has `isUnread: true` additionally renders a small unread-dot indicator before its timestamp. At the desktop breakpoint the Details, Configuration, and History sections render side by side in a three-column layout; below it (mobile and tablet) they render as a tab row — Details active by default — with one section visible at a time and the History panel in standard top-to-bottom page flow (inline "Show more", no self-scrolling card). Field values, runs, and markdown rendering are all supplied by the host app; this component performs no routing, i18n, or network calls, and its only internal state is the selected mobile tab.

```tsx
import {
  ScheduledTaskDetailView,
  ScheduledTaskRunStatus,
} from '@epam/ai-dial-scheduled-tasks';

<ScheduledTaskDetailView
  labels={{/* ..., unreadIndicatorLabel: 'Unread' */}}
  onBack={() => {}}
  onEdit={() => {}}
  displayName="Daily summary"
  description="Summarizes unread inbox items every morning"
  modelLabel="GPT-4.1 mini"
  repeatsLabel="Every Monday 12:00"
  nextRunLabel="Next run: Jul 31 at 9:00 AM"
  instructionsMarkdown="Summarize my inbox"
  runs={[
    {
      id: 'run_1',
      status: ScheduledTaskRunStatus.Success,
      timestampLabel: 'today at 9:01 AM (99s)',
      conversationId: 'conversations/bucket/.scheduler/sched_123/run_1',
      isUnread: true,
    },
  ]}
  onRunsLoadMore={() => {}}
  onRunClick={(run) => navigateToConversation(run.conversationId)}
/>;
```

### ScheduledTaskDeleteConfirmation

Controlled deletion presentation that leaves mutations, routing, notifications,
and translated copy to the host. `isDeleting` prevents duplicate confirmation
and dismissal callbacks.

```tsx
import { ScheduledTaskDeleteConfirmation } from '@epam/ai-dial-scheduled-tasks';

<ScheduledTaskDeleteConfirmation
  open={isDeleteOpen}
  taskName={task.displayName}
  title="Delete task"
  body="This action cannot be undone."
  cancelLabel="Cancel"
  confirmLabel="Delete"
  isDeleting={isDeleting}
  onClose={closeDelete}
  onConfirm={deleteTask}
/>;
```

## Validation entry point

Use the pure validation entry before an app submits a task. It returns typed
error codes rather than translated text, and accepts an injected clock for
deterministic validation.

```ts
import { validateScheduledTaskFormValues } from '@epam/ai-dial-scheduled-tasks/validation';

const errors = validateScheduledTaskFormValues(values, { now: new Date() });
```

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key        | Class                            | Element                              |
| ---------- | -------------------------------- | ------------------------------------ |
| `card`     | `dial-scheduled-tasks-card`      | One task card                        |
| `cardGrid` | `dial-scheduled-tasks-card-grid` | The responsive grid the cards sit in |

```tsx
import { SCHEDULED_TASKS_CLASS } from '@epam/ai-dial-scheduled-tasks';

SCHEDULED_TASKS_CLASS.card; // 'dial-scheduled-tasks-card'
```

The card is a `CardShell` from [`@epam/ai-dial-ui-kit`](https://www.npmjs.com/package/@epam/ai-dial-ui-kit),
so `dial-kit-card-shell` is on the same element — this class is what tells a
task card apart from any other card in the same host. Its accessible name is
the task's display name, so the role and name were never usable as a selector.

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.

## Constants

### TIME_OF_DAY_PATTERN

24-hour `HH:mm` time-of-day pattern matching the `Calendar` time control's value shape. The create form's blur validation uses it internally; it is exported so a host's submit-time validation and the lib's field agree on what a valid time is.

```ts
import { TIME_OF_DAY_PATTERN } from '@epam/ai-dial-scheduled-tasks';

TIME_OF_DAY_PATTERN.test('09:30'); // true
TIME_OF_DAY_PATTERN.test('9:5'); // false
```

### DESCRIPTION_MAX_LENGTH

Maximum length of the create form's description field: `500` characters.

```ts
import { DESCRIPTION_MAX_LENGTH } from '@epam/ai-dial-scheduled-tasks';
```

## Review corrections: layout, history and package boundaries

Import UI Kit base/theme CSS once and the public scheduler stylesheet:

```ts
import '@epam/ai-dial-ui-kit/styles.css';
import '@epam/ai-dial-scheduled-tasks/styles.css';
```

The scheduler stylesheet includes the **built CSS Modules** of builder-form.
Do not import builder source styles: compiling a module as plain CSS loses
the class names used by the published JavaScript.

- `gridLayout` (or CardGrid's `layout`) supports `maxColumns` (3),
  `minCardWidth` (320px), `maxWidth` (1180px), `gap` (20px) and
  `cardHeight` (232px). Columns respond to the available container width;
  skeletons inherit the same height.
- Card colors `pausedTitleText` and `completedTitleText` override
  `titleText` for that status only. CardGrid accepts every card badge label.
- Form `styles.layout.detailsWidth` and `columnGap` configure the shared
  builder layout. The scheduler uses two wrapping columns without an empty
  third column. Generic builder forms retain their existing default layout.
- Detail columns wrap when their requested sizes cannot fit. Existing mobile
  tabs remain. History width excludes its surrounding 24px padding.
- Detail accepts `runsLoadMoreError` and `onRunsRetryLoadMore`; the standalone
  HistorySection accepts `loadMoreError` and `onRetryLoadMore`. These show a
  footer error without replacing loaded runs. `historyLoadMoreErrorLabel`
  defaults to `historyErrorLabel`.
- Delete confirmation `cancelAppearance` defaults to UI Kit
  `ButtonAppearance.Ghost`. Existing title/action class settings still apply.
- Scheduler forms/details default to a narrow back arrow; explicit
  `backIcon` replaces it, and `null` hides it.

The `/validation` subpath ships its own JavaScript and declaration entry and
can be imported without mounting UI. The packed consumer's test target checks
real installed types, imports, CSS, grid sizing and interactions:

```sh
npm exec nx run scheduled-tasks-consumer-fixture:test
```

Responsive visibility and spacing in scheduler surfaces and their builder shell
use scoped CSS with the package's 1280px desktop threshold. Host utility styles
using a different desktop threshold do not expose duplicate titles/actions or
show the Create label inside its mobile icon button. The packed fixture checks
both stylesheet orders in LTR and RTL at 360, 900, 1279, 1280 and 1920px.

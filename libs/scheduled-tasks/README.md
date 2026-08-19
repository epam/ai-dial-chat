# @epam/ai-dial-scheduled-tasks

## Overview

Presentational components for a host app's Scheduled Tasks feature: a page shell (`ScheduledTasks`) with a header, search/sort toolbar, and a flat grid of task cards (`ScheduledTaskCardGrid`, `ScheduledTaskCard`), plus a create-task form (`ScheduledTaskCreateForm`). All user-visible strings, callbacks, and state (loading, error, search query, sort key, form values, validation errors) are provided by the consuming app via props; this lib has no knowledge of routing, feature flags, i18n, or any backend API — it performs no date/locale formatting or data fetching of its own.

Use this lib when building a host app's Scheduled Tasks pages: wire up i18n, feature-flag gating, data fetching, and local UI state (search query, sort key, form values) at the app level, then render `<ScheduledTasks />` for the list page and `<ScheduledTaskCreateForm />` for the create page with the resolved strings, items, and handlers.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-scheduled-tasks": "*"
  }
}
```

## Peer Dependencies

- `react`
- `@tabler/icons-react`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-builder-form`

## Components

### ScheduledTasks

Page shell: header with title/subtitle/create action, a search + sort toolbar, and a content region that shows a loading spinner, an error with retry, the empty state, a no-results state, or a section-grouped card grid, depending on `isLoading`/`error`/`items`.

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
      { key: ScheduledTasksSortKey.FirstToRun, label: 'First to run' },
      { key: ScheduledTasksSortKey.LastToRun, label: 'Last to run' },
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
/>;
```

### ScheduledTaskCard

A single scheduled task rendered as a card: title, optional description/prompt preview, schedule pill, and optional location breadcrumb and "new" badge. When `onCardClick` is supplied, the whole card becomes an activatable element (click or Enter/Space) reporting the task id.

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

Presentational create-task form: a back-navigable header, display name, a one-shot/recurring schedule section (with an optional Start date / End date pair bounding a recurring schedule's activity window), a Model or Agent field, a description field, and a markdown Instructions editor. Field values and validation errors are supplied by the host app; the Model or Agent field's control itself is a fully-composed `modelSelector` element the host renders — the lib only wraps it with the field's required label and error message. This component holds no state of its own.

```tsx
import {
  ScheduledTaskCreateForm,
  ScheduledTaskRepeat,
} from '@epam/ai-dial-scheduled-tasks';

<ScheduledTaskCreateForm
  labels={
    {
      /* ... */
    }
  }
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
  markdownEditorTheme="light"
/>;
```

### ScheduledTaskDetailView

Presentational detail page for a single scheduled task: a back-navigable header with an optional Edit action, a Details/Configuration body (description, model/agent, recurrence, activity window, read-only markdown instructions), and a paginated History panel listing past runs with a status icon, timestamp, and duration per row, with a "Show more" button (not scroll-triggered) for loading further pages. Field values, runs, and markdown rendering are all supplied by the host app; this component holds no state of its own and performs no routing, i18n, or network calls.

```tsx
import {
  ScheduledTaskDetailView,
  ScheduledTaskRunStatus,
} from '@epam/ai-dial-scheduled-tasks';

<ScheduledTaskDetailView
  labels={
    {
      /* ... */
    }
  }
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
    },
  ]}
  onRunsLoadMore={() => {}}
/>;
```

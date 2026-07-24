# @epam/ai-dial-scheduled-tasks

## Overview

Presentational Scheduled Tasks page shell: a header (title, subtitle, primary "create task" action), a toolbar (search input and sort control), and a content area. The content area always renders a centered empty state — this lib does not yet render task cards, list rows, or any grouping of tasks, since no scheduled-task data contract exists yet. All user-visible strings, callbacks, and state are provided by the consuming app via props; this lib has no knowledge of routing, feature flags, i18n, or any backend API.

Use this lib when building a host app's Scheduled Tasks page: wire up i18n, feature-flag gating, and local UI state (search query, sort key) at the app level, then render `<ScheduledTasks />` with the resolved strings and handlers.

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
- `@epam/ai-dial-kit`
- `@epam/ai-dial-chat-shared`

## Components

### ScheduledTasks

```tsx
import { ScheduledTasks } from '@epam/ai-dial-scheduled-tasks';

<ScheduledTasks
  texts={{
    title: 'Scheduled tasks',
    subtitle:
      'Automate recurring tasks with scheduled runs, or execute them on demand whenever you need.',
    createButtonLabel: 'New task',
    searchPlaceholder: 'Search scheduled tasks...',
    searchAriaLabel: 'Search scheduled tasks by name',
    clearSearchLabel: 'Clear scheduled tasks search',
    sortLabel: 'Sort',
    sortOptions: [
      { key: 'firstToRun', label: 'First to run' },
      { key: 'lastToRun', label: 'Last to run' },
    ],
    emptyStateLabel: 'No scheduled tasks yet',
  }}
  onCreateClick={() => {}}
  searchQuery=""
  onSearchQueryChange={() => {}}
  sortKey="firstToRun"
  onSortChange={() => {}}
/>;
```

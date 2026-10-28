# @epam/ai-dial-projects

## Overview

Presentational Projects page for a host app. `Projects` renders a header, a search and sort toolbar, and a grid of project cards. Each card shows the project's name with the search match highlighted, a source badge (personal, shared or organization) and the last-updated date. The component filters the projects by name and sorts them itself (Newest, Oldest or Name A–Z). It renders exactly one content state at a time: loading, error with retry, empty, no results, or the list. When the host reports `incompleteSources`, a notice with a retry action sits above the list; with nothing listed, that notice replaces the empty state so the page never claims there are no projects.

The lib knows nothing about routing, feature flags, i18n or any backend API. The host loads the projects, owns the search query and sort key, resolves every string, and formats dates. Use it when a host app needs a Projects list page. Wire data fetching and feature gating at the app level, then render `<Projects />` with the resolved strings, items and handlers.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-projects": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-projects/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-chat-shared`

## Components

### Projects

Page shell with:

- an `<h1>` title and a subtitle;
- a search input inside a `role="search"` landmark;
- a sort control inside a `role="group"` named by `labels.sortLabel`. Its trigger shows the applied option's label, or `labels.sortLabel` when `sortKey` matches no option;
- the content region.

Search matches project names case-insensitively, using the trimmed `searchQuery`, and highlights the match. In both date orders, projects without `updatedAt` come last. Name A–Z collates with `Intl.Collator(locale, { sensitivity: 'base', numeric: true })`.

A visually hidden `role="status"` region announces:

- `labels.resultCountLabel(count)` while the list is shown;
- `labels.noResultsLabel`, `labels.emptyStateLabel`, `labels.errorLabel` or `labels.incompleteLabel` in the matching state;
- nothing while loading.

Cards are not interactive.

```tsx
import {
  Projects,
  ProjectSource,
  ProjectsSortKey,
} from '@epam/ai-dial-projects';

<Projects
  projects={[
    {
      id: 'projects/a1b2c3/q4-launch',
      name: 'Q4 launch',
      source: ProjectSource.Personal,
      updatedAt: 1791234567000,
    },
  ]}
  isLoading={false}
  hasError={false}
  incompleteSources={[]}
  onRetry={() => {}}
  searchQuery=""
  onSearchQueryChange={() => {}}
  sortKey={ProjectsSortKey.Newest}
  onSortKeyChange={() => {}}
  formatUpdatedAt={(timestamp) =>
    `Updated ${new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(timestamp)}`
  }
  locale="en"
  labels={{
    title: 'Projects',
    subtitle:
      'Projects you own, projects shared with you, and your organization’s projects',
    searchPlaceholder: 'Search projects',
    searchAriaLabel: 'Search projects',
    clearSearchLabel: 'Clear search',
    sortLabel: 'Sort',
    sortOptions: [
      { value: ProjectsSortKey.Newest, label: 'Newest' },
      { value: ProjectsSortKey.Oldest, label: 'Oldest' },
      { value: ProjectsSortKey.NameAsc, label: 'Name A–Z' },
    ],
    emptyStateLabel: 'No projects yet',
    emptyStateDescription: 'Your projects will appear here once created.',
    noResultsLabel: 'No projects match your search',
    errorLabel: 'Projects could not be loaded',
    incompleteLabel:
      'Some projects could not be loaded. The list may be incomplete.',
    retryLabel: 'Retry',
    sourceLabels: {
      [ProjectSource.Personal]: 'Personal',
      [ProjectSource.Shared]: 'Shared',
      [ProjectSource.Organization]: 'Organization',
    },
    resultCountLabel: (count) => `${count} projects`,
  }}
/>;
```

The layout is mobile-first:

- On mobile, the toolbar stacks the search above the sort control, and cards use a single column.
- From the `desktop` breakpoint, the toolbar is one row and the grid fills columns of at least 280px.

Only logical properties are used, so the layout follows the inherited `dir`.

`styles.colors` overrides the CSS custom properties. Each one falls back to the matching app theme token:

| Field             | Fallback            |
| ----------------- | ------------------- |
| `background`      | `--bg-layer-base`   |
| `subtitleText`    | `--text-secondary`  |
| `sortButtonText`  | `--text-accent`     |
| `cardBackground`  | `--bg-layer-raised` |
| `cardBorder`      | `--stroke-tertiary` |
| `cardTitleText`   | `--text-primary`    |
| `badgeBackground` | `--bg-layer-sunken` |
| `badgeText`       | `--text-primary`    |
| `metaText`        | `--text-secondary`  |

`styles.typography` overrides the type-scale classes:

| Field                | Default                 |
| -------------------- | ----------------------- |
| `titleClassName`     | `'dial-h1-text'`        |
| `subtitleClassName`  | `'dial-body-text'`      |
| `cardTitleClassName` | `'dial-body-semi-text'` |
| `badgeClassName`     | `'dial-tiny-semi-text'` |
| `metaClassName`      | `'dial-small-text'`     |

## Enums

### ProjectSource

Where a project comes from: `Personal` (`'personal'`), `Shared` (`'shared'`), `Organization` (`'organization'`).

### ProjectsSortKey

Order of the visible projects: `Newest` (`'newest'`), `Oldest` (`'oldest'`), `NameAsc` (`'name-asc'`).

## Types

- `ProjectItem` — `{ id, name, source, updatedAt? }`, one card.
- `ProjectsLabels` — every user-visible string, including `sourceLabels` and the `resultCountLabel` callback.
- `ProjectsProps` — the props of `Projects`.
- `ProjectsStyles`, `ProjectsColors`, `ProjectsTypography` — style overrides.

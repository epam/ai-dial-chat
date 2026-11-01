## MODIFIED Requirements

### Requirement: The app owns project data through useProjects

Data state SHALL be owned by the `useProjects(enabled: boolean)` hook (`apps/chat/src/hooks/projects/useProjects.ts`, one hook per file, with JSDoc on why it exists). It adapts the shared `useProjects` of `libs/chat-hooks/src/project/use-projects.ts` to the app's `projectsClient`. No new React context is introduced, because only the page consumes the data.

The hook calls `listProjects({ signal })` from `apps/chat/src/server-api/projects.api.ts`. That wrapper calls `projectsApi.listProjects(...)` on the `ProjectsApi` instance exported from `apps/chat/src/server-api/api-client.ts`; no `fetch` and no `base.ts` helper is used. The hook maps each `ProjectDto` through `mapProjectDtoToItem` (`libs/chat-hooks/src/project/project-mapping.ts`), which maps `ProjectSource` onto the lib's `ProjectSource`.

The hook returns `{ projects, incompleteSources, isLoading, hasError, retry }`:

- It fetches inside `useEffect` with an `AbortController`, and aborts on unmount or when `enabled` turns false. A cancelled request never sets state.
- `isLoading` is derived, not stored: it is `true` whenever `enabled` is `true` and no result answers the current reload token. An enabled page is therefore loading from its first enabled render, including the render where the app config first becomes ready, and never momentarily shows the empty state.
- `retry` is a stable `useCallback` that re-runs the fetch.
- While `enabled` is `false`, the hook sends no request.

**Live updates.** When the client provides `watchProjects` and a load succeeded with at least one project, the hook SHALL open `watchProjects(ids, signal)`. `ids` are the first `PROJECTS_WATCH_MAX_IDS` (1000) listed ids in list order. The hook SHALL apply every decoded `ProjectWatchEvent` through the pure reducer `applyProjectEvent` (`libs/chat-hooks/src/project/project-events.ts`):

- `UPDATE` or `CREATE` for a listed id sets that item's `updatedAt` to the larger of its current value and the event `timestamp`;
- `DELETE` for a listed id removes the item;
- an event for an unlisted id changes nothing;
- when nothing changes, the reducer returns the same `projects` reference.

**Subscription key.** The watch is keyed on the sorted, joined id set. It is reopened only when that set changes through a load, a retry or a silent refresh. A `DELETE` does not reopen it. Unmount, `enabled` turning `false`, or a key change aborts the open stream.

**Failures:**

- If opening the watch fails (rejected promise or non-2xx), live updates stay off for the rest of the visit. There is no retry, no error state and no user-visible message.
- If an open stream ends or errors, the hook reconnects after 1, 2, 4, 8 and 16 seconds. After the last failed attempt, live updates stay off.
- After a successful reconnect, the hook reloads the list silently. `isLoading` stays `false`, the current `projects` stay visible until the new result replaces them, and a failed silent reload keeps the current list without entering the error state.

#### Scenario: Successful load populates the list

- **WHEN** the page mounts with the flag on and `listProjects` resolves with three items
- **THEN** `isLoading` goes from `true` to `false`, `projects` has three mapped items, and `hasError` is `false`

#### Scenario: The first enabled render is already loading

- **WHEN** the hook first renders with `enabled: false` (app config not ready) and then with `enabled: true`
- **THEN** every render with `enabled: true` reports `isLoading: true` until the response arrives

#### Scenario: Unmount aborts the request

- **WHEN** the page unmounts while `listProjects` is pending
- **THEN** the request's `AbortSignal` is aborted, and no state update happens after unmount

#### Scenario: Retry refetches after an error

- **WHEN** `listProjects` rejects and the user activates the retry action
- **THEN** `listProjects` is called again, and a successful second response replaces the error state with the list

#### Scenario: A live update moves a project forward

- **WHEN** the list holds `projects/public/handbook` with `updatedAt: 1000`, and the watch emits `{ id: 'projects/public/handbook', action: 'UPDATE', timestamp: 5000 }`
- **THEN** that item's `updatedAt` becomes `5000`, and `watchProjects` is not called again

#### Scenario: An older event does not move the date back

- **WHEN** an item has `updatedAt: 5000`, and an `UPDATE` with `timestamp: 4000` arrives
- **THEN** the item keeps `updatedAt: 5000`, and `projects` keeps its reference

#### Scenario: A deleted project disappears

- **WHEN** the watch emits `{ id: 'projects/public/handbook', action: 'DELETE', timestamp: 6000 }`
- **THEN** `projects` no longer contains that item, and no new watch is opened

#### Scenario: Unsupported Core leaves the page as it was

- **WHEN** `watchProjects` rejects on open
- **THEN** `projects`, `isLoading` and `hasError` are unchanged, and `watchProjects` is not called again during the visit

#### Scenario: A dropped stream reconnects and refreshes silently

- **WHEN** an open watch stream ends, and the reconnect after 1 second succeeds
- **THEN** `listProjects` is called again while `isLoading` stays `false` and the current cards stay rendered, and the new result replaces them

#### Scenario: Unmount closes the watch

- **WHEN** the page unmounts with an open watch
- **THEN** the `AbortSignal` passed to `watchProjects` is aborted

### Requirement: Each project card shows its name and folder path

The lib SHALL render the visible projects as a list (`<ul>` with one `<li>` per project), keyed by `id`. Each card is the kit `CardShell` (an `<article>` with the design's radius, padding and shadow), named by the project name through `aria-label`. It shows, top to bottom with an 8px gap:

- when `updatedAt` is set, the last-updated time relative to the reference time, in a `<time>` element whose `dateTime` is the ISO timestamp, formatted with `Intl.RelativeTimeFormat(locale)` in the largest whole unit (e.g. `49 minutes ago`, `1 week ago`; under a minute reads `now`);
- the name, through `Highlight` with `maxLines={1}`;
- in the card's top inline-end corner, inside the card padding (the first row keeps clear of it), after the name in reading order: when the host passes `onTogglePin(id, isPinned)`, a kit `GhostIconButton` (`ElementSize.Small`) named by `labels.pinLabel` (default `'Pin'`) with `aria-pressed={isPinned}`, showing `IconPinFilled` when pinned and `IconPin` otherwise. It is painted above the stretched link, so its click never opens the project. An unpinned card's toggle is shown on card hover or focus within the card, and always where the pointer cannot hover. Without `onTogglePin`, a pinned card shows an `IconPinFilled` marker (`aria-hidden`) followed by visually hidden `labels.pinnedLabel` text;
- the kit `FolderPath`, with no divider above it, named by `labels.folderPathLabel`, whose segments are `labels.sourceLabels[source]` followed by the `/`-separated `parentPath` folders.

The reference time SHALL be taken from `Date.now()` again whenever the `projects` prop reference changes, and kept otherwise (`Projects` in `libs/projects/src/components/Projects/Projects.tsx`). A project updated while the page is open therefore reads `now` rather than a time relative to when the page was mounted. With an unchanged `projects` reference, the times stay a snapshot and do not tick.

No description or source badge is rendered: the listing carries no description, and the design shows the source only in the folder path.

**Interactive cards.** When `onOpenProject` and `getProjectHref` are supplied, the name SHALL be an `<a href={getProjectHref(id)}>`. Its `::after` is stretched over the card, so the whole card is the click target, while the link remains the single tab stop. A primary click without modifier keys calls `event.preventDefault()` and then `onOpenProject(id)`. A modified or middle click follows the `href`, so the project opens in a new tab. Hover and `:focus-visible` apply the same card highlight: the kit `CardShell` lift with `shadow-lg` (none under `prefers-reduced-motion`), plus a focus outline in `--stroke-focus` on `:focus-visible`. The card background does not change.

Without those props, cards are not interactive: no link, button or `tabIndex`.

The **New project** buttons are specified separately, in "Projects page offers New project in the header and the empty state".

**RTL impact:** the pin marker or toggle sits in the top inline-end corner through logical properties (`inset-e-*`, `pe-*`), so it moves to the left in RTL, and the icon is not mirrored. **i18n impact:** `projects.card.pinned` ("Pinned"); `ProjectsPage` fills `labels.pinLabel` from `ButtonsI18nKeys.Pin` and reports a failed pin with `projects.actions.pinError`, both existing keys.

#### Scenario: Card content

- **WHEN** a project `{ name: 'Handbook', source: ProjectSource.Organization, updatedAt: 1789000000000 }` is rendered
- **THEN** its card is an `<article>` named `Handbook` that shows a `<time>` element with the relative last-updated time, the name, and a folder path containing only the organization source label

#### Scenario: Undated card has no time

- **WHEN** a project has no `updatedAt`
- **THEN** its card renders no `<time>` element

#### Scenario: Nested project shows its folders

- **WHEN** a project has `source: ProjectSource.Personal` and `parentPath: 'marketing/2026'`
- **THEN** its folder path reads Personal, then `marketing`, then `2026`

#### Scenario: Clicking a card opens the project

- **WHEN** the user clicks the `Handbook` card on the Projects page
- **THEN** `onOpenProject('projects/public/handbook')` is called, and the router is at `/projects/view/public/handbook`

#### Scenario: Card link supports a new tab

- **WHEN** the user Ctrl+clicks or middle-clicks the card
- **THEN** `onOpenProject` is not called, and the link's `href` is `/projects/view/public/handbook`

#### Scenario: Pinned card is marked

- **WHEN** a project has `isPinned: true` and no `onTogglePin` is passed
- **THEN** its card contains the text "Pinned", available to assistive technology

#### Scenario: Pinning from the list

- **WHEN** the Projects page passes `onTogglePin`, and the user activates the pin toggle of an unpinned card
- **THEN** `onTogglePin(id, true)` is called, the project does not open, and the app pins it through `UserConfigContext` `setPinnedProject`; a failure rolls the pin back and shows the `projects.actions.pinError` notification

#### Scenario: A live update reads as now

- **WHEN** the page was mounted ten minutes ago, and the host passes a new `projects` array in which one item's `updatedAt` is the current time
- **THEN** that card's `<time>` reads `now`

### Requirement: Projects page is mobile-first, RTL-safe and meets WCAG 2.1 AAA

The Projects lib and page SHALL meet the layout, RTL, accessibility and memoisation rules below.

**Layout:**

- The lib layout SHALL be mobile-first. Cards use one column with a 16px gap by default and, under the `desktop:` variant from `tools/tailwind/theme.css`, three columns with a 20px gap in a centred grid at most 1116px wide.
- Under `desktop:`, the header, the toolbar and the content area have 32px inline padding; the header has 16px block padding, the toolbar 16px above and 20px below, and the content area 24px above. On mobile, the toolbar has 16px padding on every side, the content area 16px inline padding and none above, and 80px below so the floating **New project** button never covers the last card.
- On mobile, the toolbar keeps the search and the sort control on one row with an 8px gap: the search at `ElementSize.Standard` and the sort control at `ElementSize.Small` with a 16px icon. Under `desktop:`, the gap is 12px, the search is `ElementSize.Large`, and the sort control is `ElementSize.Standard` with a 20px icon and 12px inline padding. The sort control's text uses `--text-accent`. The component branches with `useIsMobile` from `@epam/ai-dial-chat-shared`.
- No `sm:`/`md:`/`lg:`/`xl:` prefixes are used.
- Long names truncate to one line with a tooltip, and the folder path collapses or truncates inside the card, so the page never scrolls horizontally at a 320 px viewport.

**RTL:**

- Only logical properties are used (`ms-*`/`me-*`, `ps-*`/`pe-*`, `inset-s-*`/`inset-e-*`, `text-start`, `border-s-*`).
- The folder path's separators come from the kit `FolderPath`; the page adds no directional icon of its own (`IconArrowsSort` and `IconPlus` are symmetric).
- Direction is inherited from `<html dir>`. The lib does not read the language.

**Accessibility:**

- The title is the page's `<h1>`, styled `dial-h1-text` by default. On mobile it is visually hidden, because the design shows no title row there.
- The search is inside `role="search"`.
- Each card is an `<article>` named by its project, and its folder path is a `<nav>` named by `labels.folderPathLabel`.
- A visually hidden `<span role="status" aria-live="polite">` announces each of these states:
  - the result count (`projects.status.resultCount`);
  - the no-results label;
  - the empty-state label;
  - the error label;
  - the incomplete label, which takes precedence over the result count.
  It announces nothing while loading.
- Every Tabler outline icon passes `stroke={DIAL_KIT_ICON_STROKE}`. Decorative icons, including icons inside labelled controls, carry `aria-hidden`.
- The sort dropdown, the pin toggles and the retry button are reachable and operable by keyboard.
- Text colors use theme tokens whose fallbacks meet a 7:1 contrast ratio.

**Memoisation:**

- The lib computes the filtered and sorted list in `useMemo`, keyed on `projects`, `searchQuery`, `sortKey` and `locale`.
- `ProjectsPage` memoises `labels` with `useMemo` and its handlers with `useCallback`.

#### Scenario: Status region announces result count

- **WHEN** a search leaves 2 of 5 projects visible
- **THEN** the `aria-live` status region text is the localized "2 projects"

#### Scenario: Status region announces no results

- **WHEN** a search matches no project
- **THEN** the status region text equals `labels.noResultsLabel`

#### Scenario: Narrow viewport has no horizontal scroll

- **WHEN** the page renders at a 320 px wide viewport with a 120-character project name
- **THEN** the document's `scrollWidth` does not exceed its `clientWidth`

#### Scenario: RTL mirrors the layout

- **WHEN** `<html dir="rtl">` is set
- **THEN** the toolbar and card content align to the inline start in RTL order, and no physical left/right class is present in the lib's source

#### Scenario: Mobile keeps the title for assistive tech only

- **WHEN** the page renders on mobile with a subtitle label
- **THEN** the `<h1>` is visually hidden, and the subtitle is not rendered

### Requirement: Projects page offers New project in the header and the empty state

When `onCreateProject` is supplied, the `Projects` lib component SHALL render two **New project** buttons, both labelled `labels.createProjectLabel` and both calling `onCreateProject`:

- **Header button:** under `desktop:`, a primary kit `Button` without an icon, on the inline end of the title row. On mobile, where there is no title row, it is a round 40px primary kit `Button` showing only an `IconPlus`, named by `labels.createProjectLabel` through `aria-label`, floating 16px from the bottom inline-end corner of the page. Either form is rendered in every content state.
- **Empty-state button:** a secondary kit `Button` without an icon, passed as the `action` of the empty-state `PanelEmptyState`, so it renders only in the Empty state. It does not render in the no-results, error or incomplete states.

When `onCreateProject` is omitted, neither button renders.

`ProjectsPage` passes `onCreateProject={() => navigate(ROUTES.ProjectCreate)}` (memoised with `useCallback`), and resolves `labels.createProjectLabel` from `projects.page.newProject` ("New project"). Under `desktop:`, the title wraps before the header button is pushed out, and the page never scrolls horizontally at 320 px.

**Feature flag:** inherits `projectsEnabled` from the page. **RTL impact:** the buttons sit at the inline end through logical properties (`inset-e-4` for the floating one). **i18n impact:** `projects.page.newProject`.

#### Scenario: Header button navigates to the create page

- **WHEN** projects are listed and the user activates the header **New project** button
- **THEN** `onCreateProject` is called once, and the router navigates to `/projects/new`

#### Scenario: Empty state has its own New project button

- **WHEN** there are no projects and every source is complete
- **THEN** the empty state shows "No projects yet", its description, and a **New project** button, and the header button is also present

#### Scenario: Mobile floats one New project button

- **WHEN** projects are listed on mobile
- **THEN** exactly one button is named "New project", and activating it calls `onCreateProject` once

#### Scenario: No buttons without the callback

- **WHEN** `Projects` renders without `onCreateProject`
- **THEN** no button named "New project" is rendered


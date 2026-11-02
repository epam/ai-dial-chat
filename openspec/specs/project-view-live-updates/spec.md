# project-view-live-updates Specification

## Purpose

Keeps the open project view page current: `useProjectWatch` in `libs/chat-hooks` subscribes the one project through `POST /api/v1/projects/watch`, skips events for the loaded etag, runs one coalesced silent refresh of the details and the Chats list at a time, leaves the page with a toast on a delete, reconnects with backoff and degrades silently when the watch is unavailable.

## Requirements

### Requirement: useProjectWatch subscribes one project through the injected client

`libs/chat-hooks` SHALL export `useProjectWatch` from the `@epam/ai-dial-chat-hooks/project` entry point (`libs/chat-hooks/src/project/use-project-watch.ts`):

```ts
useProjectWatch(
  client: Pick<ProjectsApiClient, 'watchProjects'>,
  projectId: string | null,
  options: ProjectWatchOptions,
): void;

interface ProjectWatchOptions {
  /** The loaded snapshot's aggregate etag; events carrying it are skipped. */
  etag: string | undefined;
  /** Silent refresh of everything the page shows; rejections are swallowed. */
  onChange: () => Promise<void>;
  /** The project was deleted elsewhere. Called at most once per project id. */
  onDelete: () => void;
}
```

The hook:

- opens `client.watchProjects([projectId], signal)` when `client.watchProjects` is defined, `projectId` is not `null` and `etag` is defined, that is, once the snapshot has loaded;
- reads the stream with the internal `readSseEvents` (`libs/chat-hooks/src/shared/read-sse-events.ts`), and parses each payload with `parseProjectWatchEvent`;
- ignores an event whose `id` is not `projectId`;
- reads `etag`, `onChange` and `onDelete` through refs, so a new callback identity or a refreshed `etag` never reopens the stream;
- never constructs a client, reads a route, shows a toast or navigates. Those stay with the host through `onChange` and `onDelete`.

The reconnect loop SHALL be the internal helper shared with `useProjects` (see the `projects-watch-sse` capability), not a copy.

**Owner of the state:** none. The hook holds only refs. The page's data stays in `useProject` and `useProjectConversations`.

#### Scenario: Watch opens after the snapshot loads

- **WHEN** `ProjectViewPage` loads `projects/a1b2c3/q4-launch` with `etag: '"9f2c"'`
- **THEN** `watchProjects` is called once with `['projects/a1b2c3/q4-launch']`

#### Scenario: A host without watch support

- **WHEN** the client has no `watchProjects`
- **THEN** no watch is attempted, and the page behaves exactly as before this change

#### Scenario: New callbacks do not resubscribe

- **WHEN** the page re-renders with a new `onChange` identity and a refreshed `etag`
- **THEN** `watchProjects` is not called again

### Requirement: An UPDATE triggers a coalesced silent refresh unless its etag is already loaded

On an `UPDATE` (or `CREATE`) event for the watched project, `useProjectWatch` SHALL:

- skip the event when `event.etag` equals the current `options.etag`, so a version the page already shows (for example its own snapshot read racing the event) is not loaded twice;
- otherwise call `options.onChange()`, with at most one call in flight. Events that arrive while a call runs set one pending flag. When the call settles, one trailing `onChange()` runs if the flag is set and the flag clears. Ten events during one refresh therefore cause exactly one more refresh.
- An event without `etag` is never skipped.

`ProjectViewPage` SHALL pass `onChange` as one memoised callback that runs `Promise.all([refreshProject(), refreshConversations()])` (see the `project-view-ui` and `project-conversations-ui` capabilities). Neither refresh shows a `Spinner` or resets `isLoading`. Both keep their current data on failure. `contextSearchQuery`, the scroll position, focus and any open dropdown or dialog are untouched, because no state is remounted.

#### Scenario: Another user edits the instructions

- **WHEN** the page shows `etag: '"9f2c"'` and an `UPDATE` with `etag: '"c3d4"'` arrives
- **THEN** `getProject` and `listProjectConversations` are each called once more, no spinner renders, and the new instructions show

#### Scenario: Event for the loaded version is skipped

- **WHEN** an `UPDATE` with `etag: '"9f2c"'` arrives and the loaded snapshot has `etag: '"9f2c"'`
- **THEN** no request is sent

#### Scenario: A burst during a generation

- **WHEN** five `UPDATE` events with distinct etags arrive while one refresh is in flight
- **THEN** exactly one more refresh starts after it settles, and never two at once

#### Scenario: The search query survives a refresh

- **WHEN** the user has typed `ticket` in the context search and a refresh completes
- **THEN** the search field still holds `ticket`, and the filtered list reflects the refreshed files

### Requirement: A DELETE shows a toast and leaves the page

On a `DELETE` event for the watched project, `useProjectWatch` SHALL close the stream, cancel any pending trailing refresh, and call `options.onDelete()` once.

`ProjectViewPage` SHALL implement `onDelete` as follows:

- `showInfoNotification` from `useNotification()` (`apps/chat/src/context/NotificationContext.tsx`) with `t(ProjectsI18nKeys.ViewDeletedElsewhere)`, "This project was deleted". `NotificationContainer` announces it through its kit `LiveRegion`.
- `replacePinnedProjectId(id, null)`.
- `navigate(ROUTES.Projects, { replace: true })`.

A silent refresh whose `getProject` answers `404` SHALL be handled the same way, so a missed `DELETE` (during a reconnect gap) still leaves the page.

When the user's own delete from this page is in progress, `useProjectActions` already notifies and navigates, so the page SHALL NOT show a second toast: `onDelete` is ignored while `isDeleting` is true or after the page's own delete succeeded.

#### Scenario: Deleted elsewhere

- **WHEN** a `DELETE` event arrives for the open project
- **THEN** the toast "This project was deleted" is shown, and the router is at `/projects`

#### Scenario: Own delete shows one toast

- **WHEN** the owner deletes the project from this page and the `DELETE` event arrives meanwhile
- **THEN** only the existing "deleted" success toast is shown

#### Scenario: Missed delete found by a refresh

- **WHEN** a reconnect's silent refresh gets `404` from `getProject`
- **THEN** the same toast is shown, and the router is at `/projects`

### Requirement: The watch reconnects with backoff and degrades silently

`useProjectWatch` SHALL reuse the `useProjects` policy through the shared helper:

- A stream that ends or errors after it opened is reopened after `WATCH_RECONNECT_DELAYS_MS` (`1000, 2000, 4000, 8000, 16000` ms). The attempt counter resets after a successful open.
- After each successful reopen it calls `onChange()` once, through the same coalescing gate, so changes made during the gap are not lost.
- When the first open fails (`400` from a Core without project events, `403`, a network error), or the delays are exhausted, the watch is marked unavailable for that project id for the rest of the page's lifetime. No further attempts are made for it, and the page keeps working without live updates. No error is shown. Another project id, after a route change, tries again.

#### Scenario: Dropped stream recovers

- **WHEN** the open stream ends and the reopen 1 s later succeeds
- **THEN** one silent refresh runs after the reopen

#### Scenario: Core without project events

- **WHEN** the first `watchProjects` call rejects with `400`
- **THEN** no retry is scheduled, no error UI renders, and the details and Chats list still render

### Requirement: The watch closes on unmount and on a project id change

`useProjectWatch` SHALL abort the stream's `AbortSignal` and clear any reconnect timer on unmount and whenever `projectId` changes, including the change after a rename that navigates to the new id. A refresh that settles after the abort sets no state.

#### Scenario: Leaving the page

- **WHEN** the user navigates from the view page to `/projects`
- **THEN** the signal passed to `watchProjects` is aborted, and no reconnect fires afterwards

#### Scenario: Id changes

- **WHEN** the route changes from `projects/a1b2c3/q4` to `projects/a1b2c3/q4-final`
- **THEN** the old stream is aborted, and a new watch for `projects/a1b2c3/q4-final` opens after its snapshot loads

### Requirement: Live updates add one string, no new markup and no new flag

Live updates on the project view page SHALL meet the following cross-cutting contract.

- **i18n:** one new key, `projects.view.deletedElsewhere` ("This project was deleted"), in `apps/chat/src/i18n/locales/en.json` and every other locale file (English placeholder), with the `ProjectsI18nKeys.ViewDeletedElsewhere` member in `apps/chat/src/constants/translation-keys.ts`.
- **RTL:** none. No markup or icon is added.
- **Accessibility:** a refresh makes no announcement of its own and does not move focus. The delete toast is announced through the kit `LiveRegion` of `NotificationContainer`. When a refresh changes the context-file count while a query is active, the existing `role="status"` region of `ProjectView` announces the new count.
- **Gating:** behind `FeatureKey.ProjectsEnabled` (`PROJECTS_ENABLED`, `PROJECTS_ENABLED_ROLES`). No new flag.
- **Telemetry:** none added. The BFF's existing `SseSubscriptionKind.ProjectsWatch` metric counts the stream.
- **Caching:** none. Each open view page holds its own stream.
- **Memoisation:** the `onChange` and `onDelete` callbacks passed to the hook are `useCallback`.

#### Scenario: Toast text comes from i18n

- **WHEN** the delete toast is shown
- **THEN** its message is `t(ProjectsI18nKeys.ViewDeletedElsewhere)`

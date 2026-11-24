## MODIFIED Requirements

### Requirement: The app owns project data through useProject

`useProject(client, id: string | null, enabled: boolean)` (`libs/chat-hooks/src/project/use-project.ts`, exported from `@epam/ai-dial-chat-hooks/project`) SHALL call `client.getProject(id, signal)`. The pages call it with `projectsClient` (`apps/chat/src/hooks/projects/projects-client.ts`), which wraps `getProject` from `apps/chat/src/server-api/projects.api.ts` (`projectsApi.getProject`). The hook returns `{ project, isLoading, hasError, isNotFound, isAccessDenied, retry, refresh }`:

- `project` is the `ProjectDetailsDto`, or `null`.
- The fetch runs in `useEffect` with an `AbortController`. It aborts on unmount and on an id change, and a cancelled request never sets state.
- `isLoading` is derived, as in `useProjects`: it is `true` while `enabled && id != null` and no result answers the current reload token.
- A `404` sets `isNotFound`. A `403` sets `isAccessDenied`. Any other failure sets `hasError`. At most one of the three is `true`, and the status is read with the existing `getApiErrorStatus` (`libs/chat-hooks/src/api-error/api-error.ts`).
  - The BFF answers `403` on this read only for a project in another user's bucket: Core's `403` mask of a missing project in the caller's own bucket is already a `404` (see the `project-detail-api` capability), and each page renders `NotFoundPage` before any read when `projectsEnabled` is off. A `403` therefore means the caller lost access: the owner stopped sharing the project or deleted it. Core does not tell the two apart, so neither does the hook.
- `retry` is a stable `useCallback`.
- `refresh` is a stable `useCallback` returning `Promise<ProjectRefreshOutcome>`. `ProjectRefreshOutcome` is a string enum in `libs/chat-hooks/src/project/project-refresh.ts`: `Updated = 'updated'`, `NotFound = 'not-found'`, `AccessLost = 'access-lost'`, `Failed = 'failed'`, `Skipped = 'skipped'`.
  - It re-requests `getProject` without touching `isLoading`, `hasError`, `isNotFound` or `isAccessDenied`.
  - On success it replaces `project` in the current result, which keeps its key, and resolves `Updated`.
  - On `404` it keeps the current `project` and resolves `NotFound`, so the page can leave (see the `project-view-live-updates` capability).
  - On `403` it keeps the current `project` and resolves `AccessLost`, so the page can leave (see the `project-view-live-updates` capability).
  - On any other failure it keeps the current `project` and resolves `Failed`.
  - A refresh started while no project is loaded resolves `Skipped`.
  - A newer `refresh` or an id change aborts an older one. An aborted refresh sets no state and resolves `Skipped`.

The page's derived state follows `project`: the view model, `canEdit`, `conversationCount` and the header actions. A refresh that turns `canEdit` to `false` (edit access was downgraded to view) therefore hides Edit, Delete, Share and Publish without a reload.

No new React context is introduced. The hook owns the new flag in its existing local `result` state; no host integration knowledge enters `libs/chat-hooks`, which reads only the status of the error the injected client throws.

#### Scenario: Successful load

- **WHEN** `getProject` resolves
- **THEN** `isLoading` becomes `false`, and `project` holds the DTO

#### Scenario: Not found

- **WHEN** `getProject` rejects with `404`
- **THEN** `isNotFound` is `true`, and `hasError` and `isAccessDenied` are `false`

#### Scenario: Access lost

- **WHEN** `getProject` rejects with `403`
- **THEN** `isAccessDenied` is `true`, `hasError` and `isNotFound` are `false`, and `project` is `null`

#### Scenario: Retry after error

- **WHEN** `getProject` rejects with `503` and the user activates Retry
- **THEN** `getProject` is called again

#### Scenario: Silent refresh

- **WHEN** a project is loaded and `refresh()` resolves with new instructions
- **THEN** `isLoading` stays `false` throughout, `project.instructions` is the new value, and the promise resolves `Updated`

#### Scenario: Failed refresh keeps the page

- **WHEN** `refresh()` rejects with `503`
- **THEN** `project` is unchanged, `hasError` stays `false`, and the promise resolves `Failed`

#### Scenario: Refresh after losing access

- **WHEN** a project is loaded and `refresh()` rejects with `403`
- **THEN** `project` is unchanged, `isAccessDenied` stays `false`, and the promise resolves `AccessLost`

### Requirement: The view page has explicit loading, error, not-found and loaded states

`ProjectView` SHALL accept an optional `isAccessDenied` prop (`boolean`, default `false`) beside `hasError` and `isNotFound`, and SHALL render exactly one state:

| State | When | Renders |
| --- | --- | --- |
| Loading | `isLoading` | a kit `Spinner`, and no header actions |
| Access denied | `isAccessDenied` | a `<p>` with `labels.accessDeniedLabel` in the primary text colour, a second `<p>` with `labels.accessDeniedDescription` in the secondary text colour, and a `GhostButton` (`labels.browseProjectsLabel`) calling `onBrowseProjects`. It has no Retry. |
| Error | `hasError` | a `<p>` with `labels.errorLabel` in the primary text colour and a Retry `GhostButton` (`labels.retryLabel`) calling `onRetry` |
| Not found | `isNotFound` | a `<p>` with `labels.notFoundLabel` in the primary text colour and a `GhostButton` (`labels.browseProjectsLabel`) calling `onBrowseProjects` |
| Loaded | otherwise, with `project != null` | the header and the Details panel |

States are checked in the table's order, so `isAccessDenied` wins over `hasError` if a host sets both.

`ProjectViewLabels` SHALL gain two optional strings, with English defaults inside the lib:

- `accessDeniedLabel`, default `'You no longer have access to this project'`;
- `accessDeniedDescription`, default `'The owner may have stopped sharing it or deleted it.'`.

**Accessibility.** The always-mounted visually hidden `LiveRegion` SHALL carry `labels.accessDeniedLabel` when the access-denied state replaces the spinner, as it carries `labels.errorLabel` for the error state. The visible title is then `aria-hidden`, so the message is read once. The description stays readable in the page content. The button is a native kit button, reachable with Tab and activated with Enter or Space.

**Theming and RTL.** The description uses `typography.helperClassName` (default `'dial-tiny-text'`) and the existing `--pv-secondary-text` variable. The state is a centred column with no directional icon or physical spacing, so it has no RTL-specific styling.

#### Scenario: Error and retry

- **WHEN** `hasError` is `true`
- **THEN** the error message and a Retry button render, and activating Retry calls `onRetry`

#### Scenario: Unknown project

- **WHEN** `isNotFound` is `true`
- **THEN** the not-found message renders with a button that calls `onBrowseProjects`

#### Scenario: Access denied offers only the way back

- **WHEN** `isAccessDenied` is `true`
- **THEN** "You no longer have access to this project" and "The owner may have stopped sharing it or deleted it." render, the "Back to projects" button calls `onBrowseProjects`, and no Retry button renders

#### Scenario: Access denied is announced

- **WHEN** `ProjectView` first renders with `isLoading` and then with `isAccessDenied`
- **THEN** the live region that was mounted while loading contains `labels.accessDeniedLabel`

#### Scenario: Default labels

- **WHEN** `ProjectView` renders `isAccessDenied` with labels that omit `accessDeniedLabel` and `accessDeniedDescription`
- **THEN** the English defaults render

## ADDED Requirements

### Requirement: The access-denied state strings flow through react-i18next

`useProjectViewLabels` (`apps/chat/src/hooks/projects/useProjectViewLabels.ts`) SHALL fill `accessDeniedLabel` and `accessDeniedDescription` with `t()` and new `ProjectsI18nKeys` members in `apps/chat/src/constants/i18n-keys/projects.ts`. The labels object stays memoised on `t`.

New keys in `apps/chat/src/i18n/locales/en.json`:

| Key | `ProjectsI18nKeys` member | English |
| --- | --- | --- |
| `projects.view.accessDenied` | `ViewAccessDenied` | You no longer have access to this project |
| `projects.view.accessDeniedDescription` | `ViewAccessDeniedDescription` | The owner may have stopped sharing it or deleted it. |

`projects.view.accessDenied` is also the toast text when a live refresh finds the access lost (see the `project-view-live-updates` capability). `buttons.retry` is no longer shown for this case, and `projects.view.browseProjects` ("Back to projects") is reused for the way back.

**Feature flag:** `projectsEnabled` (unchanged; no new flag or role).

#### Scenario: Keys resolve through the enum

- **WHEN** `useProjectViewLabels.ts` is inspected
- **THEN** `accessDeniedLabel` is `t(ProjectsI18nKeys.ViewAccessDenied)` and `accessDeniedDescription` is `t(ProjectsI18nKeys.ViewAccessDeniedDescription)`

#### Scenario: The view page renders the access-denied state

- **WHEN** `ProjectViewPage` opens a project whose `getProject` rejects with `403`
- **THEN** "You no longer have access to this project" renders with a "Back to projects" button that navigates to `/projects`, and no Retry button renders

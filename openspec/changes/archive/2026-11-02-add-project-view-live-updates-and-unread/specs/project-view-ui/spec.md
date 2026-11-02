## MODIFIED Requirements

### Requirement: The app owns project data through useProject

`useProject(client, id: string | null, enabled: boolean)` (`libs/chat-hooks/src/project/use-project.ts`, exported from `@epam/ai-dial-chat-hooks/project`) SHALL call `client.getProject(id, signal)`. The app adapter `useProject(id, enabled)` (`apps/chat/src/hooks/projects/useProject.ts`) binds it to `projectsClient`, which wraps `getProject` from `apps/chat/src/server-api/projects.api.ts` (`projectsApi.getProject`). The hook returns `{ project, isLoading, hasError, isNotFound, retry, refresh }`:

- `project` is the `ProjectDetailsDto`, or `null`.
- The fetch runs in `useEffect` with an `AbortController`. It aborts on unmount and on an id change, and a cancelled request never sets state.
- `isLoading` is derived, as in `useProjects`: it is `true` while `enabled && id != null` and no result answers the current reload token.
- A `404` sets `isNotFound`. Any other failure sets `hasError`.
- `retry` is a stable `useCallback`.
- `refresh` is a stable `useCallback` returning `Promise<ProjectRefreshOutcome>`. `ProjectRefreshOutcome` is a string enum in `libs/chat-hooks/src/project/project-refresh.ts`: `Updated = 'updated'`, `NotFound = 'not-found'`, `Failed = 'failed'`, `Skipped = 'skipped'`.
  - It re-requests `getProject` without touching `isLoading`, `hasError` or `isNotFound`.
  - On success it replaces `project` in the current result, which keeps its key, and resolves `Updated`.
  - On `404` it keeps the current `project` and resolves `NotFound`, so the page can leave (see the `project-view-live-updates` capability).
  - On any other failure it keeps the current `project` and resolves `Failed`.
  - A refresh started while no project is loaded resolves `Skipped`.
  - A newer `refresh` or an id change aborts an older one. An aborted refresh sets no state and resolves `Skipped`.

The page's derived state follows `project`: the view model, `canEdit`, `conversationCount` and the header actions. A refresh that turns `canEdit` to `false` (the project was unshared) therefore hides Edit, Delete, Share and Publish without a reload.

No new React context is introduced.

#### Scenario: Successful load

- **WHEN** `getProject` resolves
- **THEN** `isLoading` becomes `false`, and `project` holds the DTO

#### Scenario: Not found

- **WHEN** `getProject` rejects with `404`
- **THEN** `isNotFound` is `true`, and `hasError` is `false`

#### Scenario: Retry after error

- **WHEN** `getProject` rejects with `503` and the user activates Retry
- **THEN** `getProject` is called again

#### Scenario: Silent refresh

- **WHEN** a project is loaded and `refresh()` resolves with new instructions
- **THEN** `isLoading` stays `false` throughout, `project.instructions` is the new value, and the promise resolves `Updated`

#### Scenario: Failed refresh keeps the page

- **WHEN** `refresh()` rejects with `503`
- **THEN** `project` is unchanged, `hasError` stays `false`, and the promise resolves `Failed`

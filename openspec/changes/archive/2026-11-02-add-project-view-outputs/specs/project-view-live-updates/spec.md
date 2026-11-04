## MODIFIED Requirements

### Requirement: An UPDATE triggers a coalesced silent refresh unless its etag is already loaded

On an `UPDATE` (or `CREATE`) event for the watched project, `useProjectWatch` SHALL:

- skip the event when `event.etag` equals the current `options.etag`, so a version the page already shows (for example its own snapshot read racing the event) is not loaded twice;
- otherwise call `options.onChange()`, with at most one call in flight. Events that arrive while a call runs set one pending flag. When the call settles, one trailing `onChange()` runs if the flag is set and the flag clears. Ten events during one refresh therefore cause exactly one more refresh.
- An event without `etag` is never skipped.

`ProjectViewPage` SHALL pass `onChange` as one memoised callback that runs `Promise.all([refreshProject(), refreshConversations(), refreshArtifacts()])` (see the `project-view-ui` and `project-conversations-ui` capabilities). An agent's artifact write is a write to the project resource, so Core emits an `UPDATE` with a new `etag` for it like for any other write, and the new output appears without a reload. No refresh shows a `Spinner` or resets `isLoading`. Each keeps its current data on failure. `contextSearchQuery`, the scroll position, focus and any open dropdown or dialog are untouched, because no state is remounted.

#### Scenario: Another user edits the instructions

- **WHEN** the page shows `etag: '"9f2c"'` and an `UPDATE` with `etag: '"c3d4"'` arrives
- **THEN** `getProject`, `listProjectConversations` and `listProjectArtifacts` are each called once more, no spinner renders, and the new instructions show

#### Scenario: An agent saves a new output

- **WHEN** the page shows one output and an agent writes `artifacts/summary.md`, so an `UPDATE` with a new `etag` arrives
- **THEN** `listProjectArtifacts` is called once more, and the `summary.md` card appears first in the Outputs row without a reload or a spinner

#### Scenario: Event for the loaded version is skipped

- **WHEN** an `UPDATE` with `etag: '"9f2c"'` arrives and the loaded snapshot has `etag: '"9f2c"'`
- **THEN** no request is sent

#### Scenario: A burst during a generation

- **WHEN** five `UPDATE` events with distinct etags arrive while one refresh is in flight
- **THEN** exactly one more refresh starts after it settles, and never two at once

#### Scenario: The search query survives a refresh

- **WHEN** the user has typed `ticket` in the context search and a refresh completes
- **THEN** the search field still holds `ticket`, and the filtered list reflects the refreshed files

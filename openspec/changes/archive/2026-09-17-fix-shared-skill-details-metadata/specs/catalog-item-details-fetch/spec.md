## ADDED Requirements

### Requirement: Only the active details request may update panel state

`Catalog.tsx` SHALL identify each in-flight `onFetchDetails` call by a
monotonically increasing request token held in a ref, and SHALL apply
`setFetchedDetails` and `setIsDetailsLoading` only while the token captured at
call time is still the current one. Comparing the opened item's `id` alone is
insufficient: closing the panel clears the pending-item ref and reopening the
same item re-assigns the same `id`, so a still-pending earlier response would
pass an id-only guard and overwrite the newer request's result.

Closing the details panel SHALL invalidate the current token, so a response that
arrives after the panel closed updates no state and cannot resurrect a closed
panel.

The existing pending-item-id ref SHALL be retained for the post-authentication
retry loop's between-attempt bail-out ("is the same item still open?"), which is
genuinely an item-identity question and whose attempts are awaited sequentially
and therefore never overlap.

The equivalent guarantee SHALL hold for the headless skill-details panel
pipeline (`useSkillDetailsPanelData` in `@epam/ai-dial-chat-hooks`), whose
effect-scoped cancellation flag SHALL be paired with the same captured-token
check so a close-and-reopen of the same skill cannot let the earlier response
land. That effect SHALL continue to key on the opened item's `id` only, so a
favorite toggle or a listings refresh rebuilds the `CatalogItem` without
triggering another details fetch.

This requirement adds a race guarantee only. It changes no prop, no returned
value, and no rendered output, and it is independent of which detail requests a
given entity branch issues.

#### Scenario: Close and reopen the same item while a request is pending

- **WHEN** a user opens an item's details, closes the panel before the fetch
  settles, reopens the same item, and the first request then resolves
- **THEN** the first response is discarded and the panel renders only the second
  request's result

#### Scenario: Response arriving after close is dropped

- **WHEN** the details panel is closed while a fetch is in flight and that fetch
  later resolves
- **THEN** neither the fetched details nor the loading flag is updated and the
  panel stays closed

#### Scenario: Switching to a different item

- **WHEN** a user opens item A's details and opens item B before A's fetch
  settles
- **THEN** A's response is discarded and the panel renders B's result

#### Scenario: Post-authentication retry still bails out on close

- **WHEN** the user closes the panel, or opens a different item, while a
  login/logout retry sequence is between attempts
- **THEN** the retry loop stops rather than re-fetching for the no-longer-open
  item

#### Scenario: Unrelated rerenders trigger no refetch

- **WHEN** the open panel rerenders because a favorite was toggled or the
  listings were refreshed, with the opened item's `id` unchanged
- **THEN** no additional details fetch is issued

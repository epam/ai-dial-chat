## MODIFIED Requirements

### Requirement: Recipient-side "Remove from My List" action in the catalog details panel

`Header` (`libs/catalog/src/components/Details/Header/Header.tsx`) SHALL append a "Remove from My List" entry to the details panel's "Manage" dropdown when, and only when, all of the following hold:
- an `onUnshare` callback was supplied by the host,
- the item's `isMyApp` is not `true`, and
- the item's `sharedWithMe` is `true`.

`isMyApp` and `sharedWithMe` are mutually exclusive for a given item, so the owner-side Delete entry and this entry never render together. The entry's label SHALL come from `texts.unshareLabel` (default `'Remove from My List'`) and its icon SHALL be `IconTrash`, matching the Delete entry's icon treatment. Clicking it SHALL only request confirmation — it SHALL NOT call the host's `onUnshare` directly.

`DetailsPanel` SHALL own the confirmation step and present it as an in-place sub-view — see the `catalog-details-confirmation-subview` capability for the shared mechanics. While the awaited `onUnshare` is pending the confirm button SHALL show a loading state and reject duplicate submissions. On success the whole details panel closes; on rejection the panel returns to its details content and stays open, leaving failure feedback to the host. The sub-view SHALL also close when the displayed item changes.

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL implement `onUnshare` by calling `discardSharedCatalogItem(item.id)`, then refetching toolsets for a `Toolset` item, skills for a `Skill` item (via `refetchSkills()` from `useSkills()`), and deployments otherwise, clearing `selectedItemId` when the removed item was selected, and showing a success notification. A rejection from the discard call SHALL surface an error notification (with the request's trace id) and be re-thrown so the panel stays open; a rejection from the subsequent refetch SHALL NOT downgrade the already-succeeded mutation to an error.

`CatalogView.isUnshareVisible` SHALL NOT unconditionally exclude `CatalogEntityType.Skill`. It SHALL return `true` for `Skill` (subject to `Header`'s built-in `isMyApp`/`sharedWithMe` gate above, which already applies uniformly across entity types), since `DiscardSharedCatalogItemDto`'s allowlist already accepts `skills/{bucket}/{path}` and no backend change is required to support it.

#### Scenario: Shared item exposes the action

- **GIVEN** a catalog item with `isMyApp: false` and `sharedWithMe: true`, and a host-supplied `onUnshare`
- **WHEN** the details panel's Manage menu is opened
- **THEN** the menu includes a "Remove from My List" entry and no owner-side Delete entry

#### Scenario: Owned item does not expose the action

- **GIVEN** a catalog item with `isMyApp: true`
- **WHEN** the details panel's Manage menu is opened
- **THEN** the menu includes the owner-side Delete entry and no "Remove from My List" entry

#### Scenario: Confirmation precedes the API call

- **WHEN** the user activates "Remove from My List"
- **THEN** the confirmation popup opens and `onUnshare` has not been called

#### Scenario: Successful removal closes the panel and refreshes the catalog

- **WHEN** the user confirms removal of a shared toolset
- **THEN** `discardSharedCatalogItem` is called once with the item id, toolsets are refetched (deployments and skills are not), a success notification is shown, and the details panel closes

#### Scenario: Failed removal keeps the panel open

- **WHEN** `discardSharedCatalogItem` rejects
- **THEN** an error notification is shown, no refetch runs, the selection is left untouched, and the details panel stays open

#### Scenario: Shared skill exposes and exercises "Remove from My List"

- **GIVEN** a skill catalog item with `isMyApp: false` and `sharedWithMe: true`
- **WHEN** the user opens the Manage menu and confirms "Remove from My List"
- **THEN** the menu includes the entry (no longer excluded by `isUnshareVisible`), `discardSharedCatalogItem` is called once with the skill's `item.id` (`skills/{bucket}/{path}`), `refetchSkills()` is called (neither toolsets nor deployments are refetched), a success notification is shown, and the details panel closes

#### Scenario: Failed skill removal does not refetch and keeps the panel open

- **GIVEN** a shared skill item
- **WHEN** `discardSharedCatalogItem` rejects for that item
- **THEN** an error notification is shown with the request's trace id, `refetchSkills` is NOT called, the selection is left untouched, and the details panel stays open

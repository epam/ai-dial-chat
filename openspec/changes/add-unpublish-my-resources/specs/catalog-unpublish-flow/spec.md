## ADDED Requirements

### Requirement: The catalog details Manage menu offers Unpublish

`libs/catalog`'s details header (`Details/Header/Header.tsx`) SHALL render an `Unpublish` entry in the Manage dropdown, positioned directly after `Publish` so the two operations read as a pair. It uses `IconWorldOff` (`@tabler/icons-react`) at `DIAL_ICON_SIZE.SM` with `aria-hidden`, and its label comes from `texts.unpublishLabel`, defaulting to the lib's English `'Unpublish'`.

The entry SHALL NOT use the `danger` dropdown treatment. Unpublishing removes a published copy but destroys nothing the owner holds — the source entity is untouched and can be published again — so it sits with Edit/Download/Publish rather than with Delete.

Clicking it SHALL call `onOpenUnpublish`, a new prop the panel supplies; the header itself performs no request and knows nothing about how a resource is unpublished.

#### Scenario: Unpublish follows Publish in the menu
- **GIVEN** both entries are visible for an item
- **WHEN** the Manage menu is opened
- **THEN** `Unpublish` renders immediately after `Publish`, with a non-danger treatment

#### Scenario: Host label overrides the default
- **GIVEN** `texts.unpublishLabel` is supplied
- **THEN** the entry uses it instead of `'Unpublish'`

### Requirement: Unpublish visibility is derived from publish history

The entry SHALL be shown only when the panel holds at least one publish-history entry for the current item, combined (AND) with an optional caller-supplied `isUnpublishVisible(item)` rule and the presence of an `onUnpublish` callback.

The panel already fetches history through `getPublishHistory(item)` when the publish sub-view opens. That fetch SHALL be lifted so it also runs when the Manage menu is opened or focused — the same lazy, once-per-item trigger `Header.tsx` already uses for its recipient-count lookup (`onMouseEnter`/`onFocus` on the Manage trigger, guarded by a ref holding the item id whose lookup has started). It SHALL NOT run on panel open or on item render: most items are never unpublished, and the request is only worth making when the user reaches for the menu.

Resolution states:

| History state | Entry |
|---|---|
| Not requested / in flight | withheld |
| Resolved with ≥ 1 entry | shown |
| Resolved with 0 entries | hidden |
| Failed | hidden |

Hiding on failure is deliberate and differs from `Revoke access`, which stays reachable when its lookup fails. Revoke needs the lookup only for a count in its label; Unpublish needs the folder itself to build the request, so an entry shown without history could not do anything if clicked. A failed lookup is retried the next time the menu is opened, and the 60-second server-side history cache keeps a transient failure short-lived.

Publish history fetched for the menu and publish history fetched for the publish sub-view SHALL be the same state, fetched once per item — opening Publish after opening the menu SHALL NOT issue a second request.

#### Scenario: Entry appears once history resolves with entries
- **GIVEN** the item has been published to one folder
- **WHEN** the user opens the Manage menu
- **THEN** the history lookup runs and, once resolved, `Unpublish` is present

#### Scenario: Never-published item offers no Unpublish
- **GIVEN** history resolves to an empty array
- **THEN** `Unpublish` is absent from the menu

#### Scenario: A failed history lookup hides the entry
- **GIVEN** `getPublishHistory` rejects
- **THEN** `Unpublish` is absent, no error notification is raised, and the next menu open retries the lookup

#### Scenario: The lookup is not repeated for the same item
- **WHEN** the user hovers the Manage trigger, opens the menu, closes it, and opens the publish sub-view
- **THEN** `getPublishHistory` has been called exactly once for that item

#### Scenario: Switching items discards the previous item's history
- **WHEN** the panel's `item.id` changes
- **THEN** the cached history, its resolution state, and the started-lookup ref are reset, and no response from the previous item can make `Unpublish` appear for the new one

### Requirement: Unpublish opens a confirmation sub-view carrying the folder choice

Selecting `Unpublish` SHALL open the details panel's in-place confirmation sub-view with `DetailsConfirmationKind.Unpublish` (see `catalog-details-confirmation-subview`), never a modal popup and never a second slide-in panel.

The sub-view's body depends on how many folders the item is published to:

- **Exactly one folder** — static copy naming that folder, and the confirm button is enabled immediately.
- **More than one folder** — the published folders render as a single-select radio group under the message, in the order history returns them (most recently published first), with none preselected. The confirm button stays disabled until the user picks one.

Selecting a folder SHALL NOT trigger any request; the choice is local panel state, cleared when the confirmation is cancelled, when the sub-view closes, and when `item.id` changes.

Confirming SHALL call `onUnpublish(item, folderPath)`, where `folderPath` is the selected folder's path segments — the same `string[]` shape `onPublish` receives — and the lib performs no request itself.

Copy resolves from `ItemDetailsTexts` with English defaults:

| Slot | Text key | Default |
|---|---|---|
| Sub-view title | `unpublishConfirmTitle` → `unpublishLabel` | `'Unpublish'` |
| Message | `unpublishConfirmMessage(name, folder)` | `Unpublish <strong>{name}</strong> from "{folder}"? The request is submitted for admin approval.` |
| Message (multi-folder) | `unpublishSelectFolderMessage(name)` | `Choose which folder to unpublish <strong>{name}</strong> from. The request is submitted for admin approval.` |
| Folder group label | `unpublishFolderGroupAriaLabel` | `'Published folders'` |
| Consequences | `unpublishConfirmConsequences` | `'Everyone loses access to the published copy'`, `'Your own copy is not deleted'`, `'You can publish it again later'` |
| Confirm label | `unpublishLabel` | `'Unpublish'` |
| Loading status | `unpublishingStatusLabel` | `'Requesting unpublish'` |

Every one of these SHALL be reachable from `index.ts` through the exported `ItemDetailsTexts` type, and every one SHALL be forwarded from `DetailsPanel` to the place that renders it — a declared label that never reaches its element leaves the host's translation unused.

#### Scenario: Single published folder confirms directly
- **GIVEN** history holds one folder
- **WHEN** the user selects `Unpublish`
- **THEN** the sub-view names that folder in its message, renders no radio group, and the confirm button is enabled

#### Scenario: Multiple folders require a choice
- **GIVEN** history holds three folders
- **WHEN** the sub-view opens
- **THEN** all three render as radio options with none selected and the confirm button disabled
- **WHEN** the user selects one
- **THEN** the confirm button becomes enabled

#### Scenario: Confirming reports the chosen folder
- **WHEN** the user confirms with `Organization/Data Science` selected
- **THEN** `onUnpublish` is called with the item and `['Organization', 'Data Science']`

#### Scenario: Cancelling clears the selection
- **WHEN** the user selects a folder, backs out, and reopens the confirmation
- **THEN** no folder is preselected and the confirm button is disabled again

### Requirement: Unpublish result handling stays with the host

While `onUnpublish` is in flight the sub-view SHALL show the shared confirming state — confirm and back disabled, the loading status text announced through the existing `role="status"` region — reusing the panel's single `isConfirming` flag rather than adding per-action state.

On resolve, the confirmation closes and the panel returns to the details content. The panel SHALL NOT close, SHALL NOT remove the item from view, and SHALL NOT mutate its cached publish history: the removal is pending approval, so the folder is still published (see `catalog-publish-api`). This puts `Unpublish` with `Logout`/`RevokeAccess` rather than with `Delete`/`Unshare` in `CONFIRMATIONS_REMOVING_ITEM_FROM_VIEW`.

On reject, the confirmation closes the same way and the item stays visible. Success and failure feedback are both the host's responsibility — the lib raises no notification and renders no error text, matching how `onDelete`/`onRevokeShare` already behave.

#### Scenario: In-flight state is announced
- **WHEN** the user confirms and `onUnpublish` has not settled
- **THEN** the confirm and back controls are disabled and the loading status text is exposed to assistive tech

#### Scenario: Success returns to details with the panel open
- **WHEN** `onUnpublish` resolves
- **THEN** the confirmation closes, the details content is shown again, the panel stays open, and the folder still appears in publish history

#### Scenario: Failure is not reported by the lib
- **WHEN** `onUnpublish` rejects
- **THEN** the confirmation closes, the item remains visible, and the lib renders no error message

### Requirement: The app wires Unpublish to the BFF endpoint and its notification

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL pass `onUnpublish` to `DetailsPanel`, calling the `unpublishCatalogEntity` wrapper in `apps/chat/src/server-api/publish.api.ts` with the item's entity type, id, the selected folder joined with `/`, and the item's version.

On success it SHALL raise exactly one notification through `useOperationNotification` with `EntityOperation.UnpublishRequested`, the entity resolved by the existing `resolveNotifiableEntity(item.type)` helper, and `{ name, folder }` where `folder` is the selected folder's leaf segment — the same interpolation shape the publish success notification uses.

On failure it SHALL reuse `usePublishErrorNotification`, which already maps status, message, trace id, and the offline case; no new error copy is introduced.

All strings SHALL come from `t()` with keys declared in `apps/chat/src/constants/translation-keys.ts`; no raw key literal and no English string may appear in the wiring. `libs/catalog` SHALL learn nothing about the endpoint, the entity-type enum, or the generated client — it receives only the callback and the labels.

#### Scenario: Confirming issues the request
- **WHEN** the user confirms unpublish for a toolset published to `Organization/Data Science`
- **THEN** `unpublishCatalogEntity` is called with the toolset's entity type and id, `folderPath: 'Organization/Data Science'`, and the item's version

#### Scenario: Success raises the request-pending notification
- **WHEN** the request resolves
- **THEN** one success notification is raised via `notifyOperationSuccess(..., EntityOperation.UnpublishRequested, { name, folder })`

#### Scenario: Failure reuses the shared publish error notification
- **WHEN** the request rejects with a 403
- **THEN** `usePublishErrorNotification` raises the error notification with the response's own message and trace id, and no success notification is raised

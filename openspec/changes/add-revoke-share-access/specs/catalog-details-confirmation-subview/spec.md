## MODIFIED Requirements

### Requirement: Confirmation kinds and their copy

`DetailsConfirmationKind` (`libs/catalog/src/types/details-confirmation.ts`) SHALL enumerate exactly `Delete`, `Logout`, `Unshare`, and `RevokeAccess`. Each kind resolves its title, message, consequence bullets, confirm label, loading status text, and variant from `ItemDetailsTexts`, falling back to the lib's English defaults:

| Kind | Title | Confirm label | Variant | Consequences default |
|---|---|---|---|---|
| `Delete` | `deleteConfirmTitle` → `deleteActionLabel` → `'Delete'` | `deleteActionLabel` | `Danger` | `deleteConfirmConsequences`, else the three-item delete list |
| `Unshare` | `unshareConfirmTitle` → `unshareLabel` → `'Remove from My List'` | `unshareLabel` | `Info` | `unshareConfirmConsequences`, else the three-item removal list |
| `RevokeAccess` | `revokeShareConfirmTitle` → `revokeShareLabel` → `'Revoke access'` | `revokeShareLabel` | `Danger` | `revokeShareConfirmConsequences`, else the three-item revoke list |
| `Logout` | `logoutActionLabel` → `'Log out'` | `logoutActionLabel` | `Info` | none |

Removal is `Info` rather than `Danger` because it revokes only the caller's own access and is recoverable with a new invitation — nothing is destroyed for anyone else.

Revocation is `Danger` because other people irreversibly lose access; the owner must re-share to restore it. It is nonetheless not a deletion — the item survives intact for its owner, which the copy states explicitly. Its English default consequence list is: `'Everyone you shared it with loses access'`, `'Existing share links stop working'`, `'You keep full access — nothing is deleted'`. Its default loading status label is `revokingShareStatusLabel` → `'Revoking access'`.

Message defaults emphasize the item name with `<strong>`. Hosts supplying `deleteConfirmMessage`/`unshareConfirmMessage`/`revokeShareConfirmMessage` return a `ReactNode`, so a host that wants emphasis can pass JSX; a host passing a plain translated string gets plain text. The English default revoke message is: `Revoke shared access to <strong>{name}</strong>? Anyone you shared it with will lose access.`

#### Scenario: Host text overrides win over defaults

- **GIVEN** `texts.unshareConfirmTitle`, `texts.unshareLabel`, and `texts.unshareConfirmMessage` are supplied
- **WHEN** the removal confirmation opens
- **THEN** the sub-view title, confirm button label, and body copy use those values

#### Scenario: Consequence bullets are listed

- **GIVEN** the active kind resolves to a non-empty consequence list
- **THEN** each entry renders as a bullet under the message; an empty list renders no bullets

#### Scenario: Revoke confirmation uses the danger palette and its own copy

- **GIVEN** no `revokeShare*` text overrides are supplied
- **WHEN** the revoke confirmation opens
- **THEN** its title is `'Revoke access'`, its confirm button uses the danger treatment, and its three default consequence bullets are rendered

### Requirement: Confirming, cancelling, and failure handling

Confirming SHALL await the matching host callback (`onDelete`, `onUnshare`, `onRevokeShare`, or `onLogout` with the item's signed-in credentials level) with the confirm and cancel buttons disabled and `loadingStatusLabel` announced through a `role="status" aria-live="polite"` region.

On success, whether the panel closes SHALL be decided by one question — does the confirmed action remove the item from the caller's own view?

- `Delete` and `Unshare` remove the item from the caller's catalog, so on success the panel calls `onClose()`.
- `Logout` and `RevokeAccess` leave the item in the caller's catalog, so on success the panel returns to its details content and stays open. Revoking removes *other people's* access; the owner's own view is unchanged.
- On rejection the panel returns to its details content and stays open; surfacing the failure is the host's responsibility.
- Cancel, the back button, and `Escape` all clear the active confirmation, and all three SHALL no-op while the action is in flight.
- `Escape` SHALL cancel an open confirmation instead of closing the whole panel.
- Changing the displayed item SHALL clear any active confirmation.

#### Scenario: Duplicate submission is rejected

- **WHEN** the confirm button is clicked twice before the host callback settles
- **THEN** the host callback is invoked exactly once and the button is disabled for the duration

#### Scenario: Escape backs out of the confirmation

- **GIVEN** a confirmation sub-view is open
- **WHEN** the user presses `Escape`
- **THEN** the panel returns to its details content and remains open

#### Scenario: Logout keeps the panel open

- **WHEN** the logout confirmation is confirmed for an item with signed-in credentials
- **THEN** `onLogout` is called with the item's signed-in level, the panel returns to its details content, and `onClose` is not called

#### Scenario: Revoke keeps the panel open

- **WHEN** the revoke confirmation is confirmed for an owned item
- **THEN** `onRevokeShare` is called with the item, the panel returns to its details content, and `onClose` is not called

### Requirement: The details header only requests confirmations

`Header` SHALL NOT perform the action or own any in-flight state for Delete, Remove from My List, or Revoke access. Its `onDelete`, `onUnshare`, and `onRevokeShare` props are request callbacks with no return value; the panel wires them to handlers that set the active confirmation. `Header` therefore has no `onCloseDetails` prop, no `isDeleting` state, no spinner in the Manage menu, and no delete progress `aria-live` region — the confirmation footer owns all of that.

#### Scenario: Clicking Delete does not delete

- **WHEN** "Delete" is clicked in the Manage menu
- **THEN** the host's `onDelete` is not called, the menu entry stays enabled, and the delete confirmation sub-view opens

#### Scenario: Clicking Revoke access does not revoke

- **WHEN** "Revoke access" is clicked in the Manage menu
- **THEN** the host's `onRevokeShare` is not called, the menu entry stays enabled, and the revoke confirmation sub-view opens

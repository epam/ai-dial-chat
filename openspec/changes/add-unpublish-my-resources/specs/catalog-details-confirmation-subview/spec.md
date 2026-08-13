## MODIFIED Requirements

### Requirement: Confirmations render as an in-place sub-view, not a popup

The details panel SHALL NOT use `ConfirmationPopup` (or any other modal overlay) for its own confirmations. Instead it SHALL track a single active confirmation as `DetailsConfirmationKind | null` and, while one is active, replace its details content with a confirmation sub-view laid out exactly like the Publish sub-view:

- **Panel header row**: a back `GhostIconButton` (`IconChevronLeft`, mirrored in RTL via `rtl:scale-x-[-1]`, accessible name from `texts.backToDetailsAriaLabel`, default `'Back'`) followed by the confirmation title. The star toggle and the panel close button SHALL be hidden while any sub-view is open.
- **Scrollable body** (`ConfirmationView`): an `InfoCard` naming the item the step is about, the confirmation copy, an optional bulleted consequence list, and an optional interactive slot rendered after the bullets.
- **Pinned footer** (`ConfirmationFooter`), rendered outside the scroll container: a `GhostButton` cancel and a confirming button whose treatment follows the step's variant.

The interactive slot exists because a confirmation may need an input before it can be confirmed — today, choosing which published folder to unpublish from. `ConfirmationView` SHALL accept it as optional `children`, and the panel SHALL own whatever state it holds; `ConfirmationView` stays presentational. A kind that needs no input passes nothing and renders exactly as before.

When a kind's input is required but unsatisfied, the panel SHALL disable the confirm button through a per-kind `isConfirmDisabled` derivation, distinct from the in-flight `isConfirming` flag — a confirmation that cannot yet run and one that is already running are different states and SHALL NOT share one flag.

The panel SHALL reset the active confirmation and any input state it holds when the confirmation is cancelled and when `item.id` changes.

The publish sub-view and a confirmation sub-view SHALL be mutually exclusive; a confirmation takes precedence when both would render.

Only one confirmation can be active at a time, so the panel keeps exactly one `isConfirming` flag rather than per-action loading state.

#### Scenario: Details content is replaced, not overlaid

- **WHEN** a confirmation is requested from the details header
- **THEN** the tab row and header actions are no longer rendered, the back button and confirmation title appear in the panel header, and no modal dialog is layered over the panel

#### Scenario: Publish and confirmation do not stack

- **WHEN** a confirmation is active
- **THEN** the publish sub-view and its footer are not rendered

#### Scenario: A confirmation needing input blocks confirm until it is given

- **GIVEN** the active kind renders an interactive slot whose value is required
- **WHEN** the sub-view opens with no value chosen
- **THEN** the confirm button is disabled while the back button stays enabled
- **WHEN** a value is chosen
- **THEN** the confirm button becomes enabled

#### Scenario: Input state is discarded on cancel and on item change

- **WHEN** the user provides a value, backs out, and reopens the same confirmation
- **THEN** no value is retained
- **WHEN** `item.id` changes while a confirmation is open
- **THEN** the confirmation closes and its input state is cleared

### Requirement: Confirmation kinds and their copy

`DetailsConfirmationKind` (`libs/catalog/src/types/details-confirmation.ts`) SHALL enumerate exactly `Delete`, `Logout`, `Unshare`, `RevokeAccess`, and `Unpublish`. Each kind resolves its title, message, consequence bullets, confirm label, loading status text, and variant from `ItemDetailsTexts`, falling back to the lib's English defaults:

| Kind | Title | Confirm label | Variant | Consequences default |
|---|---|---|---|---|
| `Delete` | `deleteConfirmTitle` → `deleteActionLabel` → `'Delete'` | `deleteActionLabel` | `Danger` | `deleteConfirmConsequences`, else the three-item delete list |
| `Unshare` | `unshareConfirmTitle` → `unshareLabel` → `'Remove from My List'` | `unshareLabel` | `Info` | `unshareConfirmConsequences`, else the three-item removal list |
| `RevokeAccess` | `revokeShareConfirmTitle` → `revokeShareLabel` → `'Revoke access'` | `revokeShareLabel` | `Danger` | `revokeShareConfirmConsequences`, else the three-item revoke list |
| `Unpublish` | `unpublishConfirmTitle` → `unpublishLabel` → `'Unpublish'` | `unpublishLabel` | `Danger` | `unpublishConfirmConsequences`, else the three-item unpublish list |
| `Logout` | `logoutActionLabel` → `'Log out'` | `logoutActionLabel` | `Info` | none |

Removal is `Info` rather than `Danger` because it revokes only the caller's own access and is recoverable with a new invitation — nothing is destroyed for anyone else.

Revocation is `Danger` because other people irreversibly lose access; the owner must re-share to restore it. It is nonetheless not a deletion — the item survives intact for its owner, which the copy states explicitly. Its English default consequence list is: `'Everyone you shared it with loses access'`, `'Existing share links stop working'`, `'You keep full access — nothing is deleted'`. Its default loading status label is `revokingShareStatusLabel` → `'Revoking access'`.

Unpublish is `Danger` for the same reason as revocation and with the same caveat: everyone loses access to the published copy and the owner must publish again to restore it, while the source entity is untouched. Its English default consequence list is: `'Everyone loses access to the published copy'`, `'Your own copy is not deleted'`, `'You can publish it again later'`. Its default loading status label is `unpublishingStatusLabel` → `'Requesting unpublish'`, phrased as a request because the removal takes effect only after an administrator approves it (see `catalog-unpublish-flow`). It is the one kind that renders the interactive slot, and only when the item is published to more than one folder.

Message defaults emphasize the item name with `<strong>`. Hosts supplying `deleteConfirmMessage`/`unshareConfirmMessage`/`revokeShareConfirmMessage`/`unpublishConfirmMessage` return a `ReactNode`, so a host that wants emphasis can pass JSX; a host passing a plain translated string gets plain text. The English default revoke message is: `Revoke shared access to <strong>{name}</strong>? Anyone you shared it with will lose access.`

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

#### Scenario: Unpublish confirmation uses the danger palette and request-phrased status

- **GIVEN** no `unpublish*` text overrides are supplied
- **WHEN** the unpublish confirmation opens
- **THEN** its title is `'Unpublish'`, its confirm button uses the danger treatment, its three default consequence bullets are rendered, and its in-flight status text reads `'Requesting unpublish'`

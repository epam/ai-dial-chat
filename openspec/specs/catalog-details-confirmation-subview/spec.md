# catalog-details-confirmation-subview Specification

## Purpose
Defines how the catalog details panel (`libs/catalog/src/components/Details/DetailsPanel.tsx`) asks the user to confirm a destructive or state-changing action. Every such confirmation is an in-place sub-view that replaces the panel's details content — the same drill-in treatment the Publish flow already uses — rather than a modal popup layered on top of the panel.
## Requirements
### Requirement: Confirmations render as an in-place sub-view, not a popup

The details panel SHALL NOT use `ConfirmationPopup` (or any other modal overlay) for its own confirmations. Instead it SHALL track a single active confirmation as `DetailsConfirmationKind | null` and, while one is active, replace its details content with a confirmation sub-view laid out exactly like the Publish sub-view:

- **Panel header row**: the panel's `SideDrawer` (`@epam/ai-dial-ui-kit`) header, given `onBack`/`backAriaLabel`/`backDisabled` and the sub-view title, renders a back `GhostIconButton` (`IconChevronLeft`, mirrored in RTL by the kit's `rtl:-scale-x-100`, accessible name from `texts.backToDetailsAriaLabel`, default `'Back'`) followed by the confirmation title. The star toggle (`headerActions`) and the panel close button (`hideClose`) SHALL be hidden while any sub-view is open.
- **Scrollable body** (`ConfirmationView` from `@epam/ai-dial-chat-shared`): a `ConfirmationIdentityCard` naming the item the step is about, the confirmation copy, an optional bulleted consequence list, and an optional interactive slot rendered after the bullets.
- **Pinned footer** (`ConfirmationFooter` from `@epam/ai-dial-chat-shared`), rendered outside the scroll container: a `GhostButton` cancel and a confirming button whose treatment follows the step's variant.

The interactive slot exists because a confirmation may need an input before it can be confirmed — today, choosing which published folder to unpublish from. `ConfirmationView` SHALL accept it as optional `children`, and the panel SHALL own whatever state it holds; `ConfirmationView` stays presentational. A kind that needs no input passes nothing and renders exactly as before.

When a kind's input is required but unsatisfied, the panel SHALL disable the confirm button through an `isConfirmDisabled` derivation, distinct from the in-flight `isConfirming` flag — a confirmation that cannot yet run and one that is already running are different states and SHALL NOT share one flag. `ConfirmationFooter` disables its confirm button on either. Today the derivation has exactly one term: `Unpublish` with no resolvable target folder; every other kind resolves to `false`.

The panel SHALL reset the active confirmation and any input state it holds when the confirmation is cancelled and when `item.id` changes.

The panel hosts three sub-views — confirmation, publish, and credentials management — and they SHALL be mutually exclusive. Precedence, resolved in one place when the panel derives its sub-view header, is: confirmation, then publish, then credentials management. The header that sub-view contributes carries its own title, its own back handler, and whether backing out is currently disabled, so every sub-view gets the same chrome without the panel re-deriving it per branch.

Only one confirmation can be active at a time, so the panel keeps exactly one `isConfirming` flag rather than per-action loading state.

#### Scenario: Details content is replaced, not overlaid

- **WHEN** a confirmation is requested from the details header
- **THEN** the tab row and header actions are no longer rendered, the back button and confirmation title appear in the panel header, and no modal dialog is layered over the panel

#### Scenario: Publish and confirmation do not stack

- **WHEN** a confirmation is active
- **THEN** the publish sub-view and its footer are not rendered

#### Scenario: Credentials management yields to both other sub-views

- **WHEN** credentials management is open and a confirmation is then requested
- **THEN** the confirmation sub-view is what renders, and the panel header shows its title and back handler

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

### Requirement: Confirmation variants

The confirmation's palette SHALL be `ConfirmationPopupVariant` from `@epam/ai-dial-ui-kit`, of which the sub-view uses exactly `Danger` and `Info`; the variant drives both the identity-card surface and the confirm button. The catalog no longer defines or exports its own `DetailsConfirmationVariant` enum.

| Variant | Identity-card surface | Confirm button | Meaning |
|---|---|---|---|
| `Danger` | `--bg-control-error-alpha-active`, bordered with `--stroke-error-alpha` | `DangerButton` with a leading `IconTrashX` | Irreversible loss for everyone |
| `Info` | `--bg-info` | `NeutralButton`, no icon | Affects only the current user and is recoverable |

`Info` is the default for `ConfirmationIdentityCard`, `ConfirmationView`, and `ConfirmationFooter`.

The body, footer, and identity card are not catalog components: `ConfirmationView`, `ConfirmationFooter`, and `ConfirmationIdentityCard` live in `@epam/ai-dial-chat-shared` (see the `shared-delete-confirmation` spec), so the scheduled-task, chat, and Files delete dialogs render the same block. The catalog's former `InfoCard` component and its `InfoCardProps` type are removed and not re-exported; a view that anchors a message to a catalog item uses `ConfirmationIdentityCard` with `item`. The details panel still themes the card through `ItemDetailsColors.infoCardBackground` / `infoCardDangerBackground`, forwarded to `ConfirmationView`'s `styles.colors.cardBackground` / `cardDangerBackground`; the panel forwards no danger-border override, so although `ConfirmationView` accepts `styles.colors.cardDangerBorder`, the details panel's danger border is not themable.

#### Scenario: Only true destruction gets the danger palette

- **WHEN** the delete confirmation is open
- **THEN** its confirm button uses the danger treatment, while the removal confirmation's confirm button uses the neutral one

### Requirement: Confirmation kinds and their copy

`DetailsConfirmationKind` (`libs/catalog/src/types/details-confirmation.ts`) SHALL enumerate exactly `Delete`, `Logout`, `Unshare`, `RevokeAccess`, `DeleteApiKey`, and `Unpublish`. Each kind resolves its title, message, consequence bullets, confirm label, loading status text, and variant from `ItemDetailsTexts`, falling back to the lib's English defaults:

| Kind | Title | Confirm label | Variant | Consequences default |
|---|---|---|---|---|
| `Delete` | `deleteConfirmTitle` → `deleteActionLabel` → `'Delete'` | `deleteActionLabel` | `Danger` | `deleteConfirmConsequences`, else the three-item delete list |
| `Unshare` | `unshareConfirmTitle` → `unshareLabel` → `'Remove from My List'` | `unshareLabel` | `Info` | `unshareConfirmConsequences`, else the three-item removal list |
| `RevokeAccess` | `revokeShareConfirmTitle` → `revokeShareLabel` → `'Revoke access'` | `revokeShareLabel` | `Danger` | `revokeShareConfirmConsequences`, else the three-item revoke list |
| `Unpublish` | `unpublishConfirmTitle` → `unpublishLabel` → `'Unpublish'` | `unpublishLabel` | `Danger` | `unpublishConfirmConsequences`, else the three-item unpublish list |
| `Logout` | `logoutActionLabel` → `'Log out'` | `logoutActionLabel` | `Info` | none |
| `DeleteApiKey` | `deleteActionLabel` → `'Delete'` | `deleteActionLabel` | `Danger` confirm, `Info` card | none |

Removal is `Info` rather than `Danger` because it revokes only the caller's own access and is recoverable with a new invitation — nothing is destroyed for anyone else.

Revocation is `Danger` because other people irreversibly lose access; the owner must re-share to restore it. It is nonetheless not a deletion — the item survives intact for its owner, which the copy states explicitly. Its English default consequence list is: `'Everyone you shared it with loses access'`, `'Existing share links stop working'`, `'You keep full access — nothing is deleted'`. Its default loading status label is `revokingShareStatusLabel` → `'Revoking access'`.

Unpublish is `Danger` for the same reason as revocation and with the same caveat: everyone loses access to the published copy and the owner must publish again to restore it, while the source entity is untouched. Its English default consequence list is: `'Everyone loses access to the published copy'`, `'Your own copy is not deleted'`, `'You can publish it again later'`. Its default loading status label is `unpublishingStatusLabel` → `'Requesting unpublish'`, phrased as a request because the removal takes effect only after an administrator approves it (see `catalog-unpublish-flow`). It is the one kind that renders the interactive slot, and only when the item is published to more than one folder.

`DeleteApiKey` is the only kind whose card and confirm button diverge: the confirm button is `Danger`, but the identity card stays `Info` via the separate `cardVariant` field, because removing one stored credential leaves the item itself untouched. Its message is `deleteApiKeyConfirmMessage(level)`, defaulting to `'Are you sure you want to delete the organization API key?'` for `CredentialsLevel.Global` and `'Are you sure you want to delete your personal API key?'` otherwise, and its loading status label is `deletingStatusLabel` → `'Deleting'`. It is listed here because the enumeration above is exhaustive; this change does not alter its behaviour.

Message defaults emphasize the item name with `<strong>`. The chat app's `CatalogView` passes its own `deleteConfirmMessage` as a `<Trans>` node whose `<bold>` tag maps to `CONFIRMATION_BOLD_COMPONENTS` (`dial-small-semi-text`), so the name stays bold in the translated copy too. Hosts supplying `deleteConfirmMessage`/`unshareConfirmMessage`/`revokeShareConfirmMessage`/`unpublishConfirmMessage` (called with the item name and, for unpublish, the single folder's label) or `unpublishSelectFolderMessage` (the multi-folder copy, called with the item name) return a `ReactNode`, so a host that wants emphasis can pass JSX; a host passing a plain translated string gets plain text. The English default revoke message is: `Revoke shared access to <strong>{name}</strong>? Anyone you shared it with will lose access.`

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

### Requirement: The details header only requests confirmations

`Header` SHALL NOT perform the action or own any in-flight state for Delete, Remove from My List, or Revoke access. Its `onDelete`, `onUnshare`, and `onRevokeShare` props are request callbacks with no return value; the panel wires them to handlers that set the active confirmation. `Header` therefore has no `onCloseDetails` prop, no `isDeleting` state, no spinner in the Manage menu, and no delete progress `aria-live` region — the confirmation footer owns all of that.

In the Manage ("...") menu, Delete SHALL be the last entry, after Remove from My List and Revoke access, so the destructive action never sits next to an entry a misclick can reach. Delete and Remove from My List both use the `IconTrashX` glyph, and Delete carries the menu's danger treatment.

#### Scenario: Delete is the last Manage entry

- **GIVEN** an owned item (`isMyApp: true`) the host can share, publish, and revoke access to, with a positive recipient count
- **WHEN** the Manage menu is opened
- **THEN** "Revoke access" is directly followed by "Delete", and "Delete" is the last entry

#### Scenario: Clicking Delete does not delete

- **WHEN** "Delete" is clicked in the Manage menu
- **THEN** the host's `onDelete` is not called, the menu entry stays enabled, and the delete confirmation sub-view opens

#### Scenario: Clicking Revoke access does not revoke

- **WHEN** "Revoke access" is clicked in the Manage menu
- **THEN** the host's `onRevokeShare` is not called, the menu entry stays enabled, and the revoke confirmation sub-view opens

### Requirement: Confirming, cancelling, and failure handling

Confirming SHALL await the matching host callback (`onDelete`, `onUnshare`, `onRevokeShare`, `onUnpublish` with the chosen folder's path segments, or `onLogout` with `{ level }` — the item's signed-in credentials level for `Logout`, the API key's level for `DeleteApiKey`) with the confirm and cancel buttons disabled and `loadingStatusLabel` announced through a `role="status" aria-live="polite"` region.

On success, whether the panel closes SHALL be decided by one question — does the confirmed action remove the item from the caller's own view? That answer SHALL be expressed as a single set of kinds rather than re-decided per branch, so adding a kind is a one-line decision at that set.

- `Delete` and `Unshare` are the members of that set: they remove the item from the caller's catalog, so on success the panel calls `onClose()`.
- Every other kind — `Logout`, `RevokeAccess`, `Unpublish`, `DeleteApiKey` — leaves the item in the caller's catalog, so on success the panel returns to its details content and stays open. Revoking removes *other people's* access and unpublishing removes the published copy; the owner's own view is unchanged in both cases.
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

### Requirement: Accessible naming of the open sub-view

While a sub-view is open, the panel's `role="dialog"` SHALL be named after that sub-view — the confirmation title, the publish title, or the credentials-management title, per the precedence above — instead of the generic details label from `texts.ariaLabel`. The name is read from the same resolved sub-view header the chrome uses, so the heading a sighted user reads and the accessible name can never disagree.

#### Scenario: Dialog takes the confirmation's name

- **WHEN** the removal confirmation is open
- **THEN** the dialog's accessible name is the removal confirmation's title


# catalog-details-confirmation-subview Specification

## Purpose
Defines how the catalog details panel (`libs/catalog/src/components/Details/DetailsPanel.tsx`) asks the user to confirm a destructive or state-changing action. Every such confirmation is an in-place sub-view that replaces the panel's details content — the same drill-in treatment the Publish flow already uses — rather than a modal popup layered on top of the panel.

## Requirements
### Requirement: Confirmations render as an in-place sub-view, not a popup

The details panel SHALL NOT use `ConfirmationPopup` (or any other modal overlay) for its own confirmations. Instead it SHALL track a single active confirmation as `DetailsConfirmationKind | null` and, while one is active, replace its details content with a confirmation sub-view laid out exactly like the Publish sub-view:

- **Panel header row**: a back `GhostIconButton` (`IconChevronLeft`, mirrored in RTL via `rtl:scale-x-[-1]`, accessible name from `texts.backToDetailsAriaLabel`, default `'Back'`) followed by the confirmation title. The star toggle and the panel close button SHALL be hidden while any sub-view is open.
- **Scrollable body** (`ConfirmationView`): an `InfoCard` naming the item the step is about, the confirmation copy, and an optional bulleted consequence list.
- **Pinned footer** (`ConfirmationFooter`), rendered outside the scroll container: a `GhostButton` cancel and a confirming button whose treatment follows the step's variant.

The publish sub-view and a confirmation sub-view SHALL be mutually exclusive; a confirmation takes precedence when both would render.

Only one confirmation can be active at a time, so the panel keeps exactly one `isConfirming` flag rather than per-action loading state.

#### Scenario: Details content is replaced, not overlaid

- **WHEN** a confirmation is requested from the details header
- **THEN** the tab row and header actions are no longer rendered, the back button and confirmation title appear in the panel header, and no modal dialog is layered over the panel

#### Scenario: Publish and confirmation do not stack

- **WHEN** a confirmation is active
- **THEN** the publish sub-view and its footer are not rendered

### Requirement: Confirmation variants

`DetailsConfirmationVariant` (`libs/catalog/src/types/details-confirmation.ts`) SHALL enumerate exactly `Danger` and `Info`, and SHALL drive both the `InfoCard` surface and the confirm button:

| Variant | `InfoCard` surface | Confirm button | Meaning |
|---|---|---|---|
| `Danger` | `--bg-error` | `DangerButton` with a leading `IconTrashX` | Irreversible loss for everyone |
| `Info` | `--bg-info` | `NeutralButton`, no icon | Affects only the current user and is recoverable |

`Info` is the default for `InfoCard`, `ConfirmationView`, and `ConfirmationFooter`.

`InfoCard` (`libs/catalog/src/components/InfoCard/InfoCard.tsx`) is a standalone exported component — a tinted rounded surface wrapping an `EntityHeader` (default `iconSize` 40, no featured tag) — so any view that needs to anchor a message to a specific catalog item reuses it rather than re-deriving the treatment. Its surface colors are themed through `ItemDetailsColors.infoCardBackground` / `infoCardDangerBackground` (`--cat-info-card-bg` / `--cat-info-card-danger-bg`).

#### Scenario: Only true destruction gets the danger palette

- **WHEN** the delete confirmation is open
- **THEN** its confirm button uses the danger treatment, while the removal confirmation's confirm button uses the neutral one

### Requirement: Confirmation kinds and their copy

`DetailsConfirmationKind` (`libs/catalog/src/types/details-confirmation.ts`) SHALL enumerate exactly `Delete`, `Logout`, and `Unshare`. Each kind resolves its title, message, consequence bullets, confirm label, loading status text, and variant from `ItemDetailsTexts`, falling back to the lib's English defaults:

| Kind | Title | Confirm label | Variant | Consequences default |
|---|---|---|---|---|
| `Delete` | `deleteConfirmTitle` → `deleteActionLabel` → `'Delete'` | `deleteActionLabel` | `Danger` | `deleteConfirmConsequences`, else the three-item delete list |
| `Unshare` | `unshareConfirmTitle` → `unshareLabel` → `'Remove from My List'` | `unshareLabel` | `Info` | `unshareConfirmConsequences`, else the three-item removal list |
| `Logout` | `logoutActionLabel` → `'Log out'` | `logoutActionLabel` | `Info` | none |

Removal is `Info` rather than `Danger` because it revokes only the caller's own access and is recoverable with a new invitation — nothing is destroyed for anyone else.

Message defaults emphasize the item name with `<strong>`. Hosts supplying `deleteConfirmMessage`/`unshareConfirmMessage` return a `ReactNode`, so a host that wants emphasis can pass JSX; a host passing a plain translated string gets plain text.

#### Scenario: Host text overrides win over defaults

- **GIVEN** `texts.unshareConfirmTitle`, `texts.unshareLabel`, and `texts.unshareConfirmMessage` are supplied
- **WHEN** the removal confirmation opens
- **THEN** the sub-view title, confirm button label, and body copy use those values

#### Scenario: Consequence bullets are listed

- **GIVEN** the active kind resolves to a non-empty consequence list
- **THEN** each entry renders as a bullet under the message; an empty list renders no bullets

### Requirement: The details header only requests confirmations

`Header` SHALL NOT perform the action or own any in-flight state for Delete or Remove from My List. Its `onDelete` and `onUnshare` props are request callbacks with no return value; the panel wires them to handlers that set the active confirmation. `Header` therefore has no `onCloseDetails` prop, no `isDeleting` state, no spinner in the Manage menu, and no delete progress `aria-live` region — the confirmation footer owns all of that.

#### Scenario: Clicking Delete does not delete

- **WHEN** "Delete" is clicked in the Manage menu
- **THEN** the host's `onDelete` is not called, the menu entry stays enabled, and the delete confirmation sub-view opens

### Requirement: Confirming, cancelling, and failure handling

Confirming SHALL await the matching host callback (`onDelete`, `onUnshare`, or `onLogout` with the item's signed-in credentials level) with the confirm and cancel buttons disabled and `loadingStatusLabel` announced through a `role="status" aria-live="polite"` region.

- `Delete` and `Unshare` remove the item from the caller's catalog, so on success the panel calls `onClose()`.
- `Logout` leaves the item in place, so on success the panel returns to its details content and stays open.
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

### Requirement: Accessible naming of the open sub-view

While a sub-view is open, the panel's `role="dialog"` SHALL be named after that sub-view — the confirmation title when a confirmation is active, the publish title while publishing — instead of the generic details label from `texts.ariaLabel`.

#### Scenario: Dialog takes the confirmation's name

- **WHEN** the removal confirmation is open
- **THEN** the dialog's accessible name is the removal confirmation's title

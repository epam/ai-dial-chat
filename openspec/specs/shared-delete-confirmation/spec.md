# Spec: shared-delete-confirmation

## Purpose

Defines the one delete confirmation every surface that deletes a single resource or a selection shows, and the `@epam/ai-dial-chat-shared` components it is built from: `ConfirmationView`, `ConfirmationFooter`, `ConfirmationIdentityCard`, `ConfirmationIdentityRow`, and `ConfirmationDialog`. Surface-specific copy, API calls, and post-delete behaviour stay in each surface's own spec — `catalog-details-confirmation-subview`, `scheduled-task-detail-page`, `file-manager-delete-ui`, and the chat panel's single-chat delete described below.

## Requirements

### Requirement: Every delete confirmation shows the same block

A delete confirmation SHALL present, in this order:

1. **Identity card** — the resource as a red-tinted card (`ConfirmationPopupVariant.Danger`): its icon, its type, and its name. The scheduled task dialog and the Files body show the name only, with no icon or type, per design.
2. **Message** — one sentence naming the resource in bold and ending in "This action is permanent and cannot be undone."
3. **Consequences** — a short bulleted list whose last bullet is "Cannot be undone" (`basic.consequenceCannotBeUndone`).
4. **Actions** — a text Cancel beside a red Delete carrying a leading `IconTrashX`.

The surfaces that render it are the catalog details panel (in place, see `catalog-details-confirmation-subview`), the scheduled task detail page, the chat panel's single-chat delete, and the Files page body (see `file-manager-delete-ui`).

Not covered: the Files dialog's frame and actions belong to `@epam/ai-dial-react-file-manager`; from `0.3.0-dev.25` they match this block (close control, text Cancel, danger Delete with a trash icon), but they are the package's own, not `ConfirmationFooter`. `AvatarPickerModal` composes its body from three label props rather than a content node and keeps its own wording. "Delete all conversations" has no single resource to name and stays on the kit's `ConfirmationPopup` (see `conversation-panel-header-menu`).

#### Scenario: A delete surface shows the full block

- **WHEN** the user asks to delete a chat, a scheduled task, a catalog item, or a file selection
- **THEN** the confirmation shows the danger identity card, the sentence with the bold name, a consequence list ending in "Cannot be undone", and a text Cancel beside a danger Delete

### Requirement: `ConfirmationView` renders the body

`ConfirmationView` (`libs/chat-shared/src/components/ConfirmationView/ConfirmationView.tsx`) SHALL be presentational and accept:

- `item?: EntityHeaderItem` — rendered as a `ConfirmationIdentityCard` when `identity` is not set; with neither `item` nor `identity`, no card is rendered (a confirmation that is not about a particular resource, such as discarding unsaved changes).
- `identity?: ReactNode` — a card rendered in place of the default one, for a resource that is not an `EntityHeaderItem`.
- `message: ReactNode` — the body sentence; a `ReactNode` so the host can bold the name.
- `consequences?: string[]` — bullets under the message; an empty or omitted list renders nothing.
- `variant?: ConfirmationPopupVariant` — default `Info`.
- `messageClassName?: string` — typography for the message and the bullets, default `'dial-small-text'`.
- `styles?.colors` — `messageText`, `consequenceText`, `cardBackground`, `cardDangerBackground`, `cardDangerBorder`.
- `children?: ReactNode` — an interactive slot after the bullets; the caller owns its state.

Message and bullet colors SHALL come from `--cfm-message-text` / `--cfm-consequence-text`, falling back to `--text-primary` / `--text-secondary`. Layout SHALL use logical properties only (`ps-5` on the list).

#### Scenario: Empty consequences render no list

- **WHEN** `consequences` is `[]`
- **THEN** no `<ul>` is rendered

#### Scenario: No resource means no identity card

- **WHEN** neither `item` nor `identity` is passed
- **THEN** no identity card is rendered and the message is the first element in the body

### Requirement: `ConfirmationFooter` renders the action row

`ConfirmationFooter` SHALL render a `GhostButton` Cancel followed by the confirm button. In the `Danger` variant the confirm button SHALL be a `DangerButton` with a leading `IconTrashX` (`aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`); in `Info` it SHALL be a `NeutralButton` with no icon. While `isLoading` is `true`, a `Spinner` SHALL replace the leading icon, both buttons SHALL be disabled, the confirm label SHALL stay unchanged, and `loadingStatusLabel`, when given, SHALL be announced through a visually hidden `role="status"` `aria-live="polite"` region. `isConfirmDisabled` SHALL disable only the confirm button, since an unsatisfied input and an in-flight request are different states. The row's top border SHALL come from `--cfm-footer-border`, falling back to `--stroke-tertiary`. In RTL the row SHALL mirror (`rtl:flex-row-reverse rtl:justify-start`).

#### Scenario: In-flight confirm keeps one accessible name

- **WHEN** `isLoading` is `true` with `confirmLabel="Delete"` and `loadingStatusLabel="Deleting…"`
- **THEN** the confirm button still reads "Delete", shows a spinner, and is disabled, and "Deleting…" is announced politely

### Requirement: `ConfirmationIdentityCard` and `ConfirmationIdentityRow` render the resource's identity

`ConfirmationIdentityCard` SHALL render a `ResourceSummary` surface with no version tag and a default `iconSize` of 40. Given `item`, it shows that entity's identity; given `children`, it shows them instead. Its surface SHALL follow `variant`:

| Variant | Background | Border |
|---|---|---|
| `Info` (default) | `--bg-info` | — |
| `Danger` | `--bg-control-error-alpha-active` | `--stroke-error-alpha` |

Overrides arrive through `styles.colors` (`background`, `dangerBackground`, `dangerBorder`), and only the selected variant's overrides SHALL be forwarded, so an inline override for one variant never paints the other.

`ConfirmationIdentityRow` SHALL lay out a resource that has no `EntityHeaderItem` as an optional host-supplied `icon`, an optional `typeLabel` above the name (`dial-caption-lead-semi-text`, which uppercases it, colored by `--cir-type-label-text` falling back to `--text-secondary`), and the `name` (`dial-small-semi-text`, truncated rather than wrapped). The host owns the glyph set; the row imports no icons.

#### Scenario: A chat's identity is its glyph, type, and title

- **WHEN** a `ConfirmationIdentityRow` with a chat glyph, `typeLabel="Chat"`, and the conversation title is rendered inside a `Danger` `ConfirmationIdentityCard`
- **THEN** the card is red-tinted and shows the glyph, `CHAT`, and the title

### Requirement: `ConfirmationDialog` presents the block as a centered dialog

`ConfirmationDialog` SHALL wrap `ConfirmationView` and `ConfirmationFooter` in the kit's `Popup` for any surface with no details panel to host the step in place. It accepts every `ConfirmationView` prop plus `open`, `title`, `confirmLabel`, `cancelLabel`, `isLoading`, `isConfirmDisabled`, `loadingStatusLabel`, `size`, `popupClassName`, `titleClassName`, `onConfirm`, and `onClose`.

- `title` SHALL be a `string`, because the kit names a dialog only from a string header; a node would leave the dialog with no accessible name.
- `size` SHALL default to `PopupSize.Sm` (400px) rather than the kit's `Md`.
- While `isLoading` is `true`, every dismissal route — Cancel, the header close control, `Escape`, and an outside click — SHALL be ignored, not only the two footer buttons, so the surface behind never contradicts a request that is still running.

#### Scenario: Escape is inert while deleting

- **WHEN** `isLoading` is `true` and the user presses `Escape`
- **THEN** `onClose` is not called and the dialog stays open

#### Scenario: The dialog is named by its title

- **WHEN** the dialog is open with `title="Delete chat"`
- **THEN** its accessible name is "Delete chat"

### Requirement: The chat panel's single-chat delete uses the shared dialog

`ConversationPanelView` SHALL confirm deleting one conversation with `ConfirmationDialog` in the `Danger` variant:

- **Title:** "Delete chat" (`conversationPanel.delete.deleteConfirmTitle`).
- **Identity:** a `ConfirmationIdentityRow` with `IconMessageCircle`, the type label from `conversationPanel.typeLabel`, and the conversation title.
- **Message:** `conversationPanel.delete.confirmMessage` with the title bold via `CONFIRMATION_BOLD_COMPONENTS`.
- **Consequences:** `basic.consequenceCannotBeUndone`.
- **Actions:** `buttons.delete` / `buttons.cancel`, with `basic.deletingStatus` announced while the request runs.

A failed request SHALL keep the dialog open and render the error inline through the dialog's `children` slot. On success the panel shows the deletion notification and, when the deleted conversation is the one open, navigates to the root route. Closing SHALL be ignored while the request is in flight.

#### Scenario: Deleting the open chat navigates home

- **WHEN** the user confirms deleting the conversation that is currently open, and the request succeeds
- **THEN** the dialog closes, a deletion notification is shown, and the app navigates to the root route

#### Scenario: A failed delete keeps the dialog open

- **WHEN** the delete request fails
- **THEN** the dialog stays open and shows the localized delete error beneath the consequences

### Requirement: Shared strings are defined once

"Cannot be undone" and "Deleting…" SHALL each exist exactly once, as `basic.consequenceCannotBeUndone` and `basic.deletingStatus`, and every delete surface in the app SHALL reuse them rather than defining a per-namespace copy.

#### Scenario: No duplicate of the shared strings

- **WHEN** `apps/chat/src/i18n/locales/en.json` is searched for the values "Cannot be undone" and "Deleting…"
- **THEN** each appears only under `basic`

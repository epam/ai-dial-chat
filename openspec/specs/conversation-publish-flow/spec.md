## ADDED Requirements

### Requirement: Publish action is offered only for owned, writable conversations

`ConversationPanelView.getActions` SHALL add a "Publish" `DropdownItem` to the row action menu, positioned after "Share" and before "Delete", using the same `isReadonlyItem` gate already computed for Share (`rawItem.isReadonly || rawItem.sharedWithMe || rawItem.publishedWithMe`) — the action SHALL be omitted entirely (not shown disabled) when `isReadonlyItem` is `true`. Clicking it SHALL set `pendingPublishConversationPath` (new `ConversationPanelView` state, mirroring `pendingShareConversationPath`) to the conversation's context id.

This is a client-side UI gate only; it does not replace server-side write-access enforcement performed by DIAL Core when the publish request is made (see `conversation-publish-api`).

#### Scenario: Owned conversation shows a Publish action
- **GIVEN** a conversation with `isReadonly: false`, `sharedWithMe: false`, `publishedWithMe: false`
- **WHEN** the panel row's action menu is opened
- **THEN** a "Publish" action is present, after "Share" and before "Delete"

#### Scenario: Shared-with-me or published-with-me conversation has no Publish action
- **GIVEN** a conversation with `sharedWithMe: true` or `publishedWithMe: true`
- **WHEN** the panel row's action menu is opened
- **THEN** no "Publish" action is present

#### Scenario: Clicking Publish opens the panel for that conversation
- **WHEN** the user clicks "Publish" on a conversation row
- **THEN** `pendingPublishConversationPath` is set to that conversation's id and the publish panel opens

### Requirement: Standalone publish panel is a right-side slide-in, sized and animated like the catalog details panel

`PublishConversationPanelContainer` SHALL render a right-side slide-in panel matching `libs/catalog`'s `DetailsPanel` dimensions and animation: full width on mobile, `desktop:w-[540px]` with `desktop:rounded-ts-xl desktop:rounded-bs-xl` on desktop, `fixed inset-y-0 end-0`, `translate-x-0`/`translate-x-full rtl:-translate-x-full` transform toggling on open/close, and a backdrop (`fixed inset-0`) that dismisses the panel on click. The panel root SHALL use `role="dialog"`, `aria-modal="true"`, and an `aria-label` sourced from i18n (`conversationPublish.panelAriaLabel`).

Unlike the catalog publish sub-view (which is nested inside `DetailsPanel` and hides its Close button behind a Back-to-details affordance), this panel is standalone — there is no details view behind it. Its header SHALL render, left-to-right in LTR (logical order: flex spacer, then title, then close):
1. A flex spacer (`flex-1`, no Back button — a Back control would have nothing to go "back" to)
2. The title, sourced from i18n (`conversationPublish.title`, default "Publish")
3. A `DialCloseButton` that calls `onClose`

`onClose` SHALL clear `pendingPublishConversationPath` in `ConversationPanelView`. While a publish request is in flight (`isSubmitting`), the `DialCloseButton` SHALL be disabled, matching `DetailsPanel`'s existing Back-button-disabled-while-submitting behavior for its publish sub-view.

#### Scenario: Panel header has Close but no Back
- **WHEN** the conversation publish panel is open
- **THEN** the header shows the title and a Close (X) button, and does not render any Back/chevron control

#### Scenario: Close button is disabled while submitting
- **GIVEN** the panel is open and a publish request is in flight
- **WHEN** the user attempts to click the Close button
- **THEN** the button is disabled and does not dismiss the panel

#### Scenario: Backdrop click dismisses the panel
- **WHEN** the user clicks the backdrop behind the open panel
- **THEN** `onClose` fires and `pendingPublishConversationPath` becomes `null`

### Requirement: Cancel, Close, and Escape all dismiss the panel identically

The pinned footer's "Cancel" button SHALL call the same `onClose` handler as the header's Close button (not a separate "go back" handler, since there is no intermediate view). Pressing Escape while the panel is open SHALL also call `onClose`, matching `DetailsPanel`'s existing Escape-to-close `keydown` listener pattern. All three dismissal paths SHALL clear `pendingPublishConversationPath` and reset any in-progress folder-selection/history state owned by the publish flow hook.

#### Scenario: Cancel button dismisses the panel
- **WHEN** the user clicks "Cancel" in the pinned footer
- **THEN** the panel closes and `pendingPublishConversationPath` becomes `null`

#### Scenario: Escape key dismisses the panel
- **GIVEN** the conversation publish panel is open
- **WHEN** the user presses Escape
- **THEN** the panel closes and `pendingPublishConversationPath` becomes `null`

### Requirement: Panel body renders a title-only resource summary instead of the catalog version pill

The scrollable body SHALL render the shared `PublishPanel` lib component (destination folder picker with search, inline folder creation, replace/no-access/submit-error callouts, publish history list) configured with a `PublishResourceSummary` built from the conversation's title (no icon, no version) rather than a `CatalogItem`. The summary row SHALL show the conversation's title and SHALL NOT render a version pill or any `{name}__{version}`-style identifier, since conversations have no version.

Destination folder picker, search, and inline folder creation SHALL behave identically to the catalog publish flow (folder tree via `PublishFoldersTree`, bucket root selectable as `[]`, lazy-loaded children, optimistic create with rollback on failure), reusing `usePublishFolders` (the renamed, shared `useCatalogPublishFolders`).

#### Scenario: Summary row shows the conversation title with no version
- **WHEN** the publish panel opens for a conversation titled "Q3 planning notes"
- **THEN** the summary row displays "Q3 planning notes" and no version pill

#### Scenario: Folder selection and search behave as in catalog publish
- **WHEN** the user searches for a folder name and selects a matching folder
- **THEN** `selectedFolderPath` updates exactly as it would for a catalog entity publish flow

### Requirement: Submit button always reads "Publish"; already-published-to-folder disables submit instead of offering replace

The pinned footer's submit button SHALL always show the fixed label "Publish" (i18n key `conversationPublish.submitLabel`) regardless of folder selection — never an "Update version" variant, since conversations have no version to update. When the selected folder already has a prior publication of this same conversation (history for that folder is non-empty), the submit button SHALL be disabled and a distinct callout (i18n key `conversationPublish.alreadyPublishedWarning`, NOT the catalog `ReplaceWarning` wording) SHALL be shown, since there is no supported "publish again to the same folder" action in this iteration (see design.md D2).

#### Scenario: First publish to a folder is allowed
- **GIVEN** the conversation has never been published to the selected folder
- **WHEN** the user selects that folder
- **THEN** the submit button is enabled and reads "Publish"

#### Scenario: Republishing to an already-published folder is blocked
- **GIVEN** the conversation has a prior publication in the selected folder
- **WHEN** the user selects that folder
- **THEN** the submit button is disabled and the "already published" callout is shown instead of a replace-warning

#### Scenario: Long folder names never appear in the button label
- **WHEN** any folder or the root is selected, regardless of name length
- **THEN** the submit button label remains the fixed "Publish" text, never interpolating the destination name

### Requirement: Successful publish closes the panel, shows a success notification, and refreshes the conversation list

On a successful publish response, `PublishConversationPanelContainer` SHALL: close the panel (same effect as Cancel/Close), call `showNotification` with a success variant and i18n message (`conversationPublish.successMessage`), and call `ConversationsContext`'s `refreshConversations()` so the newly published copy becomes visible under the Organization tab (`publishedWithMe`) without requiring a manual reload.

On failure, the panel SHALL remain open, the submit-error callout (existing `derivePublishState` mechanism, `PublishCalloutKind.SubmitError`) SHALL be shown, and no notification or list refresh SHALL occur.

#### Scenario: Publish succeeds
- **WHEN** the user submits a valid publish request and the backend returns success
- **THEN** the panel closes, a success notification appears, and `refreshConversations()` is called

#### Scenario: Publish fails
- **WHEN** the backend returns an error for the publish request
- **THEN** the panel stays open, the submit-error callout is shown, and no success notification or list refresh occurs

### Requirement: i18n — all new user-visible strings use translation keys

New keys SHALL be added to a `ConversationPublishI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`, with English defaults in `apps/chat/src/i18n/locales/en.json`. The row-menu label, panel title, and submit-button label all read the exact same English string ("Publish") and SHALL reuse the single generic `ButtonsI18nKeys.Publish` key (added to `ButtonsI18nKeys` since none existed) rather than three separate feature-scoped keys with duplicate values, per the project's existing duplicate-value convention — an initial duplicate `ConversationPanelI18nKeys.PublishLabel` key was removed during implementation for exactly this reason.

New keys (non-exhaustive — implementation SHALL add any additional strings needed, following this naming pattern):

| Key | English value |
|---|---|
| `buttons.publish` (`ButtonsI18nKeys.Publish`) | "Publish" — row menu label, panel title, and submit-button label |
| `conversationPublish.panelAriaLabel` | "Publish conversation" |
| `conversationPublish.alreadyPublishedWarning` | "This conversation is already published in {folder}." |
| `conversationPublish.successMessage` | "Conversation published successfully." |

#### Scenario: Row menu label resolves via i18n
- **WHEN** `en.json` is loaded
- **THEN** `buttons.publish` resolves to "Publish"

### Requirement: RTL — logical properties and mirrored directional icons throughout

The panel SHALL use `end-0`/`inset-y-0` and `rtl:-translate-x-full` for its slide-in position (matching `DetailsPanel`'s existing pattern), and no new physical-direction (`left-*`/`right-*`/`ml-*`/`mr-*`) classes SHALL be introduced. The folder tree and search input inherit `DialFoldersTree`'s and `SearchInput`'s existing RTL-correct rendering (no additional mirroring needed at this layer, matching `catalog-publish-flow`'s existing folder-tree requirement). No directional icon requiring `rtl:scale-x-[-1]` mirroring is introduced by this panel (Close/X and the folder-tree's own chevrons are already covered by existing components).

#### Scenario: Panel slides in from the correct edge in RTL
- **WHEN** `dir="rtl"` is set on the document and the panel opens
- **THEN** the panel animates in from the visual end edge (screen-left in RTL), using `rtl:-translate-x-full` rather than a hardcoded LTR-only transform

### Requirement: Accessibility — panel is keyboard- and screen-reader-navigable

The panel root SHALL expose `role="dialog"`, `aria-modal="true"`, and `aria-label`. The Close button SHALL have an `aria-label` sourced from i18n. The submit-error and already-published callouts SHALL use `role="alert"`. The publish history list SHALL expose list semantics (`role="list"`/`role="listitem"` or equivalent), matching `catalog-publish-api`'s existing history-list accessibility requirement. Focus SHALL move into the panel when it opens and return to the triggering row's action-menu button when it closes (standard modal focus-management pattern, matching `DetailsPanel`'s existing behavior).

#### Scenario: Screen reader announces the already-published callout
- **WHEN** the already-published callout renders
- **THEN** it is exposed with `role="alert"` so assistive technology announces it immediately

#### Scenario: Focus returns to the triggering control on close
- **WHEN** the panel closes via Cancel, Close, or Escape
- **THEN** keyboard focus returns to the conversation row's "..." action-menu trigger

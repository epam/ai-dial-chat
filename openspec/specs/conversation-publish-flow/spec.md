## Purpose

Define the conversation publishing UI flow, including eligibility, destination selection, approval-request submission, feedback, internationalization, RTL behavior, and accessibility.

## Requirements

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

The scrollable body SHALL render the shared `PublishPanel` component (exported from `@epam/ai-dial-publish-panel`, not `@epam/ai-dial-catalog`) providing the destination folder picker with search, inline folder creation, no-access/submit-error callouts, and publish history list, configured with a `PublishResourceSummary` built from the conversation's title (no icon, no version) rather than a `CatalogItem`. The summary row SHALL show the conversation's title and SHALL NOT render a version pill or any `{name}__{version}`-style identifier, since conversations have no version.

Destination folder picker, search, and inline folder creation SHALL behave identically to the catalog publish flow (folder tree via `PublishFoldersTree`, bucket root selectable as `[]`, lazy-loaded children, optimistic create with rollback on failure), reusing `usePublishFolders` (the renamed, shared `useCatalogPublishFolders`).

#### Scenario: Summary row shows the conversation title with no version
- **WHEN** the publish panel opens for a conversation titled "Q3 planning notes"
- **THEN** the summary row displays "Q3 planning notes" and no version pill

#### Scenario: Folder selection and search behave as in catalog publish
- **WHEN** the user searches for a folder name and selects a matching folder
- **THEN** `selectedFolderPath` updates exactly as it would for a catalog entity publish flow

Inline folder creation SHALL also validate the new folder name identically to the catalog publish flow (see `catalog-publish-flow`'s "Inline folder creation validates the name client-side" requirement — empty name, `..`/forbidden characters, or a duplicate sibling name are all rejected client-side before `onCreatePublishFolder` is called). `PublishConversationPanelContainer` SHALL supply the validation error strings (`ConversationPublishI18nKeys.EmptyFolderNameError`, `InvalidFolderNameError`, `DuplicateFolderNameError`) via `PublishPanelTexts.createFolderEmptyNameError`/`createFolderInvalidNameError`/`createFolderDuplicateNameError`.

#### Scenario: User enters a path-traversal folder name in the conversation publish panel
- **WHEN** the user types `../EscapeFolder` into the inline create row and confirms
- **THEN** an inline validation error is shown and no publish request is sent with an invalid `folderPath`

### Requirement: Submit always creates a publish request and is not blocked by publication history

The pinned footer's submit button SHALL always show the fixed label "Publish" (i18n key `buttons.publish`) regardless of folder selection — never an "Update version" variant, since conversations have no version to update. Each submission creates a new admin-approval request rather than updating or replacing an existing published conversation. Therefore, prior publication history for the selected folder is informational only and SHALL NOT disable the submit button or show an "already published" or replace-warning callout. When the selected folder is valid and writable and no submission is already in flight, the user SHALL be allowed to submit another publish request for the same conversation and folder.

#### Scenario: First publish to a folder is allowed
- **GIVEN** the conversation has never been published to the selected folder
- **WHEN** the user selects that folder
- **THEN** the submit button is enabled and reads "Publish"

#### Scenario: Another publish request to a previously used folder is allowed
- **GIVEN** the conversation has a prior publication in the selected folder
- **WHEN** the user selects that folder
- **THEN** the submit button remains enabled and reads "Publish"
- **AND** no "already published" or replace-warning callout is shown
- **WHEN** the user clicks "Publish"
- **THEN** a new admin-approval request is submitted

#### Scenario: Long folder names never appear in the button label
- **WHEN** any folder or the root is selected, regardless of name length
- **THEN** the submit button label remains the fixed "Publish" text, never interpolating the destination name

### Requirement: Successful publish closes the panel, shows a pending-approval notification, and does not refresh the conversation list

On a successful publish response (HTTP 201, meaning Core accepted a new, admin-pending publication request), `PublishConversationPanelContainer` SHALL: close the panel (same effect as Cancel/Close) and call `showNotification` with a success variant and i18n message (`conversationPublish.successMessage`) whose copy communicates that the request was **submitted for admin approval**, not that the conversation is now published or visible.

`PublishConversationPanelContainer` SHALL NOT call `ConversationsContext.refreshConversations()` on publish success. A newly submitted publication request is pending admin approval; no resource exists yet under `conversations/public/...` for the Organization tab to show, so refreshing the conversation list at this point has no observable effect and previously reinforced an incorrect "it's published now" impression. The Organization tab reflects the published copy only once a separate, out-of-app admin approval step (not exposed by this application) is completed and the user later reloads or otherwise refreshes the list themselves.

On failure, the panel SHALL remain open, the submit-error callout (existing `derivePublishState` mechanism, `PublishCalloutKind.SubmitError`) SHALL be shown, and no notification or list refresh SHALL occur.

#### Scenario: Publish succeeds
- **WHEN** the user submits a valid publish request and the backend returns success
- **THEN** the panel closes, a success notification appears with pending-approval wording, and `refreshConversations()` is NOT called

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
| `conversationPublish.successMessage` | "Publish request submitted. It will appear in Organization once an admin approves it." |

#### Scenario: Row menu label resolves via i18n
- **WHEN** `en.json` is loaded
- **THEN** `buttons.publish` resolves to "Publish"

#### Scenario: Success message communicates pending approval, not immediate publication
- **WHEN** `en.json` is loaded
- **THEN** `conversationPublish.successMessage` resolves to wording that describes a submitted, pending-approval request and does not assert the conversation is already published or visible

### Requirement: RTL — logical properties and mirrored directional icons throughout

The panel SHALL use `end-0`/`inset-y-0` and `rtl:-translate-x-full` for its slide-in position (matching `DetailsPanel`'s existing pattern), and no new physical-direction (`left-*`/`right-*`/`ml-*`/`mr-*`) classes SHALL be introduced. The folder tree and search input inherit `DialFoldersTree`'s and `SearchInput`'s existing RTL-correct rendering (no additional mirroring needed at this layer, matching `catalog-publish-flow`'s existing folder-tree requirement). No directional icon requiring `rtl:scale-x-[-1]` mirroring is introduced by this panel (Close/X and the folder-tree's own chevrons are already covered by existing components).

#### Scenario: Panel slides in from the correct edge in RTL
- **WHEN** `dir="rtl"` is set on the document and the panel opens
- **THEN** the panel animates in from the visual end edge (screen-left in RTL), using `rtl:-translate-x-full` rather than a hardcoded LTR-only transform

### Requirement: Accessibility — panel is keyboard- and screen-reader-navigable

The panel root SHALL expose `role="dialog"`, `aria-modal="true"`, and `aria-label`. The Close button SHALL have an `aria-label` sourced from i18n. The submit-error callout SHALL use `role="alert"`. The publish history list SHALL expose list semantics (`role="list"`/`role="listitem"` or equivalent), matching `catalog-publish-api`'s existing history-list accessibility requirement. Focus SHALL move into the panel when it opens and return to the triggering row's action-menu button when it closes (standard modal focus-management pattern, matching `DetailsPanel`'s existing behavior).

#### Scenario: Focus returns to the triggering control on close
- **WHEN** the panel closes via Cancel, Close, or Escape
- **THEN** keyboard focus returns to the conversation row's "..." action-menu trigger

### Requirement: Publish UI is imported from the shared publish-panel library, not the catalog library
`PublishConversationPanelContainer` SHALL import `StandalonePublishPanel`, `usePublishFlow`, and all `Publish*` types from `@epam/ai-dial-publish-panel`. It SHALL NOT import any symbol from `@epam/ai-dial-catalog`, since conversation publish has no relationship to catalog browsing or catalog domain models.

#### Scenario: Container imports only from the publish-panel library
- **WHEN** `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx` is inspected
- **THEN** all publish-UI imports come from `@epam/ai-dial-publish-panel` and none come from `@epam/ai-dial-catalog`

### Requirement: Publish panel wires the shared access-rules editor and includes rules in the publish request

`PublishConversationPanelContainer` SHALL pass `usePublishFlow`'s `rules`/`setRules` into `StandalonePublishPanel`'s new `rules`/`onRulesChange` props, and SHALL pass `ruleSourceOptions` sourced from `useAppConfig().config.publicationFilterSources` (see the `config-registry-and-env-provider`/`client-config-endpoint` capabilities). The `onPublish` callback (`PublishConversationPanelContainer.tsx:76-78`) SHALL forward the `rules` argument now supplied by `usePublishFlow.handleSubmit` to `publishConversation`, which SHALL include it in the request body sent to `POST /api/v1/conversations/publish` (see `conversation-publish-api`).

#### Scenario: Rules entered in the panel reach the publish call
- **GIVEN** the user has added one rule (`source: 'role'`, `function: 'CONTAIN'`, `targets: ['engineering']`) and selected a destination folder
- **WHEN** the user clicks Publish
- **THEN** `publishConversation` is called with a request body whose `rules` array contains exactly that one rule

#### Scenario: No rules added sends an empty array
- **GIVEN** the user has not added any rules
- **WHEN** the user clicks Publish
- **THEN** `publishConversation` is called with `rules: []`, identical to today's behavior

#### Scenario: Source options come from client config, not a hardcoded list
- **WHEN** the access-rules section's source control renders
- **THEN** its available options equal `useAppConfig().config.publicationFilterSources`, not a value hardcoded in `PublishConversationPanelContainer` or `libs/publish-panel`

### Requirement: Selecting a destination folder pre-fills the rules editor with that folder's existing rules

`PublishConversationPanelContainer` SHALL supply `usePublishFlow`'s `onFetchExistingRules` option as a thin call to `apps/chat/src/server-api/publish-rules.api.ts`'s `getPublishRules(folderPath)`, which calls `GET /api/v1/publish/rules?folderPath=...` (see `publish-rules-lookup-api`). Choosing a destination folder replaces the rules editor's contents with that folder's already-configured rules (or empties it, if none), overwriting whatever the user had entered for a previously selected folder.

#### Scenario: Selecting a folder with prior rules pre-fills the editor
- **GIVEN** the user opens the publish panel for a conversation and selects a destination folder that already has a configured rule
- **WHEN** the lookup resolves
- **THEN** the rules editor shows that existing rule as a chip, without the user having entered it

#### Scenario: A rules-lookup failure does not block the conversation publish flow
- **GIVEN** the user selects a destination folder and the rules lookup fails
- **THEN** folder selection, manual rule entry, and the Publish submit action all remain fully usable; only the pre-fill did not occur

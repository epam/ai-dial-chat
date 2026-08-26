# conversation-unpublish-flow Specification

## Purpose
TBD - created by archiving change add-unpublish-my-resources. Update Purpose after archive.
## Requirements
### Requirement: The conversation row action menu offers Unpublish

`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` SHALL add an `Unpublish` entry to a conversation row's action menu, occupying the existing `Publish` entry's position, using `IconWorldOff` at `DIAL_ICON_SIZE.SM` with `aria-hidden` and the label `t(ButtonsI18nKeys.Unpublish)`.

`Publish` and `Unpublish` SHALL be mutually exclusive, matching the catalog details menu (`catalog-unpublish-flow`): the row menu SHALL carry exactly one of the two. A conversation with no published copy offers `Publish`; once history resolves to at least one published folder, `Unpublish` takes its place. Republishing an already-published conversation therefore means unpublishing it first.

The swap SHALL reverse once an administrator approves a removal: history then resolves to zero folders for that folder and the entry returns to `Publish`. Only a published folder that is still live yields `Unpublish` — see the history requirement below for what "still live" means when Core keeps the original `ADD` as an audit record.

The entry SHALL be gated by the same conditions that gate `Publish`, plus one more:

- `OverlayFeature.ConversationsPublishing` is enabled — an app whose publish action is hidden must not offer to reverse it.
- The row is the caller's own writable conversation (not `isReadonly`, `sharedWithMe`, or `publishedWithMe`), matching the existing publish gate.
- The conversation's publish history has resolved to at least one folder.

#### Scenario: Unpublish replaces Publish in the row menu
- **GIVEN** publishing is enabled and the conversation's history has resolved to at least one published folder
- **WHEN** the row's action menu is opened
- **THEN** `Unpublish` renders in `Publish`'s position and `Publish` is not rendered

#### Scenario: Publish holds the slot for an unpublished conversation
- **GIVEN** publishing is enabled and the conversation has no published folder, or its history has not resolved yet
- **WHEN** the row's action menu is opened
- **THEN** `Publish` renders and `Unpublish` is not rendered

#### Scenario: Publishing disabled hides both entries
- **GIVEN** `OverlayFeature.ConversationsPublishing` is off
- **THEN** neither `Publish` nor `Unpublish` is rendered

#### Scenario: A conversation shared with the caller offers neither
- **GIVEN** the row is `sharedWithMe` or `publishedWithMe`
- **THEN** no publish or unpublish entry is rendered

### Requirement: Conversation publish history is fetched lazily when the row menu opens

The conversation panel SHALL call `getConversationPublishHistory(path)` when a row's action menu is opened or its trigger is focused, once per conversation, and hold the result keyed by conversation. It SHALL NOT fetch history while rendering the conversation list: the list can hold hundreds of rows, and history is a bucket-wide `getPublications` scan on the server.

The resolution states and their effect on the `Unpublish` entry are identical to the catalog flow (see `catalog-unpublish-flow`): withheld while unresolved, shown with ≥ 1 folder, hidden on zero folders, hidden on failure. A failure SHALL NOT raise a notification — the user did not ask for history, they opened a menu.

Resolved history SHALL exclude folders whose removal Core has approved. Core never retracts the original `ADD` publication — it stays `APPROVED` as an audit record — so `resolvePublicationsForSource` in `apps/chat-api/src/publish/publication.util.ts` SHALL treat an `APPROVED` `DELETE` as cancelling every `ADD` for the same target folder created at or before it. A `PENDING` removal SHALL cancel nothing: the copy is live until it is approved. An `ADD` created *after* an approved removal SHALL survive, so publish → unpublish → publish-again lists the folder again. When Core reports an approved removal with no usable `createdAt` there is nothing to order it against, and it SHALL cancel the whole folder — a re-publish included — because offering `Unpublish` for a copy Core has deleted is the failure being prevented ([GH #8445](https://github.com/epam/ai-dial-chat/issues/8445)).

A resolved result SHALL be reused for a bounded window (`PUBLISH_HISTORY_TTL_MS`, matching the server-side history cache) and revalidated after it, so a menu opened later in a long-lived session reflects an approval that happened meanwhile rather than a first-open snapshot. A revalidation SHALL keep the folders already on screen rather than reverting to a loading state, and at most one request per conversation SHALL be in flight at a time.

#### Scenario: An approved removal returns the entry to Publish
- **GIVEN** the conversation was published to one folder and an administrator approved its removal
- **WHEN** the row's action menu is opened and history resolves
- **THEN** history reports zero folders, `Publish` renders, and `Unpublish` is not rendered

#### Scenario: A re-publish after an approved removal offers Unpublish again
- **GIVEN** the conversation was published, removed with approval, and published to that folder again
- **WHEN** history resolves
- **THEN** the folder is listed and `Unpublish` renders

#### Scenario: A pending removal still offers Unpublish
- **GIVEN** an unpublish request for the folder is `PENDING`
- **WHEN** history resolves
- **THEN** the folder is still listed, because the published copy is live until an admin approves

#### Scenario: A stale result is revalidated on the next open
- **GIVEN** a resolved result older than the reuse window
- **WHEN** the menu is opened again
- **THEN** one further request is issued while the folders already resolved stay on screen

#### Scenario: A request still in flight is not duplicated
- **GIVEN** a request for the conversation has not settled
- **WHEN** the menu is opened again, even past the reuse window
- **THEN** no second request is issued

The same fetched history SHALL be handed to `PublishConversationPanelContainer` when the publish panel opens for that conversation, so opening Publish after opening the menu issues no second request.

#### Scenario: History loads on menu open
- **WHEN** the user opens a conversation row's action menu for the first time
- **THEN** exactly one `getConversationPublishHistory` request is issued for that conversation

#### Scenario: Rendering the list issues no history requests
- **WHEN** the conversation list renders with fifty rows
- **THEN** no publish-history request is issued

#### Scenario: A failed lookup hides the entry silently
- **GIVEN** the history request rejects
- **THEN** `Unpublish` is absent from the menu and no notification is shown

#### Scenario: Publish panel reuses the already-fetched history
- **WHEN** the user opens the menu and then opens the publish panel for the same conversation
- **THEN** the publish panel renders the history already held, and no second request is issued

### Requirement: Conversation unpublish confirms in a popup, not a slide-in panel

Selecting `Unpublish` SHALL open a `ConfirmationPopup` — the same component the conversation panel's other destructive row actions use. Conversations have no details panel, so the catalog's in-place confirmation sub-view has no equivalent here, and introducing a second slide-in panel for one confirmation would not be worth the surface.

The popup body follows the catalog flow's folder rule: with exactly one published folder it names that folder in static copy and enables the confirm button immediately; with more than one it renders the folders as a single-select radio group, none preselected, with confirm disabled until a choice is made. The radio group carries an accessible group label (`conversationUnpublish.folderGroupAriaLabel`).

Confirm and cancel SHALL both be disabled while the request is in flight, and the in-flight state SHALL be announced through an `aria-live="polite"` status region rather than by a spinner alone.

All strings SHALL come from `t()` with keys declared in `apps/chat/src/constants/translation-keys.ts`.

#### Scenario: Single folder confirms directly
- **GIVEN** the conversation is published to one folder
- **THEN** the popup names that folder and the confirm button is enabled

#### Scenario: Multiple folders require a choice
- **GIVEN** the conversation is published to two folders
- **THEN** both render as radio options with none selected and confirm disabled until one is chosen

#### Scenario: In-flight state is announced and locks the controls
- **WHEN** the user confirms
- **THEN** confirm and cancel are disabled and the pending state is announced through a polite live region

#### Scenario: Escape and Cancel both dismiss without a request
- **WHEN** the user presses Escape or clicks Cancel
- **THEN** the popup closes, no request is issued, and any folder selection is discarded

### Requirement: Conversation unpublish calls the BFF endpoint and reports a pending request

Confirming SHALL call the `unpublishConversation` wrapper in `apps/chat/src/server-api/conversation-publish.api.ts` with the bucket-relative conversation path — derived with the same `getConversationPath(normalizeConversationId(contextId))` call the publish action already uses, not the `conversations/{bucket}/...` resource path the share action uses — and the selected folder joined with `/`.

On success it SHALL close the popup and raise exactly one notification via `notifyOperationSuccess(NotifiableEntity.Conversation, EntityOperation.UnpublishRequested, { name, folder })`, whose copy states the request is awaiting admin approval.

It SHALL NOT call `ConversationsContext.refreshConversations()`. Nothing about the caller's own conversation list changed — the published copy under `conversations/public/...` survives until an admin approves the removal — for the same reason publish success does not refresh the list.

On failure the popup SHALL close and `usePublishErrorNotification` SHALL raise the error notification, reusing the shared publish error copy, trace-id handling, and offline case.

#### Scenario: Confirming issues the request with the publish-shaped path
- **WHEN** the user confirms unpublish for a conversation
- **THEN** `unpublishConversation` is called with the bucket-relative path (no `conversations/` prefix) and the selected folder

#### Scenario: Success reports a pending request and leaves the list alone
- **WHEN** the request resolves
- **THEN** one success notification with pending-approval wording is raised and `refreshConversations()` is not called

#### Scenario: Failure reuses the shared publish error notification
- **WHEN** the request rejects
- **THEN** `usePublishErrorNotification` raises the error notification and no success notification is raised

### Requirement: RTL and accessibility for the conversation unpublish surface

The popup and its folder list SHALL use logical Tailwind utilities (`ms-*`/`me-*`, `ps-*`/`pe-*`, `text-start`, `start-*`/`end-*`) throughout — no physical-direction classes for directional layout — so the surface flips correctly under `dir="rtl"`. `IconWorldOff` is conceptual, not directional, and SHALL NOT be mirrored.

Every `aria-label` on the new surface SHALL be translated through `t()`; the radio group SHALL be a real grouped control with an accessible name, keyboard-operable with arrow keys; and the confirm/cancel pair SHALL remain reachable and correctly ordered by keyboard.

#### Scenario: Arabic locale flips the popup layout
- **WHEN** the app language is Arabic and the popup is open
- **THEN** its content, folder list, and footer buttons mirror, and the icon in the menu entry is not mirrored

#### Scenario: Folder choice is keyboard-operable
- **WHEN** a keyboard user reaches the folder group
- **THEN** the group exposes its accessible name and arrow keys move the selection


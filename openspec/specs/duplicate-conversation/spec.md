# Spec: duplicate-conversation

## Purpose

Define the backend, generated-client, state-management, and UI behavior for duplicating a conversation into the authenticated user's bucket with a fresh stable identifier.

## Requirements

### Requirement: Backend duplicate endpoint
The system SHALL expose `POST /api/v1/conversations/duplicate?path=<sourcePath>` that copies the source conversation into the authenticated user's own bucket. The endpoint is protected by `SessionGuard`, accepts no request body, and returns HTTP 201 with:

```json
{
  "newPath": "conversations/user-bucket/gpt-4o__My%20chat"
}
```

The returned `newPath` is the encoded full DIAL Core resource path and SHALL be treated as an opaque conversation identifier by callers.

The duplicated conversation SHALL keep the source conversation's stored display name, sanitised via `prepareEntityName`, without adding a numeric title suffix. Its destination storage path SHALL be the clean path, and SHALL gain a fresh `generateUUID()` segment only when a resource already exists there:

```
{deploymentKey}__{displayName}            // clean path is free
{deploymentKey}__{displayName}__{uuid}    // clean path is taken
```

`duplicateConversation` SHALL perform exactly one destination path-existence check, a lookup of that single candidate path (never a listing of the caller's conversations). A trailing UUID from the source path SHALL NOT be reused. The full rule, and why it differs from `createConversation`, lives in the `auto-index-duplicate-names` capability (Requirement: `duplicateConversation` path gains a fresh UUID segment only on collision). Existing legacy source paths without a UUID remain valid inputs.

Generated-client impact:
- OpenAPI operationId: `duplicateConversation`
- SDK method: `ConversationsApi.duplicateConversation({ path })`
- Query DTO: `ConversationPathDto`
- Response DTO: `DuplicateConversationResponseDto` (`{ newPath: string }`)
- Frontend callers use the normal generated method through `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — `path` is missing, empty, or invalid
- `401 Unauthorized` — the caller has no valid session
- `403 Forbidden` — the caller cannot read the source conversation, or the body carries `code: conversationDuplicateModelHidden` (`ConversationErrorCode.DuplicateModelHidden`, response DTO `DuplicateConversationErrorDto`) because the conversation's current model is operator-hidden (see below)
- `404 Not Found` — the source conversation does not exist
- `502 Bad Gateway` — DIAL Core rejects the read or save operation
- `503 Service Unavailable` — DIAL Core is unreachable

This behavior does not require a new API version: UUID-suffixed `newPath` values were already valid collision responses, so consumers already have to treat the returned path as opaque. Existing stored paths are not migrated.

#### Scenario: Successful duplication from shared conversation
- **WHEN** an authenticated user calls `POST /api/v1/conversations/duplicate?path=other-bucket/gpt-4o__My%20chat__<source-uuid>`
- **THEN** the system copies the conversation to the user's bucket and returns `{ newPath: "conversations/<user-bucket>/gpt-4o__My%20chat" }` with HTTP 201 when that clean path is free

#### Scenario: No UUID is appended when the unsuffixed destination path is free
- **GIVEN** no resource exists at `gpt-4o__My chat` in the user's bucket
- **WHEN** the user duplicates a conversation named `"My chat"`
- **THEN** a single destination metadata lookup of `gpt-4o__My chat` is performed
- **AND** the duplicate is stored at `gpt-4o__My chat`, with no UUID segment

#### Scenario: Repeated duplicates retain the display name and receive different ids
- **WHEN** the same conversation named `"My chat"` is duplicated twice
- **THEN** both duplicated conversations keep `name: "My chat"` without a numeric suffix
- **AND** the first `newPath` is the clean `gpt-4o__My%20chat` path (when it was free), while the second ends with a freshly generated UUID because the first duplicate now occupies the clean path
- **AND** the two `newPath` values differ

#### Scenario: Missing path parameter
- **WHEN** the request omits the `path` query parameter
- **THEN** the system returns HTTP 400

#### Scenario: Unauthenticated request
- **WHEN** the request is made without a valid session
- **THEN** the system returns HTTP 401

### Requirement: Server-API duplicate function
The frontend server-api module SHALL expose `duplicateConversation(conversationPath: string)` that delegates to `ConversationsApi.duplicateConversation({ path: conversationPath })` and returns `{ newPath: string }`. It SHALL NOT construct the REST request through `server-api/base.ts`.

#### Scenario: Successful call
- **WHEN** `duplicateConversation("other-bucket/some/chat.json")` is called
- **THEN** it resolves with `{ newPath: string }` matching the backend response

### Requirement: Conversations context exposes duplicate
`ConversationsContext` SHALL expose `duplicateConversation(id: string): Promise<string>` that performs an optimistic update, calls the server-api, and returns the new conversation ID.

The optimistic lifecycle is:
1. Before the API call, a placeholder `ConversationListItemDto` is prepended to the list. The placeholder carries a client-generated UUID as its `id`, the source conversation's `title` (or `''` when the source is not in the list), `updatedAt: Date.now()`, and `sharedWithMe: false`, `publishedWithMe: false`, `isPinned: false`, `isReadonly: false`, `isScheduledTask: false`.
2. The source id is passed through `normalizeConversationId` before calling the server-api. Once the API call resolves, the placeholder's `id` is replaced in-place with the returned `newPath`.
3. `silentRefreshConversations` is fired in the background to reconcile with the server without showing a loading state.
4. On API failure, the placeholder is removed and the error is re-thrown.

#### Scenario: Optimistic item appears immediately
- **WHEN** `duplicateConversation(id)` is called
- **THEN** a new entry with the source conversation's title appears at the top of the list before the API call resolves

#### Scenario: Placeholder replaced with real id on success
- **WHEN** the API call resolves with `newPath`
- **THEN** the placeholder entry's id is updated to `newPath` and the returned string is `newPath`

#### Scenario: Error propagation removes placeholder
- **WHEN** the backend returns an error
- **THEN** the placeholder is removed from the list and the error is re-thrown so callers can handle it

### Requirement: Backend refuses to duplicate a conversation whose current model is hidden
After reading the source conversation, `ConversationLifecycleService.duplicateConversation` SHALL resolve the model the conversation uses now — `assistantModelId || model.id` from the stored body, not the deployment id in the resource path — through `DeploymentsService.resolveDeploymentItem`. When that deployment has `isHidden: true` (`HIDDEN_ENTITY_TAGS`, Issue #9183) the endpoint SHALL throw `ForbiddenException` with `code: conversationDuplicateModelHidden` and SHALL NOT save a copy. A model that no longer resolves to a deployment does not block the copy.

The path keeps the model a conversation was created with, so a chat later switched to a hidden model is only caught here; the row dropdown below cannot see the switch.

#### Scenario: Chat switched to a hidden model is refused
- **GIVEN** a conversation stored at `{visibleModel}__{title}` whose `assistantModelId` names a hidden deployment
- **WHEN** the client calls the duplicate endpoint
- **THEN** the response is 403 with `code: conversationDuplicateModelHidden` and no copy is saved

#### Scenario: Visible current model is duplicated
- **WHEN** the conversation's current model resolves to a deployment without `isHidden`
- **THEN** the copy is saved as usual

### Requirement: Duplicate action in conversation row dropdown
The conversation row three-dot dropdown in `ConversationPanelView` SHALL include a Duplicate item (`key: 'duplicate'`, `IconCopy` icon, label `t(ButtonsI18nKeys.Duplicate)` → `buttons.duplicate`) for all conversations regardless of source — both the read-only action list and the owned-conversation action list include it — except a conversation whose model is operator-hidden. That deployment is resolved from the row's resource path via `findDeploymentForConversationId` (which tries every suffix of the path-derived id, so a conversation stored inside a folder is matched too), and the matching deployment in `useDeployments().items` has `isHidden: true` (`HIDDEN_ENTITY_TAGS`, Issue #9183). Such a row omits Duplicate from both lists, so the hidden model cannot spread to new conversations. On success it shows the `EntityOperation.Duplicated` conversation success notification; on failure it shows an error notification with the response trace ID and `ConversationPanelI18nKeys.DuplicateUnavailableModel` when the response `code` is `conversationDuplicateModelHidden`, otherwise `ConversationPanelI18nKeys.DuplicateError`. Because the row resolves the model from the path, a row whose chat was switched to a hidden model still offers Duplicate; the server refuses that copy.

#### Scenario: Duplicate action appears in menu
- **WHEN** the user opens the three-dot menu for any conversation row
- **THEN** a Duplicate menu item is present with the correct icon and translated label

#### Scenario: Duplicate action is omitted for a hidden-model conversation
- **WHEN** the user opens the three-dot menu for a row whose model deployment has `isHidden: true`
- **THEN** no Duplicate menu item is present

#### Scenario: Duplicate action is omitted for a hidden-model conversation stored in a folder
- **WHEN** the user opens the three-dot menu for a row whose id is `conversations/{bucket}/{folder}/{deploymentId}__{title}` and the `{deploymentId}` deployment has `isHidden: true`
- **THEN** no Duplicate menu item is present

#### Scenario: Duplicate action triggers duplication and navigation
- **WHEN** the user clicks Duplicate in the row dropdown
- **THEN** the app calls `duplicateConversation` and navigates to `getConversationRoute(newPath)`

### Requirement: Filter tab behavior after duplicating a read-only conversation
After duplicating a read-only conversation the conversation panel filter tab MUST follow these rules (applied in `apps/chat/src/app/app.tsx` `handleDuplicateReadonly`, invoked by the in-conversation button and by the panel dropdown only when the duplicated row is the currently active conversation):
- If the active filter is **Organization** or **Shared with me** — switch to **My chats**, because the duplicated conversation does not appear under those filters.
- If the active filter is **All** or **My chats** — leave the filter unchanged, because the duplicated conversation is already visible under those filters.

#### Scenario: Duplicating from the Organization or Shared filter switches to My chats
- **GIVEN** the conversation panel is showing the Organization or Shared with me filter tab
- **WHEN** the user duplicates a read-only conversation (from the panel dropdown or the in-conversation button)
- **THEN** the panel switches to the My chats filter after navigating to the new conversation

#### Scenario: Duplicating from the All filter keeps the filter unchanged
- **GIVEN** the conversation panel is showing the All filter tab
- **WHEN** the user duplicates a read-only conversation
- **THEN** the panel remains on the All filter

#### Scenario: Duplicating from the My chats filter keeps the filter unchanged
- **GIVEN** the conversation panel is showing the My chats filter tab
- **WHEN** the user duplicates a read-only conversation
- **THEN** the panel remains on the My chats filter

### Requirement: Duplicate appears at the top of the conversation list
The duplicated conversation SHALL appear as the first (topmost) item in the My chats group in the sidebar immediately when the duplicate action is triggered — before the API call resolves — regardless of the original conversation's position or the timestamp DIAL Core assigns to the copied resource. This is achieved by prepending the optimistic placeholder described in the "Conversations context exposes duplicate" requirement.

#### Scenario: Duplicate is at the top immediately on action trigger
- **WHEN** the user triggers the duplicate action
- **THEN** the new conversation is visible at the top of the My chats group in the sidebar without waiting for the API response

#### Scenario: Order of other conversations is preserved
- **WHEN** the user duplicates a conversation
- **THEN** all other conversations retain their existing relative order in the list

### Requirement: Duplicated conversation preserves chat settings from the source
When a conversation is duplicated the chat settings (temperature, response format, system prompt) SHALL be copied from the source conversation so that the duplicate opens with the same configuration as the original.

#### Scenario: Temperature is preserved after duplication
- **GIVEN** the source conversation has a specific `temperature` value
- **WHEN** the user duplicates the conversation
- **THEN** the duplicated conversation's chat settings show the same temperature

#### Scenario: Response format is preserved after duplication
- **GIVEN** the source conversation has a `responseFormat` value
- **WHEN** the user duplicates the conversation
- **THEN** the duplicated conversation's chat settings show the same response format

#### Scenario: System prompt is preserved after duplication
- **GIVEN** the source conversation has a `prompt` (system prompt) value
- **WHEN** the user duplicates the conversation
- **THEN** the duplicated conversation's chat settings show the same system prompt

### Requirement: Read-only conversation view shows centered duplicate action button
When a conversation is read-only (source bucket differs from user bucket), the `ConversationView` SHALL render a centered `NeutralButton` in place of the `ConversationInput` composer, preceded by an `ErrorMessageNotification` when a `duplicateError` is set. The button SHALL display an `IconCopy` icon and the translated text "Duplicate the conversation to be able to edit it".

When the conversation's model (`assistantModelId || model.id`) resolves to a deployment with `isHidden: true`, `Conversation.tsx` SHALL pass `isDuplicateUnavailable` to `ConversationView`, which then renders the `conversationPanel.duplicateUnavailableModel` translation key as text instead of the button. `handleDuplicateConversation` SHALL also refuse to duplicate in that state (Issue #9183), and when the server refuses with `code: conversationDuplicateModelHidden` it shows the same `conversationPanel.duplicateUnavailableModel` text as its inline error.

#### Scenario: Centered button rendered for read-only conversation
- **WHEN** `isReadOnly` is `true`
- **THEN** the centered duplicate button is shown and the conversation composer is not

#### Scenario: Hidden-model read-only conversation explains instead of offering the button
- **WHEN** `isReadOnly` and `isDuplicateUnavailable` are both `true`
- **THEN** no duplicate button is rendered and the unavailable-model explanation is shown

#### Scenario: Button invokes onDuplicateConversation
- **WHEN** the user clicks the centered duplicate button
- **THEN** `onDuplicateConversation` is called

### Requirement: i18n keys for duplicate feature
The duplicate feature SHALL use these i18n keys:
- `buttons.duplicate` (`ButtonsI18nKeys.Duplicate`): short action label used in the dropdown ("Duplicate")
- `conversationPanel.duplicateReadOnlyDescription` (`ConversationPanelI18nKeys.DuplicateReadOnlyDescription`): full sentence used in the centered button ("Duplicate the conversation to be able to edit it")
- `conversationPanel.duplicateError` (`ConversationPanelI18nKeys.DuplicateError`): error notification text ("Failed to duplicate the conversation. Please try again.")
- `conversationPanel.duplicateUnavailableModel` (`ConversationPanelI18nKeys.DuplicateUnavailableModel`): read-only view text shown when the conversation's model is hidden, and the error text when the server refuses a duplicate with `conversationDuplicateModelHidden`

All keys SHALL be present in every locale file (today only `apps/chat/src/i18n/locales/en.json`) and referenced through the typed enums in `apps/chat/src/constants/translation-keys.ts`.

#### Scenario: Keys present in English locale
- **WHEN** `en.json` is loaded
- **THEN** `buttons.duplicate`, `conversationPanel.duplicateReadOnlyDescription`, and `conversationPanel.duplicateError` are defined

#### Scenario: Typed enum values exist
- **WHEN** a component imports `ButtonsI18nKeys` and `ConversationPanelI18nKeys`
- **THEN** `ButtonsI18nKeys.Duplicate`, `ConversationPanelI18nKeys.DuplicateReadOnlyDescription`, and `ConversationPanelI18nKeys.DuplicateError` resolve to the correct key strings

## MODIFIED Requirements

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
| `conversationPublish.alreadyPublishedWarning` | "This conversation is already published in {folder}." |
| `conversationPublish.successMessage` | "Publish request submitted. It will appear in Organization once an admin approves it." |

#### Scenario: Row menu label resolves via i18n
- **WHEN** `en.json` is loaded
- **THEN** `buttons.publish` resolves to "Publish"

#### Scenario: Success message communicates pending approval, not immediate publication
- **WHEN** `en.json` is loaded
- **THEN** `conversationPublish.successMessage` resolves to wording that describes a submitted, pending-approval request and does not assert the conversation is already published or visible

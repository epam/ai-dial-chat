## MODIFIED Requirements

### Requirement: Successful publish closes the panel, shows a pending-approval notification, and does not refresh the conversation list

On a successful publish response (HTTP 201, meaning Core accepted a new, admin-pending publication request), `PublishConversationPanelContainer` SHALL: close the panel (same effect as Cancel/Close) and call `showNotification` with a success variant and i18n message (`conversationPublish.successMessage`) whose copy communicates that the request was **submitted for admin approval**, not that the conversation is now published or visible.

`PublishConversationPanelContainer` SHALL NOT call `ConversationsContext.refreshConversations()` on publish success. A newly submitted publication request is pending admin approval; no resource exists yet under `conversations/public/...` for the Organization tab to show, so refreshing the conversation list at this point has no observable effect and previously reinforced an incorrect "it's published now" impression. The Organization tab reflects the published copy only once a separate, out-of-app admin approval step (not exposed by this application) is completed and the user later reloads or otherwise refreshes the list themselves.

On failure, the panel SHALL remain open, the submit-error callout (existing `derivePublishState` mechanism, `PublishCalloutKind.SubmitError`) SHALL be shown, and no list refresh SHALL occur. In addition, `PublishConversationPanelContainer` SHALL call `showNotification` with an error variant, so a failed publish is reported outside the panel as well ([GitHub issue #7898](https://github.com/epam/ai-dial-chat/issues/7898) — previously no notification was shown at all, leaving a connection-loss failure indistinguishable from a button that did nothing). The failure notification SHALL be wired through `usePublishFlow`'s `onPublishError` option (see `publish-panel-library`) rather than derived from `handleSubmit`'s `false` return value, so the rejection reason itself is available to the host.

The failure notification SHALL:

- use the shared `publish.failedTitle` title and the shared `publish.failedMessage` body, and carry `requestId` set to the trace ID resolved from the failed response via `getApiErrorDetails` when one is available (see `notification-request-id` and `api-error-trace-correlation`);
- use the connection-specific `publish.networkErrorMessage` body and omit `requestId` when the failure occurred while `navigator.onLine` is `false`, because the request never reached the backend and therefore has no trace ID;
- be additive to the inline callout, never a replacement for it — the callout remains the in-context explanation next to the destination picker.

The submit-error callout text SHALL be supplied by the host as `PublishPanelLabels.submitError` (`publish.submitErrorCallout`) rather than left to the library's hardcoded English default, since libraries carry no i18n.

The failure-notification strings SHALL live in one shared `publish.*` namespace (`PublishI18nKeys`) used by both this flow and the catalog publish flow, and the notification itself SHALL be produced by one shared hook (`apps/chat/src/hooks/publish/usePublishErrorNotification.ts`), rather than duplicated per host with identical copy.

#### Scenario: Publish succeeds
- **WHEN** the user submits a valid publish request and the backend returns success
- **THEN** the panel closes, a success notification appears with pending-approval wording, and `refreshConversations()` is NOT called

#### Scenario: Publish fails with a backend error
- **WHEN** the backend returns an error for the publish request
- **THEN** the panel stays open, the submit-error callout is shown, and no success notification or list refresh occurs
- **AND** an error notification appears with the `publish.failedTitle` title and `publish.failedMessage` body
- **AND** the notification shows the request ID when the failed response carried a valid `traceparent`

#### Scenario: Publish fails because the connection was lost
- **GIVEN** the user has selected a destination folder and the internet connection is then lost
- **WHEN** the user clicks Publish
- **THEN** the panel stays open with the submit-error callout, and an error notification appears with the `publish.networkErrorMessage` body and no request ID

#### Scenario: The inline submit-error callout is translated
- **WHEN** the submit-error callout is shown
- **THEN** its text comes from the host-supplied `publish.submitErrorCallout` key, not from the publish-panel library's English fallback string

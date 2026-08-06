## MODIFIED Requirements

### Requirement: Publish submission and history use real backend data
`CatalogView` SHALL call the real `onPublish`, `getPublishHistory`, and `hasPublishWriteAccess` implementations backed by `apps/chat/src/server-api` wrappers instead of mock data (`MOCK_PUBLISH_FOLDERS`, `MOCK_PUBLISH_HISTORY`, and the mock `handlePublish`), which SHALL be deleted once parity is confirmed.

Loading/empty/error states: while history is loading, `PublishHistoryList` SHALL show a loading state; on fetch failure it SHALL show an inline error state distinct from the empty-history state.

Submit failure: `CatalogView` SHALL supply an `onPublishError` handler, threaded down as `CatalogProps.onPublishError` → `DetailsPanelProps.onPublishError` → `usePublishFlow` the same way `onPublishSuccess` already is, so a rejected publish produces an error notification in addition to the inline submit-error callout ([GitHub issue #7898](https://github.com/epam/ai-dial-chat/issues/7898)). It SHALL reuse the same shared `usePublishErrorNotification` hook and shared `publish.*` i18n namespace as the conversation publish flow (see `conversation-publish-flow`), including the offline branch that swaps in `publish.networkErrorMessage` and omits `requestId`. `CatalogView` SHALL also pass the translated `publishLabels.submitError` (`publish.submitErrorCallout`), so the callout no longer renders the publish-panel library's hardcoded English default.

Accessibility: the publish history list SHALL expose `role="list"`/`role="listitem"` semantics (or equivalent list semantics already implemented) so screen readers announce entry count; the submit-error callout SHALL use `role="alert"`.

#### Scenario: Publish succeeds
- **WHEN** the user submits a publish request and the backend returns success
- **THEN** `onPublishSuccess` fires, a success notification is shown via `CatalogI18nKeys.PublishSuccess*`, and the publish history list refreshes to include the new entry

#### Scenario: Publish fails due to no write access
- **WHEN** the user submits a publish request and the backend returns a 403
- **THEN** `derivePublishState` surfaces the no-access callout and the submit action remains available for a different folder selection

#### Scenario: Publish fails and the panel reports it outside the panel too
- **WHEN** the user submits a publish request and it rejects (backend error or lost connection)
- **THEN** the publish sub-view stays open with the submit-error callout, `onPublishError` receives the rejection reason, and an error notification is shown

#### Scenario: Publish history fails to load
- **WHEN** `getPublishHistory` rejects
- **THEN** `PublishHistoryList` renders an inline error state instead of an empty-history message

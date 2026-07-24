## MODIFIED Requirements

### Requirement: Publish submission and history use real backend data

`CatalogView` SHALL call the real `onPublish`, `getPublishHistory`, and `hasPublishWriteAccess` implementations backed by `apps/chat/src/server-api` wrappers instead of mock data (`MOCK_PUBLISH_FOLDERS`, `MOCK_PUBLISH_HISTORY`, and the mock `handlePublish`), which SHALL be deleted once parity is confirmed.

Loading/empty/error states: while history is loading, `PublishHistoryList` SHALL show a loading state; on fetch failure it SHALL show an inline error state distinct from the empty-history state.

Accessibility: the publish history list SHALL expose `role="list"`/`role="listitem"` semantics (or equivalent list semantics already implemented) so screen readers announce entry count; the submit-error callout SHALL use `role="alert"`.

**Temporary exception (tracked in [GitHub issue #7897](https://github.com/epam/ai-dial-chat/issues/7897)):** `CatalogView.getPublishHistory` SHALL NOT call the publish-history endpoint (`getCatalogPublishHistory`) while it returns 503 from DIAL Core. For the duration of this exception, `getPublishHistory` SHALL always resolve to `[]`, so `PublishHistoryList` SHALL always render its empty state and the fetch-failure error state described above SHALL NOT trigger. This exception SHALL be lifted — restoring the fetch and the full requirement above — as soon as the backend publish-history endpoint (`catalog-publish-api`'s history requirement) is fixed; the exception itself is not a permanent relaxation of this requirement.

#### Scenario: Publish succeeds
- **WHEN** the user submits a publish request and the backend returns success
- **THEN** `onPublishSuccess` fires and a success notification is shown via `CatalogI18nKeys.PublishSuccess*`

#### Scenario: Publish fails due to no write access
- **WHEN** the user submits a publish request and the backend returns a 403
- **THEN** `derivePublishState` surfaces the no-access callout and the submit action remains available for a different folder selection

#### Scenario: While the temporary exception is active, publish history is always empty
- **GIVEN** the publish-history fetch is disabled per the temporary exception above
- **WHEN** the user opens the publish panel for an application or toolset, regardless of any real prior publications
- **THEN** `getPublishHistory` resolves to `[]` and `PublishHistoryList` renders its empty state, never a loading or error state

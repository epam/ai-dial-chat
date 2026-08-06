## ADDED Requirements

### Requirement: usePublishFlow reports the publish rejection reason to the host

`usePublishFlow`'s `handleSubmit` SHALL bind the rejection thrown by `onPublish` and pass it to a new optional option `onPublishError?: (item: TItem, folderPath: string[], error: unknown) => void`, the symmetric counterpart of the existing `onPublishSuccess`. A bindingless `catch` that discards the error SHALL NOT be used, since the rejection carries the only means of resolving the failed response's server message and trace ID ([GitHub issue #7898](https://github.com/epam/ai-dial-chat/issues/7898)).

`onPublishError` SHALL be called after `hasSubmitError` is set and before `handleSubmit` resolves to `false`. The hook SHALL NOT await the callback, so `isSubmitting` clears without waiting on host-side work such as parsing a response body; the callback's declared return type SHALL therefore be `void`.

The library SHALL NOT itself display a notification, toast, or any user-visible failure copy beyond the existing `PublishCalloutKind.SubmitError` callout, whose text remains a host-supplied `PublishPanelLabels.submitError` label with an English default. Notification presentation stays entirely with the host, consistent with the library's no-i18n and no-host-integration rules.

`onPublishError` SHALL be part of the public surface via the already-exported `UsePublishFlowOptions` type, and `libs/catalog` SHALL thread it from `CatalogProps` → `Catalog` → `DetailsPanel` → `usePublishFlow` so catalog hosts can supply it.

#### Scenario: A rejected publish reaches the host with the original error
- **GIVEN** a host supplies `onPublishError` and its `onPublish` rejects with an error
- **WHEN** the user submits the publish flow
- **THEN** `onPublishError` is called exactly once with the item, the selected folder path, and that same error object
- **AND** `hasSubmitError` is `true`, `isSubmitting` is `false`, and `handleSubmit` resolves to `false`

#### Scenario: A successful publish never invokes the error callback
- **GIVEN** a host supplies both `onPublishSuccess` and `onPublishError`
- **WHEN** the publish request succeeds
- **THEN** only `onPublishSuccess` is called

#### Scenario: Omitting the callback keeps the previous behavior
- **GIVEN** a host does not supply `onPublishError`
- **WHEN** its `onPublish` rejects
- **THEN** `hasSubmitError` is still set and `handleSubmit` still resolves to `false`, with no error thrown from the hook

#### Scenario: The library still renders no failure notification of its own
- **WHEN** a publish request fails
- **THEN** the only library-rendered failure feedback is the submit-error callout, and no notification/toast is created inside `libs/publish-panel`

# Spec Delta

## ADDED Requirements

### Requirement: usePublishFlow can submit through a direct write
`UsePublishFlowOptions` SHALL gain two optional options: `canPublishDirectlyTo?: (folderPath: string[]) => boolean` and `onPublishDirectly?: (item: TItem, folderPath: string[]) => Promise<void>`. `UsePublishFlowResult` SHALL gain `isDirectWrite: boolean`, `true` when a folder is selected and both options are supplied and `canPublishDirectlyTo` holds for it. While `isDirectWrite` is `true`, `handleSubmit` SHALL call `onPublishDirectly` instead of `onPublish`, with the same success, error and taken-target handling (`onPublishSuccess`, `onPublishError`, `isTargetTakenError`, `hasSubmitError`), and SHALL NOT send rules, author or credentials. A host that supplies neither option sees no change. The library SHALL learn nothing about endpoints, rights data or the `publications` namespace: the predicate and the callback arrive from the host.

#### Scenario: Direct folder
- **WHEN** `canPublishDirectlyTo` returns `true` for the selected folder and the user submits
- **THEN** `onPublishDirectly` is called, `onPublish` is not, and `onPublishSuccess` runs on resolve

#### Scenario: Request folder
- **WHEN** `canPublishDirectlyTo` returns `false`
- **THEN** `onPublish` is called as before

#### Scenario: Options omitted
- **WHEN** the host passes neither option
- **THEN** `isDirectWrite` is `false` and behaviour is unchanged

#### Scenario: Taken target on a direct write
- **WHEN** `onPublishDirectly` rejects and `isTargetTakenError` recognises the error
- **THEN** the selected folder is marked taken instead of setting `hasSubmitError`

### Requirement: PublishPanel renders a direct destination
`PublishPanel` SHALL also accept an optional host-supplied `directUnavailableNote?: string` (default none), a finished sentence rendered as an information callout when the direct path is unavailable for a reason the host names; the library decides nothing about it. `PublishPanel` SHALL accept optional `isDirectWrite?: boolean` (default `false`) and, for `true`, SHALL NOT render the access rules section, the author field or the credentials checkbox, SHALL render `labels.directWriteNote` (optional, default none: rendered only when the host supplies it) in the credentials section's place. The panel takes no decision of its own: the host passes the flow's `isDirectWrite`.

#### Scenario: Direct destination
- **WHEN** `isDirectWrite` is `true`
- **THEN** none of the three publication-only sections is rendered and the note is shown when `labels.directWriteNote` is supplied

#### Scenario: Direct path unavailable because of dependencies
- **WHEN** the host supplies `directUnavailableNote` and `isDirectWrite` is `false`
- **THEN** the sentence is shown as an information callout and submit files a request as usual

#### Scenario: Default
- **WHEN** `isDirectWrite` is omitted
- **THEN** the panel renders exactly as before

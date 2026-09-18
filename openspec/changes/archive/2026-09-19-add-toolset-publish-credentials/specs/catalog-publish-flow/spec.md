## ADDED Requirements

### Requirement: Catalog publish panel offers a credentials opt-in for authenticated toolsets the publisher is signed in to

The catalog publish sub-view SHALL show the shared publish panel's credentials checkbox for a toolset that needs a login and whose publisher holds one, and SHALL send the chosen value with the publish request so DIAL Core publishes the publisher's own credential alongside the toolset.

**When the control is offered.** `DetailsPanel` SHALL offer it when all of the following hold for the item being published:

- `item.type` is `CatalogEntityType.Toolset`;
- `item.credentials?.authenticationType` is set and is not `ToolsetAuthenticationType.None`;
- `item.credentials.userStatus` is `CredentialStatus.SignedIn` **or** `item.credentials.globalStatus` is `CredentialStatus.SignedIn`.

Both authentication types qualify — OAuth and API key. A shared team API key is the most common internal case, and nothing about the flag is OAuth-specific.

Either credential level qualifies because publishing always acts on the publisher's own source item (`isPublishVisible` already requires `item.isMyApp`): on a personal item `globalStatus` is the owner's own credential, and `userStatus` covers a personal credential configured on top of it. Access the publisher does not hold cannot be passed on, so a toolset the publisher is signed out of SHALL offer no control.

The eligibility decision SHALL be made inside `libs/catalog` from `item.credentials`, which `DetailsPanel` already receives and already branches on for its credentials action (see `catalog-toolset-credentials`). No new fetch, no new loading state, and no new host prop are introduced for it, and `libs/publish-panel` SHALL remain unaware of toolsets and credential levels (see `publish-panel-library`).

**No role gate.** Any publisher who is signed in to the toolset may select the option; administrator status is irrelevant. DIAL Core's existing pending-approval lifecycle — every publication is `PENDING` until an administrator approves — is the control point for the act.

**Default state.** The option SHALL be cleared every time the publish sub-view is opened, including immediately after a publication submitted with it selected, and including for a destination folder whose previous publication carried shared credentials. `usePublishFlow` owns the state and `DetailsPanel` already calls `reset()` on every close path (see `publish-panel-library`).

**Submission.** `CatalogProps.onPublish` and `ItemDetailsProps.onPublish` SHALL take the flag as a fifth argument, matching `usePublishFlow`'s extended signature. `CatalogView.handlePublish` (delegating to `useCatalogPublishing`'s `handlePublish`) SHALL forward it to `publishCatalogEntity` as the request body's `publishCredentials` field (see `catalog-publish-api`), omitting the field entirely when it is `false` so a publish without shared access sends exactly the request it sends today. A non-toolset item, or a toolset that was never offered the control, SHALL never send the field.

**Unpublish is unaffected.** `unpublishCatalogEntity` SHALL NOT gain the field.

**Confidentiality.** No credential value SHALL be read, displayed, logged, or sent by any part of this flow — only the boolean.

**i18n.** The new user-visible strings SHALL be registered on `CatalogI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and added to `apps/chat/src/i18n/locales/en.json` — `catalog.publish.credentialsLabel` (`"Publish with my credentials"`) and `catalog.publish.credentialsHint` (stating that members will use the toolset without authorising and that the credential itself is never shown to them). `CatalogView` SHALL pass them through `publishLabels` as `credentialsLabel` and `credentialsHint`, alongside the labels it already supplies. The library's English defaults SHALL NOT be relied upon by the app.

**RTL/direction impact:** none beyond the surrounding panel. The control is a ui-kit `Checkbox` positioned with CSS logical properties; no directional icon is introduced, so no `rtl:` mirroring applies.

**Feature gating:** none. The control is part of the publish panel, whose visibility is already governed by the existing `Publish visibility is scoped to editable entities` requirement.

#### Scenario: An OAuth toolset the publisher is signed in to offers the option

- **GIVEN** the publisher's own toolset has `authenticationType: OAuth` and `globalStatus: SignedIn`
- **WHEN** the publisher opens the publish sub-view
- **THEN** the credentials checkbox is shown, cleared

#### Scenario: An API-key toolset the publisher is signed in to offers the option

- **GIVEN** the publisher's own toolset has `authenticationType: ApiKey` and `userStatus: SignedIn`
- **WHEN** the publisher opens the publish sub-view
- **THEN** the credentials checkbox is shown, cleared

#### Scenario: A toolset that needs no login offers no option

- **GIVEN** the item is a toolset whose `authenticationType` is `None`, or which has no `credentials` at all
- **WHEN** the publisher opens the publish sub-view
- **THEN** no credentials checkbox is rendered

#### Scenario: A toolset the publisher is signed out of offers no option

- **GIVEN** the item is a toolset with `authenticationType: OAuth` whose `userStatus` and `globalStatus` are both absent or not `SignedIn`
- **WHEN** the publisher opens the publish sub-view
- **THEN** no credentials checkbox is rendered, because access the publisher does not hold cannot be passed on

#### Scenario: A non-toolset entity offers no option

- **GIVEN** the item is an application, prompt, skill, or model
- **WHEN** the publisher opens the publish sub-view
- **THEN** no credentials checkbox is rendered

#### Scenario: A non-administrator may select the option

- **GIVEN** the publisher is not an administrator and is signed in to their own authenticated toolset
- **WHEN** the publisher opens the publish sub-view
- **THEN** the credentials checkbox is shown and can be selected

#### Scenario: Selecting the option reaches the publish call

- **GIVEN** the publisher ticks the credentials checkbox and selects a destination folder
- **WHEN** the publisher clicks Publish
- **THEN** `publishCatalogEntity` is called with a request body whose `publishCredentials` is `true`

#### Scenario: Leaving the option clear sends the unchanged request

- **GIVEN** the publisher leaves the credentials checkbox clear
- **WHEN** the publisher clicks Publish
- **THEN** `publishCatalogEntity` is called with no `publishCredentials` field in the request body

#### Scenario: The option is cleared when the panel is reopened

- **GIVEN** the publisher published the toolset with the credentials checkbox ticked
- **WHEN** the publisher opens the publish sub-view for that toolset again
- **THEN** the checkbox is cleared

#### Scenario: The option is cleared after cancelling

- **GIVEN** the publisher ticks the checkbox and then cancels the publish sub-view
- **WHEN** the publisher reopens it
- **THEN** the checkbox is cleared

#### Scenario: A destination folder previously published to with shared credentials does not pre-select it

- **GIVEN** publish history shows the selected folder's previous publication carried shared credentials
- **WHEN** the publisher selects that folder
- **THEN** the checkbox stays cleared

### Requirement: Catalog publish history shows which publications carried shared credentials

`CatalogView.getPublishHistory` SHALL map the endpoint's `publishCredentials` field onto `PublishHistoryEntry` via `mapPublishHistoryEntryDto`, and SHALL pass a translated `sharedCredentialsLabel` through `publishLabels` so `PublishHistoryList` marks those entries (see `publish-panel-library`). The i18n key SHALL be `catalog.publish.historySharedCredentials`, registered on `CatalogI18nKeys` and added to `apps/chat/src/i18n/locales/en.json`.

The synthesised single-entry history a public copy's own id produces (`isPublicCatalogEntityId`) SHALL leave `publishCredentials` unset, since that path never calls the endpoint and has no publication record to read it from. Absent reads as `false`, so the marker simply does not appear.

This requirement delivers the data path and the rendering; it SHALL NOT re-enable the publish-history section that `PublishPanel` currently keeps behind a `TODO`, which is separate scope. The marker becomes visible when that section is re-enabled.

#### Scenario: A publication made with shared credentials is marked in history

- **WHEN** the history endpoint reports an entry with `publishCredentials: true`
- **THEN** `mapPublishHistoryEntryDto` carries it onto the `PublishHistoryEntry`, and `PublishHistoryList` renders that row with the shared-credentials label

#### Scenario: A publication made without shared credentials is unmarked

- **WHEN** the history endpoint reports an entry with `publishCredentials: false`
- **THEN** the mapped entry is `false` and the row carries no marker

#### Scenario: A public copy's synthesised history entry carries no flag

- **GIVEN** the item's id addresses the `public` bucket, so history is synthesised from the id rather than fetched
- **WHEN** that entry is produced
- **THEN** its `publishCredentials` is unset and no marker is rendered

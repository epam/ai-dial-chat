## ADDED Requirements

### Requirement: Catalog publish panel offers an editable author pre-filled with the publisher's name

The catalog publish sub-view SHALL show the shared publish panel's author field, pre-filled with the signed-in user's display name, and SHALL send the submitted value with the publish request so it becomes the published entity's **Hosted by** value.

State ownership: `DetailsPanel`'s existing `usePublishFlow` instance owns `author`/`setAuthor` (see `publish-panel-library`) and supplies them to its inline `PublishPanel` render via the new required `author`/`onAuthorChange` props, threaded the same way `rules`/`onRulesChange` already are.

Prefill is host-resolved, not lib-resolved. `CatalogProps` and `ItemDetailsProps` SHALL gain `publishDefaultAuthor?: string`, threaded `CatalogView` → `Catalog` → `DetailsPanel` → `usePublishFlow`'s `defaultAuthor` option, exactly as `publishFolderItems`/`publishLabels` already are. `CatalogView` SHALL resolve the value from `useUserProfile()`'s `displayName`. Neither `libs/catalog` nor `libs/publish-panel` reads `UserContext`, OIDC claims, or i18n for it, per AGENTS.md §Library isolation; `publishDefaultAuthor` is the app-level adapter contract that carries the host's session knowledge across the boundary.

Submission: `CatalogProps.onPublish` and `ItemDetailsProps.onPublish` SHALL take the author as a fourth argument, matching `usePublishFlow`'s extended `onPublish` signature. `CatalogView.handlePublish` (delegating to `useCatalogPublishing`'s `handlePublish`) SHALL accept that argument and forward it to `publishCatalogEntity`, which SHALL include it in the request body's `author` field sent to `POST /api/v1/catalog/{entityType}/{entityId}/publish` (see `catalog-publish-api`). When the value is empty after trimming, `handlePublish` SHALL omit `author` from the request body entirely rather than sending an empty string, so the backend's session-derived fallback applies.

Unpublish is unaffected: `unpublishCatalogEntity` SHALL NOT gain an author field, since a removal request's `displayAuthor` identifies the requester of that removal rather than the published entity's author.

i18n: the new user-visible strings SHALL be registered on `PublishI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and added to `apps/chat/src/i18n/locales/en.json` — `publish.authorLabel` (`"Author"`), `publish.authorPlaceholder` (`"Author name"`), and `publish.authorHint` (explaining the value is shown as the publication's author in the catalog). `CatalogView` SHALL pass them through `publishLabels` as `authorLabel`, `authorPlaceholder`, and `authorHint`, alongside the labels it already supplies. The library's English defaults SHALL NOT be relied upon by the app.

RTL/direction impact: none beyond the surrounding panel. The field is a ui-kit `Input` positioned with CSS logical properties; no directional icon is introduced, so no `rtl:` mirroring applies.

Feature gating: none. The field is not behind `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` — it is part of the publish panel, whose visibility is already governed by the existing `Publish visibility is scoped to editable entities` requirement.

#### Scenario: Author is pre-filled with the signed-in user's display name

- **GIVEN** the signed-in user's profile resolves `displayName` to `"Daniil Pavlov"`
- **WHEN** the user opens the publish sub-view for a toolset
- **THEN** the author field shows `"Daniil Pavlov"` without the user typing anything

#### Scenario: Edited author reaches the publish call

- **GIVEN** the user replaces the pre-filled author with `"DIAL Team"` and selects a destination folder
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with a request body whose `author` is `"DIAL Team"`

#### Scenario: Untouched pre-filled author is sent as-is

- **GIVEN** the user leaves the pre-filled author unchanged
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with `author` equal to the signed-in user's display name, producing the same **Hosted by** value as before this change

#### Scenario: Cleared author omits the field from the request

- **GIVEN** the user clears the author field
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with no `author` key in the request body, and the backend falls back to the session-derived display name

#### Scenario: Author resets when a different item is opened

- **GIVEN** the user edited the author for one catalog item without submitting
- **WHEN** the details panel switches to a different item and `publishFlow.reset()` runs
- **THEN** the author field returns to the signed-in user's display name

#### Scenario: Prefill arrives after the panel opens

- **GIVEN** the user profile has not yet resolved when the publish sub-view first renders, so the author field is empty
- **WHEN** `publishDefaultAuthor` resolves to the user's display name and the user has not typed in the field
- **THEN** the field fills with that name

#### Scenario: Labels come from the app's i18n, not the library defaults

- **WHEN** the publish sub-view renders in the catalog
- **THEN** the author field's label, placeholder, and hint are the translated `publish.authorLabel`/`publish.authorPlaceholder`/`publish.authorHint` values passed through `publishLabels`

#### Scenario: Unpublish request carries no author

- **WHEN** the user submits an unpublish request for a published catalog entity
- **THEN** `unpublishCatalogEntity` is called with the same request body shape as before this change, with no `author` field

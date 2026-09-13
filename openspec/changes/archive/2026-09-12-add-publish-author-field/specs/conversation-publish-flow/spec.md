## ADDED Requirements

### Requirement: Conversation publish panel offers an editable author pre-filled with the publisher's name

The standalone conversation publish panel SHALL show the shared publish panel's author field, pre-filled with the signed-in user's display name, and SHALL send the submitted value with the publish request.

State ownership: `PublishConversationPanelContainer`'s existing `usePublishFlow` instance owns `author`/`setAuthor` (see `publish-panel-library`) and passes them into `StandalonePublishPanel`'s new required `author`/`onAuthorChange` props, exactly as it already passes `rules`/`onRulesChange`.

Prefill is host-resolved: `PublishConversationPanelContainer` SHALL call `useUserProfile()` and pass its `displayName` as `usePublishFlow`'s `defaultAuthor` option. `libs/publish-panel` SHALL NOT read `UserContext`, OIDC claims, or i18n for it, per AGENTS.md §Library isolation.

Submission: the container's `onPublish` callback SHALL accept the fourth `author` argument now supplied by `usePublishFlow.handleSubmit` and forward it to `publishConversation`, whose wrapper in `apps/chat/src/server-api/conversation-publish.api.ts` SHALL take the author as a fourth positional parameter and include it as the request body's `author` field for `POST /api/v1/conversations/publish` (see `conversation-publish-api`). When the value is empty after trimming, the wrapper SHALL omit `author` from the request body entirely so the backend's session-derived fallback applies.

Unpublish is unaffected: `unpublishConversation` SHALL NOT gain an author field.

i18n: the field reuses the shared `publish.authorLabel` / `publish.authorPlaceholder` / `publish.authorHint` keys introduced for the catalog flow (see `catalog-publish-flow`) rather than declaring conversation-specific copies, and passes them through `panelLabels` as `authorLabel`, `authorPlaceholder`, and `authorHint` — alongside the `submitError` and `rootFolderLabel` overrides the container already supplies from the same shared namespace.

RTL/direction impact: none beyond the surrounding panel — the field uses CSS logical properties and introduces no directional icon.

Accessibility: the field is part of the panel's existing focus order and dialog semantics; it introduces no new live region, and the panel's existing Escape/Cancel/Close dismissal behaviour is unchanged.

Feature gating: none.

#### Scenario: Author is pre-filled with the signed-in user's display name

- **GIVEN** the signed-in user's profile resolves `displayName` to `"Daniil Pavlov"`
- **WHEN** the user opens the publish panel for a conversation
- **THEN** the author field shows `"Daniil Pavlov"` without the user typing anything

#### Scenario: Edited author reaches the publish call

- **GIVEN** the user replaces the pre-filled author with `"DIAL Team"` and selects a destination folder
- **WHEN** the user clicks Publish
- **THEN** `publishConversation` is called with a request body whose `author` is `"DIAL Team"`

#### Scenario: Cleared author omits the field from the request

- **GIVEN** the user clears the author field
- **WHEN** the user clicks Publish
- **THEN** `publishConversation` is called with no `author` key in the request body, and the backend falls back to the session-derived display name

#### Scenario: Author resets when the panel closes

- **GIVEN** the user edited the author without submitting
- **WHEN** the panel closes and `publishFlow.reset()` runs
- **THEN** reopening the panel shows the signed-in user's display name again

#### Scenario: Unpublish request carries no author

- **WHEN** the user submits an unpublish request for a published conversation
- **THEN** `unpublishConversation` is called with the same request body shape as before this change, with no `author` field

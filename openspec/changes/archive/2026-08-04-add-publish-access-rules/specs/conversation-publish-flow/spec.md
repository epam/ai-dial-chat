## ADDED Requirements

### Requirement: Publish panel wires the shared access-rules editor and includes rules in the publish request

`PublishConversationPanelContainer` SHALL pass `usePublishFlow`'s `rules`/`setRules` into `StandalonePublishPanel`'s new `rules`/`onRulesChange` props, and SHALL pass `ruleSourceOptions` sourced from `useAppConfig().config.publicationFilterSources` (see the `config-registry-and-env-provider`/`client-config-endpoint` delta specs). The `onPublish` callback (`PublishConversationPanelContainer.tsx:76-78`) SHALL forward the `rules` argument now supplied by `usePublishFlow.handleSubmit` to `publishConversation`, which SHALL include it in the request body sent to `POST /api/v1/conversations/publish` (see `conversation-publish-api`).

#### Scenario: Rules entered in the panel reach the publish call
- **GIVEN** the user has added one rule (`source: 'role'`, `function: 'CONTAIN'`, `targets: ['engineering']`) and selected a destination folder
- **WHEN** the user clicks Publish
- **THEN** `publishConversation` is called with a request body whose `rules` array contains exactly that one rule

#### Scenario: No rules added sends an empty array
- **GIVEN** the user has not added any rules
- **WHEN** the user clicks Publish
- **THEN** `publishConversation` is called with `rules: []`, identical to today's behavior

#### Scenario: Source options come from client config, not a hardcoded list
- **WHEN** the access-rules section's source control renders
- **THEN** its available options equal `useAppConfig().config.publicationFilterSources`, not a value hardcoded in `PublishConversationPanelContainer` or `libs/publish-panel`

### Requirement: Selecting a destination folder pre-fills the rules editor with that folder's existing rules

`PublishConversationPanelContainer` SHALL supply `usePublishFlow`'s `onFetchExistingRules` option as a thin call to `apps/chat/src/server-api/publish-rules.api.ts`'s `getPublishRules(folderPath)`, which calls `GET /api/v1/publish/rules?folderPath=...` (see `publish-rules-lookup-api`). Choosing a destination folder replaces the rules editor's contents with that folder's already-configured rules (or empties it, if none), overwriting whatever the user had entered for a previously selected folder.

#### Scenario: Selecting a folder with prior rules pre-fills the editor
- **GIVEN** the user opens the publish panel for a conversation and selects a destination folder that already has a configured rule
- **WHEN** the lookup resolves
- **THEN** the rules editor shows that existing rule as a chip, without the user having entered it

#### Scenario: A rules-lookup failure does not block the conversation publish flow
- **GIVEN** the user selects a destination folder and the rules lookup fails
- **THEN** folder selection, manual rule entry, and the Publish submit action all remain fully usable; only the pre-fill did not occur

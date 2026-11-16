# Spec Delta

## ADDED Requirements

### Requirement: The conversation publish panel shows the conversation's private dependencies

`apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx` SHALL load the dependencies of the conversation being published each time the panel opens, through `usePublishDependencies` from `@epam/ai-dial-chat-hooks` and `getConversationPublishDependencies` from `apps/chat/src/server-api/conversation-publish.api.ts`, map them with the `libs/chat-hooks` mapper, and pass them to `StandalonePublishPanel` as `dependencies`, with the translated text inside the `panelLabels` it already passes (`PublishPanelLabels.dependenciesLabels`). A rejected read leaves the list empty and shows no error; publishing is never blocked or delayed by it.

The dependency list SHALL NOT include files that publishing the conversation already carries along (files in the author's own bucket); see `publish-dependencies-api` for exactly what is listed.

Strings reuse the keys defined for the catalog flow (`publish.dependencies*`), through one shared `getPublishDependenciesLabels(t)` helper, so every flow reads the same. The translated text is passed in the `panelLabels` of `StandalonePublishPanel` (`PublishPanelLabels.dependenciesLabels`).

#### Scenario: Conversation with a private application shows the section
- **GIVEN** the conversation's model is a private application
- **WHEN** the user opens Publish for the conversation
- **THEN** the panel lists that application in its dependencies section

#### Scenario: Conversation with only own-bucket files shows nothing
- **GIVEN** every attachment is a file in the author's own bucket
- **WHEN** the user opens Publish
- **THEN** no dependencies section is rendered

#### Scenario: Lookup is slow or fails
- **WHEN** the dependencies request has not resolved or rejects
- **THEN** the panel is fully usable and the user can submit

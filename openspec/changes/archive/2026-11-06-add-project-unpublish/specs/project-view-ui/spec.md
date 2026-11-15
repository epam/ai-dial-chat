# project-view-ui Specification

## MODIFIED Requirements

### Requirement: Projects can be published through the standalone publish panel

`PublishProjectPanelContainer` (`apps/chat/src/components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx`) SHALL follow the structure of `PublishConversationPanelContainer`:

- `StandalonePublishPanel` from `@epam/ai-dial-publish-panel`;
- `usePublishFolders`, `usePublishErrorNotification` and `getPublishRules`.

It submits through `publishCatalogEntity({ entityType: CatalogPublishEntityType.Project, entityId: projectId, publishCatalogEntityDto })` from `apps/chat/src/server-api/publish.api.ts`. On success it calls `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.PublishRequested, { name })`, then the optional `onPublished?: () => void` prop, which `ProjectViewPage` uses to re-fetch the project's publish state (see `project-unpublish-flow`). Its strings come from `projects.publish.*` keys, plus the shared publish keys where they exist.

`CatalogPublishEntityType` in `libs/chat-hooks/src/catalog/publish.ts` SHALL gain `'project'`. `CatalogEntityType` in `libs/chat-shared` is not changed.

The page passes `onPublish` only once the project's publish state has settled with no live folder; a published project offers Unpublish in its place (see `project-unpublish-flow`).

**Chats warning.** DIAL Core publishes a project as a whole, `conversations/` included. When `conversationCount > 0`, the container renders a kit `Notification` with the warning variant through `StandalonePublishPanel`'s `renderSummary`, after the resource title, so `libs/publish-panel` is not changed.

- Its text is `projects.publish.chatsWarning`, pluralised by `count`: "The {{count}} chats in this project are published with it."
- The warning does not block submission: publishing stays the user's choice.
- It sits inside the panel's labelled region, so screen readers read it with the summary.

#### Scenario: Publish request

- **WHEN** the user selects a folder and submits
- **THEN** `POST /api/v1/catalog/project/{encoded id}/publish` is sent, and a "publish requested" toast is shown

#### Scenario: Publish success notifies the page

- **WHEN** the publish request succeeds
- **THEN** `onPublished` is called once, after the success notification

#### Scenario: Chats warning on a project with chats

- **WHEN** the panel opens for a project with `conversationCount: 2`
- **THEN** a warning `Notification` with `projects.publish.chatsWarning_other` (`count: 2`) renders, and Submit stays enabled

#### Scenario: No warning without chats

- **WHEN** the panel opens for a project with `conversationCount: 0`
- **THEN** no chats warning renders

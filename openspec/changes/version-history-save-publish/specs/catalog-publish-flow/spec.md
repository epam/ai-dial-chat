# Spec Delta

## ADDED Requirements

### Requirement: The catalog Details publish panel passes the Versions history section through

For an application or a toolset, the catalog Details publish panel (`DetailsPublishContent` in `libs/catalog`, which renders `PublishPanel` inside `DetailsPanel`) SHALL accept the Versions history props as resolved data and callbacks (rows, labels, colors, loading and error flags, a retry callback) and SHALL forward them to `PublishPanel` unchanged, so the section appears at the bottom of the panel as in the mockups. The catalog lib SHALL NOT import `@epam/ai-dial-chat-hooks`, call an API client or build the rows; the host builds them with the history hook (`CatalogView` in `apps/chat`). The panel and `Catalog` also accept `onPublishOpenChange(isOpen, item)`, called with `true` and the open item when the publish sub-view opens and with `false` when it closes or the panel unmounts, so the host builds the history for that item and loads statuses only while the sub-view is open. When the host passes no history props, the panel SHALL render exactly as it does today. The section SHALL NOT add a version input to the publish panel: publishing still uses the saved version.

#### Scenario: Application publish panel shows the section
- **WHEN** the user opens Publish for an application from its catalog details and the host supplies history rows
- **THEN** a Versions history section is the last section of the publish panel

#### Scenario: Host passes no history props
- **WHEN** the host omits the history props
- **THEN** the publish panel renders as before, without the section

#### Scenario: Publishing still uses the saved version
- **WHEN** the user publishes with the section visible
- **THEN** the saved version is published and no version field is offered

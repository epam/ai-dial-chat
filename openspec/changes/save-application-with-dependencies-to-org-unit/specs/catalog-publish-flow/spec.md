# Spec Delta

## MODIFIED Requirements

### Requirement: The Save panel shows the private dependencies of an unsaved schema app

`POST /api/v1/catalog/application-values/publish-dependencies` (`PublishDependenciesController`) SHALL accept `{ schemaId, properties }` (`ApplicationValuesDependenciesRequestDto`, `properties` a non-empty object of at most 64 KiB serialized) and return a `ResourceDependenciesResultDto` built by `ApplicationDependencyResolver.resolveFromValues` from the application type schema and the given values, without reading any application from DIAL Core. Like the entity route it SHALL answer an empty list when the schema cannot be read.

`useResourceSavePanel` (`libs/chat-hooks/src/catalog/useResourceSavePanel/useResourceSavePanel.ts`) SHALL accept an optional `loadDependencies` and return `panelProps.dependencies`: the loaded list while the committed destination is under the Organization root, otherwise an empty list. The list SHALL be empty while loading and after a failed read, SHALL ignore a read that finishes after the destination left the Organization root or the panel closed, and SHALL never disable Save. It SHALL apply to a public-folder save that sends a publication request and to a direct write into an org unit alike.

`apps/chat` SHALL pass `dependencyValues` to `ResourceSavePanelContainer` only for a schema-form app, from `ApplicationSavePanelConfig.getDependencyValues` of `schemaAppDefinition` (the schema id and `setup.properties`); the Quick App, DIAL Loop and custom app definitions SHALL provide none. For a Quick App and a DIAL Loop app the container SHALL instead pass the neutral dependencies sentence of `resource-save-panel`, because their form state is inside an embedded editor; a custom app has no schema and so nothing to list or say. The container SHALL fill the section's copy with the `Published` variant of `getPublishDependenciesLabels` and the `publish.dependenciesPublished*` keys, since the dependencies of an application are published or copied together with it on both Save paths (a publication request and a direct write into an org unit).

#### Scenario: Schema app saved to an Organization folder through a publication request
- **WHEN** the committed destination is a public folder outside every org unit and the app has form values
- **THEN** the panel lists the private dependencies of those values

#### Scenario: Schema app saved by a direct write into an org unit
- **WHEN** the committed destination is a unit folder the user may write to, and the app has form values
- **THEN** the panel lists the private dependencies of those values and the rules editor stays hidden

#### Scenario: Personal destination
- **WHEN** the committed destination is under the Personal root
- **THEN** no dependencies are listed and no request is made

#### Scenario: Kind without a form
- **WHEN** the Save panel opens for a Quick App, DIAL Loop or custom app
- **THEN** no dependencies are requested or listed under any root, a Quick App and a DIAL Loop app show the neutral sentence for an Organization destination, and a custom app shows nothing

#### Scenario: Failed read
- **WHEN** the dependencies request rejects
- **THEN** the list is empty and Save stays enabled

#### Scenario: Project publish panel
- **WHEN** the user opens Publish for a project
- **THEN** the project container loads the list with `usePublishDependencies` and renders no section while the list is empty

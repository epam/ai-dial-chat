## MODIFIED Requirements

### Requirement: Success notification copy follows one pattern per (entity, operation) pair

Every success notification SHALL consist of a title of the form `<Entity> <operation> successfully` and a one-sentence body that names the entity in double quotes, and — for publish and unpublish — the target folder in double quotes. The two request-shaped operations are the exception to the `successfully` title form: they end in `requested`, because nothing has completed yet.

The strings SHALL be declared as one complete sentence per `(entity, operation)` pair. A sentence SHALL NOT be composed at runtime from an entity noun plus an operation fragment: gendered and cased locales (Arabic, which the app must support, as well as Russian and German) cannot form a correct sentence from interpolated nouns. The one exception is the schema-app copy: its sentences are still complete per pair, but the entity is the application schema's display name, interpolated as `{{type}}`, because the runner schemas are data with no translated labels. Translators keep the whole sentence; a gendered or cased locale may phrase it around the inserted name.

English copy per operation, where `<Entity>` / `<entity>` is the entity label from the table that follows:

| Operation | Title | Body |
|---|---|---|
| Created | `<Entity> created successfully` | `You can now see <entity> "{{name}}" in the catalog and My collection.` (catalog entities) / `<Entity> "{{name}}" is created.` (file, folder) |
| Edited | `<Entity> edited successfully` | `Changes for <entity> "{{name}}" are saved.` |
| Renamed | `<Entity> renamed successfully` | `<Entity> "{{name}}" is renamed.` |
| Duplicated | `<Entity> duplicated successfully` | `A copy of <entity> "{{name}}" is created.` |
| Deleted | `<Entity> deleted successfully` | `<Entity> "{{name}}" is not available anymore.` |
| Downloaded | `<Entity> downloaded successfully` | `<Entity> "{{name}}" is saved on your device.` |
| Publish requested | `<Entity> publish requested` | `Publish request for <entity> "{{name}}" was submitted to folder "{{folder}}". It will appear there once an admin approves it.` |
| Unpublish requested | `<Entity> unpublish requested` | `Unpublish request for <entity> "{{name}}" was submitted for folder "{{folder}}". It will be removed once an admin approves it.` |

Entity labels: `Prompt`, `Quick app`, `Custom app`, `Agent`, `Toolset`, `Model`, `Skill`, `Conversation`, `File`, `Folder`, and `{{type}}` — the application schema's display name — for a schema app.

An application is named by its concrete kind, not by the generic `Agent`: `Quick app` for an app of the QuickApp schema (`isQuickAppSchema`), `Custom app` for a schema-less app, and, for an app of any other application schema, that schema's `displayName` through `NotifiableEntity.SchemaApp` with `type` set to the name. The editors resolve it from the page context — `CustomAppEditor` → `Custom app`; `AppsEditor` (both the embedded-editor and the schema-form kinds) → `resolveSchemaNotificationTarget`, returning `{ entity, type }`. Catalog-level operations (delete, publish, unpublish) resolve it from the item's deployment with `resolveCatalogItemEntity(type, deployment, schemas)` and pass `type: findSchemaDisplayName(schemas, deployment.applicationTypeSchemaId)`. `Agent` is used only as the fallback — when the item's deployment cannot be resolved, or its schema is not in the loaded list or has no display name — so the copy never guesses a kind.

Batch operations (export all, import, multi-item delete/copy/move/rename) keep their existing plural copy and their existing keys; only their titles are realigned to the `<Entity> <operation> successfully` form.

A pair whose copy has to count items declares `_one` / `_other` variants and receives `count`, which the helper interpolates into **both** the title and the body. The multi-item file download is the one such pair today: `File downloaded successfully` / `File "X" is saved on your device.` for a single file, `Files downloaded successfully` / `{{count}} files are saved on your device.` for a selection.

#### Scenario: Created copy names the entity and where to find it

- **WHEN** a prompt is created in the prompt editor
- **THEN** the notification title is `"Prompt created successfully"` and the body is `You can now see prompt "<name>" in the catalog and My collection.`

#### Scenario: Edited copy states the changes are saved

- **WHEN** an existing prompt is saved in the prompt editor
- **THEN** the notification title is `"Prompt edited successfully"` and the body is `Changes for prompt "<name>" are saved.`

#### Scenario: Unpublish copy names the folder and the approval step

- **WHEN** a conversation's unpublish request is accepted for folder `Organization/Shared chats`
- **THEN** the body is `Unpublish request for conversation "<name>" was submitted for folder "Shared chats". It will be removed once an admin approves it.`

#### Scenario: Copy is not assembled from fragments at runtime

- **WHEN** any success notification in this capability is rendered
- **THEN** its title and body each resolve from a single i18n key holding a complete sentence, with only `name` and `folder` interpolated

#### Scenario: An app of a non-QuickApp schema is named by its schema

- **WHEN** the user saves an app named "my app" of the schema whose `displayName` is "External app"
- **THEN** the notification title is `"External app edited successfully"` and the body is `Changes for External app "my app" are saved.`

#### Scenario: Deleting it from the catalog names the schema too

- **WHEN** the user deletes that app from the catalog
- **THEN** the notification title is `"External app deleted successfully"`

#### Scenario: A QuickApp app keeps the quick app copy

- **WHEN** the user saves an app of the QuickApp schema in `AppsEditor`
- **THEN** the notification title is `"Quick app edited successfully"`

#### Scenario: An unknown schema falls back to the agent copy

- **WHEN** the app's schema is not in the loaded schema list
- **THEN** the notification uses the `Agent` copy


### Requirement: i18n keys

All new strings SHALL live in one `entityNotifications` namespace in `apps/chat/src/i18n/locales/en.json`, with a matching `EntityNotificationsI18nKeys` string enum in `apps/chat/src/constants/translation-keys.ts` (raw key literals passed to `t()` are forbidden). Keys are named `entityNotifications.<entity>.<operation>Title` and `entityNotifications.<entity>.<operation>`, e.g.:

| Key | English |
|---|---|
| `entityNotifications.prompt.createdTitle` | `"Prompt created successfully"` |
| `entityNotifications.prompt.created` | `"You can now see prompt \"{{name}}\" in the catalog and My collection."` |
| `entityNotifications.prompt.editedTitle` | `"Prompt edited successfully"` |
| `entityNotifications.prompt.edited` | `"Changes for prompt \"{{name}}\" are saved."` |
| `entityNotifications.prompt.deletedTitle` | `"Prompt deleted successfully"` |
| `entityNotifications.prompt.deleted` | `"Prompt \"{{name}}\" is not available anymore."` |
| `entityNotifications.prompt.downloadedTitle` | `"Prompt downloaded successfully"` |
| `entityNotifications.prompt.downloaded` | `"Prompt \"{{name}}\" is saved on your device."` |
| `entityNotifications.prompt.publishRequestedTitle` | `"Prompt publish requested"` |
| `entityNotifications.prompt.publishRequested` | `"Publish request for prompt \"{{name}}\" was submitted to folder \"{{folder}}\". It will appear there once an admin approves it."` |
| `entityNotifications.prompt.unpublishRequestedTitle` | `"Prompt unpublish requested"` |
| `entityNotifications.prompt.unpublishRequested` | `"Unpublish request for prompt \"{{name}}\" was submitted for folder \"{{folder}}\". It will be removed once an admin approves it."` |
| `entityNotifications.schemaApp.createdTitle` / `.editedTitle` / `.deletedTitle` / `.publishRequestedTitle` / `.unpublishRequestedTitle` | `"{{type}} created successfully"`, `"{{type}} edited successfully"`, `"{{type}} deleted successfully"`, `"{{type}} publish requested"`, `"{{type}} unpublish requested"` |
| `entityNotifications.schemaApp.created` / `.edited` / `.deleted` / `.publishRequested` / `.unpublishRequested` | the quick-app sentences with `{{type}}` in place of `quick app` — e.g. `"Changes for {{type}} \"{{name}}\" are saved."` |
| `entityNotifications.agent.*`, `entityNotifications.toolset.*`, `entityNotifications.model.*`, `entityNotifications.skill.*`, `entityNotifications.conversation.*`, `entityNotifications.file.*`, `entityNotifications.folder.*` | same operation suffixes, one sentence per pair, only for pairs the matrix marks as existing |

Superseded keys SHALL be removed rather than left orphaned: `promptEditor.saveSuccessTitle`, `promptEditor.createSuccess`, `promptEditor.updateSuccess`, `catalog.publishSuccessTitle`, `catalog.publishSuccess`, `catalog.details.delete.successTitle`, `catalog.details.delete.success`. Keys whose copy is only realigned keep their names (`conversationPanel.*`, `conversationExport.*`, `conversationImport.*`, `dialFileManager.*`, `conversationPublish.successMessage`).

The `unpublishRequested` pair SHALL exist only for entities the matrix marks as unpublishable; no `entityNotifications.file.unpublishRequested` or `entityNotifications.folder.unpublishRequested` key may be added.

Strings that label the unpublish UI itself — the menu entry, confirmation copy, consequence bullets, folder-group label, status text — SHALL NOT live in `entityNotifications`. They belong to their own feature namespaces (`catalog.details.unpublish.*`, `conversationUnpublish.*`) with the shared verb reused from `ButtonsI18nKeys.Unpublish` rather than re-declared per surface.

#### Scenario: Every new key is reachable through the enum

- **WHEN** a call site or the key map references a new string
- **THEN** it does so through `EntityNotificationsI18nKeys`, and no raw key literal appears in TypeScript

#### Scenario: No orphaned keys remain

- **WHEN** this change is implemented
- **THEN** every superseded key listed above is deleted from `en.json` and from `translation-keys.ts`, and no key in `entityNotifications` is unreferenced

#### Scenario: The Unpublish verb is declared once

- **WHEN** the catalog menu entry, the conversation menu entry, and both confirm buttons render their label
- **THEN** all four resolve `ButtonsI18nKeys.Unpublish`, and no feature namespace re-declares the bare word

#### Scenario: Schema-app keys are declared through the enum

- **WHEN** the schema-app copy is resolved
- **THEN** it uses `EntityNotificationsI18nKeys.SchemaApp*` members, each backed by an `entityNotifications.schemaApp.*` entry in `en.json`


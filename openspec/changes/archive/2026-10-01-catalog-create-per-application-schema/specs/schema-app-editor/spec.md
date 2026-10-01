## ADDED Requirements

### Requirement: The apps editor picks its kind from the schema's editor URL

`ROUTES.AppsEditor` SHALL keep rendering `ApplicationEditorPage` with `kind={ApplicationEditorKind.QuickApp}`, and `ApplicationEditorPage` SHALL resolve the effective kind with `resolveSchemaEditorKind(schemas, searchParams.get(AppsEditorQuery.Schema))` (`apps/chat/src/utils/application-editor.ts`), reading `schemas` from `useDeployments()`:

- a known schema **without** `editorUrl` → `ApplicationEditorKind.SchemaApp` (`'schema-app'`), whose definition is `schemaAppDefinition`;
- a schema **with** `editorUrl`, or a schema not (yet) in the list → `ApplicationEditorKind.QuickApp`, the embedded-editor flow unchanged: metadata first, then the "Create the application to configure its setup" pending step, then the iframe.

While `useDeployments().isLoading` is true and `schemas` is empty, the page SHALL render nothing, so an editor-less schema does not flash the embedded-editor layout first. `ApplicationFormEditor` SHALL be keyed by the resolved kind, so a change of kind remounts a fresh form. Other routes' kinds are not resolved.

`SchemaApp` SHALL be registered in `APPLICATION_EDITOR_DEFINITIONS` (`apps/chat/src/pages/ApplicationEditor/definitions/index.ts`).

#### Scenario: A schema with an editor URL keeps the embedded editor

- **WHEN** `/apps-editor?schema=<id>` is opened and that schema has an `editorUrl`
- **THEN** the page shows the Metadata section and the "Create the application to configure its setup" step, and no schema form

#### Scenario: A schema without an editor URL opens the schema form

- **WHEN** `/apps-editor?schema=<id>` is opened and that schema has no `editorUrl`
- **THEN** the page shows the Metadata section and a form rendered from the schema, with no pending-create step and no iframe

#### Scenario: The schema form is used even without declared properties

- **WHEN** the editor-less schema declares no properties
- **THEN** the schema-app editor still opens, and the form reports that there are no configurable properties

#### Scenario: Nothing renders before the schema list arrives

- **WHEN** the schema list is still loading and empty
- **THEN** `ApplicationEditorPage` renders nothing until it can resolve the kind

### Requirement: The schema-app Setup renders the schema with DialSchemaRenderer

`SchemaAppSetup` (`apps/chat/src/pages/ApplicationEditor/setup/SchemaAppSetup.tsx`) SHALL load the full JSON schema for `AppsEditorQuery.Schema` through `getApplicationSchema(schemaId)` (`apps/chat/src/server-api/application-schemas.ts`) in a `useEffect` with a cancelled flag, and render it with the kit's `DialSchemaRenderer` (`variant={SchemaRendererVariant.Flat}`, `skipUntouched`). `DialSchemaRenderer` is a 1.0 component with no 2.0 replacement. Its `onChange` and `onDefaultValues` SHALL both write the whole value into the setup's `properties`.

Its states SHALL be:

| State | Rendering |
|---|---|
| schema loading, or edit mode before the saved properties arrive | a centred `Spinner` |
| schema load failed | `ErrorMessageNotification` with `appsEditor.schemaForm.loadFailed` |
| ready | the renderer, with `defaultValue` set to the setup's `properties` |
| required property missing on submit | a `role="alert"` line with `appsEditor.schemaForm.requiredMissing` above the renderer |

The renderer reads `defaultValue` only on mount, so in edit mode it SHALL mount only after the saved properties have loaded.

The setup model is `SchemaApplicationSetup` (`apps/chat/src/models/application-editor.ts`): `properties?: Record<string, unknown>` and `requiredProperties: string[]`. The component SHALL copy the schema's top-level `required` list into `requiredProperties` whenever the two differ, because loading an edited app replaces the whole setup.

**Endpoint reused** — no new endpoint. `GET /api/v1/application-schemas/:id` (operationId `getApplicationSchema`, generated `applicationsApi.getApplicationSchema({ id })`, normal method), cached server-side under `application-schemas:item:<userSub>:<schemaId>` for 60 seconds with TTL-only invalidation, as `application-schemas-get` specifies. Example: `GET /api/v1/application-schemas/https%3A%2F%2Fexample.com%2Fschemas%2Ftext-classification` → `200 { "$id": "…", "type": "object", "properties": { "labels": { "type": "string", "title": "Labels" } }, "required": ["labels"] }`; `401`/`403` pass through, `404` when unknown, `502` for upstream 5xx, `503` when DIAL Core is unreachable — all shown as the load-failed message.

**i18n**: `appsEditor.schemaForm.loadFailed` ("Failed to load the application settings. Please try again."), `appsEditor.schemaForm.requiredMissing` ("Fill in all required settings."), declared as `AppsEditorI18nKeys.SchemaFormLoadFailed` / `SchemaFormRequiredMissing`. The renderer's own texts are left at the kit's English defaults.

**RTL**: none beyond the kit renderer and the shared editor layout, which use logical properties.

**Feature gate**: none of its own; the page is reached only through the runner Create options and Edit, which `OverlayFeature.SchemaApps` gates.

**Memoisation**: the properties change handler SHALL be a `useCallback`; the component is exported through `memo`.

#### Scenario: The form is built from the schema

- **WHEN** the schema declares a `labels` string property titled "Labels"
- **THEN** the Setup shows a "Labels" field, and `getApplicationSchema` was called with the schema id

#### Scenario: A failed schema load is reported

- **WHEN** `getApplicationSchema` rejects
- **THEN** the Setup shows `appsEditor.schemaForm.loadFailed` and no form

#### Scenario: Edit waits for the saved properties

- **WHEN** an existing app is opened before its details have loaded
- **THEN** the Setup shows a spinner, and the form mounts afterwards pre-filled with the saved values

### Requirement: A schema app is created in one request with its properties

`schemaAppDefinition` (`apps/chat/src/pages/ApplicationEditor/definitions/schemaAppDefinition.tsx`) SHALL use `ApplicationCreateStrategy.AllAtOnce`, so the Metadata and the form values are sent together and the editor then returns to `ROUTES.Catalog`. Its `create` SHALL call `createApplication` (`POST /api/v1/applications`, operationId `createApplication`) with `type` set to the schema id and `applicationProperties` set to the form value (`{}` when empty), plus the trimmed name, description, icon, version, topics and locale fields.

Example body:

```json
{
  "name": "Classifier",
  "type": "https://example.com/schemas/text-classification",
  "applicationProperties": { "labels": "spam,ham" }
}
```

Its `validateSetup` SHALL return a `properties` error (`appsEditor.schemaForm.requiredMissing`) when any name in `requiredProperties` has no value — absent, `null`, a blank string, or an empty array (`getMissingRequiredProperties`). `false` and `0` count as values. Only top-level required properties are checked; nested ones are left to the renderer's own highlighting.

The page title SHALL use the schema's `displayName` (`appsEditor.createTitle` / `appsEditor.editTitle` with `{{type}}`), falling back to `appsEditor.defaultTypeName`. The definition reports success through `getNotificationTarget: resolveSchemaNotificationTarget`: the `Quick app` copy for the QuickApp schema, the `SchemaApp` copy naming the schema's `displayName` (e.g. "External app edited successfully") for any other known schema, and the generic `Agent` copy when the schema is unknown (see `entity-operation-notifications`). The embedded-editor kind (`quickAppDefinition`) resolves its notifications the same way.

#### Scenario: Creation is blocked while a required property is empty

- **WHEN** the schema requires `labels`, the user fills the name and leaves `labels` empty, then clicks Create
- **THEN** `appsEditor.schemaForm.requiredMissing` is shown and `createApplication` is not called

#### Scenario: One request carries the form values

- **WHEN** the user fills the name "Classifier" and `labels` with "spam,ham", then clicks Create
- **THEN** `createApplication` is called once with `type` equal to the schema id and `applicationProperties: { labels: "spam,ham" }`
- **AND** the editor navigates to the Catalog

### Requirement: An edited schema app loads and saves its properties

`schemaAppDefinition.loadSetup` SHALL read `applicationDetails.applicationProperties` from `getDeploymentDetails(appId)` (`{}` when absent). Its `update` SHALL call `updateApplication` (`PATCH /api/v1/applications/:applicationName`, operationId `updateApplication`) with the Metadata fields and `applicationProperties` set to the form value, which replaces the stored `application_properties` as `applications-write-api` specifies. The id query parameter is `AppsEditorQuery.AppId`.

#### Scenario: Saved properties are shown and saved back

- **WHEN** an app whose `applicationProperties` are `{ labels: "a,b" }` is opened for editing, the user changes `labels` to "a,b,c" and clicks Save
- **THEN** the form first shows "a,b"
- **AND** `updateApplication` is called with the app id and `applicationProperties: { labels: "a,b,c" }`

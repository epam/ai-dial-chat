## ADDED Requirements

### Requirement: Create-mode metadata defaults are uniform across kinds
Every form-based kind registered in `APPLICATION_EDITOR_DEFINITIONS` (`CustomApp`, `QuickApp`, `SchemaApp`) SHALL declare `defaultMetadata` with `name: ''` and `version: DEFAULT_DEPLOYMENT_VERSION` (from `@epam/ai-dial-builder-form`), with `iconUrl`, `description` empty and `topics`, `otherLocales` empty arrays. The Custom App value is `DEFAULT_CUSTOM_APP_GENERAL_FORM` in `apps/chat/src/constants/custom-apps.ts`; the two schema kinds share `SCHEMA_APP_DEFAULT_METADATA` in `apps/chat/src/pages/ApplicationEditor/definitions/schemaDefinitionHelpers.ts`. No kind SHALL pre-fill a generated or translated default name. Edit mode is unaffected: it continues to seed values from the loaded deployment through `deploymentToMetadata`.

#### Scenario: Every form-based kind opens with the same defaults
- **WHEN** a unit test inspects `defaultMetadata` of the `custom-app`, `quick-app` and `schema-app` definitions
- **THEN** each has `name: ''` and `version: '1.0.0'`

#### Scenario: Quick app create form shows the default version
- **WHEN** a user opens the create form for an application schema with an embedded editor
- **THEN** the Version field shows `1.0.0` and the Name field is empty

#### Scenario: Schema app create sends the default version
- **WHEN** a user creates a schema app without editing the Version field
- **THEN** the create request carries `version: '1.0.0'`

#### Scenario: Clearing the version still omits it
- **WHEN** a user clears the Version field on any form-based kind and creates the application
- **THEN** the request omits `version` (as today) and the BFF stores its own `1.0.0` fallback

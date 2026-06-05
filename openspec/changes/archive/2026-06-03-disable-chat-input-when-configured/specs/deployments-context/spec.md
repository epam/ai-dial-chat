## ADDED Requirements

### Requirement: Backend maps dial:chatMessageInputDisabled to isChatMessageInputDisabled

`apps/chat-api/src/deployments/deployments.service.ts` SHALL, in `getDeploymentConfiguration`, map the raw DIAL Core JSON Schema response to a `DeploymentConfigurationDto` before returning it to the frontend. The mapping SHALL extract `raw['dial:chatMessageInputDisabled']` into a clean camelCase field `isChatMessageInputDisabled?: boolean`, following the same pattern as `ApplicationSchemasService` maps `dial:applicationTypeDisplayName` to `displayName`.

The raw `Record<string, unknown>` SHALL NOT be returned directly — a typed DTO is the contract.

#### Scenario: Backend maps the flag to isChatMessageInputDisabled

- **WHEN** DIAL Core returns a schema with `{ "dial:chatMessageInputDisabled": true }`
- **THEN** `getDeploymentConfiguration` returns `{ isChatMessageInputDisabled: true }` (field renamed, DIAL key absent)

#### Scenario: Flag absent in raw schema — field omitted from DTO

- **WHEN** DIAL Core returns a schema without `dial:chatMessageInputDisabled`
- **THEN** the DTO does not include `isChatMessageInputDisabled` (field is `undefined`)

---

### Requirement: DeploymentConfigurationDto is the typed backend response

`apps/chat-api/src/deployments/dto/deployment-configuration.dto.ts` SHALL define:

```ts
export class DeploymentConfigurationDto {
  type?: string;
  title?: string;
  properties?: Record<string, unknown>;
  additionalProperties?: boolean | Record<string, unknown>;
  isChatMessageInputDisabled?: boolean;
}
```

The controller SHALL reference this class in its `@ApiResponse` decorator.

#### Scenario: DTO shape matches mapped fields

- **WHEN** `getDeploymentConfiguration` succeeds
- **THEN** the response body contains only the mapped fields defined in `DeploymentConfigurationDto`

---

### Requirement: DeploymentConfigurationSchema exposes isChatMessageInputDisabled as a typed field

`libs/chat-shared/src/models/deployment-configuration.ts` (`DeploymentConfigurationSchema`) SHALL include:

```ts
/** When true, the application does not accept free-form text input; users interact only via form/action buttons. */
isChatMessageInputDisabled?: boolean;
```

The raw `'dial:chatMessageInputDisabled'` field SHALL be removed — the backend owns the mapping, the frontend reads only the clean name.

#### Scenario: Type-safe field access without cast

- **WHEN** app-edge code reads `selectedDeploymentConfiguration?.isChatMessageInputDisabled`
- **THEN** TypeScript infers the type as `boolean | undefined` without a type assertion

#### Scenario: Missing field defaults to undefined

- **WHEN** a `DeploymentConfigurationSchema` object is constructed without `isChatMessageInputDisabled`
- **THEN** the field is `undefined`, which is falsy, and no existing code breaks

## MODIFIED Requirements

### Requirement: Config registry exposes defaultDeploymentId as a client-visible config key

`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` SHALL include an entry:

```ts
{
  key: 'deployments.defaultDeploymentId',
  type: 'config',
  valueType: 'string',
  visibility: 'client',
  defaultValue: null,
  critical: false,
  description: 'Operator-configured default deployment ID shown to users without a persisted selection. Null when DEFAULT_DEPLOYMENT is not set.',
  owner: 'chat-team',
  envVar: 'DEFAULT_DEPLOYMENT',
}
```

`CLIENT_CONFIG_MAPPINGS` in `apps/chat-api/src/app-config/client-config.mapper.ts` SHALL map the key onto `config.defaultDeploymentId` through `toNullableString`. When `DEFAULT_DEPLOYMENT` is not set (or is an empty string), `AppConfigService` SHALL resolve `deployments.defaultDeploymentId` as `null`.

#### Scenario: Env var set — registry entry resolves to the string value

- **WHEN** `DEFAULT_DEPLOYMENT=my-model` is set and `AppConfigService.getClientConfig({ appId: 'ai-dial-chat', ... })` is called
- **THEN** the resolved value for key `deployments.defaultDeploymentId` is `"my-model"`

#### Scenario: Env var absent — registry entry resolves to null

- **WHEN** `DEFAULT_DEPLOYMENT` is not set and `AppConfigService.getClientConfig({ appId: 'ai-dial-chat', ... })` is called
- **THEN** the resolved value for key `deployments.defaultDeploymentId` is `null`

---

### Requirement: ClientConfigResponseDto includes defaultDeploymentId in the config object

`apps/chat-api/src/app-config/dto/client-config-response.dto.ts` SHALL add a `defaultDeploymentId` field inside the nested `config` object:

```ts
@ApiPropertyOptional({
  description: 'Operator-configured default deployment ID. Null when not configured.',
  example: 'gpt-4o',
  nullable: true,
  type: String,
})
@IsOptional()
@IsString()
defaultDeploymentId!: string | null;
```

**Authorization:** The `GET /api/v1/client-config` endpoint is public (`@Public()` with `OptionalSessionGuard`; no session required). No change to the endpoint's auth posture is introduced by this requirement.

**Feature flag:** Not gated.

**i18n impact:** None.

**RTL / UI impact:** None (backend DTO only).

**Generated-client impact:**
- operationId: `getClientConfig` (unchanged — same handler).
- SDK method: `AppConfigApi.getClientConfig(appId)` — return type updates automatically after regeneration.
- Frontend wrapper `apps/chat/src/server-api/app-config.api.ts`'s `getClientConfig` returns the whole generated `ClientConfigResponseDto` (calling `appConfigApi.getClientConfig({ appId: 'ai-dial-chat' })`); `AppConfigContext` SHALL read `response.config?.defaultDeploymentId ?? null` from it and expose it as `config.defaultDeploymentId: string | null`.

#### Scenario: GET /api/v1/client-config with DEFAULT_DEPLOYMENT set returns defaultDeploymentId

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `DEFAULT_DEPLOYMENT=gpt-4o`
- **THEN** the response is `200 OK` and the body contains `"appId": "ai-dial-chat"` and, among the other client config fields, `"config": { ..., "defaultDeploymentId": "gpt-4o", ... }`

#### Scenario: GET /api/v1/client-config without DEFAULT_DEPLOYMENT returns null defaultDeploymentId

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `DEFAULT_DEPLOYMENT` is not set
- **THEN** the response is `200 OK` and `config.defaultDeploymentId` is `null`

---

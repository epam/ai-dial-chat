## ADDED Requirements

### Requirement: UI_EVENT_ENABLED_BY_DEFAULT sets the operator default for the celebrations preference

`UI_EVENT_ENABLED_BY_DEFAULT` SHALL be an optional boolean on `EnvironmentVariables`
(`apps/chat-api/src/config/environment.config.ts`) that defaults to `true`. An absent value SHALL
resolve to `true`. `false`, `0` and `no` (trimmed, case-insensitive) SHALL resolve to `false`;
any other value SHALL resolve to `true`. It SHALL back the registry entry
`ui.celebrationsEnabledByDefault` in `CONFIG_DEFINITIONS`
(`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) with
`type: 'config'`, `valueType: 'boolean'`, `visibility: 'client'`, `defaultValue: true` and
`critical: false`. `CLIENT_CONFIG_MAPPINGS` and `createDefaultClientConfig`
(`apps/chat-api/src/app-config/client-config.mapper.ts`) SHALL expose it as
`config.celebrationsEnabledByDefault: boolean` on the existing `GET /api/v1/client-config`. A
non-boolean resolved value SHALL map to `true`.

The value SHALL be honoured whether or not `UI_EVENT` is set; without an event it has no visible
effect. It SHALL NOT be role-gated, SHALL NOT be an `ENABLED_FEATURES` key, and SHALL NOT appear
under `features`. Existing endpoint authentication, status codes, configuration cache and refresh
behaviour SHALL be retained.

**Endpoint/client impact:** no new endpoint. `ClientConfigDto`
(`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) gains a required
`celebrationsEnabledByDefault: boolean` with `@ApiProperty`. The generated
`AppConfigApi.getClientConfig` response model gains the field after `npm run openapi`. The frontend
keeps calling the normal (non-`Raw`) method through `apps/chat/src/server-api/app-config.api.ts`.

Example response excerpt:

```json
{ "config": { "activeEventId": "new-year", "celebrationsEnabledByDefault": true } }
```

**Cache:** none new. The field rides the existing client-config cache and refresh lifecycle.

#### Scenario: Unset defaults to on

- **WHEN** `UI_EVENT_ENABLED_BY_DEFAULT` is not set
- **THEN** `GET /api/v1/client-config` returns `config.celebrationsEnabledByDefault: true`

#### Scenario: An explicit false turns the default off

- **WHEN** `UI_EVENT_ENABLED_BY_DEFAULT` is `false`, `0`, `no` or `FALSE`
- **THEN** `config.celebrationsEnabledByDefault` is `false`

#### Scenario: Any other value keeps it on

- **WHEN** `UI_EVENT_ENABLED_BY_DEFAULT` is `true`, `1` or `yes`
- **THEN** `config.celebrationsEnabledByDefault` is `true`

#### Scenario: The field is not a feature flag

- **WHEN** the client config is fetched
- **THEN** `celebrationsEnabledByDefault` is present under `config` and absent from `features`

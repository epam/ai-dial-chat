## MODIFIED Requirements

### Requirement: fileManager.availableTabs config-registry key

`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` SHALL declare a `fileManager.availableTabs` entry in `CONFIG_DEFINITIONS`: `type: 'config'`, `valueType: 'json'`, `visibility: 'client'`, `defaultValue: ['all', 'my_files', 'shared', 'organization']`, `critical: false`, `envVar: 'FILE_MANAGER_AVAILABLE_TABS'`.

**State ownership**: `AppConfigService`/`CompositeConfigProvider` own resolution. No new NestJS module is introduced; the entry is registered in the existing `AppConfigModule`.

**Caching**: resolved through the existing `/api/v1/client-config` response, cached under the existing `app-config:client:{appId}:user:{userId}:roles:{roles}` key with the existing 60s TTL. No new cache key or TTL is introduced.

#### Scenario: Config definition is registered as client-visible

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` resolves the client config
- **THEN** the `fileManager.availableTabs` definition is included among the resolved `client`-visibility definitions

#### Scenario: Default value lists all first

- **WHEN** the `fileManager.availableTabs` definition is read from `CONFIG_DEFINITIONS`
- **THEN** its `defaultValue` is `['all', 'my_files', 'shared', 'organization']`

---

### Requirement: ClientConfigResponseDto exposes fileManagerTabs

`ClientConfigDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL expose `fileManagerTabs!: string[]`, populated during `AppConfigService.getClientConfig` by the `fileManager.availableTabs` → `fileManagerTabs` mapping in `apps/chat-api/src/app-config/client-config.mapper.ts` (`applyClientConfigValue`), which forwards the resolved array and falls back to the mapper's own `DEFAULT_FILE_MANAGER_TABS` when the resolved value is not an array. Its Swagger `example` SHALL be `['all', 'my_files', 'shared', 'organization']`.

#### Generated-client impact

- **operationId**: unchanged (`getClientConfig`). The field's shape is unchanged; only its Swagger example changes, and `npm run openapi` regenerates the artifact.
- **Response DTO**: `ClientConfigDto.fileManagerTabs: string[]`.
- **Frontend caller**: `apps/chat/src/server-api/app-config.api.ts`'s existing `getClientConfig` is unchanged (normal, non-`Raw` method).

**Example response** (`GET /api/v1/client-config?appId=ai-dial-chat`):

```json
{
  "appId": "ai-dial-chat",
  "features": { "asrEnabled": false },
  "config": {
    "asrModelId": null,
    "transcribeSizeLimitBytes": 5242880,
    "defaultDeploymentId": null,
    "fileManagerTabs": ["all", "my_files", "shared", "organization"]
  },
  "metadata": { "resolvedAt": "2026-09-28T00:00:00.000Z", "cacheTtlSeconds": 60 }
}
```

Error codes are unchanged from the existing endpoint.

#### Scenario: Default deployment returns the four-tab default

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS` is unset and `GET /api/v1/client-config?appId=ai-dial-chat` is called
- **THEN** the response's `config.fileManagerTabs` is `["all", "my_files", "shared", "organization"]`

---

### Requirement: No ENABLED_FEATURES_ROLES gating

`fileManager.availableTabs` SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — it is a `type: 'config'` (non-boolean) registry entry, and `allowedRolesEnvVar`-based role gating is only supported for `type: 'feature'` entries in the current config-registry type system. Visibility of the resolved tab list is deployment-wide, not per-role, in this change.

#### Scenario: Tab configuration applies uniformly regardless of caller roles

- **WHEN** two users with different roles both call `GET /api/v1/client-config?appId=ai-dial-chat` against the same deployment
- **THEN** both receive the identical `config.fileManagerTabs` value

---

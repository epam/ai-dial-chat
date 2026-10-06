# Spec: user-config-deployment-management

## Purpose

Installing, uninstalling, and selecting deployments within the user configuration.

## Requirements

### Requirement: PATCH /api/v1/user-config/deployments installs or uninstalls a deployment

`UserConfigController` SHALL expose `PATCH /api/v1/user-config/deployments` returning HTTP 204. The request body is validated by `UpdateInstalledDto`:

```ts
class UpdateInstalledDto {
  id: string;          // Deployment identifier — validated @IsString + @IsNotEmpty + @Matches(/^\S+$/) (any non-whitespace)
  isInstalled: boolean; // @IsBoolean
}
```

The handler calls `userConfigService.updateInstalledDeployment(id, isInstalled, at, bucket)`. `updateInstalledDeployment` delegates to the private `updateInstalledEntry('deployments', ...)` helper shared with toolsets, prompts and skills: it reads the current config, adds or removes `id` from `deployments.installed` (idempotent), then writes back via `writeConfig` with `version: CURRENT_CONFIG_VERSION`.

The operation MUST be idempotent:
- Installing an already-installed ID MUST NOT create duplicates.
- Uninstalling a missing ID MUST succeed silently (no error).

Error codes:
- `400 Bad Request` — body fails DTO validation (missing `id`, non-boolean `isInstalled`, or `id` does not match the allowlist `@Matches` constraint)
- `401 Unauthorized` — missing or invalid session

#### Scenario: Valid install request returns 204

- **WHEN** `PATCH /api/v1/user-config/deployments` is called with `{ "id": "deployment-xyz", "isInstalled": true }`
- **THEN** the response is 204 and `"deployment-xyz"` appears in `deployments.installed` in the stored config

#### Scenario: Valid uninstall request returns 204

- **WHEN** `PATCH /api/v1/user-config/deployments` is called with `{ "id": "deployment-xyz", "isInstalled": false }`
- **THEN** the response is 204 and `"deployment-xyz"` is absent from `deployments.installed`

#### Scenario: Installing an already-installed deployment is idempotent

- **WHEN** `PATCH /api/v1/user-config/deployments` is called twice with the same `id` and `isInstalled: true`
- **THEN** `deployments.installed` contains the ID exactly once

#### Scenario: Uninstalling a missing deployment ID is a no-op

- **WHEN** `PATCH /api/v1/user-config/deployments` is called with an `id` not in `deployments.installed` and `isInstalled: false`
- **THEN** the response is 204 and `deployments.installed` is unchanged

#### Scenario: Missing id field returns 400

- **WHEN** `PATCH /api/v1/user-config/deployments` is called with `{ "isInstalled": true }` (no id)
- **THEN** the response is 400

#### Scenario: Non-boolean isInstalled returns 400

- **WHEN** `PATCH /api/v1/user-config/deployments` is called with `{ "id": "deployment-xyz", "isInstalled": "yes" }`
- **THEN** the response is 400

#### Scenario: deployments.installed is preserved when other sections are updated

- **WHEN** `PATCH /api/v1/user-config/pins` is called after a deployment has been installed
- **THEN** `deployments.installed` is unchanged in the stored config after the pin operation

---

### Requirement: UserConfigDto v3 includes deployments.selectedId

`apps/chat-api/src/user-config/dto/user-config.dto.ts` SHALL carry `selectedId: string | null` on the `DeploymentsConfig` interface and its `DeploymentsConfigDto` class (introduced as config version 3; `CURRENT_CONFIG_VERSION` is now `6` after the later prompts/skills/prompt-id migrations):

```ts
class DeploymentsConfigDto implements DeploymentsConfig {
  @ApiProperty({ description: 'Installed deployment identifiers.', example: ['deployment-xyz'], type: [String] })
  installed!: string[];

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  selectedId!: string | null;
}

export const CURRENT_CONFIG_VERSION = 6;
```

`selectedId` is optional at the DTO level to allow partial reads of older stored files. `DEFAULT_USER_CONFIG` and `createDefaultUserConfig()` set `deployments: { installed: [], selectedId: null }`.

**i18n impact:** None.

**RTL / UI impact:** None.

#### Scenario: UserConfigDto with selectedId deserialises correctly

- **WHEN** a stored config file contains `{ "version": 3, "deployments": { "installed": [], "selectedId": "gpt-4o" } }`
- **THEN** the deserialised `UserConfigDto.deployments.selectedId` equals `"gpt-4o"`

#### Scenario: UserConfigDto without selectedId deserialises to null

- **WHEN** a stored config file contains `{ "version": 2, "deployments": { "installed": [] } }` and is migrated to the current version
- **THEN** the migrated `UserConfigDto.deployments.selectedId` is `null`

---

### Requirement: migrateConfig handles v2→v3 migration

`migrateConfig(raw: unknown, userBucket: string): UserConfig`, a module-level function exported from `apps/chat-api/src/user-config/dto/user-config.dto.ts` and called by `UserConfigService` on every config read, SHALL rebuild the config from the stored object and return it at `CURRENT_CONFIG_VERSION` (`6`). For the v2→v3 step it SHALL carry `deployments.selectedId` over when the stored value is a string and set it to `null` otherwise:

```ts
// v2→v3: extract selectedId if present, default to null
const deploymentsSelectedIdRaw = deploymentsObj?.['selectedId'];
const deploymentsSelectedId =
  typeof deploymentsSelectedIdRaw === 'string' ? deploymentsSelectedIdRaw : null;
```

A v1 shape (`pinnedConversationIds` at the root, no `conversations`) returns `createDefaultUserConfig()` with only the pinned ids carried over, so `selectedId` is `null`. Files that already have a string `selectedId` keep it. The migration MUST be idempotent.

#### Scenario: v2 config is migrated to v3 with selectedId null

- **WHEN** `migrateConfig` receives a v2 config `{ version: 2, deployments: { installed: ["dep-1"] } }`
- **THEN** the returned config has `version: CURRENT_CONFIG_VERSION` (`6`) and `deployments.selectedId === null`

#### Scenario: Stored selectedId is preserved

- **WHEN** `migrateConfig` receives `{ version: 3, deployments: { installed: [], selectedId: "gpt-4o" } }`
- **THEN** the returned config keeps `deployments.selectedId === "gpt-4o"` and has `version: CURRENT_CONFIG_VERSION`

#### Scenario: v1 config migrates to the current version

- **WHEN** `migrateConfig` receives a v1 config
- **THEN** the returned config has `version: CURRENT_CONFIG_VERSION` and `deployments.selectedId === null`

---

### Requirement: PATCH /api/v1/user-config/deployments/selected persists selected deployment

`UserConfigController` SHALL expose `PATCH /api/v1/user-config/deployments/selected` returning HTTP 204. The request body is validated by `UpdateSelectedDeploymentDto`:

```ts
class UpdateSelectedDeploymentDto {
  @ApiPropertyOptional({
    description: 'Deployment ID to set as selected, or null to clear.',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  id: string | null = null;
}
```

The handler calls `userConfigService.updateSelectedDeployment(id, at, bucket)`.

`updateSelectedDeployment` reads the current config, sets `deployments.selectedId = id`, then writes back via `writeConfig` with `version: CURRENT_CONFIG_VERSION`. The entire operation MUST be a read-modify-write.

**Authorization:** Requires authenticated user (existing `SessionGuard` on the controller). Same as all other user-config mutation endpoints.

**operationId:** `updateSelectedDeployment` (handler method name on the controller).

**Generated-client impact:**
- SDK method: `UserConfigApi.updateSelectedDeployment(updateSelectedDeploymentDto)`
- Request DTO: `UpdateSelectedDeploymentDto { id: string | null }`
- Response: 204 No Content (no body)
- Frontend wrapper: `apps/chat/src/server-api/user-config.api.ts` SHALL add `updateSelectedDeployment(id: string | null): Promise<void>` that calls the generated `UserConfigApi.updateSelectedDeployment`.

**Example request:**
```
PATCH /api/v1/user-config/deployments/selected
Content-Type: application/json

{ "id": "gpt-4o" }
```

**Example response:**
```
HTTP/1.1 204 No Content
```

**Example request (clear selection):**
```
PATCH /api/v1/user-config/deployments/selected
Content-Type: application/json

{ "id": null }
```

#### Scenario: Valid id persists selection and returns 204

- **WHEN** `PATCH /api/v1/user-config/deployments/selected` is called with `{ "id": "gpt-4o" }`
- **THEN** the response is 204 and `deployments.selectedId` in the stored config equals `"gpt-4o"`

#### Scenario: null id clears selection and returns 204

- **WHEN** `PATCH /api/v1/user-config/deployments/selected` is called with `{ "id": null }`
- **THEN** the response is 204 and `deployments.selectedId` in the stored config is `null`

#### Scenario: Missing body field id defaults to null (optional field)

- **WHEN** `PATCH /api/v1/user-config/deployments/selected` is called with `{}`
- **THEN** the response is 204 and `deployments.selectedId` in the stored config is `null`

#### Scenario: Unauthenticated request returns 401

- **WHEN** `PATCH /api/v1/user-config/deployments/selected` is called without a valid session
- **THEN** the response is 401

#### Scenario: deployments.installed is unchanged after updateSelectedDeployment

- **WHEN** `PATCH /api/v1/user-config/deployments/selected` is called with `{ "id": "gpt-4o" }`
- **AND** `deployments.installed` was `["dep-a", "dep-b"]`
- **THEN** `deployments.installed` still equals `["dep-a", "dep-b"]` in the stored config

---

### Requirement: UserConfigContext exposes selectedDeploymentId and setSelectedDeployment

`UserConfigContextType` (`apps/chat/src/context/UserConfigContext.tsx`) SHALL add:

```ts
selectedDeploymentId: string | null;
setSelectedDeployment: (id: string | null) => Promise<void>;
```

`selectedDeploymentId` reflects `getUserConfig()` response `deployments.selectedId` (initially `null` if absent). `setSelectedDeployment` updates local state optimistically before calling `updateSelectedDeployment(id)` from `user-config.api.ts`; a failed backend call is logged with `console.warn` and swallowed (the promise resolves, and local state is not rolled back).

**Memoisation:** The context value object SHALL be wrapped in `useMemo`; `setSelectedDeployment` SHALL be wrapped in `useCallback` to keep the memoised value stable across renders.

#### Scenario: selectedDeploymentId is populated after successful load

- **WHEN** `getUserConfig()` resolves with `deployments.selectedId = "gpt-4o"`
- **THEN** `useUserConfig().selectedDeploymentId` equals `"gpt-4o"`

#### Scenario: setSelectedDeployment writes to backend and updates local state

- **WHEN** `setSelectedDeployment("gpt-4o")` is called
- **THEN** `selectedDeploymentId` updates to `"gpt-4o"` immediately
- **AND** `updateSelectedDeployment("gpt-4o")` is called

#### Scenario: setSelectedDeployment with null clears selectedDeploymentId

- **WHEN** `setSelectedDeployment(null)` is called
- **THEN** `selectedDeploymentId` is `null`, whether or not the backend call succeeds

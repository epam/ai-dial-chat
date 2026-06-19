# Spec: user-config-deployment-management

## Requirements

### Requirement: PATCH /api/v1/user-config/deployments installs or uninstalls a deployment

`UserConfigController` SHALL expose `PATCH /api/v1/user-config/deployments` returning HTTP 204. The request body is validated by `UpdateInstalledDto`:

```ts
class UpdateInstalledDto {
  id: string;          // Deployment identifier — validated with @Matches allowlist regex
  isInstalled: boolean;
}
```

The handler calls `userConfigService.updateInstalledDeployment(id, isInstalled, at, bucket)`. `updateInstalledDeployment` reads the current config, adds or removes `id` from `deployments.installed` (idempotent), then writes back via `writeConfig`.

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

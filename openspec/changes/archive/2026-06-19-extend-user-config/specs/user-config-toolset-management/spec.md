## ADDED Requirements

### Requirement: PATCH /api/v1/user-config/toolsets installs or uninstalls a toolset

`UserConfigController` SHALL expose `PATCH /api/v1/user-config/toolsets` returning HTTP 204. The request body is validated by `UpdateInstalledDto`:

```ts
class UpdateInstalledDto {
  id: string;          // Toolset identifier — validated with @Matches allowlist regex
  isInstalled: boolean;
}
```

The handler calls `userConfigService.updateInstalledToolset(id, isInstalled, at, bucket)`. `updateInstalledToolset` reads the current config, adds or removes `id` from `toolsets.installed` (idempotent), then writes back via `writeConfig`.

The operation MUST be idempotent:
- Installing an already-installed ID MUST NOT create duplicates.
- Uninstalling a missing ID MUST succeed silently (no error).

Error codes:
- `400 Bad Request` — body fails DTO validation (missing `id`, non-boolean `isInstalled`, or `id` does not match the allowlist `@Matches` constraint)
- `401 Unauthorized` — missing or invalid session

#### Scenario: Valid install request returns 204

- **WHEN** `PATCH /api/v1/user-config/toolsets` is called with `{ "id": "toolset-abc", "isInstalled": true }`
- **THEN** the response is 204 and `"toolset-abc"` appears in `toolsets.installed` in the stored config

#### Scenario: Valid uninstall request returns 204

- **WHEN** `PATCH /api/v1/user-config/toolsets` is called with `{ "id": "toolset-abc", "isInstalled": false }`
- **THEN** the response is 204 and `"toolset-abc"` is absent from `toolsets.installed`

#### Scenario: Installing an already-installed toolset is idempotent

- **WHEN** `PATCH /api/v1/user-config/toolsets` is called twice with the same `id` and `isInstalled: true`
- **THEN** `toolsets.installed` contains the ID exactly once

#### Scenario: Uninstalling a missing toolset ID is a no-op

- **WHEN** `PATCH /api/v1/user-config/toolsets` is called with an `id` not in `toolsets.installed` and `isInstalled: false`
- **THEN** the response is 204 and `toolsets.installed` is unchanged

#### Scenario: Missing id field returns 400

- **WHEN** `PATCH /api/v1/user-config/toolsets` is called with `{ "isInstalled": true }` (no id)
- **THEN** the response is 400

#### Scenario: Non-boolean isInstalled returns 400

- **WHEN** `PATCH /api/v1/user-config/toolsets` is called with `{ "id": "toolset-abc", "isInstalled": "yes" }`
- **THEN** the response is 400

#### Scenario: toolsets.installed is preserved when other sections are updated

- **WHEN** `PATCH /api/v1/user-config/pins` is called after a toolset has been installed
- **THEN** `toolsets.installed` is unchanged in the stored config after the pin operation

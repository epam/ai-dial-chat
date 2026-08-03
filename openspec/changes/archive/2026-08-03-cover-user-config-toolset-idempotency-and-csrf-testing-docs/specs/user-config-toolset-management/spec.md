## ADDED Requirements

### Requirement: Tests cover the toolset install/uninstall surface end-to-end

The change SHALL ship a `describe` block in
`user-config.controller.integration.spec.ts` that wires the real `UserConfigService` (not a
mock) behind `UserConfigController`, so the idempotency and no-op scenarios already
documented for `PATCH /api/v1/user-config/toolsets` are proven through the full HTTP request
path — DTO validation, controller wiring, and the real `updateInstalledEntry` dedup logic —
not only at the unit level.

#### Scenario: Idempotent install is proven end-to-end

- **WHEN** the test suite issues `PATCH /api/v1/user-config/toolsets` with the same `id` and
  `isInstalled: true` twice against the real `UserConfigService`
- **THEN** the response is `204` both times and the persisted config's `toolsets.installed`
  contains the ID exactly once

#### Scenario: Uninstall no-op is proven end-to-end

- **WHEN** the test suite issues `PATCH /api/v1/user-config/toolsets` with an `id` not present
  in `toolsets.installed` and `isInstalled: false` against the real `UserConfigService`
- **THEN** the response is `204` and the persisted config's `toolsets.installed` is unchanged

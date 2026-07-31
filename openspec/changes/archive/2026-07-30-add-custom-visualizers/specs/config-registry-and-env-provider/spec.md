## ADDED Requirements

### Requirement: Registry declares the customVisualizers key

The `CONFIG_DEFINITIONS` registry (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) SHALL include a new entry:

- `key='customVisualizers'`
- `type='config'`
- `valueType='json'`
- `visibility='client'`
- `defaultValue=[]`
- `critical=false`
- `envVar='CUSTOM_VISUALIZERS'`
- `description` — human-readable summary of the visualizer registry semantics.
- `owner` — matches the ownership convention used by other registry entries.

The parsed value type MUST be `CustomVisualizer[]` (see `custom-visualizers` capability). Elements that fail per-entry validation SHALL be dropped with an error log at boot; total parse failure SHALL yield `[]`.

**Feature flag:** none. The registry entry is a backend implementation detail.

#### Scenario: Registry contains customVisualizers key

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='customVisualizers'`, `type='config'`, `valueType='json'`, `visibility='client'`, `envVar='CUSTOM_VISUALIZERS'`, and `defaultValue=[]`

#### Scenario: Env resolves to parsed array

- **WHEN** `CUSTOM_VISUALIZERS='[{"contentType":"application/x-my-viz","url":"https://viz.example.com"}]'` and the config is resolved
- **THEN** the `customVisualizers` value on the resolved config equals `[{ contentType: 'application/x-my-viz', url: 'https://viz.example.com' }]`

#### Scenario: Missing env falls back to default

- **WHEN** `CUSTOM_VISUALIZERS` is unset
- **THEN** the `customVisualizers` value on the resolved config equals `[]`

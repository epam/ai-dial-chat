## ADDED Requirements

### Requirement: AppConfigContext exposes customVisualizers

`AppConfigContext` (`apps/chat/src/context/AppConfigContext.tsx`) SHALL surface the parsed `customVisualizers: CustomVisualizer[]` field from the `/api/v1/config` response to client consumers.

Behaviour:

- The field SHALL be readable via the existing `useAppConfig()` accessor and via a dedicated `useCustomVisualizers()` hook exported from `apps/chat/src/hooks/attachment/useCustomVisualizers.ts` (see the `custom-visualizers` capability).
- While the config request is loading OR on error, both accessors SHALL return `[]`.
- The returned array reference SHALL remain stable across renders as long as the underlying config has not changed (memoise the parse result).
- The type imported by the app SHALL be the same `CustomVisualizer` type exported from `@epam/ai-dial-chat-shared`.

Libs SHALL NOT read `AppConfigContext` for the registry — the app resolves the registry and passes concrete `VisualizerCanvasContent` values into libs.

**Feature flag:** none. The empty-array default keeps the field dark.

**RTL impact:** none.

**i18n impact:** none.

#### Scenario: customVisualizers is exposed when config is ready

- **WHEN** `AppConfigProvider` has fetched a config with `customVisualizers: [{ contentType: 'application/x-my-viz', url: 'https://viz.example.com' }]`
- **THEN** `useAppConfig().customVisualizers` returns that same array
- **AND** `useCustomVisualizers()` returns the same array (identical reference)

#### Scenario: customVisualizers defaults to empty during loading and on error

- **WHEN** the config request is in flight
- **THEN** both `useAppConfig().customVisualizers` and `useCustomVisualizers()` return `[]`
- **AND** the same holds after the request rejects

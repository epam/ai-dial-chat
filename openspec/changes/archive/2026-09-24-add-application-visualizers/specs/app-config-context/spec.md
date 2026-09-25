## ADDED Requirements

### Requirement: AppConfigContext exposes applicationVisualizers

`AppConfigContext` (`apps/chat/src/context/AppConfigContext.tsx`) SHALL surface the
`applicationVisualizers: Record<string, ApplicationVisualizer>` field from the
`GET /api/v1/client-config` response to client consumers.

Behaviour:

- The field SHALL live on `AppConfigState.config`, readable as
  `useAppConfig().config.applicationVisualizers` and via a dedicated
  `useApplicationVisualizers()` hook exported from
  `apps/chat/src/hooks/attachment/useApplicationVisualizers.ts` (see the
  `application-visualizers` capability).
- While the config request is loading OR on error, both accessors SHALL return an empty
  registry.
- The registry reference SHALL remain stable across renders as long as the underlying
  config has not changed. The not-ready branch of `useApplicationVisualizers()` SHALL
  return a module-level constant rather than an inline `{}`, so a consumer's
  `useMemo`/`useCallback` dependencies are not invalidated on every render while config
  loads.
- The type imported by the app SHALL be the same `ApplicationVisualizer` type exported
  from `@epam/ai-dial-chat-shared`.

Libs SHALL NOT read `AppConfigContext` for the registry — the app resolves the registry,
partitions the attachments, and passes a concrete `GroupedVisualizerCanvasContent` value
into libs.

**Feature flag:** none. The empty-registry default keeps the field dark.

**RTL impact:** none.

**i18n impact:** none.

#### Scenario: applicationVisualizers is exposed when config is ready

- **WHEN** `AppConfigProvider` has fetched a config with `applicationVisualizers: { 'app-1': { title: 'my-viz', url: 'https://viz.example.com' } }`
- **THEN** `useAppConfig().config.applicationVisualizers` returns that same object
- **AND** `useApplicationVisualizers()` returns the same object (identical reference)

#### Scenario: applicationVisualizers defaults to an empty registry during loading and on error

- **WHEN** the config request is in flight
- **THEN** both `useAppConfig().config.applicationVisualizers` and `useApplicationVisualizers()` return an empty registry
- **AND** the same holds after the request rejects

#### Scenario: Not-ready reference is stable

- **WHEN** `useApplicationVisualizers()` is called on two consecutive renders while the config status is not ready
- **THEN** both calls return the identical object reference

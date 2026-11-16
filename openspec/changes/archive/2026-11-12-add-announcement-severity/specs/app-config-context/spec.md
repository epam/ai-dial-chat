## MODIFIED Requirements

### Requirement: AppConfigContext exposes the announcements list

`AppConfigState.config` SHALL include an `announcements: AnnouncementListItem[]` field, typed with the `AnnouncementListItem` interface exported from `@epam/ai-dial-chat-hooks`.

The initial (loading) value SHALL be `[]`. On a successful `GET /api/v1/client-config` response, it SHALL be populated from the response's `config.announcements` field. On error, or when the backend omits the field, it SHALL retain the `[]` default. A `null` or non-array value SHALL be normalized to `[]`.

The returned array reference SHALL remain stable across renders as long as the underlying config has not changed. The context SHALL NOT re-validate, re-sanitize, or re-order entries — the backend is the authority on which entries are safe to render.

Each entry's `severity` SHALL be mapped from the generated `AnnouncementSeverity` union onto the `AnnouncementSeverity` string enum exported from `@epam/ai-dial-chat-hooks` through `mapAnnouncementSeverity` (also exported from `@epam/ai-dial-chat-hooks`), because a TypeScript string enum is not assignable from the generated string-literal type. This mapping is the only per-entry transformation the context performs; `title`, `description` and `link` SHALL pass through unchanged. The mapping SHALL run once per config load, inside the existing response-to-state step in `apps/chat/src/context/AppConfigContext.tsx`, so the array reference stays stable across renders. `mapAnnouncementSeverity` SHALL return `AnnouncementSeverity.Info` for any value it does not recognise, so an older backend that omits the field still yields `info`. The `AppConfigContext` owns this state; no new context or hook is introduced.

#### Scenario: Announcements default to an empty array before config loads

- **WHEN** `AppConfigProvider` has mounted but the API call has not resolved
- **THEN** `useAppConfig().config.announcements` returns `[]`

#### Scenario: Announcements are populated from a successful response

- **WHEN** the API call resolves with an entry in `config.announcements`
- **THEN** `useAppConfig().config.announcements` returns that entry

#### Scenario: Announcements stay empty when the backend omits them or the call fails

- **WHEN** the response omits `config.announcements`, or the API call rejects
- **THEN** `useAppConfig().config.announcements` returns `[]`

#### Scenario: A non-array announcements value is normalized

- **WHEN** the response carries `config.announcements: null`
- **THEN** `useAppConfig().config.announcements` returns `[]` rather than `null`

#### Scenario: The announcements array reference is stable across renders

- **WHEN** a consumer re-renders without the underlying config changing
- **THEN** `useAppConfig().config.announcements` returns the same array reference as the previous render

#### Scenario: Entry severity is mapped onto the lib enum

- **WHEN** the API call resolves with `config.announcements: [{ title: "Upcoming maintenance", description: null, link: null, severity: "warning" }]`
- **THEN** `useAppConfig().config.announcements[0].severity` is `AnnouncementSeverity.Warning` and its `title`, `description` and `link` equal the response values

#### Scenario: A response without severity yields info

- **WHEN** the API call resolves with an announcements entry that has no `severity` field, as an older backend returns
- **THEN** `useAppConfig().config.announcements[0].severity` is `AnnouncementSeverity.Info`

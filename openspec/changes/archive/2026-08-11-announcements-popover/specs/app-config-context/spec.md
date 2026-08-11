## ADDED Requirements

### Requirement: AppConfigContext exposes the announcements list

`AppConfigState.config` SHALL include an `announcements: AnnouncementItem[]` field.

The initial (loading) value SHALL be `[]`. On a successful `GET /api/v1/client-config` response, it SHALL be populated from the response's `config.announcements` field. On error, or when the backend omits the field, it SHALL retain the `[]` default. A `null` or non-array value SHALL be normalized to `[]`.

The returned array reference SHALL remain stable across renders as long as the underlying config has not changed. The context SHALL NOT re-validate, re-sanitize, or re-order entries — the backend is the authority on which entries are safe to render.

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

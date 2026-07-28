## ADDED Requirements

### Requirement: AppConfigContext exposes the announcement message

`AppConfigState.config` SHALL include an `announcementHtml: string | null` field. The initial (loading) value SHALL be `null`. On a successful `GET /api/v1/client-config` response, `config.announcementHtml` SHALL be populated from the response's `config.announcementHtml` field. On error, or when the backend omits the field, `config.announcementHtml` SHALL retain the `null` default.

#### Scenario: announcementHtml is null before config loads

- **WHEN** `AppConfigProvider` has mounted but the API call has not resolved
- **THEN** `useAppConfig().config.announcementHtml` returns `null`

#### Scenario: announcementHtml is populated from a successful response

- **WHEN** the API call resolves with `config.announcementHtml: "Welcome to DIAL!"`
- **THEN** `useAppConfig().config.announcementHtml` returns `"Welcome to DIAL!"`

#### Scenario: announcementHtml stays null when the backend omits it or the call fails

- **WHEN** the response omits `config.announcementHtml`, or the API call rejects
- **THEN** `useAppConfig().config.announcementHtml` returns `null`

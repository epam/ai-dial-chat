## ADDED Requirements

### Requirement: AppConfigContext exposes the announcement title and description

`AppConfigState.config` SHALL include `announcementTitle: string | null` and `announcementDescription: string | null`.

The initial (loading) value of each SHALL be `null`. On a successful `GET /api/v1/client-config` response, each SHALL be populated from the response's `config.announcementTitle` and `config.announcementDescription` fields. On error, or when the backend omits a field, each SHALL retain the `null` default.

The context SHALL NOT re-sanitize or otherwise transform these values — it surfaces what the backend returned, and the banner component applies its own client-side sanitization pass (see the `announcement-banner` capability).

#### Scenario: Announcement fields are null before config loads

- **WHEN** `AppConfigProvider` has mounted but the API call has not resolved
- **THEN** `useAppConfig().config.announcementTitle` returns `null` and `.announcementDescription` returns `null`

#### Scenario: Announcement fields are populated from a successful response

- **WHEN** the API call resolves with `config.announcementTitle: "🎉 Welcome to DIAL! 🎉"` and `config.announcementDescription: "Explore our AI offerings with your data."`
- **THEN** `useAppConfig().config` exposes those exact values

#### Scenario: Announcement fields stay null when the backend omits them or the call fails

- **WHEN** the response omits both fields, or the API call rejects
- **THEN** `useAppConfig().config.announcementTitle` returns `null` and `.announcementDescription` returns `null`

#### Scenario: One field populated, the other absent

- **WHEN** the response carries `config.announcementTitle` but omits `config.announcementDescription`
- **THEN** `useAppConfig().config.announcementTitle` returns the response value and `.announcementDescription` returns `null`

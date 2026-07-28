## ADDED Requirements

### Requirement: client-config response includes the announcement message

`GET /api/v1/client-config` SHALL include an `announcementHtml` field of type `string | null` in the `config` object of its response, sourced from the `announcement.html` registry key. The field SHALL carry the operator-configured message when set and SHALL be `null` when `ANNOUNCEMENT_HTML_MESSAGE` is not configured. The `ClientConfigDto` response DTO SHALL declare this field with Swagger metadata so the generated `@epam/chat-api-client` exposes it.

#### Scenario: Announcement message configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `ANNOUNCEMENT_HTML_MESSAGE` is set to `Welcome to DIAL!`
- **THEN** the response is `200 OK` with `config.announcementHtml="Welcome to DIAL!"`

#### Scenario: Announcement message not configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `ANNOUNCEMENT_HTML_MESSAGE` is not set
- **THEN** the response is `200 OK` with `config.announcementHtml=null`

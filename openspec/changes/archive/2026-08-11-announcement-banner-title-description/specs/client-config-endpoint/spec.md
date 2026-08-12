## ADDED Requirements

### Requirement: client-config response includes the announcement title and description

`GET /api/v1/client-config` SHALL include `announcementTitle` and `announcementDescription`, both of type `string | null`, in the `config` object of its response, sourced from the `announcement.title` and `announcement.description` registry keys. Each SHALL be `null` when its environment variable is not configured or resolves to a blank string.

`announcementTitle` SHALL be returned as plain text — the service SHALL NOT interpret it as markup and SHALL NOT strip or escape its characters beyond trimming surrounding whitespace.

`announcementDescription` SHALL be sanitized server-side before it is returned, using the announcement allowlist: tags `a`, `b`, `strong`, `em`, `br`, `span`, and attributes `href`, `target`, `rel`. This allowlist SHALL match the client-side DOMPurify pass in `AnnouncementBanner` exactly, so the server never returns markup the client silently strips. It is deliberately narrower than the footer's allowlist, which additionally permits `u` and `p` — block-level and underline markup have no place on a single truncating line. Anchors whose `href` is not a hash link SHALL be rewritten to carry `target="_blank"` and `rel="noopener noreferrer"`, reusing the footer's anchor transform. If sanitization reduces the value to an empty string, the field SHALL be `null`.

The `ClientConfigDto` response DTO SHALL declare both fields with Swagger metadata so the generated `@epam/chat-api-client` exposes them.

#### Scenario: Title and description configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called with `ANNOUNCEMENT_TITLE="🎉 Welcome to DIAL! 🎉"` and `ANNOUNCEMENT_DESCRIPTION="Explore our AI offerings with your data."`
- **THEN** the response is `200 OK` with both fields populated with those values

#### Scenario: Title and description not configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and neither variable is set
- **THEN** the response is `200 OK` with `config.announcementTitle=null` and `config.announcementDescription=null`

#### Scenario: Blank values resolve to null

- **WHEN** either variable is set to an empty string or to whitespace only
- **THEN** the corresponding response field is `null` rather than an empty or whitespace string

#### Scenario: Safe description markup is preserved

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is set to `Explore our <strong>AI offerings</strong>.`
- **THEN** the returned `config.announcementDescription` retains the `<strong>` element

#### Scenario: Description markup outside the allowlist is stripped

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is set to `Hi<script>alert(1)</script><img src=x onerror="alert(1)">`
- **THEN** the returned `config.announcementDescription` contains no `<script>` element, no `<img>` element, and no inline event handler attribute

#### Scenario: Description links are forced to open safely

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` contains `<a href="https://dialx.ai">docs</a>`
- **THEN** the returned anchor carries `target="_blank"` and `rel="noopener noreferrer"`

#### Scenario: A description that sanitizes away becomes null

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is set to `<script>alert(1)</script>`
- **THEN** the returned `config.announcementDescription` is `null` rather than an empty string

#### Scenario: Title is not treated as markup

- **WHEN** `ANNOUNCEMENT_TITLE` is set to `Release <b>3.0</b>`
- **THEN** the returned `config.announcementTitle` is the literal string `Release <b>3.0</b>`, unmodified

---

### Requirement: Announcement fields are independent of one another and of the legacy message

The service SHALL resolve `announcementTitle`, `announcementDescription`, and the existing `announcementHtml` independently. Configuring any subset SHALL be valid; the service SHALL NOT require that they be set together, SHALL NOT derive one from another, and SHALL NOT clear `announcementHtml` when the new fields are set. Choosing which content to render is the client's responsibility (see the `announcement-banner` capability).

#### Scenario: Only the title is configured

- **WHEN** `ANNOUNCEMENT_TITLE` is set and the description and legacy message are not
- **THEN** the response carries `config.announcementTitle` populated, `config.announcementDescription=null`, and `config.announcementHtml=null`

#### Scenario: Only the description is configured

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is set and the title and legacy message are not
- **THEN** the response carries `config.announcementDescription` populated, `config.announcementTitle=null`, and `config.announcementHtml=null`

#### Scenario: Legacy message and new fields are both configured

- **WHEN** `ANNOUNCEMENT_HTML_MESSAGE` and `ANNOUNCEMENT_TITLE` are both set
- **THEN** the response carries both `config.announcementHtml` and `config.announcementTitle` populated, with neither suppressing the other

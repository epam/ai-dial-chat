## ADDED Requirements

### Requirement: client-config response includes the validated announcements list

`GET /api/v1/client-config` SHALL include an `announcements` field of type `AnnouncementItemDto[]` in the `config` object of its response, sourced from the `announcement.items` registry key. The field SHALL be `[]` when `ANNOUNCEMENTS` is not configured. Entries SHALL be returned in configured order.

Each entry SHALL carry a `title: string`, a `description: string | null`, and a `link: AnnouncementLinkDto | null` whose link carries a `label: string` and an `href: string`.

The service SHALL include only entries that satisfy all of:

- `title` is a string that is non-blank after trimming;
- `link`, **when present**, has a non-blank string `label` and an `href` that parses as an absolute URL whose scheme is exactly `http:` or `https:`.

An entry with no `link` SHALL be included, rendering as an announcement without a call to action. An entry whose `link` is present but invalid SHALL be dropped entirely rather than returned without its link, so a broken call to action is never silently swallowed.

`description` SHALL be sanitized with the announcement allowlist (tags `a`, `b`, `strong`, `em`, `br`, `span`; attributes `href`, `target`, `rel`), with non-hash anchors rewritten to `target="_blank"` and `rel="noopener noreferrer"`. A description that is blank or sanitizes to an empty string SHALL be `null`. `title` and `link.label` SHALL be returned as plain text and SHALL NOT be interpreted as markup.

Every rejected entry SHALL be dropped and logged with a warning naming the entry and the reason. The service SHALL cap the returned list at the supported maximum, dropping and logging the excess. A malformed value (invalid JSON, or a JSON root that is not an array) SHALL result in `announcements: []` with a logged warning. Invalid announcements configuration SHALL NEVER cause the request to fail and SHALL NEVER suppress the banner's own announcement fields.

`AnnouncementItemDto` and `AnnouncementLinkDto` SHALL be declared as classes with `@ApiProperty` metadata on every field, so `@nestjs/swagger` emits runtime metadata and the generated client exposes the shape.

#### Scenario: A complete announcement is returned

- **WHEN** `ANNOUNCEMENTS` contains an entry with a title, a description, and an `https` link
- **THEN** the response is `200 OK` with that entry present, its description sanitized and its link intact

#### Scenario: Announcements not configured

- **WHEN** `ANNOUNCEMENTS` is not set
- **THEN** the response is `200 OK` with `config.announcements=[]`

#### Scenario: An entry without a link is kept

- **WHEN** an entry has a title but no `link` key
- **THEN** the entry is returned with `link: null`

#### Scenario: An entry with an invalid link href is dropped

- **WHEN** an entry's `link.href` is `javascript:alert(1)`, `data:text/html,x`, a relative path such as `/settings`, or an unparseable string
- **THEN** that entry is absent from `config.announcements` and a warning is logged

#### Scenario: An entry with a blank link label is dropped

- **WHEN** an entry has a `link` whose `label` is blank or missing
- **THEN** that entry is absent from `config.announcements` and a warning is logged

#### Scenario: An entry with a blank title is dropped

- **WHEN** an entry has a blank or missing `title`
- **THEN** that entry is absent from `config.announcements` and a warning is logged

#### Scenario: One bad entry does not discard the good ones

- **WHEN** `ANNOUNCEMENTS` contains one valid entry and one entry with a `javascript:` link href
- **THEN** `config.announcements` contains exactly the valid entry

#### Scenario: Descriptions are sanitized per entry

- **WHEN** an entry's description contains `<script>alert(1)</script>Hello`
- **THEN** the returned description contains no `<script>` element and retains `Hello`

#### Scenario: A description that sanitizes away becomes null

- **WHEN** an entry's description is `<script>alert(1)</script>`
- **THEN** the entry is returned with `description: null` rather than an empty string

#### Scenario: Titles are not treated as markup

- **WHEN** an entry's title is `Release <b>3.0</b>`
- **THEN** the returned title is the literal string `Release <b>3.0</b>`, unmodified

#### Scenario: Malformed JSON degrades to an empty list

- **WHEN** `ANNOUNCEMENTS` resolves to a value that is not an array
- **THEN** the response is `200 OK` with `config.announcements=[]`, a warning is logged, and the banner's `announcementTitle` / `announcementDescription` are still populated

#### Scenario: Excess entries are capped

- **WHEN** `ANNOUNCEMENTS` contains more entries than the supported maximum
- **THEN** `config.announcements` contains only the first N entries in configured order and a warning names the dropped ones

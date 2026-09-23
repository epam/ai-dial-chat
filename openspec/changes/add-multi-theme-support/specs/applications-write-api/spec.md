## ADDED Requirements

### Requirement: Application write endpoints accept a theme URL

Both application write DTOs SHALL accept an optional theme URL.

`CreateApplicationBodyDto` and `UpdateApplicationBodyDto` (`apps/chat-api/src/applications/dto/`)
SHALL each accept an optional `themeUrl`, validated with
`@IsString() @IsOptional()` and a URL check that admits only an absolute `https://` URL or the
empty string, and documented with `@ApiPropertyOptional` carrying the example
`https://themes.contoso.example.com`.

This field is independent of `applicationProperties`. Nothing is hoisted out of
`applicationProperties` into it, and supplying one has no effect on the other — the existing
`applicationProperties` replacement semantics on `PATCH` are unchanged by this addition.

`POST /api/v1/applications` SHALL, when `themeUrl` is a non-empty string, write
`catalog_properties.themeUrl` on the created DIAL Core application.

`PATCH /api/v1/applications/:applicationName` SHALL apply **merge** semantics to
`catalog_properties`, deliberately unlike `applicationProperties`:

- when the body omits `themeUrl` or sends it as `null`, the stored `catalog_properties` SHALL be
  carried through unchanged;
- when the body sends a non-empty `themeUrl`, only that key SHALL be set on the stored map, leaving
  every other key intact;
- when the body sends `themeUrl` as an empty or whitespace-only string, only that key SHALL be
  deleted from the stored map;
- when deleting the last key would leave an empty map, `catalog_properties` SHALL be written as an
  empty object rather than removed, so DIAL Core's stored shape stays stable.

`catalog_properties` is merged rather than replaced because chat does not own its other keys — they
are set by the operator and by DIAL Core's own catalog tooling.

**Authorization**: unchanged from the existing create and update requirements — any authenticated
user, for their own application, with no additional role restriction.

**Cache invalidation**: unchanged. The existing invalidation of the applications list, the
deployments list, and `deployments:details:<userSub>:<applicationName>` already covers this field;
without the details invalidation a re-opened editor would show the previous theme URL.

**Generated-client impact**: `CreateApplicationBodyDto` and `UpdateApplicationBodyDto` each gain an
optional `themeUrl?: string`. The operations `createApplication` and `updateApplication` are
otherwise unchanged; frontend callers keep using the normal (non-`Raw`) generated methods through
`apps/chat/src/server-api/applications.ts`.

Example create request:

```json
{
  "name": "Contoso App",
  "type": "https://mydial.epam.com/custom_application_schemas/quickapps2",
  "version": "1.0.0",
  "themeUrl": "https://themes.contoso.example.com"
}
```

Example update request that clears it:

```json
{
  "name": "Contoso App",
  "themeUrl": ""
}
```

Example rejection:

```json
{
  "statusCode": 400,
  "message": ["themeUrl must be an https URL"],
  "error": "Bad Request"
}
```

#### Scenario: Create with a theme URL

- **WHEN** an authenticated user POSTs an application with
  `themeUrl: "https://themes.contoso.example.com"`
- **THEN** the created DIAL Core application carries
  `catalog_properties.themeUrl = "https://themes.contoso.example.com"` and the endpoint responds
  `201` with the usual `CreatedApplicationDto`

#### Scenario: Create without a theme URL

- **WHEN** the body omits `themeUrl`
- **THEN** no `catalog_properties` key is written and behaviour is identical to today

#### Scenario: Update sets the theme URL and preserves other catalog properties

- **WHEN** the stored `catalog_properties` is `{ "provider": "Contoso" }` and the body sends
  `themeUrl: "https://themes.contoso.example.com"`
- **THEN** the persisted map is
  `{ "provider": "Contoso", "themeUrl": "https://themes.contoso.example.com" }`

#### Scenario: Update omitting the field leaves the map untouched

- **WHEN** a General-step-only save sends `name` and `iconUrl` but no `themeUrl`
- **THEN** the stored `catalog_properties` is carried through byte-for-byte, exactly as every
  existing caller already behaves

#### Scenario: Update with an empty string deletes only that key

- **WHEN** the stored map is `{ "provider": "Contoso", "themeUrl": "https://a.example.com" }` and
  the body sends `themeUrl: ""`
- **THEN** the persisted map is `{ "provider": "Contoso" }`

#### Scenario: A non-https theme URL is rejected

- **WHEN** the body sends `themeUrl: "http://themes.contoso.example.com"`
- **THEN** the endpoint responds `400` from `ValidationPipe` and no DIAL Core call is made

#### Scenario: applicationProperties semantics are unaffected

- **WHEN** a body sends both `themeUrl` and `applicationProperties`
- **THEN** `application_properties` is replaced wholesale exactly as specified today, and
  `catalog_properties` is merged, with neither field read from or written into the other

#### Scenario: The details cache is invalidated so the editor re-reads the new value

- **WHEN** an author saves a changed `themeUrl` and the editor refetches deployment details for the
  same application id
- **THEN** the response carries the new value rather than a cached previous one

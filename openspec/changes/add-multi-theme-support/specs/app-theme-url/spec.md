## ADDED Requirements

### Requirement: An application carries an optional theme URL

An application authored through the AppsEditor SHALL carry an optional `themeUrl`: an absolute
`https://` URL of a themes host serving `config.json` in the format
`docs/theme-customization.md` documents.

The value SHALL be persisted in DIAL Core's `catalog_properties` under the key `themeUrl`, **not**
in `application_properties`. `application_properties` is replaced wholesale by the Settings-step
schema editor on every save (`openspec/specs/applications-write-api/spec.md:110-132`), so a
General-step field written there would be destroyed on the author's next Settings save.

Writes to `catalog_properties` SHALL **merge**: the service reads the stored map, sets or deletes
only the `themeUrl` key, and writes the whole map back. Other keys in that map (`provider`,
`vendor`, `license`, `knowledgeCutoffDate`, `parameters`, and any the operator or DIAL Core sets)
SHALL be preserved untouched. This differs deliberately from `applicationProperties`' replacement
semantics, because chat does not own the rest of `catalog_properties`.

An empty or whitespace-only submitted value SHALL be treated as "no theme": the `themeUrl` key is
removed from `catalog_properties` rather than stored as an empty string.

#### Scenario: A theme URL is stored on create

- **WHEN** an application is created with `themeUrl: "https://themes.contoso.example.com"`
- **THEN** the application is persisted in DIAL Core with
  `catalog_properties.themeUrl = "https://themes.contoso.example.com"`

#### Scenario: Other catalog properties survive a theme URL update

- **WHEN** an application whose stored `catalog_properties` is
  `{ "provider": "Contoso", "themeUrl": "https://a.example.com" }` is updated with
  `themeUrl: "https://b.example.com"`
- **THEN** the persisted map is `{ "provider": "Contoso", "themeUrl": "https://b.example.com" }`

#### Scenario: Clearing the field removes the key

- **WHEN** an application with a stored `themeUrl` is updated with `themeUrl: ""`
- **THEN** the `themeUrl` key is absent from the persisted `catalog_properties`, and the map's other
  keys are unchanged

#### Scenario: A Settings-step save does not disturb the theme URL

- **WHEN** an author saves the Settings step, which replaces `application_properties` wholesale
- **THEN** `catalog_properties.themeUrl` is unchanged

---

### Requirement: The theme URL is validated on the way in

`themeUrl` SHALL be rejected with `400` by DTO validation unless it is absent, an empty string, or a
string that parses as an absolute URL with protocol `https:`.

Origin allow-listing is **not** enforced by the application write endpoints. A stored `themeUrl`
whose origin is not allow-listed is inert: `GET /api/v1/themes/remote` rejects it at read time (see
the `remote-theme-proxy` spec), the host keeps the base theme, and nothing breaks. Enforcing the
allowlist on write would mean an operator narrowing `THEMES_ALLOWED_ORIGINS` silently invalidates
stored applications that can no longer be saved at all.

#### Scenario: An http URL is rejected

- **WHEN** an application is created with `themeUrl: "http://themes.contoso.example.com"`
- **THEN** the endpoint responds `400` and no DIAL Core call is made

#### Scenario: A non-URL string is rejected

- **WHEN** `themeUrl` is `"not a url"`
- **THEN** the endpoint responds `400`

#### Scenario: A syntactically valid but non-allow-listed URL is accepted on write

- **WHEN** an application is saved with an `https://` `themeUrl` whose origin is not in
  `THEMES_ALLOWED_ORIGINS`
- **THEN** the save succeeds, and a later attempt to load that theme is rejected by
  `GET /api/v1/themes/remote` with `400`, leaving the base theme in place

---

### Requirement: The theme URL is readable from the deployment details response

`GET /api/v1/deployments/{deployment}/details` SHALL expose the stored value at
`applicationDetails.catalogProperties.themeUrl`, added to the existing allow-listed projection in
`mapCatalogProperties` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts:152-168`) and
to `ModelCatalogPropertiesDto`.

The mapper's existing contract is preserved: a non-string value is ignored, and
`catalogProperties` stays `undefined` when no recognised key has a value.

No new endpoint is introduced for reading an application's theme URL; the frontend already fetches
deployment details per deployment.

**Generated-client impact**: `ModelCatalogPropertiesDto` gains an optional `themeUrl?: string`.
Frontend callers use the normal generated `getDeploymentDetails` method through
`apps/chat/src/server-api/deployments.ts:12`.

Example fragment of a `200` response:

```json
{
  "id": "applications/users/u-123/contoso-app__1.0.0",
  "applicationDetails": {
    "displayName": "Contoso App",
    "catalogProperties": {
      "provider": "Contoso",
      "themeUrl": "https://themes.contoso.example.com"
    }
  }
}
```

**Cache**: no new cache. The existing `deployments:details:<userSub>:<deployment>` entry carries the
field and is already invalidated by `updateApplication`
(`openspec/specs/applications-write-api/spec.md:147-152`).

#### Scenario: A stored theme URL is returned

- **WHEN** details are requested for an application whose `catalog_properties` contains
  `themeUrl`
- **THEN** the response carries it at `applicationDetails.catalogProperties.themeUrl`

#### Scenario: An application without a theme URL

- **WHEN** details are requested for an application with no `themeUrl` and no other recognised
  catalog property
- **THEN** `applicationDetails.catalogProperties` is absent from the response

#### Scenario: A non-string stored value is ignored

- **WHEN** `catalog_properties.themeUrl` is the number `42`
- **THEN** `themeUrl` is absent from the mapped `catalogProperties`

#### Scenario: Saving the editor refreshes what details returns

- **WHEN** an author saves a new `themeUrl` and the editor re-fetches deployment details for the
  same application id
- **THEN** the new value is returned, because `updateApplication` already invalidates
  `deployments:details:<userSub>:<applicationName>`

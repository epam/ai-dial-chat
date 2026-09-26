## ADDED Requirements

### Requirement: Registry declares the applicationVisualizers key

The `CONFIG_DEFINITIONS` registry (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) SHALL include a new entry:

- `key='applicationVisualizers'`
- `type='config'`
- `valueType='json'`
- `visibility='client'`
- `defaultValue={}`
- `critical=false`
- `envVar='APPLICATION_VISUALIZERS'`
- `description` — human-readable summary of the application-scoped grouped visualizer registry, including that each entry's origin must also be listed in `ALLOWED_IFRAME_ORIGINS` and that application visualizers take precedence over `CUSTOM_VISUALIZERS` for the attachments they claim.
- `owner` — matches the ownership convention used by other registry entries.

The parsed value type MUST be `Record<string, ApplicationVisualizer>` (see the `application-visualizers` capability). Entries that fail per-entry validation SHALL be dropped with an error log at boot; total parse failure SHALL yield `{}`.

**Feature flag:** none. The registry entry is a backend implementation detail.

#### Scenario: Registry contains applicationVisualizers key

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='applicationVisualizers'`, `type='config'`, `valueType='json'`, `visibility='client'`, `envVar='APPLICATION_VISUALIZERS'`, and `defaultValue={}`

#### Scenario: Env resolves to a parsed object

- **WHEN** `APPLICATION_VISUALIZERS='{"app-1":{"title":"my-viz","url":"https://viz.example.com"}}'` and the config is resolved
- **THEN** the `applicationVisualizers` value on the resolved config equals `{ 'app-1': { title: 'my-viz', url: 'https://viz.example.com' } }`

#### Scenario: Missing env falls back to default

- **WHEN** `APPLICATION_VISUALIZERS` is unset
- **THEN** the `applicationVisualizers` value on the resolved config equals `{}`

---

### Requirement: EnvConfigProvider parses APPLICATION_VISUALIZERS fail-open

`EnvConfigProvider` (`apps/chat-api/src/app-config/config-registry/env-config.provider.ts`) SHALL resolve `applicationVisualizers` through a dedicated `parseApplicationVisualizers` method, structurally mirroring the existing `parseCustomVisualizers`:

- Unparseable JSON SHALL log an error and resolve to `{}`.
- A parsed value that is not a plain object — including an array or `null` — SHALL log an error and resolve to `{}`.
- Each value SHALL be validated independently via `plainToInstance(ApplicationVisualizerDto, …)` + `validateSync`. A failing entry SHALL be dropped with an error log naming its key; the remaining entries SHALL still resolve.
- A value that is not an object SHALL be dropped with an error log naming its key.
- When an entry declares `contentType`, it SHALL be dropped with an error log if splitting on `,` and trimming yields no non-empty MIME type. An entry that omits `contentType` SHALL NOT be subject to this check.
- `title` SHALL NOT be trimmed or normalised — it is an opaque postMessage namespace, and a whitespace-only value is a legitimate `appName` for some deployed visualizers. Only absent and empty-string titles are rejected, by `@IsNotEmpty()` on the DTO.
- Unrecognised fields on an entry SHALL be logged as a warning listing their names and then ignored; they MUST NOT cause the entry to be dropped.

Boot MUST NOT fail for any of these cases.

Additionally, the provider SHALL log a warning when a surviving entry's URL origin is absent from `ALLOWED_IFRAME_ORIGINS`, naming the entry key and the missing origin. The entry is still returned — CSP, not this provider, is what blocks the iframe — but the warning gives the operator the only server-side signal of a misconfiguration that is otherwise invisible in the browser.

`ApplicationVisualizerDto` (`apps/chat-api/src/app-config/dto/application-visualizer.dto.ts`) SHALL mirror `CustomVisualizerDto` with `contentType` optional, and SHALL carry full `@ApiProperty` metadata on every field.

#### Scenario: Invalid JSON resolves to an empty registry

- **WHEN** `APPLICATION_VISUALIZERS` is `'not-json'`
- **THEN** `resolve('applicationVisualizers', ctx)` returns `{}`
- **AND** an error is logged

#### Scenario: A JSON array is rejected

- **WHEN** `APPLICATION_VISUALIZERS` is `'[{"title":"my-viz","url":"https://viz.example.com"}]'`
- **THEN** `resolve('applicationVisualizers', ctx)` returns `{}`
- **AND** an error is logged stating the value must be a JSON object

#### Scenario: One invalid entry does not drop the others

- **WHEN** the object contains a valid entry under `app-1` and an entry under `app-2` whose `url` is not an absolute HTTP(S) URL
- **THEN** the resolved registry contains only `app-1`
- **AND** an error naming `app-2` is logged

#### Scenario: Entry without contentType is accepted

- **WHEN** an entry declares `title` and `url` but no `contentType`
- **THEN** the entry is accepted with `contentType` absent

#### Scenario: Entry with an unusable contentType is dropped

- **WHEN** an entry declares `contentType: " , "`
- **THEN** the entry is dropped with an error log

#### Scenario: Whitespace-only title is preserved

- **WHEN** an entry's `title` is `" "`
- **THEN** the entry is accepted and `title` is preserved verbatim, including its whitespace
- **AND** no error is logged

#### Scenario: Unknown fields are warned about and ignored

- **WHEN** an entry carries `expanded: true`
- **THEN** the entry is still accepted
- **AND** a warning naming `expanded` as an ignored field is logged

#### Scenario: Origin missing from the iframe allowlist is warned about

- **WHEN** a valid entry's `url` is `https://viz.example.com` and `ALLOWED_IFRAME_ORIGINS` does not contain that origin
- **THEN** the entry is still returned in the resolved registry
- **AND** a warning naming the entry key and the missing origin is logged

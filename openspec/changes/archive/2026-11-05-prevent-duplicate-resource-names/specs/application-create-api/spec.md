# Spec Delta

## MODIFIED Requirements

### Requirement: Safe template creation

A caller MAY set `createOnly: true` to send `If-None-Match: *` on the DIAL Core write. Core SHALL check existence atomically with the write. The storage path is derived from
the name at creation and does not follow a later rename, so a taken path does not mean
an app with that name is visible to the user. Whether an entity with the same displayed name
and version already exists is decided first, by the duplicate check of the
`resource-name-uniqueness` capability, which rejects with `409` before any write. Only once
that check passes, on Core's 412 precondition failure the BFF
SHALL retry at the next candidate path (`<name>-2__<version>`, `<name>-3__<version>`, …,
up to 20 candidates in total), each attempt again with `If-None-Match: *`, keeping the
display name the caller supplied and returning the `id` of the path actually created.
The retry therefore only places a new application next to an entity whose displayed
identity differs (a renamed application still holding the original path) or next to a
concurrent create that raced the check.
Only when every candidate is taken SHALL the BFF respond 409, without invalidating caches.
Any other Core error is not retried. Omitting the option retains legacy unconditional
write semantics.

A caller MAY set `preserveApplicationProperties: true` to store `applicationProperties`
verbatim, including keys named `features`, `endpoint`, `inputAttachmentTypes`, and
`maxInputAttachments`. No schema settings SHALL be hoisted in this mode. Top-level
`inputAttachmentTypes` and `maxInputAttachments` configure Core capabilities separately;
they take precedence over legacy nested capability values when both are provided.
Top-level `features` likewise configures Core features separately from schema features: it
takes precedence over a hoisted `applicationProperties.features`, is stored as supplied, and
disables the Quick App `system_prompt_supported: false` creation default, so a caller copying a
template's features keeps a flag the template leaves unset absent.
The Quick App Core `skills_supported` flag remains enabled independently of schema features.
The `createApplication` operation and generated client SHALL expose these optional fields.

#### Scenario: Concurrent creation with the same name
- **WHEN** two callers create the same name/version with `createOnly: true` at the same moment and both pass the duplicate check
- **THEN** neither write replaces the other: the first takes `<name>__<version>` and the second is created at `<name>-2__<version>`

#### Scenario: Name of a renamed app is reused
- **WHEN** an app created as `Test_QuickApp` was later renamed, and a caller creates a new app named `Test_QuickApp` with `createOnly: true`
- **THEN** the renamed app is untouched and the new app is created at the next free path with the display name `Test_QuickApp`

#### Scenario: Same displayed identity is rejected, not suffixed
- **WHEN** an own app displayed as `Test_QuickApp` version `1.0.0` exists in the same folder and a caller creates another with `createOnly: true`
- **THEN** the response is `409` with `code` `name-taken-agent` and no `-2` path is created

#### Scenario: Every candidate path is taken
- **WHEN** all 20 candidate paths respond 412
- **THEN** the endpoint responds 409 and neither cache is invalidated

#### Scenario: Template includes hidden settings
- **WHEN** a caller sets `preserveApplicationProperties: true` and supplies schema features
- **THEN** those features and unknown settings are retained under `application_properties`
- **AND** top-level attachment capabilities do not replace same-named schema settings

#### Scenario: Explicit top-level features are stored as supplied
- **WHEN** a Quick App create supplies top-level `features: { tools_supported: true }` with `preserveApplicationProperties: true` and a nested `applicationProperties.features`
- **THEN** the DIAL Core body's top-level `features` is `{ tools_supported: true, skills_supported: true }` without `system_prompt_supported`
- **AND** the nested `features` stays under `application_properties`

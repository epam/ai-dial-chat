# managed-config-schema-artifact Specification

## Purpose

The deterministic generation of Chat's managed-configuration JSON Schema from the registry, the committed per-version artifact files and `index.json` with Studio's canonical SHA-256, the drift and frozen-version checks, the semantic-version bump rules, and what distribution the artifact does and does not authorize.

## Requirements
### Requirement: Deterministic schema generation from the registry

Chat SHALL generate the managed-configuration schema only from the registry's managed entries and contract constants. It SHALL read no environment variable, `.env` file or `ConfigService` value, and SHALL start no application module. Generating twice from the same registry SHALL produce deep-equal output. The schema SHALL be a JSON Schema 2020-12 document that meets all of the following:

- it declares `"$schema": "https://json-schema.org/draft/2020-12/schema"` and a root `$id` of `urn:dial:chat-ui:managed-config:<schemaVersion>`;
- its root `type` is `object`;
- every `$ref` points inside the document (`#/...`) and no nested `$id` exists;
- it uses `dial:meta` with a nested `dial:propertyOrder`, `title`, `description` and, for hidden keys only, `isHidden: true` as editor annotations;
- each `default` comes from the registry and validates against its own schema;
- its canonical serialization is at most 57,344 bytes.

The schema SHALL compile under Ajv 2020 with `strict: false`, `allErrors: true` and `validateFormats: false`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Repeated generation

- **WHEN** the generator runs twice without registry changes
- **THEN** both outputs are deep-equal

#### Scenario: Environment cannot leak

- **WHEN** the generator runs with `ANNOUNCEMENT_TITLE`, `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT=90` and `DIAL_API_KEY` set in the process environment
- **THEN** the output is deep-equal to a run without them, and no environment value or secret appears in it

#### Scenario: Structural acceptance

- **WHEN** the generated schema is checked with Studio's rules
- **THEN** it has an object root, only internal references and no nested `$id`, compiles, and measures at most 57,344 canonical bytes

#### Scenario: Size budget is measured

- **WHEN** the artifact test runs
- **THEN** it records the canonical byte size in `index.json` and fails if the size exceeds 57,344 bytes

### Requirement: Artifact files and index

Each schema version SHALL be committed in `apps/chat-api/managed-config-schema/` as `chat-ui-<schemaVersion>.json`. The file SHALL contain exactly the members `appId` (`chat-ui`), `schemaVersion` and `schema`, the same members as Config Studio's schema upload body except its client-supplied `operationId`. The same directory SHALL contain `index.json`:

```json
{
  "format": "dial-managed-config-schema-index@1",
  "appId": "chat-ui",
  "current": "1.0.0",
  "supported": ["1.0.0"],
  "versions": [
    {
      "schemaVersion": "1.0.0",
      "file": "chat-ui-1.0.0.json",
      "schemaSha256": "<lowercase hex SHA-256 of the canonical schema>",
      "canonicalBytes": 5161
    }
  ]
}
```

`schemaSha256` SHALL be the SHA-256 of the canonical JSON of `schema`: object keys sorted at every level in ascending UTF-16 code-unit order, primitives serialized as by `JSON.stringify`, and no whitespace. This is the same value Config Studio returns after an upload and records with every publication. A test SHALL keep this algorithm aligned with the fixed vector `{"b":1,"a":[{"d":"x","c":null}],"é":"ü"}` → `b69925e54531b6b61268fda5dca74b8d1eb6d566616ec5932258abac6c9edde0`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Uploadable without editing

- **WHEN** a schema manager posts the contents of `chat-ui-1.0.0.json` plus a new `operationId` to a `chat-ui` instance's `POST /v1/schema-validations`
- **THEN** the result is `{ "valid": true, "errors": [] }`

#### Scenario: Checksum matches Studio

- **WHEN** the same body is uploaded with `POST /v1/schemas`
- **THEN** the returned `sha256` equals the version's `schemaSha256` in `index.json`

#### Scenario: Canonical vector

- **WHEN** Chat's canonicalizer hashes the fixed vector
- **THEN** the digest is `b69925e54531b6b61268fda5dca74b8d1eb6d566616ec5932258abac6c9edde0`

### Requirement: Committed artifacts stay tied to the registry and released versions stay frozen

A test in the default test run SHALL fail in any of these cases:

- the current version's committed file differs from the generator output;
- any committed version file does not hash to its `index.json` entry;
- the index does not list exactly the committed files;
- `current` is not the highest listed version;
- `supported` differs from the build's supported-version list.

A version that is part of a Chat release SHALL never be modified; any correction SHALL be a new version.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Registry changed without regeneration

- **WHEN** a managed key's bound is changed in the registry and the artifact is not regenerated
- **THEN** the artifact test fails

#### Scenario: Released file edited alone

- **WHEN** `chat-ui-1.0.0.json` is edited without changing its index entry
- **THEN** the artifact test fails

### Requirement: Schema versioning and compatibility

`schemaVersion` SHALL be `MAJOR.MINOR.PATCH` with components of at most six digits and no leading zeros, independent of Chat's release version. The bump rules are:

- **PATCH:** only annotations change (`title`, `description`, `dial:meta`, `isHidden`, `default`, the `dial:semanticConstraints` text), and the set of valid payloads is unchanged.
- **MINOR:** the set of valid payloads grows, and every payload valid under the previous version stays valid.
- **MAJOR:** anything else, including removing a key, narrowing a bound, changing a type or meaning, adding a required member, or adding any feature-policy member.

The artifact test SHALL compare the schema with the previous committed version and fail when:

- a difference outside annotation keywords is not at least a MINOR bump;
- a removed property or a newly required member is not a MAJOR bump;
- a MINOR successor rejects any of the previous version's valid contract fixtures.

A Chat build SHALL declare the exact list of schema versions it accepts. For this change the list is `["1.0.0"]`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Annotation-only change

- **WHEN** only a managed key's description changes
- **THEN** a PATCH bump satisfies the test

#### Scenario: Narrowed bound under a minor bump

- **WHEN** `announcement.title` `maxLength` drops from 200 to 100 and the version is bumped from 1.0.0 to 1.1.0
- **THEN** the artifact test fails because previous fixtures no longer validate

#### Scenario: Removed key under a minor bump

- **WHEN** a managed key is removed and the version is bumped only to 1.1.0
- **THEN** the artifact test fails and requires 2.0.0

### Requirement: Distribution and provenance

The trusted source of a schema version SHALL be its file and `index.json` entry at an `epam/ai-dial-chat` release tag, reached through the normal reviewed pull-request process. Config Studio SHALL NOT need Chat source, a Chat build, or a running Chat deployment to obtain or use the artifact. Integrity SHALL be verifiable by comparing Studio's upload `sha256` with `schemaSha256`. Creating and committing artifact files SHALL be part of implementation. Attaching them to a release, signing them, publishing them to a package registry, or uploading them into any Config Studio instance SHALL each require separate authorization.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Operator verifies an upload

- **WHEN** an operator uploads `chat-ui-1.0.0.json` from a Chat release tag into an instance
- **THEN** the `sha256` Studio returns equals that tag's `index.json` `schemaSha256`, and any difference means the uploaded schema is not the released artifact


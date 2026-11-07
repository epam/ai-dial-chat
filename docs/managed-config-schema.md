# Managed configuration schema

DIAL Config Studio keeps one immutable JSON Schema per version in every runner
instance and validates each publication against that exact version. For
`chat-ui` instances, the schema is generated from Chat's configuration
registry, `CONFIG_DEFINITIONS` in
[`config-registry.constants.ts`](../apps/chat-api/src/app-config/config-registry/config-registry.constants.ts),
and committed in
[`apps/chat-api/managed-config-schema/`](../apps/chat-api/managed-config-schema/).
Studio consumes only those JSON files. It needs no Chat source, no Chat build
and no running Chat deployment.

## Export is not activation

`managed: true` puts a key into the exported contract and nothing else. Chat
has no managed-config reader today. No resolved value, client-config field,
feature-flag result or cache entry depends on the flag, and a test strips every
managed field from the registry and compares the results. Activation (shadow
reads, then per-key opt-in) will be its own deployment control. That change
must not treat `managed` as permission to read.

The schema's root description tells operators that a deployment applies the
values only once its managed reading is enabled.

## Classifying a registry key

Every `ConfigDefinition` is in exactly one class. A registry test fails when a
key is unclassified or in two classes.

| Class                  | Registry fields                         | Exported |
| ---------------------- | --------------------------------------- | -------- |
| Managed                | `managed: true` and a `managedContract` | Yes      |
| Local-only             | `localOnly: LocalOnlyReason.<Reason>`   | Never    |
| Eligible but unmanaged | neither                                 | No       |

A key is local-only when a remote value would bypass a local dependency:

| `LocalOnlyReason`        | Meaning                                                  | Examples                                                               |
| ------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `capability`             | Needs a local model, credential, service or Core feature | `asr.modelId`, `features.asrEnabled`, `features.llmConversationNaming` |
| `deployment-topology`    | A URL of this deployment                                 | `dialCore.externalUrl`, `mcpApps.sandboxUrl`                           |
| `security-policy`        | CSP, iframe, embedding, HTML or external content         | `overlay.allowedOrigins`, `customVisualizers`, `announcement.html`     |
| `backend-enforced-limit` | Must equal a limit the BFF enforces                      | `attachments.maxFileSizeBytes`, `projects.contextFileMaxBytes`         |
| `build-metadata`         | Stamped by the release pipeline                          | `app.version`                                                          |
| `derived`                | Computed from another local value                        | `features.footer`                                                      |
| `opaque`                 | Client-owned JSON with no declared schema                | `customVariables`                                                      |

Schema version 1.0.0 manages seven keys: `announcement.title`,
`announcement.description`, `announcement.items`, `welcomeScreen.description`,
`fileManager.availableTabs`, `usageLimits.warningThresholdPercent` and the
feature `features.usageLimitsControl`. The other 14 keys are eligible but
unmanaged. `features.scheduledTasksEnabled`, `features.projectsEnabled`,
`footer.html` and `uiFeatures.enabledUiFeatures` are the next candidates, and
each needs its own schema version.

### Opting a key in

1. Set `managed: true` and add a `managedContract` to the key's registry entry:
   - `title`: an operator-facing English label;
   - `description`: operator-facing English help, with no environment-variable
     name, environment value, secret or deployment URL (a test checks every
     `EnvironmentVariables` name);
   - `order`: the position within its section;
   - `isHidden`: optional, exported as `isHidden: true`;
   - `value`: a `ManagedValueSchema`. It is required for a config key and
     absent for a feature, whose value is always a feature state.
2. Bound every string (`maxLength` or `enum`) and every array (`maxItems`).
   `ManagedValueSchema` allows only keywords Studio's Ajv enforces with
   `validateFormats: false`. It has no `$ref`, `$id` or `format`.
3. Bump `MANAGED_CONFIG_SCHEMA_VERSION` (see below), add the new version to
   `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS`, and run
   `npm run managed-config-schema`.
4. Add the version's contract fixtures under
   `apps/chat-api/src/app-config/tests/managed-config/fixtures/`.

The managed bounds apply only to managed admission. Environment variables keep
their existing fail-open parsing: a 300-character `ANNOUNCEMENT_TITLE` still
works. Moving a key from ENV to managed values means fitting its bounds.

## Payload contract

A publication is `{ "config": { … }, "features": { … } }`. Both members are
required and may be empty. Members use full registry keys, and anything
undeclared is rejected.

```json
{
  "config": { "usageLimits.warningThresholdPercent": 80 },
  "features": {
    "features.usageLimitsControl": {
      "enabled": true,
      "availability": { "startsAt": "2026-11-01T08:00:00Z" },
      "targeting": { "roles": ["beta-tester"] }
    }
  }
}
```

- A config value is a plain JSON value, never `null`. To fall back to the
  registry default, omit the key.
- A feature state is `{ enabled, availability?, targeting? }`.
  - `availability` has at least one of `startsAt` (inclusive) and `endsAt`
    (exclusive). Each is `YYYY-MM-DDTHH:MM:SS[.fff]Z`, in UTC only.
  - `targeting.roles` holds 1–50 distinct roles, each 1–128 characters with no
    whitespace or comma. Omit `targeting` for no restriction.
- Two rules JSON Schema cannot express are listed in the schema's
  `dial:semanticConstraints` and checked by `validateManagedSemantics`:
  `calendar_date` (the date exists) and `window_order` (`startsAt` before
  `endsAt`).
- Identity, schema version and revision are not in the payload. Studio's
  revision envelope carries them, and `checkManagedSnapshot` defines the checks
  a future reader applies.

## Artifact and index

Each version is committed as `chat-ui-<schemaVersion>.json`. It holds exactly
`{ appId, schemaVersion, schema }`, which is Studio's schema upload body
without the client-supplied `operationId`. `index.json` sits next to it:

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
      "schemaSha256": "9e2155b7857adf6cc51e8966ad02ebf79953c5a87875eaea929e384c02b55dd6",
      "canonicalBytes": 5161
    }
  ]
}
```

`schemaSha256` is the SHA-256 of the canonical JSON of `schema`. That is
Studio's algorithm: object keys sorted at every level in UTF-16 code-unit
order, primitives as `JSON.stringify` writes them, and no whitespace. It is
the `sha256` Studio returns after an upload, and the `schemaSha256` of every
revision published against it. `canonicalBytes` is measured over the same
bytes and must stay at or below Studio's 57,344-byte limit. A file-byte
checksum is deliberately absent, because Prettier may reformat the file.

The generator, `apps/chat-api/src/managed-config-schema.ts`, imports only the
registry and the managed-config modules. It starts no Nest application and
reads no environment variable, `.env` file or `ConfigService` value, so nothing
from the machine running it reaches the artifact. It regenerates the current
version, reads older committed versions back unchanged, and rewrites
`index.json`:

```sh
npm run managed-config-schema   # nx run chat-api:managed-config-schema
```

`managed-config-artifact.spec.ts` runs in the normal test job and fails when:

- the current file differs from the generator output (a registry change was
  not regenerated);
- a committed file does not hash to its index entry (a file was edited without
  its index entry);
- the index does not list exactly the committed files;
- `current` is not the highest version;
- `supported` differs from `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS`.

## Versioning

`schemaVersion` is the contract's own `MAJOR.MINOR.PATCH`, with each component
at most six digits and no leading zeros. It is independent of Chat's release
version.

| Bump  | When                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PATCH | Only annotations change: `title`, `description`, `dial:meta`, `isHidden`, `default`, the `dial:semanticConstraints` text                                     |
| MINOR | The set of valid payloads only grows, for example a new optional key or a widened bound                                                                      |
| MAJOR | Anything that rejects or reinterprets a valid payload: a removed key, a narrowed bound, a changed type, a new required member, any new feature-policy member |

A new policy member is MAJOR because a reader that ignores it would silently
weaken the policy. Between consecutive committed versions, the artifact test
enforces three rules:

1. A non-annotation difference needs at least a MINOR bump.
2. A removed property, a newly required member or a new feature-policy member
   needs a MAJOR bump.
3. A MINOR or PATCH successor accepts every valid fixture of the previous
   version.

Rule 3 is a fixture-based check of the superset rule, not a proof. Review
stays responsible for semantics.

**Released versions are frozen.** A version that was part of a Chat release
tag is never edited; a correction is a new version. The hash test catches an
edit without its index entry. Changing both the file and its index entry is a
review-blocking change, because tests cannot see Git history. A future reader
also rejects any snapshot whose `schemaSha256` differs from Chat's own hash for
that version.

## Verifying an upload

The trusted source of a version is its file and `index.json` entry at an
`epam/ai-dial-chat` release tag. To install it in a `chat-ui` instance:

1. Post the contents of `chat-ui-<version>.json`, plus a new `operationId`, to
   `POST /v1/schema-validations`. The expected result is
   `{ "valid": true, "errors": [] }`.
2. Post the same body to `POST /v1/schemas`.
3. Compare the returned `sha256` with that version's `schemaSha256` in the
   tag's `index.json`. Any difference means the uploaded schema is not the
   released artifact.

## Application identifiers

A BFF deployment serves the identifiers listed in `CLIENT_CONFIG_APP_IDS`
(default `chat-ui`), and `GET /api/v1/client-config` accepts only those as
`appId`. Each identifier uses the pattern Config Studio enforces for an
instance's `appId`, `^[a-z0-9][a-z0-9-]{0,62}$`, so each served identifier can
map to its own Config Studio instance.

- Only `chat-ui` has Chat-owned typed fields, and this repository publishes
  only the `chat-ui` schema. Launchpad, Models Garden and Config Studio own
  their contracts and schemas in their own repositories.
- Today every served identifier receives the same ENV-driven `features` and
  `config`, with its own echoed `appId` and its own cache entry.
- Server-side feature gates (`FeatureGuard`, text refinement) always evaluate
  as `chat-ui`, because they protect Chat BFF endpoints.

The runtime reader does not exist yet. When it is added, `chat-ui` values will
feed the existing typed fields under this schema, and a payload published for
another served identifier will be returned unchanged in a new optional
`appConfig` field. The BFF will check that payload's identity, schema hash and
size but not its schema. The application validates it against its own contract.

## Not authorized by this contract

Committing the artifact files is part of Chat's normal pull-request process.
Each of the following needs separate authorization:

- attaching the files to a GitHub release;
- signing them;
- publishing them to a package registry;
- uploading them into any Config Studio instance.

## Related environment resolution

The registry work that made export possible also changed how ENV values are
selected, with unchanged effective values:

- `validate()` (`apps/chat-api/src/config/validation.ts`) records which
  variables were present in the raw environment. `EnvConfigProvider` returns a
  value from a key's own variable, or reads its allowed-roles variable, only
  when the variable is explicit. A typed default such as
  `SCHEDULED_TASKS_ENABLED = false` therefore falls through to the registry
  default.
- Environment parsing lives in pure functions under
  `apps/chat-api/src/app-config/env-admission/`, and the capability rules
  (ASR, conversation naming, footer) in `feature-capabilities.ts`.
- `AppConfigService` applies the deployment role gate
  (`deployment-role-gate.ts`) once, after selection, on every resolution path.
  No source can bypass it by returning `true`.

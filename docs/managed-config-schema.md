# Managed configuration schema

DIAL Config Studio keeps one immutable JSON Schema per version in every runner
instance and validates each publication against that exact version. For
`ai-dial-chat` instances, the schema is generated from Chat's configuration
registry, `CONFIG_DEFINITIONS` in
[`config-registry.constants.ts`](../apps/chat-api/src/app-config/config-registry/config-registry.constants.ts),
and committed in
[`apps/chat-api/managed-config-schema/`](../apps/chat-api/managed-config-schema/).
Studio consumes only those JSON files. It needs no Chat source, no Chat build
and no running Chat deployment.

## Export is not activation

A managed `management` entry puts a key into the exported contract and nothing
else. No effective value, client-config field, feature-flag result or cache
entry depends on it, and a test strips `management` from every registry entry
and compares the results. Reading published snapshots is a separate deployment
control, described in
[Runtime reading and activation](#runtime-reading-and-activation).
The one provider-level difference is that a blank managed text from ENV
resolves to `undefined` instead of `""` (see
[Related environment resolution](#related-environment-resolution)); the
client-config field is `null` either way. Schema 1.0.0 manages no text key,
so this difference applies to no key today. A managed classification only makes
a key eligible for `MANAGED_CONFIG_ACTIVE_KEYS`; it is never permission to read.

The schema's root description tells operators that a deployment applies the
values only once its managed reading is enabled.

## Classifying a registry key

Every `ConfigDefinition` is in exactly one class, set by its single
`management` field. The field is a discriminated union, so a key cannot be in
two classes, and a managed config key cannot omit its value schema. The
helpers live in `managed-config/key-management.ts`.

| Class                  | `management`                             | Exported |
| ---------------------- | ---------------------------------------- | -------- |
| Managed config key     | `managedConfigKey({ title, …, value })`  | Yes      |
| Managed feature        | `managedFeatureKey({ title, … })`        | Yes      |
| Local-only             | `localOnlyKey(LocalOnlyReason.<Reason>)` | Never    |
| Eligible but unmanaged | absent                                   | No       |

A registry test fails when a managed kind does not match the entry's `type`.

A key is local-only when it depends on something only the deployment provides
or enforces, even when the deployment already degrades safely without it:

| `LocalOnlyReason`        | Meaning                                                  | Examples                                                                                                                                        |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `capability`             | Needs a local model, credential, service or Core feature | `asr.modelId`, `features.llmConversationNaming`, `features.scheduledTasksEnabled` (DIAL Scheduler), `features.orgUnitsEnabled` (Core org units) |
| `deployment-topology`    | A URL of this deployment                                 | `dialCore.externalUrl`, `mcpApps.sandboxUrl`                                                                                                    |
| `security-policy`        | CSP, iframe, embedding, HTML or external content         | `overlay.allowedOrigins`, `customVisualizers`, `announcement.html`                                                                              |
| `backend-enforced-limit` | Must equal a limit the BFF enforces                      | `attachments.maxFileSizeBytes`, `projects.contextFileMaxBytes`                                                                                  |
| `build-metadata`         | Stamped by the release pipeline                          | `app.version`                                                                                                                                   |
| `derived`                | Computed from another local value                        | `features.footer`                                                                                                                               |
| `opaque`                 | Client-owned JSON with no declared schema                | `customVariables`                                                                                                                               |

Schema version 1.0.0 manages one key, the onboarding tour `onboarding.hints`
(see [The onboarding tour](#the-onboarding-tour)), and no feature. Thirty-one
keys are local-only, and the other 19 are eligible but unmanaged.

### Rollout

Each step is a separate change with its own schema version. The first
schema an `ai-dial-chat` instance receives manages only the onboarding tour;
the keys managed before it come back in the next version.

| Schema | Keys                                                                                                                                                                                                                                                                                   | Needs first                                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0  | `onboarding.hints`                                                                                                                                                                                                                                                                     | Nothing                                                                                                                                                 |
| 1.1.0  | `announcement.title`, `announcement.description`, `announcement.items` with `severity` on its entries, `welcomeScreen.description`, `fileManager.availableTabs`, `usageLimits.warningThresholdPercent`, `usageLimits.spendingLimitsMode` and the feature `features.usageLimitsControl` | Nothing. Activating `features.usageLimitsControl` needs Config Studio to enforce `calendar_date` and `window_order`                                     |
| Next   | `ui.celebrationsEnabledByDefault`, `ui.activeEventId`, `mcpApps.theme`                                                                                                                                                                                                                 | Nothing                                                                                                                                                 |
| Next   | `features.projectsEnabled`                                                                                                                                                                                                                                                             | `features.usageLimitsControl` active on a deployment, proving the managed feature path                                                                  |
| Next   | `footer.html`; `uiFeatures.enabledUiFeatures`; `deployments.defaultDeploymentId` with `features.defaultDeploymentPinned`                                                                                                                                                               | Footer: `features.footer` derived from the effective `footer.html`, decided together with `announcement.html`. The deployment pair moves in one version |

The keys of 1.1.0 were managed by a 1.0.0 and a 1.1.0 that no Chat release or
Config Studio instance ever carried; both were replaced before the first
upload.

The two rules for the footer and the deployment pair are contract
requirements, and registry tests fail when a version breaks them. The other
"needs first" entries are delivery order, not code conditions.

`features.scheduledTasksEnabled` is local-only because it needs the DIAL
Scheduler. Making it manageable means changing the `capability` rule above, not
only adding a capability check. `mcpApps.hostName`, `mcpApps.userAgent` and
`content.additionalLocales` are eligible but not planned. Making a key managed
still does not activate it (see
[Runtime reading and activation](#runtime-reading-and-activation)).

### Opting a key in

1. Set the key's `management` to `managedConfigKey({ … })` for a config key or
   `managedFeatureKey({ … })` for a feature:
   - `title`: an operator-facing English label;
   - `description`: operator-facing English help, with no environment-variable
     name, environment value, secret or deployment URL (a test checks every
     `EnvironmentVariables` name);
   - `order`: the position within its section;
   - `isHidden`: optional, exported as `isHidden: true`;
   - `value` (config keys only): a `ManagedValueSchema`. A feature has none,
     because its value is always a feature state.
2. Bound every string (`maxLength` or `enum`) and every array (`maxItems`).
   `ManagedValueSchema` allows only keywords Studio's Ajv enforces with
   `validateFormats: false`. It has no `$ref`, `$id` or `format`.
3. Bump `MANAGED_CONFIG_SCHEMA_VERSION` (see below), add the new version to
   `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS`, and run
   `npm run managed-config-schema`. It prints the new version's hash; pin it by
   hand in `PINNED_MANAGED_CONFIG_SCHEMA_SHA256`.
4. Add the version's contract fixtures under
   `apps/chat-api/src/app-config/tests/managed-config/fixtures/`.

The managed bounds apply only to managed admission. Environment variables keep
their existing fail-open parsing: `ONBOARDING_HINTS` with 60 hints or a
300-character title still works. Moving a key from ENV to managed values means
fitting its bounds.

### The onboarding tour

`onboarding.hints` is the first-visit onboarding tour that `ONBOARDING_HINTS`
configures (see the variable in
[`apps/chat-api/README.md`](../apps/chat-api/README.md#environment-variables)).
Its managed value mirrors `normalizeOnboardingHints`
(`apps/chat-api/src/app-config/onboarding-hints.normalizer.ts`):

| Member        | Rule                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------- |
| the array     | At most 50 hints. The order is the tour order.                                              |
| a hint        | `{ id, target, title, description? }`; any other member is rejected                         |
| `id`          | Required; `^[A-Za-z0-9._-]{1,64}$`                                                          |
| `target`      | Required; one of the anchors in [onboarding anchors](onboarding-anchors.md), a plain `enum` |
| `title`       | Required; 1–100 characters, not only whitespace                                             |
| `description` | Optional; at most 500 characters                                                            |

- **Repeated ids.** JSON Schema cannot require distinct ids across the hints,
  so the schema accepts a repeated id. Chat keeps the first hint with an id
  and drops later ones with a warning, exactly as for `ONBOARDING_HINTS`.
- **Seen hints are remembered per browser.** The browser stores the ids it
  has shown in `localStorage`. A new or changed id shows that hint again to
  every user; editing a title or description, or reordering hints, does not.
- **A new anchor needs a new schema version.** The `target` enum is generated
  from `OnboardingHintTarget`. Adding an anchor changes the generated schema,
  so the artifact test fails until `MANAGED_CONFIG_SCHEMA_VERSION` gets a
  MINOR bump, and Config Studio editors can use the anchor only once that
  version is uploaded. Until then only `ONBOARDING_HINTS` can point at it.
- **`pages` is environment-only for now.** `ONBOARDING_HINTS` entries can
  carry `pages` (an `OnboardingHintPage` list) to limit a hint to those
  pages. Schema 1.0.0 predates the member and rejects it, so a published
  hint has no `pages` and shows on the home page only. Adding it to the
  managed schema needs a MINOR bump like a new anchor.

## Payload contract

A publication is `{ "config": { … }, "features": { … } }`. Both members are
required and may be empty. Members use full registry keys, and anything
undeclared is rejected.

```json
{
  "config": {
    "onboarding.hints": [
      {
        "id": "tour.composer",
        "target": "conversation-input",
        "title": "Ask anything",
        "description": "Type a question or attach files."
      },
      {
        "id": "tour.new-chat",
        "target": "new-chat",
        "title": "Start a new chat"
      }
    ]
  },
  "features": {}
}
```

- A config value is a plain JSON value, never `null`. To fall back to the
  registry default, omit the key.
- A feature state is `{ enabled, availability?, targeting? }`. Schema 1.0.0
  exports no feature, but it exports this state as `$defs/featureState`, and
  every feature of a later version references it.
  - `availability` has at least one of `startsAt` (inclusive) and `endsAt`
    (exclusive). Each is `YYYY-MM-DDTHH:MM:SS[.fff]Z`, in UTC only.
  - `targeting.roles` holds 1–50 distinct roles, each 1–128 characters with no
    whitespace or comma. Omit `targeting` for no restriction.
- Two rules JSON Schema cannot express are listed in the schema's
  `dial:semanticConstraints` and checked by `validateManagedSemantics`:
  `calendar_date` (the date exists) and `window_order` (`startsAt` before
  `endsAt`).
- Identity, schema version and revision are not in the payload. Studio's
  revision envelope carries them. The checks a reader applies to that envelope
  belong to the reader change.

## Artifact and index

Each version is committed as `ai-dial-chat-<schemaVersion>.json`. It holds exactly
`{ appId, schemaVersion, schema }`, which is Studio's schema upload body
without the client-supplied `operationId`. `index.json` sits next to it:

```json
{
  "format": "dial-managed-config-schema-index@1",
  "appId": "ai-dial-chat",
  "current": "1.0.0",
  "supported": ["1.0.0"],
  "versions": [
    {
      "schemaVersion": "1.0.0",
      "file": "ai-dial-chat-1.0.0.json",
      "schemaSha256": "edbe9267f6663eb7768ae7e2033e20b0b3c842994224a774968d348e3b9be71f",
      "canonicalBytes": 5259
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
`index.json`. It refuses to write a version pinned in
`PINNED_MANAGED_CONFIG_SCHEMA_SHA256` (`managed-config.constants.ts`) whose
generated hash differs from its pin:

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
- `supported` differs from `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS`;
- the committed versions and hashes differ from
  `PINNED_MANAGED_CONFIG_SCHEMA_SHA256`.

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

**Pinned versions are frozen.** Every committed version's hash is pinned by
hand in `PINNED_MANAGED_CONFIG_SCHEMA_SHA256`, which the generator never
writes. A correction, an annotation change included, is a new version with its
own pin. The generator refuses to rewrite a pinned version, the hash test
catches a file edited without its index entry, and the pin test catches a file
and index entry edited together. Changing a pin is the only way to change a
committed version, and it is a review-blocking change once the version has
been part of a Chat release tag.

## Verifying an upload

The trusted source of a version is its file and `index.json` entry at an
`epam/ai-dial-chat` release tag. To install it in a `ai-dial-chat` instance:

1. Post the contents of `ai-dial-chat-<version>.json`, plus a new `operationId`, to
   `POST /v1/schema-validations`. The expected result is
   `{ "valid": true, "errors": [] }`.
2. Post the same body to `POST /v1/schemas`.
3. Compare the returned `sha256` with that version's `schemaSha256` in the
   tag's `index.json`. Any difference means the uploaded schema is not the
   released artifact.

## Application identifiers

A BFF deployment serves the identifiers listed in `CLIENT_CONFIG_APP_IDS`
(default `ai-dial-chat`), and `GET /api/v1/client-config` accepts only those as
`appId`. Each identifier uses the pattern Config Studio enforces for an
instance's `appId`, `^[a-z0-9][a-z0-9-]{0,62}$`, so each served identifier can
map to its own Config Studio instance.

- Only `ai-dial-chat` has Chat-owned typed fields, and this repository publishes
  only the `ai-dial-chat` schema. Launchpad, Models Garden and Config Studio own
  their contracts and schemas in their own repositories.
- Every served identifier receives the same `ai-dial-chat` `features` and `config`,
  with its own echoed `appId` and its own cache entry.
- Server-side feature gates (`FeatureGuard`, text refinement) always evaluate
  as `ai-dial-chat`, because they protect Chat BFF endpoints.
- `chat-ui`, Chat's former identifier, is a deprecated alias. It is replaced
  with `ai-dial-chat` in the `appId` query parameter, in
  `CLIENT_CONFIG_APP_IDS` and on the application side of
  `MANAGED_CONFIG_INSTANCES`, so existing callers (Launchpad's fallback read,
  Models Garden, Config Studio, cached Chat frontends) and existing Helm values
  keep working. A response always carries `"appId": "ai-dial-chat"`. The alias
  does not apply to Config Studio: an instance created with `appId` `chat-ui`
  is rejected with `identity_mismatch`. Recreate it with `appId`
  `ai-dial-chat` and upload `ai-dial-chat-<version>.json`. No Chat release
  shipped the former `chat-ui-<version>.json` artifacts.

With managed reading `active`, `ai-dial-chat` values feed the existing typed fields
under this schema, and a payload published for another mapped identifier is
returned unchanged in the optional `appConfig` field. The BFF checks that
payload's identity, revision and size but not its schema. The application
validates it against its own contract.

## Runtime reading and activation

The BFF reads the published snapshot of each served identifier that
`MANAGED_CONFIG_INSTANCES` maps to a Config Studio instance, through DIAL Core
only: `GET {DIAL_CORE_URL}/v1/deployments/<instance>/route/v1/published` with
`MANAGED_CONFIG_API_KEY` and nothing from any user session. The key's Core role
must be in the instance's `userRoles` and `readerRoles`. Variables are listed in
[`apps/chat-api/README.md`](../apps/chat-api/README.md#environment-variables).

### Modes

| `MANAGED_CONFIG_MODE` | Effect                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `off` (default)       | No request is sent. Responses, cache keys, guards and browsers behave exactly as without managed configuration.                                                       |
| `shadow`              | Snapshots are read, verified and compared with the effective values (`dial_chat_managed_config_shadow_comparison_total`, one log per revision). Nothing else changes. |
| `active`              | The keys in `MANAGED_CONFIG_ACTIVE_KEYS` take managed values and policies; responses carry `metadata.managed`, `metadata.nextRefreshAt` and `appConfig`.              |

A failure never changes the mode. Setting `off`, or removing a key, is the
explicit rollback; it applies to the next request. The key list may stay in
place: outside `active` it is ignored, with a startup warning. Rolling back a configuration
is done in Studio, as a new revision.

### Reading and accepting a snapshot

Each instance is read once at startup (bounded by the 5-second read deadline;
a failure never blocks startup), then every
`MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS` plus up to 10 % jitter. Failures back
off by doubling, up to five intervals. Anything a read or a snapshot throws
counts as a failed attempt; polling and the process continue. One request per
instance is in flight;
browser requests never reach Core. A response over 131,072 bytes is rejected.

A candidate is accepted only when its `instanceId` and `appId` match the
mapping (and `environment` matches `MANAGED_CONFIG_ENVIRONMENT` when set), its
payload nests at most 32 levels and is at most 57,344 canonical bytes, and a
revision seen before has
unchanged hashes. A `ai-dial-chat` snapshot must also name a supported
`schemaVersion` with exactly its pinned `schemaSha256`, validate against the
bundled artifact, and pass `calendar_date` and `window_order`. A foreign
payload is not schema-validated. Any failure rejects the whole candidate and
keeps the previous snapshot.

### States

Freshness is the time since the last successful verification, not since
publication. The state is computed whenever a request reads it.

| State           | Meaning                                                                | Active values           | Active features |
| --------------- | ---------------------------------------------------------------------- | ----------------------- | --------------- |
| `fresh`         | Verified by the last read, within the maximum staleness                | ENV → managed → default | gated           |
| `degraded`      | Last read failed, was denied or rejected; still within staleness       | ENV → managed → default | gated           |
| `stale`         | Older than `MANAGED_CONFIG_MAX_STALENESS_SECONDS`                      | ENV → default           | `false`         |
| `unavailable`   | Nothing accepted yet (cold start, or every candidate rejected)         | ENV → default           | `false`         |
| `not_published` | Studio has nothing published for the instance; the snapshot is dropped | ENV → default           | `false`         |

A denied key behaves like an outage, is logged as an error, and keeps being
retried with backoff. Persisted last-known-good is not kept: a pod that starts
while Core or Studio is down serves defaults and closed features until its
first successful read.

### Values and feature gates

An active config value resolves as explicit ENV → managed → registry default,
through the same client-config normalization as an ENV value. An explicit ENV
variable always wins, so remove it before activating its key (shadow mode
reports such keys as `env_shadowed`).

An active managed feature is `true` only when all of these hold: the
configured bit (explicit ENV → managed `enabled` → default) is `true`; the
snapshot is usable and has a policy for the key; the local capability exists;
the availability window is active (`startsAt` inclusive, `endsAt` exclusive,
evaluated on every request); targeting matches a verified session role
(anonymous callers never match a role list); and the deployment role gate
allows the caller. ENV `true` cannot bypass any gate; ENV `false` turns the
feature off. `FeatureGuard` applies the same gates.

### Caching and browser refresh

In `active` mode the per-user response cache key also carries the instance,
revision and state, and its TTL never passes the next availability boundary or
the snapshot's staleness expiry, nor the browser refresh interval. A visible
tab refreshes after `metadata.nextRefreshAt` − `resolvedAt`
(`MANAGED_CONFIG_CLIENT_REFRESH_SECONDS`, 120 by default, measured in server
time), and immediately on focus, return to the tab, back-forward-cache
restore and reconnect. With the defaults, a visible tab shows a new publication
within about four minutes, and about 70 seconds after it regains focus. Pods
read independently, so for one interval they may serve different revisions.

### Migration runbook

The DIAL Admin, reader key, upload and verification steps are spelled out in
[managed-config-onboarding.md](managed-config-onboarding.md).

1. Deploy with the mode `off`.
2. Create the Studio instance with a reader role for the BFF's key; set
   `MANAGED_CONFIG_INSTANCES`, `MANAGED_CONFIG_API_KEY` and
   `MANAGED_CONFIG_MAX_STALENESS_SECONDS`.
3. Switch to `shadow`; watch `dial_chat_managed_config_state` and the shadow
   comparisons. Remove ENV variables reported as `env_shadowed` for keys about
   to be activated.
4. Switch to `active` with `MANAGED_CONFIG_ACTIVE_KEYS=onboarding.hints`,
   after removing `ONBOARDING_HINTS`. Publish the current tour first, so
   shadow comparison reports `equal` before the switch.
5. With schema 1.1.0, add its texts and lists, then
   `features.usageLimitsControl` only after Config Studio enforces
   `calendar_date` and `window_order`; until then a publication with an
   invalid window is rejected here as a whole and the instance goes
   `degraded`, then `stale`.

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
  value from a key's own variable only when the variable is explicit. A typed
  default such as `SCHEDULED_TASKS_ENABLED = false` therefore falls through to
  the registry default.
- A managed text set to an empty or whitespace-only string resolves to
  `undefined`, so a variable a chart templates as `""` cannot shadow a
  lower-priority source. The client mapping hides blank and null alike.
- Environment parsing lives in pure functions under
  `apps/chat-api/src/app-config/env-admission/`, and the capability rules
  (ASR, conversation naming, footer) in `feature-capabilities.ts`.
- `AppConfigService` applies the deployment role gate
  (`deployment-role-gate.ts`) once, after selection, on every resolution path.
  No source can bypass it by returning `true`. An absent roles variable holds
  its typed default, an empty list, which means no restriction.

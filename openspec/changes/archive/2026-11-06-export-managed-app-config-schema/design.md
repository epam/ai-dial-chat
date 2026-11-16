## Context

See `proposal.md` for the motivation. This section records the evidence the design depends on, separating the inspected Chat source, the external Studio contract, and assumptions.

**Observed in Chat (this repository):**

- `CONFIG_DEFINITIONS` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) declares 48 keys, of which 11 are features and 13 have `valueType: 'json'`. `ConfigDefinition` (`apps/chat-api/src/app-config/app-config.types.ts`) has no managed, constraint, or schema metadata.
- Resolution path: `AppConfigService` (`getClientConfig`, `isEnabled`, `resolveValue`, `resolveConfiguredVersion`) → `CompositeConfigProvider.resolve` (ENV, then static defaults; first non-`undefined` wins) → `value ?? defaultValue` → the `CLIENT_CONFIG_MAPPINGS` converters in `apps/chat-api/src/app-config/client-config.mapper.ts`. No other code calls the composite provider.
- **Typed defaults look explicit.** `validate()` (`apps/chat-api/src/config/validation.ts`) calls `plainToInstance` on the env classes, so field initializers apply when a variable is absent. Examples are `SCHEDULED_TASKS_ENABLED = false`, `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT = 75`, `UI_EVENT_ENABLED_BY_DEFAULT = true`, `UI_EVENT_DELIVERY_MODE = bundled`, `TRANSCRIBE_SIZE_LIMIT_BYTES = 5 MiB`, `FILE_UPLOAD_MAX_BYTES`, `DEFAULT_DEPLOYMENT_PINNED = false`, and `ALLOW_VISUALIZER_SEND_MESSAGES = false`. `EnvConfigProvider`'s generic path therefore returns these values even when nothing is set. Today this is harmless, because the static default is the same value.
- `EnvConfigProvider` (`apps/chat-api/src/app-config/config-registry/env-config.provider.ts`) mixes four concerns:
  - raw parsing (ANNOUNCEMENTS, CUSTOM_CLIENT_VARIABLES, and the visualizer registries);
  - admission filtering (the file-manager tab allow-list, the empty publication-filter fallback, the content-locale precedence);
  - capability derivation (`features.asrEnabled` from `ASR_MODEL`, `features.llmConversationNaming` from `UTILITY_MODEL`, `DIAL_API_KEY`, and the opt-in, and `features.footer` from `FOOTER_HTML_MESSAGE`);
  - deployment role gating (`applyRoleGating`, which returns `false` for a user without an allowed role).
- **The mapper stage is already source-independent.** HTML sanitization, `toNullableText` trimming, the announcement normalizer (10-entry cap, link checks), and the UI-feature allow-list run on the resolved value, whichever provider produced it.
- Build pattern: `chat-api:openapi-spec` runs `node -r @swc-node/register apps/chat-api/src/openapi-spec.ts`. `ajv` 8.20.0 is a root devDependency. The PR workflow (`.github/workflows/pr.yml`) runs tests and `validate:specs` but no `openapi:check`.

**External contract (Config Studio, read-only reference; not code in this repository):**

- Upload body: `{ appId, schemaVersion, schema, operationId }`; only these fields are read.
- Studio checks:
  - `appId` equals the instance's;
  - `schemaVersion` matches `MAJOR.MINOR.PATCH`, each component at most six digits, no leading zeros;
  - `$schema`, if present, is draft 2020-12;
  - the root `type` is `object`;
  - `$ref`/`$dynamicRef` values start with `#`;
  - there is no nested `$id`;
  - the meta-schema validates and the schema compiles.
- The validator is Ajv 2020 with `strict: false`, `allErrors: true`, and `validateFormats: false`, so unknown keywords are annotations and `format` is not enforced.
- Size and hash: canonical JSON (object keys sorted at every level by JavaScript's default code-unit sort, `JSON.stringify` primitives, no whitespace) must be at most 57,344 bytes. Studio stores `sha256` over those canonical bytes. Publication payloads are also limited to 57,344 bytes.
- The runtime read returns `{ instanceId, appId, environment, schemaVersion, schemaSha256, revisionId, sha256, publishedAt, payload }`.
- The DIAL UI Kit `SchemaRenderer` (kit `0.16.0-dev.45`, installed in Studio):
  - reads `title`, `description`, `isHidden`, and `default`;
  - reads `dial:meta` with `dial:propertyOrder` **nested inside `dial:meta`** (`DialMeta` in the kit's `src/models/json-schema.d.ts`);
  - resolves internal `#/` `$ref` with sibling keywords merged over the target.

**Assumptions (unverified):** Studio step 05 renders the artifact with `SchemaRenderer` and keeps the 56 KiB limit. Core and live Studio behavior are not exercised by this change.

## Goals / Non-Goals

**Goals:**

- One registry is the source of the managed contract. Export stays separate from activation.
- A deterministic, size-checked, Studio-acceptable artifact with an explicit version and provenance policy.
- Seams for presence, admission, normalization, capability, and policy that step 08 can use without re-reading `process.env` or duplicating parsers. Effective values do not change now.

**Non-goals (design level):**

- No runtime JSON Schema validation. Ajv stays test-only, and step 08 chooses the runtime validator.
- No runtime availability or targeting evaluator.
- No change to ENV admission strictness.
- No code shared with Studio.

## Decisions

### D1 — Managed metadata lives on `ConfigDefinition`

Add three optional fields to the existing interface:

```ts
managed?: boolean; // default false: not part of the exported contract
localOnly?: LocalOnlyReason; // never manageable; mutually exclusive with managed
managedContract?: ManagedKeyContract; // required when managed is true

enum LocalOnlyReason {
  Capability = 'capability', // needs a local model, credential, service or Core capability
  DeploymentTopology = 'deployment-topology', // URLs of this deployment
  SecurityPolicy = 'security-policy', // CSP/iframe/embedding/HTML/external-content admission
  BackendEnforcedLimit = 'backend-enforced-limit', // must equal what the BFF enforces
  BuildMetadata = 'build-metadata',
  Derived = 'derived', // computed from another local value
  Opaque = 'opaque', // no declared schema (client-owned JSON)
}

interface ManagedKeyContract {
  title: string; // operator-facing, English
  description: string; // operator-facing, English, no ENV names or values
  order: number; // exported as dial:meta["dial:propertyOrder"]
  hidden?: boolean; // exported as isHidden
  value?: ManagedValueSchema; // constraints; required for json; absent for features
}
```

`ManagedValueSchema` is a typed subset of JSON Schema:

- `type`, `enum`, `minLength`/`maxLength`/`pattern`, `minimum`/`maximum`, `minItems`/`maxItems`/`uniqueItems`, `items`, `properties`/`required`/`additionalProperties: false`, and `title`/`description`/`dial:meta`;
- no `$ref`, `$id`, or `format`.

The type system enforces this subset. That keeps constraints enforceable by Studio and checkable by tests.

- **Alternatives considered:**
  - A separate `managed-config.constants.ts` list was rejected because it is a second key list.
  - Deriving schemas from the class-validator DTOs (`CustomVisualizerDto`) was rejected: it needs a new converter dependency, DTO metadata is runtime-reflected and not deterministic enough to review, and none of the initial keys use those DTOs.
  - A tri-state `managed: 'no' | 'export' | 'active'` was rejected: activation belongs to step 08's deployment control (D2), not to the registry.

### D2 — `managed: true` means exported, not activated

`managed` selects the keys in the editable contract. With no remote reader, it has no runtime effect. Step 08 adds activation (shadow comparison, then per-key opt-in) as its own control and must not interpret `managed` as permission to read. This choice was made on 2026-11-06 over a strict reading in which the 04 artifact would be empty. The risk that an operator publishes a value Chat does not yet apply is handled under Risks.

### D3 — Payload is `{ config, features }` with plain values and full registry keys

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

- Both objects are required and may be empty. An omitted key means "no managed value". Precedence is step 08's: explicit ENV, then managed value, then default.
- Managed strings are never `null`. To hide copy, omit the key so that the registry default (`null`) applies. This avoids nullable unions, which `SchemaRenderer` renders as a type picker.
- Full keys (`features.usageLimitsControl`, not `usageLimitsControl`) match the registry and `FeatureKey` exactly. Client-config's prefix stripping stays a response concern.
- **Supersedes** the per-key `{ "value": … }` wrapper and the in-snapshot identity fields of `docs/centralized-app-config-design.md` §7. Identity, schema version, revision, and publication metadata are carried by Studio's revision envelope and runtime read response. A wrapper adds an extra form level per key and bytes, with no metadata to carry yet. The design doc is updated in this change.

### D4 — Only enforceable constraints; two named semantic constraints

- Timestamps are restricted to UTC with a `Z` suffix by a `pattern`, because Studio does not enforce `format`. Studio's editor (step 09) converts the operator's local time to UTC. A stored offset is therefore impossible, which also removes timezone ambiguity for the runtime evaluator.
- Every string and array is bounded:
  - announcement title and link label: 200 and 100 characters;
  - descriptions: 1,000 or 2,000 characters;
  - `href`: 2,048 characters, `^https?://` matched case-insensitively by character classes;
  - roles: 1–50, unique, each 1–128 characters without whitespace or commas.

  The announcement item count matches the existing 10-entry cap.
- `availability` requires at least one boundary (`minProperties: 1`). `targeting.roles` requires at least one role. Omitted targeting means no restriction.
- **Semantic constraints.** Calendar validity of a timestamp (`calendar_date`) and `startsAt < endsAt` (`window_order`) cannot be expressed in JSON Schema. They are listed with stable codes in a root annotation, `dial:semanticConstraints`, so the contract describes itself. A pure Chat validator, `validateManagedSemantics(payload) → { pointer, code }[]`, implements them. Until Studio implements them (09), Studio can publish a payload that Chat's future reader rejects as a whole snapshot. This is the documented failure policy, not silent acceptance.
- The bounds apply only to managed admission. ENV values keep today's unbounded, fail-open admission, so effective behavior does not change. Tightening ENV is a separate decision.

### D5 — Studio UI annotations

The generator emits:

- `title` and `description` from `managedContract`;
- `dial:meta: { "dial:propertyOrder": order }`;
- `isHidden: true` only when `hidden`;
- section-level `title` and `dial:propertyOrder` for `config` (1) and `features` (2).

Feature states reference `#/$defs/featureState`, and per-key `title`/`description` siblings override the shared definition. The kit merges `$ref` siblings, as verified in `utils/json-schema.js`. No other `dial:*` keyword is emitted unless it is verified against the kit used by Studio.

### D6 — Defaults from the registry only

`default` is emitted when the registry `defaultValue` is neither `null` nor `undefined` and validates against the key's own schema; a registry test enforces this. Values come from `CONFIG_DEFINITIONS` constants. The generator never reads `ConfigService`, `process.env`, or `.env` files, and it does not bootstrap Nest. Unlike `openapi-spec.ts`, it imports only the registry module, so no runtime value can leak into the artifact.

### D7 — Artifact files, naming, checksum, and provenance

Committed directory: `apps/chat-api/managed-config-schema/`.

- `chat-ui-<schemaVersion>.json` contains exactly `{ "appId": "chat-ui", "schemaVersion": "<v>", "schema": { … } }`. This is Studio's upload body without `operationId`, so a schema manager can paste or pick it unchanged.
- `index.json` is deterministic and derived from constants:

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
        "schemaSha256": "<sha256 of canonical(schema)>",
        "canonicalBytes": 5161
      }
    ]
  }
  ```

- **Checksum.** `schemaSha256` uses Studio's canonical algorithm, so it equals the `sha256` Studio returns after upload and the `schemaSha256` of every revision published against it. Chat's own canonicalizer is tested against a fixed vector computed with Studio's algorithm:
  - input `{"b":1,"a":[{"d":"x","c":null}],"é":"ü"}`;
  - canonical `{"a":[{"c":null,"d":"x"}],"b":1,"é":"ü"}`;
  - SHA-256 `b69925e54531b6b61268fda5dca74b8d1eb6d566616ec5932258abac6c9edde0`.

  A file-byte checksum is not recorded, because Prettier may reformat the JSON. Comparisons are semantic, not byte-level.
- **Generator.** `apps/chat-api/src/managed-config-schema.ts` is run by `nx run chat-api:managed-config-schema` (npm script `managed-config-schema`). It writes the current version's file and `index.json`, then runs Prettier on them, as `openapi-spec` does.
- **Measured (task 5.3).** The committed `chat-ui-1.0.0.json` has a canonical `schema` of 5,161 bytes, 9% of Studio's 57,344-byte limit, with `schemaSha256` `9e2155b7857adf6cc51e8966ad02ebf79953c5a87875eaea929e384c02b55dd6`. Its `schema` is semantically identical to the appendix sample. The prototype's 5,209-byte figure was not measured over the canonical `schema` alone; the whole canonical upload body measures 5,214 bytes.
- **Drift and immutability test** (`apps/chat-api/src/app-config/tests/managed-config/managed-config-artifact.spec.ts`), run by the PR test job:
  - the current file deep-equals the generator output;
  - every committed version file hashes to its index entry;
  - the index lists exactly the committed files;
  - `current` is the highest version;
  - `supported` equals `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS`.
- **Released versions.** A version that was present in a release tag is never edited. The test catches an edit whose index entry was not changed with it. An edit to both files is a review-blocking change, recorded in `docs/managed-config-schema.md` because tests cannot see Git history.
- **Provenance.** The trusted source is the file and the `index.json` entry at an `epam/ai-dial-chat` release tag, reviewed through the normal PR process. Integrity is checked at three points:
  1. the operator compares Studio's upload response `sha256` with the index;
  2. Studio stores the hash with every revision;
  3. step 08 rejects any snapshot whose `schemaSha256` differs from the hash Chat computes for that version, even under the same `schemaVersion`.

  Attaching files to a GitHub release, signing, and uploading into Studio instances are separate operations that this change does not authorize.
- **Alternatives considered:**
  - Serving the schema from a Chat endpoint was rejected because Studio must not need a running Chat, and it adds runtime surface.
  - An npm package was deferred because publication is unauthorized here and adds a package boundary for one JSON file.
  - A file only inside the Docker image was rejected because it is hard to obtain or review.
  - A file-byte SHA was rejected because of formatter churn and because it differs from Studio's identity.

### D8 — Versioning, compatibility, and supported versions

`schemaVersion` is the contract's own semantic version (`MANAGED_CONFIG_SCHEMA_VERSION`, starting at `1.0.0`). It is independent of Chat's release version.

- **PATCH:** annotation-only changes (`title`, `description`, `dial:meta`, `isHidden`, `default`, `dial:semanticConstraints` text). The set of valid payloads is identical.
- **MINOR:** the set of valid payloads only grows, for example a new optional key or a widened bound. Every payload valid under X.Y.Z is valid under X.(Y+1).0.
- **MAJOR:** anything that rejects or reinterprets a previously valid payload:
  - removing a key or narrowing a bound;
  - changing a type or meaning;
  - adding a required field;
  - adding a feature-policy field.

  A new policy field is MAJOR because a reader that ignores it would silently weaken policy.
- **Supported versions.** `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS` is the exact list a Chat build accepts; for this change it is `['1.0.0']`. A future reader accepts only listed versions, with matching `schemaSha256`.
- **Enforced checks** (in the artifact test, against the previous committed version):
  1. A difference with annotation keywords stripped requires at least a MINOR bump.
  2. A removed property or a newly required property requires a MAJOR bump.
  3. Every fixture payload of the previous version validates under a MINOR successor.

  Rule 3 is a fixture-based test of the superset rule, not a proof. Review remains responsible for semantics.
- **Mixed versions.** Readers are upgraded before publishing against a newer version. Deployments that cannot upgrade use a separate Studio instance (centralized-app-config design §5).

### D9 — Explicit ENV presence is captured from the raw input

`collectExplicitEnvironment(raw)` (`apps/chat-api/src/config/explicit-environment.ts`) records the names whose raw value is defined, computed from the same raw object `validate()` receives. That object includes `.env` files and process variables, before class defaults apply. An empty string counts as present: today `SCHEDULED_TASKS_ENABLED=""` parses to `true`, and characterization tests pin that. An injectable `ExplicitEnvironment` exposes `isExplicit(name)` to providers.

- **Wiring.** The exact Nest mechanism is fixed in task 2.2 under a test that classifies a `.env` value, a process value, and an absent variable correctly. The candidates are a reserved typed key on the validated config, or a validate-time holder registered as a provider. Reading `process.env` in a service is not allowed (chat-api AGENTS §13).
- **Chosen mechanism (task 2.2): a reserved key on the validated config.** `validate()` attaches the captured names to the object it returns as the non-enumerable property `EXPLICIT_ENVIRONMENT_PROPERTY` (`__explicitEnvironment`). Nest keeps that object as its validated environment, so `ConfigService.get(EXPLICIT_ENVIRONMENT_PROPERTY)` returns the set. Because the property is non-enumerable, ConfigModule's copy of validated values into `process.env` skips it. That copy is also why `process.env` cannot be the presence source: after boot it holds the typed defaults too. `AppConfigModule` registers `ExplicitEnvironment` through the factory `ExplicitEnvironment.fromConfigService`, and `EnvConfigProvider` injects it. A validate-time holder was rejected: it is module-level mutable state shared by every `validate()` call, including tests. When a ConfigModule runs without `validate()` (some module-graph tests do), nothing is captured. No typed default applies there either, so the factory then counts every value `ConfigService` holds as explicit. `apps/chat-api/src/config/tests/explicit-environment.spec.ts` boots a real `ConfigModule.forRoot` with a `.env` file and a process variable to prove the classification.
- **Generic path.** `EnvConfigProvider`'s generic `envVar` path and its role-list reads return `undefined` when the variable is not explicit. The effective value is unchanged because each typed default equals the registry default. A parity test asserts this for every registry key whose env field has an initializer. A mismatch stops the slice and is recorded here, not silently changed.
- **Derived keys.** Capability-derived keys (`features.asrEnabled`, `features.llmConversationNaming`, `features.footer`) keep their derivations. They are local-only (D11).

### D10 — Admission, normalization, capability, and policy seams

The effective value of a key is computed in five steps. This change implements the seams for ENV only.

1. **Source admission.** Parse and admit a raw value from one source. ENV admission (string parsing and today's fail-open filters) moves from `EnvConfigProvider` into pure per-key functions in `apps/chat-api/src/app-config/env-admission/`. Managed admission is schema plus semantic validation (D4), with Ajv only in tests for now.
2. **Selection.** `CompositeConfigProvider`: explicit ENV, then (future) managed, then default. Unchanged here.
3. **Shared normalization.** The existing mapper stage: sanitizers, trimming, caps, allow-lists. It already runs on every source and is untouched.
4. **Capability.** `capabilityAvailable(key)` holds the derivation rules now inside `EnvConfigProvider`. They remain the ENV provider's result for derived keys, so values are identical. They are exposed as a pure function for step 08's `AND` composition.
5. **Policy.** Deployment role gating moves out of `EnvConfigProvider` into one post-selection step in `AppConfigService`, shared by all four resolution call sites: `false` when the feature's allowed-roles list is explicit and non-empty and the user has none of them. This is equivalent to today, because gating only turns `true` into `false` and every non-ENV path for a role-gated key yields `false`. The gate is now conjunctive with any future source, as the design requires. Availability and targeting evaluation are step 08's.

Characterization tests for the role-gated keys, the derived keys, the typed defaults, and each special parser come before any move (task group 1).

### D11 — Initial managed set and classification

| Class                                   | Keys                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Managed in 1.0.0 (7)**                | `announcement.title`, `announcement.description`, `announcement.items`, `welcomeScreen.description`, `fileManager.availableTabs`, `usageLimits.warningThresholdPercent`, `features.usageLimitsControl`                                                                                                                |
| Local-only: capability (6)              | `asr.modelId`, `features.asrEnabled`, `utility.modelId`, `features.llmConversationNaming`, `features.responsesApiEnabled`, `features.responsesBackgroundEnabled`                                                                                                                                                      |
| Local-only: deployment topology (2)     | `dialCore.externalUrl`, `mcpApps.sandboxUrl`                                                                                                                                                                                                                                                                          |
| Local-only: security policy (11)        | `overlay.enabled`, `overlay.allowedOrigins`, `documents.allowedConnectOrigins`, `customVisualizers`, `applicationVisualizers`, `features.visualizerSendMessages`, `ui.celebrationDelivery.mode`, `ui.celebrationDelivery.revision`, `ui.celebrationDelivery.externalScenes`, `ui.celebrationDelivery.externalEvents`, `announcement.html` |
| Local-only: backend-enforced limit (5)  | `asr.transcribeSizeLimitBytes`, `attachments.maxFileSizeBytes`, `projects.contextFileMaxBytes`, `projects.contextTotalMaxBytes`, `projects.contextAllowedExtensions`                                                                                                                                                  |
| Local-only: build / derived / opaque (3) | `app.version`, `features.footer`, `customVariables`                                                                                                                                                                                                                                                                   |
| Eligible, unmanaged (14)                | `deployments.defaultDeploymentId`, `mcpApps.theme`, `mcpApps.userAgent`, `mcpApps.hostName`, `footer.html`, `ui.activeEventId`, `ui.celebrationsEnabledByDefault`, `features.liveChatInteraction`, `features.scheduledTasksEnabled`, `features.projectsEnabled`, `features.defaultDeploymentPinned`, `uiFeatures.enabledUiFeatures`, `publish.publicationFilterSources`, `content.additionalLocales` |

**Why this set.** These keys are client-visible operator copy or presentation settings with:

- no local capability or credential;
- no CSP, iframe, or embedding coupling;
- no backend-enforced counterpart;
- a bounded schema that fits the existing normalizers.

`features.usageLimitsControl` is the one policy feature. It is a UI-only control with no `FeatureGuard` or capability, so windows and targeting can be exercised in 08/09 without server-side enforcement risk.

**Safe fallback per key** (missing, stale, or rejected managed state, as applied by step 08):

| Key | Fallback |
| --- | --- |
| `announcement.title`, `announcement.description`, `welcomeScreen.description` | Registry default `null`: hidden |
| `announcement.items` | `[]`: the pill is hidden |
| `fileManager.availableTabs` | All four tabs |
| `usageLimits.warningThresholdPercent` | 75 |
| `features.usageLimitsControl` | Fails closed (`false`), the current default |

**Excluded on purpose:**

- `announcement.html` is passed to the browser verbatim and sanitized only client-side.
- `footer.html` is coupled with `features.footer` derivation and `%%VERSION%%`.
- `features.scheduledTasksEnabled` and `features.projectsEnabled` are server-guarded and depend on step 08's gate composition.
- `uiFeatures.enabledUiFeatures` carries a 55-value enum that must stay in sync with the overlay package.

These are the next candidates, each needing its own schema version.

### D12 — Package boundary

All code stays in `apps/chat-api`. Studio consumes only the JSON artifact, so no protocol types are shared and no `libs/*` package is created. Managed-config knowledge (registry, Core identity checks, artifact policy) stays at the application edge, as Chat's library isolation rule requires.

### D13 — Snapshot acceptance checks, pure and reader-free

`checkManagedSnapshot(snapshot, expected)` (`apps/chat-api/src/app-config/managed-config/managed-snapshot.ts`) returns either `{ ok: true }` or `{ ok: false, code }`. It requires:

- `appId === 'chat-ui'`;
- `instanceId` equal to the expected instance;
- `environment` equal to the expected environment when one is configured;
- `schemaVersion` in the supported list;
- `schemaSha256` equal to the hash of Chat's own artifact for that version;
- `revisionId` and `sha256` as non-empty strings;
- a canonical payload of at most 57,344 bytes;
- for a `revisionId` already seen, an unchanged `sha256`.

It performs no I/O and is not wired to any reader. Payload schema validation stays with Ajv in tests, and step 08 decides the runtime validator. Ajv is already a root devDependency; making it a runtime dependency is 08's decision, not this change's.

## Risks / Trade-offs

- [An operator publishes a managed value before step 08 reads it] → The root schema `description` states that a Chat deployment applies the values only when its managed reading is enabled. Studio 05 should label instances whose consumer is not yet reading. Step 08 starts in shadow mode.
- [The managed bounds are stricter than ENV: an ENV title of 300 characters is valid today] → This is an explicit, documented asymmetry (D4). Migrating a key from ENV to managed requires fitting its bounds. Step 08 must not apply managed bounds to ENV silently.
- [The typed-default parity assumption fails for some key] → The parity test fails, and the slice stops with an Open Question. No effective value changes.
- [The Nest wiring for presence capture is uncertain (`.env` files versus `process.env`)] → Task 2.2 is risk-first, with a test for both sources before any provider change.
- [Dotted property names make SchemaRenderer's client-side error paths ambiguous (`config.announcement.items`)] → Cosmetic only. Studio's authoritative errors use JSON pointers (`/config/announcement.items`). This is flagged for Studio 05.
- [Kit annotation drift: `dial:meta` nesting verified only on `0.16.0-dev.45`] → The generator emits only verified keywords. Studio 05 re-verifies against its pinned kit.
- [A released artifact is edited in place] → Index-hash and generator-equality tests catch an unpaired edit. Paired edits are a review rule, and step 08's hash check rejects snapshots made against an altered schema.
- [The semantic constraints are not enforced by Studio before step 09] → Chat rejects the whole snapshot, under the existing failure policy. Studio 09 must implement `window_order` and `calendar_date` before offering windows.

## Migration Plan

1. Characterization tests: no source change.
2. Presence capture and the typed-default parity test. The ENV provider honors presence, with identical effective values.
3. Admission, capability, and role-gate seams, with identical effective values.
4. Registry metadata and classification of all 48 keys, with registry rule tests.
5. Generator, canonical JSON, the 1.0.0 artifact, `index.json`, and the drift test.
6. Contract fixtures, the semantic validator, and the snapshot check.
7. Documentation.

Each step is an independent PR. Rollback is a revert, because no runtime behavior depends on any step. A schema mistake after release is fixed by a new version, never by editing the old file.

## Open Questions

- Whether and when to attach the artifacts to GitHub releases or sign them. Both need separate authorization and do not change the files or the checks.
- Whether Studio wants Chat's contract fixtures exported as an optional `examples` file for its editor tests. This can be added later without changing the schema.

## Appendix — sample artifact `chat-ui-1.0.0.json`

This was produced by the prototype used to measure size. The generator's output for 1.0.0 is semantically identical to it and measures 5,161 canonical bytes (see D7). Ajv 2020 with Studio's options compiles it, and Studio's structural rules pass. The generator in task 5 produces the authoritative file; titles and descriptions may be refined, and any such change before release only changes the hash.

```json
{
  "appId": "chat-ui",
  "schemaVersion": "1.0.0",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "urn:dial:chat-ui:managed-config:1.0.0",
    "title": "DIAL Chat managed configuration",
    "description": "Values published through Config Studio for one chat-ui instance. A Chat deployment applies them only when its managed reading is enabled; an explicit deployment environment override still wins, and omitted keys use the application default.",
    "type": "object",
    "additionalProperties": false,
    "required": ["config", "features"],
    "properties": {
      "config": {
        "type": "object",
        "additionalProperties": false,
        "title": "Configuration",
        "properties": {
          "announcement.title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200,
            "pattern": "\\S",
            "title": "Announcement title",
            "description": "Plain-text heading at the start of the announcement banner. Never rendered as markup.",
            "dial:meta": { "dial:propertyOrder": 10 }
          },
          "announcement.description": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000,
            "pattern": "\\S",
            "title": "Announcement description",
            "description": "Supporting banner copy. Sanitized to a safe HTML subset before it reaches browsers.",
            "dial:meta": { "dial:propertyOrder": 11 }
          },
          "announcement.items": {
            "type": "array",
            "maxItems": 10,
            "title": "Announcements",
            "description": "Entries behind the banner's \"+N announcements\" pill, at most 10.",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": ["title"],
              "properties": {
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 200,
                  "pattern": "\\S",
                  "title": "Title",
                  "dial:meta": { "dial:propertyOrder": 1 }
                },
                "description": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 2000,
                  "pattern": "\\S",
                  "title": "Description",
                  "description": "Sanitized to a safe HTML subset.",
                  "dial:meta": { "dial:propertyOrder": 2 }
                },
                "link": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": ["label", "href"],
                  "title": "Link",
                  "dial:meta": { "dial:propertyOrder": 3 },
                  "properties": {
                    "label": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 100,
                      "pattern": "\\S",
                      "title": "Label",
                      "dial:meta": { "dial:propertyOrder": 1 }
                    },
                    "href": {
                      "type": "string",
                      "maxLength": 2048,
                      "pattern": "^[Hh][Tt][Tt][Pp][Ss]?://[^\\s]+$",
                      "title": "URL",
                      "description": "Absolute http or https URL.",
                      "dial:meta": { "dial:propertyOrder": 2 }
                    }
                  }
                }
              }
            },
            "default": [],
            "dial:meta": { "dial:propertyOrder": 12 }
          },
          "welcomeScreen.description": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000,
            "pattern": "\\S",
            "title": "Welcome text",
            "description": "Plain-text copy below the greeting on the new-chat screen. Never rendered as markup.",
            "dial:meta": { "dial:propertyOrder": 20 }
          },
          "fileManager.availableTabs": {
            "type": "array",
            "minItems": 1,
            "maxItems": 4,
            "uniqueItems": true,
            "title": "File Manager tabs",
            "description": "File Manager tabs shown to users, in order.",
            "items": {
              "type": "string",
              "enum": ["all", "my_files", "shared", "organization"]
            },
            "default": ["all", "my_files", "shared", "organization"],
            "dial:meta": { "dial:propertyOrder": 30 }
          },
          "usageLimits.warningThresholdPercent": {
            "type": "integer",
            "minimum": 1,
            "maximum": 99,
            "default": 75,
            "title": "Usage warning threshold (%)",
            "description": "Percentage of a capped token or cost limit at which the composer shows its usage banner.",
            "dial:meta": { "dial:propertyOrder": 40 }
          }
        },
        "dial:meta": { "dial:propertyOrder": 1 }
      },
      "features": {
        "type": "object",
        "additionalProperties": false,
        "title": "Features",
        "properties": {
          "features.usageLimitsControl": {
            "$ref": "#/$defs/featureState",
            "title": "Usage-limits control",
            "description": "Shows the token and cost usage-limits control next to the model selector.",
            "dial:meta": { "dial:propertyOrder": 1 }
          }
        },
        "dial:meta": { "dial:propertyOrder": 2 }
      }
    },
    "dial:semanticConstraints": [
      {
        "code": "calendar_date",
        "pointer": "/$defs/utcTimestamp",
        "description": "The date and time must exist in the proleptic Gregorian calendar."
      },
      {
        "code": "window_order",
        "pointer": "/$defs/featureState/properties/availability",
        "description": "When both are present, startsAt must be earlier than endsAt."
      }
    ],
    "$defs": {
      "utcTimestamp": {
        "type": "string",
        "maxLength": 30,
        "pattern": "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,3})?Z$",
        "title": "UTC timestamp",
        "description": "RFC 3339 instant in UTC (Z suffix), for example 2026-11-01T08:00:00Z."
      },
      "role": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128,
        "pattern": "^[^\\s,]+$"
      },
      "featureState": {
        "type": "object",
        "additionalProperties": false,
        "required": ["enabled"],
        "properties": {
          "enabled": {
            "type": "boolean",
            "title": "Enabled",
            "dial:meta": { "dial:propertyOrder": 1 }
          },
          "availability": {
            "type": "object",
            "additionalProperties": false,
            "minProperties": 1,
            "title": "Availability window",
            "description": "startsAt is inclusive, endsAt exclusive; omit a boundary for no limit. startsAt must precede endsAt.",
            "properties": {
              "startsAt": {
                "$ref": "#/$defs/utcTimestamp",
                "title": "Starts at",
                "dial:meta": { "dial:propertyOrder": 1 }
              },
              "endsAt": {
                "$ref": "#/$defs/utcTimestamp",
                "title": "Ends at",
                "dial:meta": { "dial:propertyOrder": 2 }
              }
            },
            "dial:meta": { "dial:propertyOrder": 2 }
          },
          "targeting": {
            "type": "object",
            "additionalProperties": false,
            "required": ["roles"],
            "title": "Targeting",
            "description": "Users need at least one listed verified role. Omit targeting for no restriction.",
            "properties": {
              "roles": {
                "type": "array",
                "minItems": 1,
                "maxItems": 50,
                "uniqueItems": true,
                "items": { "$ref": "#/$defs/role" },
                "title": "Roles"
              }
            },
            "dial:meta": { "dial:propertyOrder": 3 }
          }
        }
      }
    }
  }
}
```

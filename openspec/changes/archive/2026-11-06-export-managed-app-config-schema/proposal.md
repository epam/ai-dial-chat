## Why

DIAL Config Studio stores one immutable JSON Schema per version in each runner instance and validates every publication against that exact version. For `chat-ui` instances, that schema has to come from Chat's own configuration registry. Studio must not keep a second key list or import Chat source. Studio's inspection step (05) cannot start until Chat exports a real, versioned artifact. The runtime reader (08) cannot be built safely until the registry separates explicit ENV overrides from typed defaults.

## Problem

- `ConfigDefinition` (`apps/chat-api/src/app-config/app-config.types.ts:3`) has no managed opt-in, no local-only classification, no value constraints, and no schema for its 13 `json` keys (48 keys in total). Nothing can be exported without inventing a second registry.
- `EnvConfigProvider.resolve` reads `ConfigService` values (`apps/chat-api/src/app-config/config-registry/env-config.provider.ts:186`). Those values already include class-field defaults applied in `validate()` (`apps/chat-api/src/config/validation.ts:42`). For example, `SCHEDULED_TASKS_ENABLED?: boolean = false` (`apps/chat-api/src/config/env/feature-flags.env.ts:111`) and `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT?: number = 75` (`feature-flags.env.ts:165`) resolve as if an operator had set them. A managed provider placed after ENV (`composite-config.provider.ts:28`) could therefore never apply.
- The same provider mixes several concerns: reading, parsing, allow-list filtering (`env-config.provider.ts:87`), capability derivation (`env-config.provider.ts:53`), and role gating (`env-config.provider.ts:207`). A second value source cannot reuse the normalization without the ENV-specific parts.

## What Changes

- **Registry metadata.** Extend `ConfigDefinition` with explicit `managed` (default `false`), a `localOnly` reason, and a `managedContract` block. The block holds an operator-facing title and description, display order, an optional hidden flag, and a value schema with enforceable constraints. Every existing key is classified as managed, local-only, or eligible but unmanaged.
- **Export is not activation.** `managed: true` only adds a key to the exported, editable contract. No remote reader exists, so effective configuration and feature behavior stay the same. The runtime change (08) adds a separate activation path (shadow reads, then per-key opt-in).
- **Initial managed set (schema `1.0.0`).** It is proposed and is not production activation:
  - `announcement.title`, `announcement.description`, and `announcement.items`;
  - `welcomeScreen.description`;
  - `fileManager.availableTabs`;
  - `usageLimits.warningThresholdPercent`;
  - the feature `features.usageLimitsControl`.
- **Payload contract.** The payload is `{ config, features }`, keyed by full registry keys. Config values are plain JSON values. Each feature state is `{ enabled, availability?, targeting? }`, with UTC-only timestamps and non-empty role lists. Unknown, local-only, and extra fields are rejected through `additionalProperties: false`. Two rules cannot be expressed in JSON Schema: calendar validity and `startsAt < endsAt`. They are named semantic constraints, with a pure Chat validator.
- **Deterministic schema generator.** It produces a JSON Schema 2020-12 document from the registry:
  - an `object` root;
  - internal `$ref` to `$defs` only, and no nested `$id`;
  - Studio's `SchemaRenderer` annotations: `title`, `description`, `dial:meta["dial:propertyOrder"]`, and `isHidden`;
  - defaults from the registry only, never runtime ENV values.

  A prototype of the 1.0.0 schema measured 5,209 bytes canonical, against Studio's 56 KiB limit.
- **Versioned artifact in the Chat repository.** Each version is committed as `apps/chat-api/managed-config-schema/chat-ui-<schemaVersion>.json`, holding exactly Studio's upload fields `{ appId, schemaVersion, schema }`. An `index.json` records each version's canonical `schemaSha256` and the versions this build supports. A Vitest drift test ties the files to the registry and freezes released versions. Committing the files is a task; attaching them to a release or uploading them into any Studio instance is not authorized by this change.
- **ENV presence and normalization seams.** Capture explicit ENV presence at bootstrap, separate from typed defaults. Extract provider-independent normalizers, capability checks, and role gating from `EnvConfigProvider`. Characterization tests are written first; effective values are unchanged.
- **Snapshot acceptance contract.** It defines pure, tested identity checks for a future runtime consumer: `appId`, `instanceId`, supported `schemaVersion`, exact `schemaSha256`, payload bound, and an immutable `revisionId`. It does not add a reader.

## Non-goals

- No remote reader, Core or Studio call, polling, managed provider in the composite chain, or change to `/api/v1/client-config`, `FeatureFlagsService`, or `FeatureGuard` behavior (step 08).
- No evaluation of availability windows or role targeting at runtime (08), and no Studio policy editor (09).
- No change to ENV admission. ENV values keep their current fail-open parsing and are not bounded by the managed constraints in this change.
- No edit to Config Studio, the BFF image, or any other repository. No new library under `libs/*`, no published npm package, and no release upload.
- No new environment variable, endpoint, generated-client change, or user-visible string.

## Alternatives considered

| Option                                                                                               | Correctness and isolation                                                         | Delivery risk                                                         | Rollback                       | Decision                                                                              |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| Baseline: hand-write the schema file in Chat                                                         | Drifts from the registry silently; a second key list                              | Lowest                                                                | Delete file                    | Rejected: a second key list, contrary to `docs/centralized-app-config-design.md` §5                                        |
| Registry metadata + generator + committed versioned files + drift test                               | Single source; deterministic; reviewed in PRs; Studio consumes JSON only          | Moderate: registry migration of every key                             | Revert commits; nothing at runtime | **Selected**                                                                          |
| Serve the schema from a Chat endpoint (`/api/v1/...`)                                                | Ties Studio to a running Chat; needs auth, Swagger, client changes                | Higher; changes runtime surface                                       | Endpoint removal               | Rejected: Studio must work without Chat running, and the endpoint adds runtime surface |
| Publish an npm package (for example `@epam/ai-dial-chat-config-schema`)                              | Good versioning, but a package boundary for a JSON file and a release pipeline    | Higher; publication requires separate authorization                   | Deprecate package              | Deferred; the committed file is enough for the first release                        |
| `managed` means runtime activation; export only the activated keys                                   | Strict wording, but the 04 artifact would be an empty contract that Studio cannot test | Low                                                                   | —                              | Rejected (decided 2026-11-06): export is kept separate from activation                            |

Distribution and versioning details are in `design.md`.

## Acceptance criteria

- Generating the schema twice from the same registry yields deep-equal output. The committed `chat-ui-1.0.0.json` equals the generator output, and its canonical SHA-256 equals the `index.json` entry.
- The schema compiles under Ajv 2020 with Studio's options (`strict: false`, `validateFormats: false`). It passes Studio's structural rules (object root, internal refs, no nested `$id`) and is at most 57,344 bytes canonical.
- Contract fixtures prove rejection of:
  - unknown keys and every local-only key;
  - out-of-range, blank, and wrongly typed values;
  - non-`http(s)` links and timestamps with an offset;
  - empty role lists and unknown policy fields.

  The pure semantic validator rejects an impossible date and `startsAt >= endsAt`.
- Registry tests prove the classification rules:
  - every key is classified;
  - `managed` implies a contract and not local-only;
  - every managed `json` key has a declared value schema;
  - each exported default validates against its own schema;
  - no description in the artifact contains an ENV variable name.
- Characterization tests written before the refactor still pass after it: client-config and `FeatureFlagsService` output for the existing ENV matrices is unchanged. Explicit presence distinguishes a set variable from a typed default, including `false`, `75`, and `true`.
- `npm run validate:specs`, `npm run validate:docs`, `openspec validate export-managed-app-config-schema --strict`, and one final `npm run verify:full` pass.

## Rollback / backward compatibility

Nothing is breaking. The registry fields are optional, the generator and artifact files are inert, and the refactor preserves effective values under characterization tests. Reverting the commits restores the previous state. A released schema version is immutable, so a mistaken release is corrected with a new version, never by editing the old file. Studio instances that already stored the version are unaffected, because Studio stores immutable schema copies.

## Capabilities

### New Capabilities

- `managed-config-contract`: the managed opt-in and local-only classification, value constraints and annotations, the `{ config, features }` payload and feature-policy shape, semantic constraints, the initial managed set, and snapshot identity acceptance for a future consumer.
- `managed-config-schema-artifact`: deterministic generation, the artifact file and index format, schema versioning and compatibility, supported versions, the canonical checksum, provenance, and the drift check.

### Modified Capabilities

- `config-registry-and-env-provider`: `ConfigDefinition` gains the managed metadata. Explicit ENV presence becomes distinct from typed defaults. ENV resolution is split into provider-independent normalization, capability checks, and role gating, with unchanged effective values.

## Impact

- **Code (chat-api only).** `apps/chat-api/src/app-config/` (types, registry, ENV provider, new `managed-config/` folder), `apps/chat-api/src/config/` (presence capture), a new generator entry `apps/chat-api/src/managed-config-schema.ts`, and the committed `apps/chat-api/managed-config-schema/`.
- **Tooling.** A new Nx target `chat-api:managed-config-schema` and the npm script `managed-config-schema`. The drift check is a Vitest spec, so the existing PR test job enforces it. `ajv` is already a root devDependency (8.20.0) and stays test-only.
- **Docs.** A new `docs/managed-config-schema.md` and the chat-api README. The §5/§7/§11 update to `docs/centralized-app-config-design.md` (payload shape, identity in the Studio envelope, role gating after selection) is deferred to that document's separate final version, because it is not tracked in this repository.
- **No impact** on `libs/*`, the generated API client, the frontend, i18n (no new strings), RTL, `ENABLED_FEATURES` gating, caches, or telemetry.
- **External consumer.** Config Studio step 05 uploads `chat-ui-1.0.0.json` through its existing `POST /v1/schema-validations` and `POST /v1/schemas` and compares the returned `sha256` with `index.json`. Studio's 56 KiB and BFF limits need no change.

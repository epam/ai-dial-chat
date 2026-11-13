<!--
Slicing strategy: risk-first, then contract-first. Characterization (1) fixes today's
behavior before anything moves. The riskiest seam, explicit ENV presence (2), is proven
next. Slices 4–6 freeze the managed contract and artifact that Config Studio consumes.
Every slice is an inert, independently revertible PR: no remote reader, no managed
provider, and no change to effective configuration, the client-config response,
feature flags, or caches. All work is in apps/chat-api, docs, and root scripts; nothing
touches libs/*, the generated API client, or the frontend, so there are no i18n, RTL,
or UI tasks.
-->

## 1. Characterization tests (no source change)

- [x] 1.1 Add `apps/chat-api/src/app-config/tests/config-registry/env-resolution-characterization.spec.ts`. For every registry key it records the `EnvConfigProvider.resolve` result and the effective `AppConfigService` result (client-config field or `isEnabled`) with the variable absent, explicitly set to its typed default, set to a non-default value, and set to `""`. It includes:
  - the role-gated features with allowed, restricted and anonymous callers;
  - the derived features (`features.asrEnabled`, `features.llmConversationNaming`, `features.footer`);
  - each special parser (announcements, custom variables, both visualizer registries, file-manager tabs, publication filter sources, content locales) with valid, malformed, empty and absent input, together with its warning texts.

  Change no source file.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/env-resolution-characterization.spec.ts`
- [x] 1.2 Add a typed-default parity test to the same file. For every registry key whose env field has a class initializer, assert that the initializer equals the registry `defaultValue` (or the mapper's default where the mapper owns it). If any key differs, stop and record it in `design.md` Open Questions before slice 2.
  - Verification: same command as 1.1.

## 2. Explicit ENV presence (risk-first)

- [x] 2.1 Add the pure `collectExplicitEnvironment(raw)` in `apps/chat-api/src/config/explicit-environment.ts`. It returns a frozen set of variable names whose raw value is defined; an empty string counts as present. Add a unit test.
  - Verification: `npm run test:file -- apps/chat-api/src/config/tests/explicit-environment.spec.ts`
- [x] 2.2 Wire presence capture from the raw object that `validate()` (`apps/chat-api/src/config/validation.ts`) receives into an injectable `ExplicitEnvironment` with `isExplicit(name)`, registered for `AppConfigModule` (`apps/chat-api/src/app-config/app-config.module.ts`). Choose between a reserved typed key on the validated config and a validate-time holder provider (design D9) under a test proving that a `.env`-file value and a process value are present and that a class default is not. Do not read `process.env` in a service. Record the chosen mechanism in `design.md` D9.
  - Verification: `npm run test:file -- apps/chat-api/src/config/tests/explicit-environment.spec.ts apps/chat-api/src/config/validation.spec.ts`
- [x] 2.3 Make the generic `envVar` path and the allowed-roles reads in `apps/chat-api/src/app-config/config-registry/env-config.provider.ts` return `undefined` for a non-explicit variable, leaving derived keys unchanged. Update the provider-level expectations in `apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts` (the provider now returns `undefined` instead of the typed default). The effective-value assertions from 1.1 must pass unchanged.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts apps/chat-api/src/app-config/tests/config-registry/env-resolution-characterization.spec.ts apps/chat-api/src/app-config/tests/app-config.service.spec.ts apps/chat-api/src/app-config/tests/feature-flags/feature-flags.service.spec.ts`
- [x] 2.4 Run `npm run verify:changed` once for slices 1–2.

## 3. Admission, capability and role-gate seams (effective values unchanged)

- [x] 3.1 Move the environment-specific parsers out of `EnvConfigProvider` into pure functions under `apps/chat-api/src/app-config/env-admission/`, one file per concern: `announcements.admission.ts`, `custom-variables.admission.ts`, `visualizers.admission.ts`, `file-manager-tabs.admission.ts`, `publication-filter-sources.admission.ts`, `content-locales.admission.ts`. Each takes the raw value and a `warn` callback, following the `normalizeEnabledUiFeatures` pattern in `apps/chat-api/src/app-config/enabled-ui-features.normalizer.ts`. The provider only reads the variable and delegates. Warning texts stay byte-identical.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/env-admission/env-admission.spec.ts apps/chat-api/src/app-config/tests/config-registry/env-resolution-characterization.spec.ts apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts`
- [x] 3.2 Extract the capability derivations (ASR, conversation naming, footer) into pure checks in `apps/chat-api/src/app-config/feature-capabilities.ts`, called by the provider with identical results. Add unit tests.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/feature-capabilities.spec.ts apps/chat-api/src/app-config/tests/config-registry/env-resolution-characterization.spec.ts`
- [x] 3.3 Move deployment role gating from `EnvConfigProvider.applyRoleGating` into the pure `applyDeploymentRoleGate` in `apps/chat-api/src/app-config/deployment-role-gate.ts`. Apply it once after selection in `AppConfigService` (`apps/chat-api/src/app-config/app-config.service.ts`) for `getClientConfig`, `isEnabled` and `resolveValue`. Cover allowed, restricted, anonymous and unrestricted callers. `FeatureGuard` and the client-config cache key stay as they are.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/deployment-role-gate.spec.ts apps/chat-api/src/app-config/tests/app-config.service.spec.ts apps/chat-api/src/app-config/tests/feature-flags/feature.guard.spec.ts apps/chat-api/src/app-config/tests/config-registry/env-resolution-characterization.spec.ts`
- [x] 3.4 Run `npm run verify:changed` once for slice 3.

## 4. Registry managed metadata and classification

- [x] 4.1 Add the `LocalOnlyReason` string enum, `ManagedKeyContract`, the typed `ManagedValueSchema` subset (no `$ref`, `$id` or `format`), `ManagedFeatureState`, and the payload types in `apps/chat-api/src/app-config/managed-config/managed-config.types.ts`. Add `managed?`, `localOnly?` and `managedContract?` to `ConfigDefinition` in `apps/chat-api/src/app-config/app-config.types.ts`. Add `MANAGED_CONFIG_APP_ID`, `MANAGED_CONFIG_SCHEMA_VERSION = '1.0.0'`, `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS = ['1.0.0']`, `MAX_MANAGED_SCHEMA_BYTES` and `MAX_MANAGED_PAYLOAD_BYTES` (both 57,344) in `apps/chat-api/src/app-config/managed-config/managed-config.constants.ts`. Write JSDoc on every field.
  - Verification: `npm exec nx typecheck chat-api`
- [x] 4.2 Classify all 48 entries in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` exactly as in design D11. Add `managedContract` (operator title and description, order, value schema with the bounds from the `managed-config-contract` spec) to the seven managed keys only. Change no existing field.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`
- [x] 4.3 Extend `apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts` with the rule tests:
  - every key is classified exactly once;
  - `managed` implies a contract and not local-only;
  - a managed `json` key has a value schema;
  - no operator description contains an `EnvironmentVariables` field name;
  - the managed set equals the seven 1.0.0 keys;
  - the named local-only keys carry the expected reasons.

  Add a test to `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` that client-config and `isEnabled` results are identical with the `managed` flags stripped.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts apps/chat-api/src/app-config/tests/app-config.service.spec.ts`

## 5. Schema generator and committed artifact

- [x] 5.1 Add `canonicalJson` and `canonicalSha256` in `apps/chat-api/src/app-config/managed-config/canonical-json.ts`, using UTF-16 code-unit key order, `JSON.stringify` for primitives, and no whitespace. Test them with the fixed vector from the `managed-config-schema-artifact` spec.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/canonical-json.spec.ts`
- [x] 5.2 Add the pure `buildManagedConfigSchema(definitions, schemaVersion)` in `apps/chat-api/src/app-config/managed-config/managed-config-schema.ts`. It emits `$schema`, the root `$id` URN, the `{ config, features }` root with `additionalProperties: false`, `$defs` (`utcTimestamp`, `role`, `featureState`), `dial:semanticConstraints`, `title`/`description`/`dial:meta["dial:propertyOrder"]`/`isHidden`, and registry-only defaults. Add `buildManagedConfigArtifact` and `buildManagedConfigIndex` in `apps/chat-api/src/app-config/managed-config/managed-config-artifact.ts`. Tests cover:
  - determinism, and that the environment cannot leak (generate with populated `process.env` and compare);
  - Studio's structural rules: object root, `#`-only references, no nested `$id`;
  - Ajv 2020 compilation with `strict: false`, `allErrors: true` and `validateFormats: false`;
  - the size bound;
  - each default validating against its own schema.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-config-schema.spec.ts`
- [x] 5.3 Add the generator entry `apps/chat-api/src/managed-config-schema.ts`. It imports only the registry and the `managed-config` modules, writes `apps/chat-api/managed-config-schema/chat-ui-<version>.json` and `index.json`, and runs Prettier on them. Add the Nx target `managed-config-schema` to `apps/chat-api/package.json`, following the `openapi-spec` target (`node -r @swc-node/register`), and the root npm script `managed-config-schema`. Run it and commit `chat-ui-1.0.0.json` and `index.json`. Record the measured canonical size in `index.json` and `design.md`.
  - Verification: `npm run managed-config-schema`, then `git status` shows only the two artifact files changed on a second run (determinism).
- [x] 5.4 Add the drift, immutability and version test `apps/chat-api/src/app-config/tests/managed-config/managed-config-artifact.spec.ts`. It checks:
  - the current file deep-equals the generator output;
  - every committed file hashes to its index entry;
  - the index lists exactly the committed files;
  - `current` is the highest version;
  - `supported` equals the constant;
  - the D8 bump rules against the previous committed version, which are inactive while only 1.0.0 exists, so they are tested with synthetic schemas.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-config-artifact.spec.ts`
- [x] 5.5 Run `npm run verify:changed` once for slices 4–5.

## 6. Contract fixtures, semantic validator and snapshot check

- [x] 6.1 Add version fixtures `apps/chat-api/src/app-config/tests/managed-config/fixtures/chat-ui-1.0.0.fixtures.json`:
  - valid payloads, including an empty publication and every bound at its maximum;
  - invalid payloads, each with the expected Ajv keyword and instance pointer: an unknown key, every local-only key, out-of-range and wrongly typed values, blank text, `null`, a non-`http(s)` link, an offset timestamp, an empty role list, and an unknown policy field.

  Add `apps/chat-api/src/app-config/tests/managed-config/managed-config-contract.spec.ts`, which validates the fixtures against the committed 1.0.0 schema with Ajv 2020 using Studio's options.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-config-contract.spec.ts`
- [x] 6.2 Add the pure `validateManagedSemantics(payload)` in `apps/chat-api/src/app-config/managed-config/managed-semantics.ts`, returning `{ pointer, code }[]` for `calendar_date` and `window_order`. Tests cover an impossible date, a leap day, an inverted window, equal boundaries and open windows.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-semantics.spec.ts`
- [x] 6.3 Add the pure `checkManagedSnapshot(snapshot, expected, seenRevisions)` in `apps/chat-api/src/app-config/managed-config/managed-snapshot.ts`. It returns ok or one of the codes `app_mismatch`, `instance_mismatch`, `environment_mismatch`, `unsupported_schema`, `schema_hash_mismatch`, `invalid_identity`, `payload_too_large`, `revision_changed`, and compares `schemaSha256` with the hash of the committed artifact for that version. Wire it to no provider, service or module, and add a test asserting that `AppConfigModule` does not reference it.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-snapshot.spec.ts`
- [x] 6.4 Run `npm run verify:changed` once for slice 6.

## 7. Documentation

- [x] 7.1 Add `docs/managed-config-schema.md`. It covers:
  - the managed/local-only/eligible classification and how to opt a key in;
  - the bump rules and the released-version freeze;
  - the artifact and index format and the canonical checksum;
  - the operator verification of Studio's upload `sha256`;
  - the statement that export is not activation;
  - what is not authorized: release upload, signing, Studio upload.

  The `docs/centralized-app-config-design.md` update (link, §5 export versus activation, §7 payload and identity, §11 role gating after selection) is deferred: that document is not tracked in this repository, and its final version will be written separately. The new doc therefore does not link to it.
  - Verification: `npm run validate:docs`
- [x] 7.2 Document the `managed-config-schema` npm script and the Nx target in the root `README.md` and `apps/chat-api/README.md`, as `.claude/rules/docs.md` requires for a new npm script.
  - Verification: `npm run validate:docs`

## 8. Close

- [x] 8.1 Run `npm run validate:specs`, `npm run validate:docs`, `npm run format:check`, and `openspec validate export-managed-app-config-schema --strict`.
- [ ] 8.2 Run `npm run verify:full` once.
- [ ] 8.3 Follow-up, out of scope: hand `chat-ui-1.0.0.json` and its `schemaSha256` to Config Studio step 05 as the external reference. Attaching to a release, signing, and uploading into any Studio instance need separate authorization and are not done here.

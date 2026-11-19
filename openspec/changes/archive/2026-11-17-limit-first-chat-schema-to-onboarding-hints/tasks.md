Slicing strategy: one vertical slice on top of #9908 (registry, artifacts, runtime constants, tests, docs), so `1.0.0` is regenerated and pinned exactly once.

## 1. Contract and artifacts

- [x] 1.1 In `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, give `onboarding.hints` `managedConfigKey({ title: 'Onboarding tour', … })` with the D2 value schema (`target` from `Object.values(OnboardingHintTarget)`, title through the announcement non-blank `boundedText`), and operator descriptions that mention the duplicate-id rule and the per-browser seen ids.
- [x] 1.2 Remove `management` from the eight D5 keys and delete their value-schema constants, `HTTP_URL_PATTERN` and the imports they used.
- [x] 1.3 In `managed-config.constants.ts`, keep `MANAGED_CONFIG_SCHEMA_VERSION` at `1.0.0`, set `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS` to `['1.0.0']`, and drop the `1.1.0` pin; drop the `1.1.0` bundled artifact from `snapshot-acceptance.ts`.
- [x] 1.4 Delete `ai-dial-chat-1.1.0.json`, remove the `1.0.0` pin, run `npm run managed-config-schema`, and pin the printed hash by hand. Verify a second run reproduces the committed files.

## 2. Tests

- [x] 2.1 Registry: counts 1 managed / 31 local-only / 19 eligible; the managed set is `onboarding.hints`; `usageLimits.spendingLimitsMode` is unmanaged.
- [x] 2.2 Contract fixtures (`fixtures/ai-dial-chat-1.0.0.fixtures.json`): valid and invalid tours, the 50-hint maximum within the payload limit, keys that return in `1.1.0` rejected, and `featureStates` validated against the exported `$defs/featureState`.
- [x] 2.3 Schema spec: `$id`, exported keys, annotations, `isHidden`, defaults and index for `1.0.0`; feature emission and null-default omission on the test-only contract.
- [x] 2.4 Add `tests/managed-config/test-managed-contract.fixtures.ts` (D6) and put the managed-feature and multi-key mechanism tests on it: `managed-activation.spec.ts`, `shadow-feature-comparison.spec.ts`, `env-config.provider.managed-text.spec.ts`; drop the `1.1.0` spending-mode activation tests.
- [x] 2.5 Real-contract tests for the tour:
  - controller integration: shadow unchanged, active tour in published order equal to the ENV normalization (trimmed title, `description: null`, first of a repeated id), explicit ENV wins, foreign payload not read into typed fields;
  - activation: unmapped `ai-dial-chat` keeps the ENV tour; stale falls back to `[]`;
  - admission: unknown target, missing target, extra member, bad or long id, blank or long title, long description and 51 hints are rejected; a maximal tour and repeated ids are accepted; feature-policy admission uses the test-only contract;
  - `MANAGED_CONFIG_ACTIVE_KEYS` accepts `onboarding.hints` and rejects `welcomeScreen.description` and `features.usageLimitsControl`;
  - shadow comparison of `onboarding.hints`;
  - "export is not activation" with `ONBOARDING_HINTS`, and ENV hints unbounded by the managed contract.
- [x] 2.6 Characterization: the blank `empty` rows of the three texts record `''` at the provider (D7).
- [x] 2.7 Enum drift: confirm that adding an `OnboardingHintTarget` value fails `managed-config-artifact.spec.ts` and that the generator refuses to rewrite `1.0.0` (D4). No separate test.

## 3. Documentation

- [x] 3.1 `docs/managed-config-schema.md`: counts, the `onboarding.hints` contract and its duplicate-id and `localStorage` notes, the rollout order (the tour in `1.0.0`, today's keys in `1.1.0`), index example, payload example, migration runbook, and that a new anchor needs a MINOR version.
- [x] 3.2 `scripts/generate-onboarding-anchors.mjs` and the regenerated `docs/onboarding-anchors.md`: adding an anchor needs a new schema version.
- [x] 3.3 `apps/chat-api/README.md` `ONBOARDING_HINTS` row (managed, bounds, per-browser ids) and `SPENDING_LIMITS_MODE` row; `docs/architecture.md`; `apps/chat-api/.env.template`.

## 4. Verification

- [x] 4.1 With `NX_WORKSPACE_ROOT_PATH=$PWD`: `npm run managed-config-schema` reproduces the committed `1.0.0`; chat-api tests; `npm run openapi:check`; `validate:docs`, `validate:specs`, `validate:agent-docs`; strict OpenSpec validation; `npm run verify:full`.
  - Result: recorded in the #9908 description.

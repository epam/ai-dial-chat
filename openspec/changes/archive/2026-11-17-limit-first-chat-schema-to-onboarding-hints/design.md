## Context

See proposal.md (Why). Facts this change relies on, as of `origin/development` at `504e72dd4` with #9906 (`dbd1ab367`):

- The registry has 51 keys. Before this change 8 are managed (7 in `1.0.0`, plus `usageLimits.spendingLimitsMode` in `1.1.0`), 31 local-only and 12 eligible but unmanaged.
- `onboarding.hints` is a `json` config key read from `ONBOARDING_HINTS` and mapped to the client-config field `onboardingHints` by `normalizeOnboardingHints` (`apps/chat-api/src/app-config/onboarding-hints.normalizer.ts`). The normalizer drops, with a warning, an entry that is not an object, has an id outside `[A-Za-z0-9._-]{1,64}`, repeats an earlier id, has an unknown target, or has a blank title; it trims the title and description and turns a blank description into `null`. It applies no length or count bound.
- `OnboardingHintTarget` (`apps/chat-api/src/app-config/types/onboarding-hint-target.ts`) has 72 values. `apps/chat/src/components/OnboardingHints/tests/onboarding-anchors.spec.ts` keeps `onboarding-anchors.json` equal to them.
- Seen hints are stored per browser in `localStorage` by `id` (#9815, #9906).
- The managed runtime (`managed-runtime/`) validates an `ai-dial-chat` snapshot against the bundled artifact of its `schemaVersion`, checks the pin, and applies only keys listed in `MANAGED_CONFIG_ACTIVE_KEYS`, which must be managed keys of the registry.

## Goals / Non-Goals

**Goals:** `1.0.0` means "the onboarding tour, nothing else", pinned once; the runtime, tests and docs agree with it.

**Non-Goals:** `1.1.0`; Studio, UI-kit or deployment changes; ENV admission changes.

## Decisions

### D1. One key, in `1.0.0`, pinned once

`MANAGED_CONFIG_SCHEMA_VERSION` stays `1.0.0`. The generator refuses to rewrite a pinned version, so the `1.0.0` pin is removed, the artifact regenerated with `npm run managed-config-schema`, and the printed hash pinned by hand. `ai-dial-chat-1.1.0.json`, its index entry and its pin are deleted, and `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS` is `['1.0.0']`. A snapshot carrying `1.1.0` is rejected as `unsupported_schema`, as for any other unsupported version.

Changing a pinned version is review-blocking once the version is part of a Chat release tag (`docs/managed-config-schema.md`, "Pinned versions are frozen"). Neither old version is: no release contains managed configuration, and no instance has an `ai-dial-chat` schema.

### D2. Value schema

```text
array, maxItems 50
  object, additionalProperties false, required [id, target, title]
    id           string, minLength 1, maxLength 64, pattern ^[A-Za-z0-9._-]{1,64}$
    target       string, enum Object.values(OnboardingHintTarget)
    title        string, minLength 1, maxLength 100, pattern \S   (the announcement non-blank text)
    description  string, maxLength 500
```

- The bounds are new: ENV has none. They follow the 17 November proposal (50 hints, title 100, description 500) and keep the largest publication (50 maximal hints, about 37 KB canonical) under Studio's 57,344-byte payload limit; a contract fixture checks that.
- `description` has no non-blank rule. A form that clears an optional field may send `""`; the normalizer already turns a blank description into `null`.
- The enum is a plain `enum`, without `oneOf` titles; labels wait for kit K4.
- Array order is the tour order. The schema does not sort or group.

### D3. Duplicate ids

JSON Schema cannot require distinct `id` values across array items (`uniqueItems` compares whole items). The schema accepts duplicates; Chat keeps the first hint with an id and drops later ones with a warning, as for ENV. The operator description of the key and of `id`, `docs/managed-config-schema.md` and the `ONBOARDING_HINTS` README row say so. A Studio semantic rule is a separate Studio decision.

### D4. A new anchor needs a new schema version

The enum is generated from `OnboardingHintTarget`. Adding an anchor changes the generated `1.0.0` schema, so `managed-config-artifact.spec.ts` ("keeps the current version equal to the generator output") fails and the generator refuses to rewrite the pinned version, which forces a MINOR bump (the set of valid payloads grows). This was checked by adding a temporary enum value: the artifact test failed and the generator reported the pin mismatch. No separate enum test is added. Until the new version is uploaded, only `ONBOARDING_HINTS` can use the anchor. `docs/onboarding-anchors.md` says so.

### D5. The eight keys return in `1.1.0`

`announcement.title`, `announcement.description`, `announcement.items`, `welcomeScreen.description`, `fileManager.availableTabs`, `usageLimits.warningThresholdPercent`, `usageLimits.spendingLimitsMode` and `features.usageLimitsControl` lose `management`. Their value-schema constants (`ANNOUNCEMENT_*_SCHEMA`, `WELCOME_SCREEN_DESCRIPTION_SCHEMA`, `FILE_MANAGER_TABS_SCHEMA`, `USAGE_WARNING_THRESHOLD_SCHEMA`, `SPENDING_LIMITS_MODE_SCHEMA`, `HTTP_URL_PATTERN`) have no other user and are deleted. `1.1.0` restores them from the git history of this file (`origin/development`), together with announcement `severity`, and restores their contract fixtures. The contract scenarios "Non-http link", "Out-of-range threshold" and "Unknown file-manager tab" keep their titles but now state what 1.0.0 does (a hint has no link member; the threshold and tab keys are unknown); `1.1.0` gives them back their original constraints.

### D6. Mechanisms without a `1.0.0` key run on a test-only contract

`1.0.0` has no managed feature and no second managed config key, but the runtime keeps the feature path (policies, windows, targeting, the `FeatureGuard` agreement, cache boundaries) for `1.1.0`. Deleting those tests would leave released code untested; rewriting them against a fake runtime would test less.

`apps/chat-api/src/app-config/tests/managed-config/test-managed-contract.fixtures.ts` marks four eligible keys managed on top of the real registry (`welcomeScreen.description`, `announcement.description`, `usageLimits.warningThresholdPercent`, `features.usageLimitsControl`) and compiles validators from a schema generated from that registry. A spec opts in with two `vi.mock` calls (the registry module and `compileManagedPayloadValidators`); snapshots keep the real `1.0.0` version and pin. Used by `managed-activation.spec.ts`, `shadow-feature-comparison.spec.ts` and `env-config.provider.managed-text.spec.ts`; `snapshot-acceptance.spec.ts` and `managed-config-schema.spec.ts` use its helpers without mocks. The contract is never generated into `managed-config-schema/`.

Everything that can use the real contract does: the controller integration tests, shadow comparison, active-key validation, admission and the contract fixtures run on `onboarding.hints`. Feature-state fixtures validate bare states against the exported `$defs/featureState` of the committed `1.0.0`.

Alternative considered: a production seam that injects the registry and validators. Rejected; it widens production code for tests only.

### D7. The blank managed-text rule is dormant

`EnvConfigProvider` resolves a blank ENV value of a managed string key to `undefined`. `1.0.0` manages no string key, so the three announcement and welcome texts resolve a blank value to `''` again, as before managed export; their client-config fields are `null` either way (the characterization rows record this). The rule stays and is tested on the test-only contract; it applies again once `1.1.0` manages those texts.

## Risks / Trade-offs

- **Studio editors see raw anchor names.** Until K4, `target` is a list of identifiers. `docs/onboarding-anchors.md` and `?onboarding-anchors` map them to elements.
- **Changing an id re-shows a hint.** Seen state is per browser and keyed by `id`; editing text or order does not re-show it. Documented for operators.
- **The test-only contract can drift from `1.1.0`.** It declares minimal value schemas only for mechanism tests; `1.1.0` brings its own fixtures.

## Migration Plan

Nothing is deployed or released with the old `1.0.0`/`1.1.0`. After merge, C1 uploads `ai-dial-chat-1.0.0.json` from the image's commit and publishes the current `ONBOARDING_HINTS` value. Rollback is a revert of this commit, before any upload.

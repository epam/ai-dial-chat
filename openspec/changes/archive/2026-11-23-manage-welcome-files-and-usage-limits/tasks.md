# Tasks

Slicing strategy: **contract-first, then vertical.**

- Slice 1 fixes and pins the `1.2.0` artifact. The hash is frozen after the first dev upload, and every later slice validates against it.
- Slice 2 retires the test-only contract, so the feature-path tests run on the real key before any new behavior is added.
- Slices 3 and 4 each take one runtime path (config values, then the feature) through registry → snapshot → client-config, with its tests and docs.
- Slice 5 writes the schema reference and editor guide, and slice 6 checks the whole change once.

Before editing, read `apps/chat-api/AGENTS.md` and `.claude/rules/docs.md`. No `libs/*` or `apps/chat` source changes in this change.

## 1. Contract: the `1.2.0` artifact

- [x] 1.1 Give `FILE_MANAGER_ALLOWED_TABS` one import path that the registry can use without a cycle. Import it from `apps/chat-api/src/app-config/env-admission/file-manager-tabs.admission.ts` if that creates no cycle; otherwise move it to `apps/chat-api/src/app-config/types/file-manager-tabs.ts` and re-export it from the admission module. Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts`, unchanged and green.
  - Result: the admission module has no imports, so the registry imports `FILE_MANAGER_ALLOWED_TABS` from it in place; nothing moved.
- [x] 1.2 In `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, add `management` to the five keys (design D2):
  - `welcomeScreen.description`: `managedConfigKey`, `boundedText(1000)`;
  - `fileManager.availableTabs`: array 1–4, `uniqueItems`, item enum from `FILE_MANAGER_ALLOWED_TABS`;
  - `usageLimits.warningThresholdPercent`: integer 1–99;
  - `usageLimits.spendingLimitsMode`: enum `Object.values(SpendingLimitsMode)`;
  - `features.usageLimitsControl`: `managedFeatureKey`.

  Use the D2 titles, descriptions and display orders: welcome 10 (between the banner and the tour, since 20–25 are the celebrations), tabs 30, threshold 40, mode 41, feature 1. Update the `1.1.0` comment above `ANNOUNCEMENT_HTML_HELP`. Verify that `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-config-contract.spec.ts` compiles. The descriptions are checked by the env-name test in 1.5.
- [x] 1.3 In `apps/chat-api/src/app-config/managed-config/managed-config.constants.ts`:
  - set `MANAGED_CONFIG_SCHEMA_VERSION` to `'1.2.0'` and `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS` to `['1.0.0', '1.1.0', '1.2.0']`;
  - run `npm run managed-config-schema`, and pin the printed `1.2.0` hash by hand in `PINNED_MANAGED_CONFIG_SCHEMA_SHA256`.

  Verify:
  - `git diff --exit-code apps/chat-api/managed-config-schema/ai-dial-chat-1.0.0.json apps/chat-api/managed-config-schema/ai-dial-chat-1.1.0.json` is clean;
  - `index.json` lists three versions with `current` `1.2.0`;
  - a second generator run leaves the tree clean.
  - Result: `1.2.0` pinned as `5761c06c65b9846e965b02074f7291e92d651ffff074c6ad7653b25376fef2e1`, 11,847 canonical bytes.
- [x] 1.4 Bundle `ai-dial-chat-1.2.0.json` in `BUNDLED_ARTIFACTS` (`apps/chat-api/src/app-config/managed-runtime/snapshot-acceptance.ts`). In `snapshot-acceptance.spec.ts`, change the unsupported example from `1.2.0` to `1.3.0` and add a pinned `1.2.0` acceptance case. Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-runtime/snapshot-acceptance.spec.ts`.
- [x] 1.5 Update `apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`:
  - counts: 53 keys, of which 15 managed, 29 local-only and 9 eligible;
  - the exact `1.2.0` managed set, with `features.usageLimitsControl` as the only managed feature;
  - the stale "until 1.2.0" comments removed.

  Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`.
- [x] 1.6 Add `apps/chat-api/src/app-config/tests/managed-config/fixtures/ai-dial-chat-1.2.0.fixtures.json`.
  - Valid fixtures:
    - an empty publication;
    - the representative publication from the spec;
    - each new key alone at its maximum, including the 50-role feature;
    - the leap-day window;
    - a window with a fraction.
  - Invalid fixtures, one per scenario under "Welcome text bounds", "File Manager tab list bounds", "Usage limit bounds" and "Usage-limits control is a managed feature":
    - the offset timestamp, an empty `availability`, empty roles, and an unknown policy member;
    - `mcpApps.theme` and `features.projectsEnabled` rejected.
  - Semantic fixtures: 30 February, equal boundaries and an inverted window, each with its expected `{ pointer, code }`.

  Extend `managed-config-contract.spec.ts`, `managed-config-schema.spec.ts` and `managed-semantics.spec.ts` to:
  - validate the fixtures with `createStudioAjv`, then `validateManagedSemantics` on the semantic fixtures;
  - check the exported keys and annotations;
  - check that `dial:semanticConstraints` and `$defs` are unchanged from `1.1.0`;
  - check the representative publication and each key alone against 57,344 canonical bytes;
  - compare the "Same rules as the environment" table with the `validation.spec.ts` threshold and mode examples.

  Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-config-contract.spec.ts apps/chat-api/src/app-config/tests/managed-config/managed-config-schema.spec.ts apps/chat-api/src/app-config/tests/managed-config/managed-semantics.spec.ts`.
  - Result: the semantic fixtures run in `managed-config-contract.spec.ts` (every valid fixture has no semantic issue, every semantic fixture reports its exact `{ pointer, code }`), so `managed-semantics.spec.ts` needed no change. The not-yet-managed examples in `snapshot-acceptance.spec.ts` moved to `mcpApps.theme` and `features.projectsEnabled`.
- [x] 1.7 Verify that `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-config-artifact.spec.ts` passes:
  - `1.2.0` is a MINOR successor of `1.1.0`;
  - every `1.0.0` and `1.1.0` valid fixture validates under it;
  - `$defs/featureState` is unchanged;
  - the pins match.

## 2. Slice: retire the test-only contract

- [x] 2.1 Delete `apps/chat-api/src/app-config/tests/managed-config/test-managed-contract.fixtures.ts` (design D6). In each consumer, drop the overlay and use `CONFIG_DEFINITIONS` and the bundled validators of the real `1.2.0` contract, with snapshots carrying `1.2.0` and its pin. The consumers are:
  - `apps/chat-api/src/app-config/tests/managed-runtime/managed-activation.spec.ts` (both hoisted mocks);
  - `apps/chat-api/src/app-config/tests/managed-runtime/shadow-feature-comparison.spec.ts` (both hoisted mocks);
  - `apps/chat-api/src/app-config/tests/managed-runtime/snapshot-acceptance.spec.ts`;
  - `apps/chat-api/src/app-config/tests/managed-config/managed-config-schema.spec.ts`.

  Verify that `rg -n "test-managed-contract|withTestManaged|TEST_MANAGED_KEYS" apps/chat-api` finds nothing, and that `npm run test:file -- <the four specs>` passes with no expectation weakened.
  - Result: all four consumers pass on the real contract with no expectation changed.

## 3. Slice: managed welcome text, tabs and usage values

- [x] 3.1 Update `apps/chat-api/src/app-config/tests/config-registry/env-config.provider.managed-text.spec.ts` and the `empty` rows in `env-resolution-characterization.spec.ts`:
  - a blank `WELCOME_SCREEN_DESCRIPTION` resolves to `undefined`;
  - the "unmanaged" example becomes `MCP_APP_USER_AGENT`;
  - unset `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT`, `SPENDING_LIMITS_MODE` and `USAGE_LIMITS_CONTROL_ENABLED` resolve to `undefined` despite their class defaults.

  Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/env-config.provider.managed-text.spec.ts apps/chat-api/src/app-config/tests/config-registry/env-resolution-characterization.spec.ts`.
- [x] 3.2 Add parity tests to `apps/chat-api/src/app-config/tests/managed-runtime/managed-content-activation.spec.ts` (real contract, design D9), one per scenario of "Managed welcome text, tab list and usage limits match their environment output":
  - padded welcome text, ENV versus snapshot;
  - the reordered tab list passed through unchanged;
  - threshold `90` and mode `enforce`;
  - explicit `SPENDING_LIMITS_MODE` wins;
  - `stale` gives the defaults;
  - the key activated before publication gives `off`.

  Also add the `file-manager-tab-config` scenarios "Explicit variable wins" and "Variable with no known id does not shadow". Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-runtime/managed-content-activation.spec.ts`.
- [x] 3.3 Extend the "export is not activation" test in `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` (`withManagedFieldsStripped`) so that the five variables are set, `WELCOME_SCREEN_DESCRIPTION` blank. Verify that the stripped and managed results stay equal with `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`.
- [x] 3.4 In `apps/chat-api/src/config/tests/managed-config-environment.spec.ts`:
  - change the "not a managed key" example to `mcpApps.theme`;
  - add "1.2.0 keys are accepted" with the full dev list plus the five keys.

  Verify with `npm run test:file -- apps/chat-api/src/config/tests/managed-config-environment.spec.ts`.
- [x] 3.5 Add a case to `libs/chat-hooks/src/files/useDialFileManagerTabConfig/tests/useDialFileManagerTabConfig.spec.ts`: `fileManagerTabs` `['organization', 'shared', 'my_files', 'all']` yields All, My files, Shared, Organization. This is a test only, with no source change. Verify with `npm run test:file -- libs/chat-hooks/src/files/useDialFileManagerTabConfig/tests/useDialFileManagerTabConfig.spec.ts`.
- [x] 3.6 Update the `WELCOME_SCREEN_DESCRIPTION`, `FILE_MANAGER_AVAILABLE_TABS`, `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT` and `SPENDING_LIMITS_MODE` rows in `apps/chat-api/README.md`, and their comments in `apps/chat-api/.env.template`. Each row names:
  - its managed key and bounds;
  - that an explicit value wins and is the fallback;
  - for tabs, that order is ignored;
  - for the mode, that `enforce` is published before the variable is removed.

  Verify with `npm run validate:docs`.

## 4. Slice: managed usage-limits control

- [x] 4.1 Add to `managed-activation.spec.ts`, now on the real key, one test per new scenario of "Managed feature gates":
  - a future `startsAt` opens without a new publication;
  - targeting `beta` versus `staff`;
  - an explicit `USAGE_LIMITS_CONTROL_ENABLED=true` over a published `enabled: false`, and `false` after the variable is removed.

  Keep the existing kill-switch and `features: {}` cases on this key. Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-runtime/managed-activation.spec.ts`.
  - Result: the window and targeting cases already ran on this key; the new tests are explicit `true` over a published `enabled: false`, and `false` once the variable is removed.
- [x] 4.2 In `apps/chat-api/src/app-config/tests/managed-runtime/shadow-feature-comparison.spec.ts` and `shadow-comparison.spec.ts`:
  - a `1.1.0` snapshot on this build yields fifteen comparisons, five of them `absent`;
  - an explicit `USAGE_LIMITS_CONTROL_ENABLED=true` against a published policy is `env_shadowed`.

  Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-runtime/shadow-feature-comparison.spec.ts apps/chat-api/src/app-config/tests/managed-runtime/shadow-comparison.spec.ts`.
- [x] 4.3 Update the `USAGE_LIMITS_CONTROL_ENABLED` row in `apps/chat-api/README.md` and its `.env.template` comment:
  - the managed feature, its window and targeting;
  - an explicit `true` overrides a published off;
  - `false` is the kill switch.

  Verify with `npm run validate:docs`.
- [x] 4.4 Run `npm run verify:changed` once for slices 2–4.
  - Result: green after one fix: `app-config.controller.spec.ts` hard-coded `schemaVersion` `1.1.0` in the managed metadata it expects.

## 5. Docs: schema reference and editor guide

- [x] 5.1 Update `docs/managed-config-schema.md`:
  - the class counts (15 / 29 / 9);
  - the rollout table from design D1, with the 1.2.0 "needs first" marked met;
  - a "Welcome text, File Manager and usage limits" subsection with the D2 bounds, the D3 set semantics, the D4 mode reasoning and residual risk, the D5 feature shape and semantic parity (naming both checked commits), and the payload note of D8;
  - the "Export is not activation" blank-text sentence, which now covers the welcome text;
  - the index example;
  - migration-runbook step 5: two steps on dev, each variable removed in the activating values change, and the mode published before its variable is removed.

  Verify with `npm run validate:docs`.
  - Result: `docs/managed-config-onboarding.md` also moved its upload example and supported-version sentence to `1.2.0`, and the payload-contract sentence "no committed schema exports a feature" was corrected. The editor-guide example was checked against the `1.2.0` artifact with Studio's Ajv options.
- [x] 5.2 Extend `docs/managed-content.md`, the editor guide:
  - the intro and "Pick schema version" sentence for `1.2.0`, and that `features` is no longer always empty;
  - a **welcome text** section (plain text, one line);
  - a **File Manager tabs** section: raw ids and their labels, the order has no effect, All needs two other tabs;
  - a **usage limits** section: the threshold, and that the mode is set only with the operator and must match DIAL Core;
  - a **usage-limits control** section: Enabled, the UTC window (start inclusive, end exclusive), roles, and that Studio rejects an impossible date or an inverted window;
  - a **"why is my change not visible"** note: an explicit deployment value, including a deployment `true` for the control.

  Verify with `npm run validate:docs`, which checks the relative links.

## 6. Integration verification

- [x] 6.1 Check the artifact against the generator:
  - `npm run managed-config-schema` reproduces the committed `1.0.0`, `1.1.0` and `1.2.0` with a clean `git status`;
  - `jq '.versions[] | {schemaVersion, schemaSha256, canonicalBytes}' apps/chat-api/managed-config-schema/index.json` shows three pins, and `1.2.0` stays at or below 57,344 canonical bytes.
- [x] 6.2 Run `npm exec nx test chat-api`, `npm exec nx test chat-hooks` and `npm exec nx lint chat-api`. `npm run openapi:check` must report no change, because the response shape is unchanged.
  - Result: `chat-api` 9,140 tests and `chat-hooks` 3,947 tests passed; lint has 0 errors (32 warnings, none in changed files); `openapi:check` exits 0.
- [x] 6.3 Run the checks:
  - `npm run validate:docs`, `npm run validate:specs` and `npm run validate:agent-docs`;
  - `npm run spec:impact` (advisory);
  - `openspec validate manage-welcome-files-and-usage-limits --strict`.
  - Result: all pass; `validate:specs` reports 0 errors and 173 warnings in unrelated main specs; `spec:impact` reports nothing.
- [x] 6.4 Run `npm run verify:full` once, and record the result and any unrelated flake here.
  - Result (2026-11-23): typecheck, lint, format and `test:full` all passed on the first run; no flake.

## 7. Review follow-up

- [x] 7.1 Normalize `fileManager.availableTabs` for every source in `apps/chat-api/src/app-config/file-manager-tabs.normalizer.ts` (fixed order, `all` dropped below two source tabs, every tab with a warning when no source tab is listed) and use it in `client-config.mapper.ts`. Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/file-manager-tabs.normalizer.spec.ts apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts`.
- [x] 7.2 Move `FILE_MANAGER_ALLOWED_TABS` to `apps/chat-api/src/app-config/types/file-manager-tabs.ts` and import it from the registry, the admission module and the mapper. Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/env-admission/env-admission.spec.ts`.
- [x] 7.3 Replace the pass-through characterization tests (`client-config.mapper.spec.ts` reference identity, `app-config.service.spec.ts` `[1, null]`) and the two `fileManager.availableTabs` rows of `env-resolution-characterization.spec.ts` whose effective value changes on purpose; add parity and shadow cases for `["all"]` and a reordered list (`managed-content-activation.spec.ts`, `shadow-comparison.spec.ts`).
- [x] 7.4 Update the `fileManagerTabs` DTO description and regenerate `libs/chat-api-client` (`nx run chat-api:openapi-spec` and `openapi-sdk`, with placeholder `CORS_ORIGIN`, `DIAL_CORE_URL`, `AUTH_SESSION_SECRET` and `AUTH_CALLBACK_BASE_URL`, because `openapi-spec.ts` validates the environment at import time before its own defaults apply); update the README row, `.env.template`, `docs/managed-config-schema.md`, `docs/managed-content.md` and the `file-manager-tab-config` and `managed-config-activation` specs.
- [x] 7.5 Run `npm run verify:full` again.

## Workflow follow-up

- The dev rollout runs as a separate runbook step only after this change is merged and in the dev image (design, Migration Plan):
  - Step A: upload `1.2.0`, publish the four values with the mode `enforce`, then remove their variables and activate the four keys in one values change.
  - Step B: try one inverted window and record Studio's rejection, publish a valid policy, then remove `USAGE_LIMITS_CONTROL_ENABLED` if set and activate `features.usageLimitsControl` in one values change.
  - Record on dev what the tab and mode fields look like in Studio without K4 and K10, and that the policy editor appears for the feature.
- Archive the change after review, then sync the delta specs.

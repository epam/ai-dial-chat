## Why

Operators still need a redeploy to change the welcome text, the File Manager tabs, the usage-banner threshold, the spending-limits mode and the usage-limits control. Schema `1.1.0` manages the tour, announcements and celebrations (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`). The five keys here were managed by a `1.0.0` and a `1.1.0` that no instance or release ever carried; both were replaced in #9908 before the first upload, so their contract can still be chosen. `1.1.0` is live on dev since 23 Nov, and Config Studio's backend has enforced `calendar_date` and `window_order` since its feature-policy merge (`bd1286d`). So a managed feature can now ship.

## What Changes

- New managed schema **`1.2.0`** for `ai-dial-chat`. It is a MINOR bump that adds optional properties only. Every `1.0.0` and `1.1.0` payload stays valid. It adds four config keys and the first managed feature:
  - `welcomeScreen.description`: plain text, non-blank, at most 1,000 characters;
  - `fileManager.availableTabs`: 1–4 unique ids from `all`, `my_files`, `shared`, `organization`;
  - `usageLimits.warningThresholdPercent`: an integer from 1 to 99, default 75;
  - `usageLimits.spendingLimitsMode`: `off`, `shadow` or `enforce`, default `off`;
  - feature `features.usageLimitsControl`: the existing shared `featureState` (enabled, an availability window and role targeting) and the two existing semantic constraints.
- The value schemas are the ones recovered from the pre-#9908 `chat-ui-1.1.0.json` (`git show 024ed5445^:apps/chat-api/managed-config-schema/chat-ui-1.1.0.json`). Each was rechecked against today's ENV validation and normalizers. The enums now come from their single sources (`FILE_MANAGER_ALLOWED_TABS`, `SpendingLimitsMode`), and the operator descriptions are rewritten (design D2).
- **Correction to the plan:** `fileManager.availableTabs` is a set, not an ordered list. Chat shows the tabs in a fixed order (`useDialFileManagerTabConfig` filters a fixed tab list by membership). The order an editor sets in Studio therefore has no effect, and the key description says so. Making Chat honor the order is a separate frontend change, not part of this one (design D3).
- Managed values reach the client through the same `client-config.mapper.ts` entries as ENV values. One mapping changes, after review: `fileManager.availableTabs` goes through a new `normalizeFileManagerTabs` for every source (fixed order, `all` dropped below two source tabs, every tab when no source tab is listed), so a published `["all"]` cannot empty File Manager (design D3, review follow-up). The blank-text rule in `EnvConfigProvider` now also covers `WELCOME_SCREEN_DESCRIPTION`, because the key becomes managed. A blank value resolves to `undefined` instead of `''`, and the client field is `null` either way.
- The test-only managed contract (`test-managed-contract.fixtures.ts`) is retired. It managed exactly three of these keys so that feature-path tests had something to run on. Those tests now run on the real `1.2.0` contract (design D6).
- `MANAGED_CONFIG_SCHEMA_VERSION` becomes `1.2.0` and `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS` becomes `['1.0.0', '1.1.0', '1.2.0']`. The change also:
  - commits `ai-dial-chat-1.2.0.json`;
  - updates `index.json`;
  - adds the pin and the `1.2.0` contract fixtures;
  - bundles all three artifacts in `snapshot-acceptance.ts`.
- Docs:
  - `docs/managed-config-schema.md`: the rollout table, the counts (15 managed, 29 local-only, 9 eligible), and a "Welcome text, File Manager and usage limits" subsection;
  - `docs/managed-content.md`: an editor-guide section for the four values and the usage-limits control;
  - `apps/chat-api/README.md` and `.env.template`: the five variables become fallbacks.

## Non-goals

- Any Config Studio, UI-kit (K4 enum labels, K10 ordered multi-select), Launchpad or deployment change. The dev upload, publication and activation are a separate runbook step (design, Migration Plan).
- Making File Manager honor the configured tab order.
- A semantic rule that `fileManager.availableTabs` keeps at least one source tab: Studio fails closed on an unknown code (design D3).
- Changing ENV parsing or the client-config response shape. There is no frontend, lib, OpenAPI or i18n change.
- Updating the feature specs that name only the environment variable as source (`start-view-greeting`, `conversation-input-usage-limits`, `conversation-input-usage-limit-banner`). The generic resolution order in `managed-config-activation` covers them, and `usage-spending-budgets` already anticipates "the schema version that manages" its key.
- `mcpApps.theme`, `features.projectsEnabled`, `footer.html`, the default-deployment pair and `uiFeatures.enabledUiFeatures` stay for later versions.

## Alternatives considered

1. **Contents of `1.2.0`.** **Chosen: the five keys the plan already assigned.** They are small, client-only, and include one feature that proves the managed feature path before `features.projectsEnabled`. Rejected: shipping the four config keys now and the feature later. The feature path is the main thing still unproven, and the semantic prerequisite is met.
2. **`fileManager.availableTabs` order.** **Chosen: manage the key as a set and document it.** Rejected: honor the order in this change. That touches `libs/chat-hooks` and two hosts, and it also changes what an explicit `FILE_MANAGER_AVAILABLE_TABS` does today. Rejected: an object of four booleans. It does not match the ENV shape, so the mapper would need a second input shape.
3. **`usageLimits.spendingLimitsMode`.** **Chosen: managed, as planned.** The value only decides presentation, and DIAL Core enforces budgets whatever Chat shows. Rejected: reclassify it local-only as a mirror of a Core setting. That would contradict the published rollout plan for little gain, because an explicit `SPENDING_LIMITS_MODE` still pins it (design D4).
4. **Test-only contract.** **Chosen: retire it.** Rejected: keep it as a no-op overlay. Tests would then stop showing which contract they exercise.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `managed-config-contract`: the `1.2.0` managed set, its value bounds, the first managed feature and its semantic constraints; the registry counts move from `1.1.0` to `1.2.0`.
- `managed-config-schema-artifact`: the build accepts `["1.0.0", "1.1.0", "1.2.0"]`, `1.2.0` is a MINOR successor of `1.1.0`, and the version-bump examples move up one version.
- `managed-config-runtime-reader`: a `1.2.0` snapshot is supported, `1.3.0` is the unsupported example, and older snapshots keep validating against their own artifacts.
- `managed-config-activation`:
  - `1.2.0` keys are accepted in `MANAGED_CONFIG_ACTIVE_KEYS`;
  - the not-yet-managed example becomes `mcpApps.theme`;
  - the feature gates now name a real managed feature;
  - the five keys produce the same output from ENV and from a snapshot.
- `config-registry-and-env-provider`: the blank managed-text rule covers `welcomeScreen.description`.
- `file-manager-tab-config`: the tab list may come from Config Studio, and the tabs keep their fixed order whatever order is published.

## Impact

- Code (`apps/chat-api` only):
  - `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`;
  - `apps/chat-api/src/app-config/managed-config/managed-config.constants.ts`;
  - `apps/chat-api/src/app-config/managed-runtime/snapshot-acceptance.ts`.
- Artifacts: `apps/chat-api/managed-config-schema/ai-dial-chat-1.2.0.json` (new) and `index.json`.
- Tests under `apps/chat-api/src/app-config/tests/` and `apps/chat-api/src/config/tests/`. `test-managed-contract.fixtures.ts` is deleted, and its four consumers move to the real registry.
- Docs: `docs/managed-config-schema.md`, `docs/managed-content.md`, `apps/chat-api/README.md`, `apps/chat-api/.env.template`.
- Compatibility:
  - not breaking: `1.0.0` and `1.1.0` stay supported and frozen;
  - without publication and activation, effective values are unchanged;
  - one provider-level difference: a blank `WELCOME_SCREEN_DESCRIPTION` resolves to `undefined` instead of `''`, and the client field is `null` either way.
- Rollback:
  - per key: remove it from `MANAGED_CONFIG_ACTIVE_KEYS` and restore its variable;
  - per deployment: `MANAGED_CONFIG_MODE=off`;
  - per configuration: publish an earlier revision;
  - per code: first stop reading `1.2.0` (publish a `1.1.0` revision or set the mode to `off`), then revert. A build without `1.2.0` rejects a `1.2.0` snapshot as `unsupported_schema`.
- Dev handoff: an explicit variable wins over a published value, and an explicit `USAGE_LIMITS_CONTROL_ENABLED=true` even overrides a published `enabled: false`. Each variable is removed in the same values change that activates its key. Dev sets `SPENDING_LIMITS_MODE=enforce`, so `enforce` is published before that variable is removed; otherwise the mode drops to `off`.
- No library, i18n, RTL, accessibility, OpenAPI or client-config shape impact. No `libs/*` source changes.

## Acceptance criteria

- `npm run managed-config-schema` writes `ai-dial-chat-1.2.0.json`, leaves `1.0.0` and `1.1.0` byte-identical, and a second run leaves the tree clean. The artifact test accepts `1.2.0` as a MINOR successor of `1.1.0`.
- Contract fixtures validate under Studio's Ajv options: each key at its maximum and a representative publication fit within 57,344 bytes, and every bound has an invalid fixture. Impossible dates and inverted or empty windows fail Chat's semantic validator with the codes Studio enforces.
- For the same raw content, the client-config fields are the same from ENV and from a `1.2.0` snapshot, and an explicit variable still wins.
- `features.usageLimitsControl` follows every managed feature gate, and the feature-path tests run on the real registry, without the test-only contract.
- `openspec validate manage-welcome-files-and-usage-limits --strict`, `npm run validate:docs`, `npm run validate:specs` and `npm run verify:full` pass.

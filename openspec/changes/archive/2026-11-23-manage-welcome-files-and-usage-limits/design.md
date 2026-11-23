## Context

See `proposal.md` for the motivation. This section separates what the code does today on `development` `dd37ad783` (observed) from what this change proposes.

**Observed:**

- **Registry.** `CONFIG_DEFINITIONS` declares 53 keys: 10 managed, 29 local-only, 14 eligible. None of the five keys has a `management` entry.
  - `welcomeScreen.description` (`WELCOME_SCREEN_DESCRIPTION`): string, default `null`.
  - `fileManager.availableTabs` (`FILE_MANAGER_AVAILABLE_TABS`): JSON, default all four ids.
  - `usageLimits.warningThresholdPercent` (`USAGE_LIMITS_WARNING_THRESHOLD_PERCENT`): number, default 75.
  - `usageLimits.spendingLimitsMode` (`SPENDING_LIMITS_MODE`): string, default `off`.
  - `features.usageLimitsControl` (`USAGE_LIMITS_CONTROL_ENABLED`): feature, default `false`, no `allowedRolesEnvVar`.
- **ENV validation and admission.**
  - The threshold is `@IsInt @Min(1) @Max(99)`, and `SPENDING_LIMITS_MODE` is `@IsEnum(SpendingLimitsMode)`. Both are in `config/env/feature-flags.env.ts`.
  - `FILE_MANAGER_AVAILABLE_TABS` is split on commas and admitted by `admitFileManagerTabs`. It keeps known ids in their given order, drops unknown ones, keeps duplicates, and resolves to `undefined` when nothing known is left.
  - `WELCOME_SCREEN_DESCRIPTION` is unbounded `@IsString`.
  - The typed class defaults (`75`, `off`, `false`, `[]`) are not explicit: `ExplicitEnvironment` decides presence.
- **Mapping** (`client-config.mapper.ts`). No mapping depends on the source:
  - `welcomeScreen.description` → `toNullableText` (trimmed, never markup);
  - `fileManager.availableTabs` → passed through when it is an array, otherwise the default;
  - threshold → passed through when it is a number, otherwise 75;
  - mode → passed through when it is a known mode, otherwise `off` with a warning.
- **Blank text.** `EnvConfigProvider` drops a blank string only for a *managed* key, so `WELCOME_SCREEN_DESCRIPTION=" "` resolves to `"   "` today.
- **File Manager.** The frontend ignores the order of the tab list.
  - `useDialFileManagerTabConfig` (`libs/chat-hooks`) filters the fixed `allTabs` from `useDialFileManagerTabs` by membership.
  - `DialFileManagerPage` builds its sections from the fixed `DIAL_FILE_MANAGER_SECTION_TABS`.
  - All is kept only while at least two source tabs are enabled.
- **Usage-limits control.**
  - Its only consumers are `UsageLimitsControl`, `UsageLimitBanner`, `ConversationView` and `NewConversationComposer` in `apps/chat`, through `useFeatureFlag('usageLimitsControl')`.
  - No `@RequireFeature` guard uses it, and `isCapabilityAvailable` has no rule for it.
- **Managed features.**
  - `isManagedFeatureEnabled` (`managed-runtime/managed-evaluation.ts`) applies the gates. The configured bit is explicit ENV, then the managed `enabled`, then the default.
  - Window boundaries schedule the next refresh (`nextManagedBoundary`).
  - The generator already emits `$defs/featureState`, `$defs/utcTimestamp`, `$defs/role` and both semantic constraints in `1.0.0` and `1.1.0`, with an empty `features` section.
- **Test-only contract.** `tests/managed-config/test-managed-contract.fixtures.ts` marks `welcomeScreen.description`, `usageLimits.warningThresholdPercent` and `features.usageLimitsControl` managed. Only the tests see this. It is used by:
  - `managed-activation.spec.ts`;
  - `shadow-feature-comparison.spec.ts`;
  - `snapshot-acceptance.spec.ts`;
  - `managed-config-schema.spec.ts`.

  Its header says that a later schema version exports these keys with their real value schemas.
- **Recovered history.** The pre-#9908 `chat-ui-1.1.0.json` (`git show 024ed5445^:apps/chat-api/managed-config-schema/chat-ui-1.1.0.json`) managed the five keys with these schemas:
  - welcome text: non-blank, ≤ 1,000 characters;
  - tabs: 1–4 unique values of the four-id enum, with that default;
  - threshold: integer 1–99, default 75;
  - mode: enum, default `off`;
  - feature: `$ref` to `featureState`.

  Its feature state and semantic constraints are identical to today's generator output.

**Constraints:**

- Studio's Ajv runs with `validateFormats: false`. `ManagedValueSchema` has no `$ref`, `format`, `oneOf`, `anyOf` or `contains`.
- Studio fails closed on an unknown `dial:semanticConstraints` code. The payload limit is 57,344 canonical bytes.
- Config Studio recognizes a feature policy by structure (`libs/feature-policy/src/vocabulary.ts`), not by key name or `$defs` name.

## Goals / Non-Goals

**Goals:**

- A `1.2.0` artifact whose bounds and window rules Studio enforces before Chat sees a value.
- The same client output for the same content from ENV or from a snapshot.
- The managed feature path proven on a real key, with tests on the real contract.

**Non-Goals:**

- Frontend or lib changes, including honoring the tab order.
- New semantic constraint codes.
- K-annotations (K4, K10) in the schema.

## Decisions

### D1. `1.2.0` = the five planned keys

The rollout table becomes:

| Schema | Keys | Needs first |
| --- | --- | --- |
| 1.0.0 | `onboarding.hints` | Nothing |
| 1.1.0 | announcements, celebrations, the delivery group | Nothing |
| 1.2.0 | `welcomeScreen.description`, `fileManager.availableTabs`, `usageLimits.warningThresholdPercent`, `usageLimits.spendingLimitsMode`, feature `features.usageLimitsControl` | Studio enforces `calendar_date` and `window_order` (met) |
| Next | `mcpApps.theme`; `features.projectsEnabled` (after `features.usageLimitsControl` is active on a deployment); footer and default-deployment rows unchanged | as today |

The counts become 15 managed, 29 local-only and 9 eligible, still 53 keys. `1.2.0` is MINOR. It adds optional properties under `config` and `features`, and leaves `$defs/featureState` unchanged. The artifact test treats only a new `featureState` member as MAJOR (`schema-compatibility.fixtures.ts`, `FEATURE_POLICY_POINTER`).

### D2. Value schemas, rechecked against today's rules

| Key | Schema | Recheck against current code |
| --- | --- | --- |
| `welcomeScreen.description` | `boundedText(1000)`: string 1–1,000, `\S` | ENV is unbounded. The mapper trims and never parses markup. 1,000 matches the history and the 540-px paragraph, and is plenty for one line of copy. |
| `fileManager.availableTabs` | array 1–4, `uniqueItems`, items `enum: FILE_MANAGER_ALLOWED_TABS` | Same ids as `admitFileManagerTabs`. ENV tolerates duplicates and unknown ids; the schema is stricter, so the pass-through mapper never sees them. `minItems: 1` matches ENV, where an empty list means "use the default". |
| `usageLimits.warningThresholdPercent` | integer 1–99 | Identical to the ENV decorators. The registry default 75 is exported as `default`. |
| `usageLimits.spendingLimitsMode` | `enum: Object.values(SpendingLimitsMode)` | Identical to `@IsEnum`. A casing variant such as `ENFORCE` fails both. |
| `features.usageLimitsControl` | `managedFeatureKey`, `$ref: #/$defs/featureState` | Same as the history. No capability or role-variable gate exists, so the window and targeting are the only managed gates. |

- **Single sources.** The enum values are taken from `FILE_MANAGER_ALLOWED_TABS` (moved to `apps/chat-api/src/app-config/types/file-manager-tabs.ts` and re-exported by the admission module) and `SpendingLimitsMode`. ENV and the schema then cannot drift. Move the constant only if importing the admission module into the registry would create a cycle; otherwise import it in place.
- **Operator descriptions** name no environment variable (the existing env-name test checks them):
  - Welcome text: "Plain text below the greeting on the new-chat screen; markup is shown as typed."
  - Tabs: "Which File Manager tabs users see. Tabs always appear in the order All, My files, Shared, Organization; the order here does not matter. All appears only with at least two other tabs."
  - Threshold: "Share of a capped day, week or month limit at which the usage banner appears above the message box. The usage dial and the Usage page keep their own 75% mark."
  - Mode: "Must equal DIAL Core's spending-limits mode. off: budgets are hidden. shadow: budgets are shown as not yet enforced. enforce: only budgets are shown. It changes what Chat shows, not what DIAL Core enforces."
  - Feature: "Shows the token and cost usage-limits control next to the model selector."

### D3. `fileManager.availableTabs` is a set

**Observation.** The plan called this "an order-sensitive unique-enum list". Chat does not use the order (Context, File Manager). Studio's reorderable array editor (K5) therefore lets an editor reorder the rows, and nothing visible changes.

**Chosen:** keep the ENV shape (an array) and say in the description that the order is ignored. The `file-manager-tab-config` delta states the fixed order as a requirement, so a later order change has to be a deliberate spec change.

**Rejected:**

- **Honor the order now.** It needs `useDialFileManagerTabConfig` and both hosts to sort by the configured list, which is a `libs/chat-hooks` change. It also changes what an explicit `FILE_MANAGER_AVAILABLE_TABS` does today. That is a separate proposal if it is wanted.
- **An object of four booleans.** It does not match the ENV shape, so the mapper would need a second input shape. Editors would also lose the uniqueness error and gain four unrelated switches.
- **A semantic rule** for "at least one source tab" or "All needs two". `ManagedValueSchema` has no `contains`, and a new code fails closed in Studio until Studio ships it.

**Review follow-up (2026-11-23).** The first implementation passed the list through and only described the `["all"]` case. Review showed that this schema-valid publication leaves both the File storage page and the attach picker (`useFileAttachmentPicker`) without a section, for every user, and that shadow mode reported a pure reorder as `differs`. The set rules now live in one normalizer, `apps/chat-api/src/app-config/file-manager-tabs.normalizer.ts`, used by the client-config mapping for ENV and managed values alike:

- the result is `FILE_MANAGER_ALLOWED_TABS` filtered to the listed known ids, in that fixed order;
- `all` is dropped below two source tabs, as the client already hides it;
- a value with no source tab falls back to all four ids, with a warning for a non-empty list.

`FILE_MANAGER_ALLOWED_TABS` moved to `apps/chat-api/src/app-config/types/file-manager-tabs.ts`, so the registry no longer imports the ENV-admission module. The behavior change for ENV is limited to order (which the client ignores) and to `FILE_MANAGER_AVAILABLE_TABS=all`, which now shows every tab instead of none. The schema and its pin are unchanged; the `fileManagerTabs` OpenAPI description was regenerated.

**What editors see without K4 and K10.** This is expected from the kit's array and enum rendering and is checked on dev (Migration Plan):

- one row per tab, each a select of raw ids (`all`, `my_files`, `shared`, `organization`), with add, remove and Move up/Move down;
- a repeated id is a `uniqueItems` error at publish;
- an empty list is a `minItems` error.

K4 would show "My files" instead of `my_files`, and K10 a single multi-select. The `oneOf: [{const, title}]` form that K4 needs is outside `ManagedValueSchema` and has not been agreed with Studio. Adding it later is a PATCH (annotation) or MINOR version.

### D4. `usageLimits.spendingLimitsMode` stays managed

The mode mirrors a DIAL Core setting that Core does not report. A wrong published value misstates only what Chat shows. Core enforces budgets whatever Chat says, so no access decision depends on the value. `LocalOnlyReason.BackendEnforcedLimit` covers limits *the BFF* enforces, and this is not one.

**Rejected:** reclassify it local-only. That contradicts the rollout plan, and operators who want a pinned value can keep `SPENDING_LIMITS_MODE` explicit, which wins.

**Residual risk.** When the snapshot is `stale` or the key is activated before publication, the mode falls to the registry default `off`. On a Core that enforces budgets, Chat then shows the role cost limit as the account limit. The runbook publishes the mode before it removes the variable (Migration Plan), and the editor guide says to set the mode only together with the operator.

### D5. `features.usageLimitsControl` is the first managed feature

- **Policy shape.** Unchanged `featureState`: `enabled`, an optional `availability { startsAt?, endsAt? }` and an optional `targeting { roles[1..50] }`. Studio's feature-policy editor (enabled switch, UTC window, role list) recognizes it structurally.
- **Semantic parity, checked.** Chat's `apps/chat-api/src/app-config/managed-config/managed-semantics.ts` is unchanged since `890a7ff1e` (checked at `development` `dd37ad783`). Studio's `libs/feature-policy/src/semantics.ts` and `instant.ts` are unchanged since `ff9e1f0` (merged by `bd1286d`, checked at Studio `master` `4cef847`). On a schema-valid payload the two agree:
  - same UTC form `^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$`;
  - `setUTCFullYear` calendar check, so years 0–99 are not remapped;
  - fraction padded to milliseconds;
  - `window_order` only when both boundaries are calendar dates, with `startsAt < endsAt` strict, so an empty window is rejected.

  Studio also checks component ranges itself, which the Chat schema pattern already guarantees. The contract fixtures pin the shared cases: 30 February, 29 February in a leap year, equal boundaries, an inverted window, a fraction, and an offset rejected by the pattern. Chat cannot run Studio's code, so parity on dev is the runbook's invalid-window publication.
- **Gates.** All existing `Managed feature gates` apply. Condition 4 (capability) and condition 7 (deployment role gate) are always true for this key. An explicit `USAGE_LIMITS_CONTROL_ENABLED=true` supplies the configured bit, so it overrides a published `enabled: false`. An explicit `false` is the kill switch.
- **Client only.** No server guard depends on the key. A browser that holds an old `true` past `endsAt` shows the control until its next client-config refresh, which `nextManagedBoundary` schedules at the boundary. No data is exposed by the control itself.

### D6. Retire the test-only contract

The three test-contract keys become real managed keys with the same shapes: welcome text 1–1,000 `\S`, integer 1–99, and a feature. The overlay would then be a no-op that hides which contract a test exercises. Changes:

- delete `test-managed-contract.fixtures.ts`;
- in `managed-activation.spec.ts` and `shadow-feature-comparison.spec.ts`, remove the two hoisted mocks;
- in `snapshot-acceptance.spec.ts` and `managed-config-schema.spec.ts`, use `CONFIG_DEFINITIONS` and the bundled validators directly.

Snapshots in those tests carry `1.2.0` and its real pin.

**Rejected:** keeping the overlay for future unmanaged keys. A later version that needs it can bring it back.

### D7. Blank welcome text

Once the key is managed, the existing blank rule makes a blank `WELCOME_SCREEN_DESCRIPTION` resolve to `undefined` instead of `''`. A chart that templates the variable as `""` therefore no longer shadows a published text. The client field is `null` either way. The provider tests that used the welcome text as the "unmanaged" example switch to `MCP_APP_USER_AGENT`.

### D8. Payload size

These are canonical sizes, rounded. The contract test asserts the exact numbers.

| Value at its maximum | Bytes |
| --- | --- |
| welcome text | ~1,030 |
| four tabs | ~70 |
| both usage values | ~85 |
| feature with a window and 50 roles of 128 characters | ~6,700 |
| all 1.2.0 additions | ~7,900 |

The representative `1.1.0` publication plus these maxima still fits the 57,344-byte limit. "Every key at its maximum" already exceeded the limit in `1.1.0` and still does. Studio rejects an overrun at publish, and the editor guide already documents the total limit.

### D9. Tests prove parity rather than restate it

- **ENV versus snapshot parity** for the four config keys, in `managed-content-activation.spec.ts` on the real contract:
  - a padded welcome text;
  - a reordered tab list, passed through unchanged;
  - threshold `90` and mode `enforce`.
- **Feature gates** on the real key: a future `startsAt`, targeting, explicit `true` over a published `false`, explicit `false`, and `features: {}`.
- **Export is not activation.** The strip-`management` test runs with the five variables set, a blank `WELCOME_SCREEN_DESCRIPTION` included.
- No frontend or lib source changes. The existing `useDialFileManagerTabConfig.spec.ts` gets one case with a reversed `fileManagerTabs` input, which pins the D3 fixed order.

## Risks / Trade-offs

- **[Risk] An explicit variable shadows a published value**, including `USAGE_LIMITS_CONTROL_ENABLED=true` over a published `enabled: false`. → Each variable is removed in the same values change that activates its key. Shadow mode reports `env_shadowed`.
- **[Risk] The spending mode drops to `off`** when it is activated before publication or while the state is `stale` (D4). → Publish first. For deployments that cannot tolerate this, keep the variable explicit.
- **[Trade-off] Editors can reorder tabs with no visible effect** (D3). → The description says so, and the spec pins the fixed order.
- **[Trade-off] Raw enum values without K4 and K10.** → The descriptions explain each value.
- **[Risk] Semantic drift between Chat and Studio.** → The fixtures pin the shared cases, the design names both checked commits, and the dev runbook publishes one invalid window.
- **[Risk] Reverting the code while a `1.2.0` revision is published.** → The rollback order below moves the deployment off `1.2.0` first.

## Migration Plan

1. Merge. The `1.2.0` artifact is committed. Behavior is unchanged until activation: `1.0.0` and `1.1.0` snapshots still validate, and the new keys are inactive.
2. Dev rollout. This is a separate runbook step, after the merged commit is in the dev image.
   - **Step A (texts and lists):**
     - upload `ai-dial-chat-1.2.0.json` from the image's commit and compare the returned `sha256` with `index.json`;
     - in a draft on `1.2.0` that keeps the current `1.1.0` content, set the welcome text, the tabs, the threshold and `usageLimits.spendingLimitsMode` `enforce`, then publish;
     - in **one** values change, remove `WELCOME_SCREEN_DESCRIPTION`, `FILE_MANAGER_AVAILABLE_TABS`, `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT` and `SPENDING_LIMITS_MODE` (each one that is set), and add the four keys to `MANAGED_CONFIG_ACTIVE_KEYS`;
     - check `client-config`: `spendingLimitsMode` is still `enforce`, and `metadata.managed.revisionId` is the new revision.

     The local values copy sets only `SPENDING_LIMITS_MODE=enforce` of the four. The others are unverified and are removed only if present.
   - **Step B (feature):**
     - try to publish `features.usageLimitsControl` with `startsAt` later than `endsAt` once, and record that Studio rejects it with `invalid_candidate` (`window_order`);
     - publish a valid policy;
     - in one values change, remove `USAGE_LIMITS_CONTROL_ENABLED` if set and add `features.usageLimitsControl`;
     - confirm the control appears for a targeted user, and that Studio shows the policy editor for the key.
3. Rollback:
   - per key: remove it from `MANAGED_CONFIG_ACTIVE_KEYS` and restore its variable;
   - per deployment: `MANAGED_CONFIG_MODE=off`;
   - per configuration: publish an earlier revision from History.
4. Code revert: first publish a `1.1.0` revision or set the mode to `off`, so that no pod reads a `1.2.0` snapshot it does not support. Then deploy the revert.

## Open Questions

- Whether to honor the configured tab order later. That would be a separate frontend proposal (D3) and does not change this contract's shape.

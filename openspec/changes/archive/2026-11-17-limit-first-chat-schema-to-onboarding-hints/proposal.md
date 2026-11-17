## Why

The first schema a Config Studio instance receives for `ai-dial-chat` should manage the setting operators want to edit first: the first-visit onboarding tour, `onboarding.hints` (`ONBOARDING_HINTS`, #9815; #9906 keeps the progress of an unfinished tour). Today `ai-dial-chat-1.0.0.json` manages seven other keys, `1.1.0` adds `usageLimits.spendingLimitsMode`, and the tour is eligible but unmanaged (rollout wave 1).

This is the last moment `1.0.0` can change meaning. No Chat release contains managed configuration (`1.3.5` is cut from `release-1.3`), no Config Studio instance has an `ai-dial-chat` schema yet, and this branch (#9908) already renames and re-pins the artifacts. After the first upload or the first release with these files, `1.0.0` is frozen.

## What Changes

- **BREAKING (unreleased contract only)** Schema `1.0.0` manages exactly one key, `onboarding.hints`, and no feature. Its value schema mirrors `normalizeOnboardingHints`:
  - an array of at most 50 hints;
  - each hint `{ id, target, title, description? }` with no other member;
  - `id` matches `^[A-Za-z0-9._-]{1,64}$`;
  - `target` is an `enum` of every `OnboardingHintTarget` value (72 anchors);
  - `title` is non-blank, at most 100 characters;
  - `description` is optional, at most 500 characters.
- The eight keys managed today lose `management` and become eligible but unmanaged: `announcement.title`, `announcement.description`, `announcement.items`, `welcomeScreen.description`, `fileManager.availableTabs`, `usageLimits.warningThresholdPercent`, `usageLimits.spendingLimitsMode` and the feature `features.usageLimitsControl`. Their value-schema constants are deleted. A later `1.1.0` restores them.
- `ai-dial-chat-1.1.0.json`, its index entry and its pin are deleted. `MANAGED_CONFIG_SCHEMA_VERSION` stays `1.0.0`, `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS` is `['1.0.0']`, and `1.0.0` is regenerated and pinned once.
- `MANAGED_CONFIG_ACTIVE_KEYS` accepts `onboarding.hints` and rejects the eight keys in `active` mode.
- Duplicate hint ids pass the schema; Chat keeps today's runtime rule (the first wins, later ones are dropped with a warning). Operator descriptions and docs say so, together with the per-browser `localStorage` memory of seen ids.
- Docs: counts (1 managed, 31 local-only, 19 eligible), the rollout order (the tour first, today's keys next), and that a new anchor needs a new schema minor version.

## Non-goals

- Schema `1.1.0` and the keys it restores, announcement `severity`, or any later wave.
- A Config Studio semantic rule for unique hint ids, `oneOf` target labels (kit K4), or any Studio, UI-kit or deployment change.
- Changing ENV admission of `ONBOARDING_HINTS`: the new bounds apply only to published values.
- Activating any key in a deployment.

## Alternatives considered

1. **Add the tour in `1.1.0` next to today's keys.** Every instance would start with nine keys, of which only the tour is planned for activation; shadow comparison on dev would report eight keys nobody publishes. Rejected by the 17 November decision.
2. **A new `2.0.0` with only the tour.** It keeps the old `1.0.0` meaning alive in the index for a contract nobody uploaded or released. Rejected: the versions would carry history without users.
3. **`target` as a bounded string.** Studio would accept hints Chat then drops. Rejected; the enum lets Studio reject an unknown anchor before publication, at the cost of a schema version per new anchor.
4. **Change `1.0.0` in place before any upload (chosen).**

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `managed-config-contract`: the managed set of `1.0.0` is `onboarding.hints` only, with its bounds; payload and constraint scenarios use the tour, and feature-state rules are checked against the exported feature-state definition.
- `managed-config-activation`: scenarios use `onboarding.hints`; feature gates apply from the first schema version that exports a managed feature; `1.0.0` rejects the eight keys in `MANAGED_CONFIG_ACTIVE_KEYS`.
- `config-registry-and-env-provider`: the blank managed-text rule has no `1.0.0` key; scenarios for managed selection and unbounded ENV use the tour.
- `usage-spending-budgets`: `usageLimits.spendingLimitsMode` is environment-only under `1.0.0`; its managed value schema and scenarios apply to the version that manages it.

## Impact

- `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`: `onboarding.hints` management and value schema; `management` and value-schema constants removed from eight keys.
- `apps/chat-api/src/app-config/managed-config/managed-config.constants.ts`, `apps/chat-api/src/app-config/managed-runtime/snapshot-acceptance.ts`: version, supported list, pin, bundled artifact.
- `apps/chat-api/managed-config-schema/`: `ai-dial-chat-1.0.0.json` regenerated, `ai-dial-chat-1.1.0.json` deleted, `index.json`.
- Tests under `apps/chat-api/src/app-config/tests/` and `apps/chat-api/src/config/tests/`, the contract fixtures, and a test-only managed contract for mechanisms `1.0.0` does not reach.
- Docs: `docs/managed-config-schema.md`, `docs/onboarding-anchors.md` (through `scripts/generate-onboarding-anchors.mjs`), `docs/architecture.md`, `apps/chat-api/README.md`, `apps/chat-api/.env.template`.
- No client-config response, OpenAPI, frontend, lib or i18n change. Effective values are unchanged; at the provider level a blank `ANNOUNCEMENT_TITLE`, `ANNOUNCEMENT_DESCRIPTION` or `WELCOME_SCREEN_DESCRIPTION` resolves to `''` again instead of `undefined`, and the client-config field is `null` either way.
- Config Studio needs no code change. Its fixture `apps/config-studio-backend/src/testing/chat-ui-1.0.0.ts` is a frozen copy and is unaffected.

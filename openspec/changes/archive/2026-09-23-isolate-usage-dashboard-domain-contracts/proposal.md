## Why

`@epam/ai-dial-usage-dashboard` is declared as a host-agnostic, publishable UI package, but three of
its public exports interpret generated BFF contracts directly:
[map-usage-data-to-dashboard.ts:1-4](../../../libs/usage-dashboard/src/utils/map-usage-data-to-dashboard.ts#L1-L4)
imports `LimitStatsDto` / `UserLimitStatsResponseDto`, and
[map-user-usage-to-model-limits.ts:1-7](../../../libs/usage-dashboard/src/utils/map-user-usage-to-model-limits.ts#L1-L7)
imports four DTOs plus the **runtime** value `DeploymentItemDtoTypeEnum`. That runtime import forces
[package.json:24](../../../libs/usage-dashboard/package.json#L24) to declare
`@epam/ai-dial-chat-api-client` in `dependencies`, and drags a `tsconfig.lib.json` project reference
and a vitest alias along with it.

AGENTS.md §Library isolation names generated API clients as host-owned knowledge and grants exactly
two exceptions — `libs/chat-api-client` (it *is* the generated client) and a narrow `libs/chat-hooks`
transport exception. Neither covers a presentational UI library. So a host that installs this package
today must also install the generated BFF client, and the library's published surface bakes in DIAL
Core field names, the `2 ** 53` unlimited sentinel, and a `DeploymentItemDto.type` filter.

This is remediation-plan item 26 (P1, architecture). It is architecture work; it makes no claim about
the production OOM or measured memory usage.

## Problem

The library owns interpretation it should only ever render:

| Coupling | Where |
| --- | --- |
| `UserLimitStatsResponseDto` / `LimitStatsDto` field selection (`dayCostStats`, `weekTokenStats`, …) | both mapper modules |
| `DeploymentItemDto` + runtime `DeploymentItemDtoTypeEnum.Model` filter | `map-user-usage-to-model-limits.ts:429-433` |
| DIAL Core unlimited sentinel `total >= 2 ** 53` | both mapper modules |
| `@epam/ai-dial-chat-api-client` in `dependencies` | `package.json:24` |
| `../chat-api-client/tsconfig.lib.json` project reference | `tsconfig.lib.json` |
| test-only `@epam/ai-dial-chat-api-client` alias | `vite.config.mts:52-55` |

Three existing capability specs actively *mandate* this placement, so the specs and the isolation
policy currently contradict each other (see Modified Capabilities). The contradiction, not just the
code, is what this change resolves.

The library's own presentation contracts — `UsageLimitCardData`, `ModelLimitRow`,
`ModelLimitPeriodStatuses` — already describe the right boundary. Nothing new needs inventing.

## Solution

Move the three mappers, their two i18n-key constants, and their tests from `libs/usage-dashboard`
into app-owned usage adapters under `apps/chat/src/utils/`, alongside the `map-*.ts` siblings they
already collaborate with (`map-deployment-to-catalog-item.ts`, `map-scheduled-task-dto.ts`,
`icon-path.ts`, `locale.ts`, `usage-reset-time.ts`). The library keeps only rendering: components,
normalized display models, status enums, theme tokens, public `dial-*` classes.

Algorithms move verbatim. This change preserves every displayed number, status, ordering rule,
label, reset trio, fetch behaviour, loading/empty/error state, a11y attribute, and responsive/RTL
behaviour on the Usage screen.

## What Changes

- **BREAKING (public API):** `@epam/ai-dial-usage-dashboard` removes seven exports —
  `mapUsageDataToDashboard`, `mapUserUsageToModelLimits`, `mapOverallCostLimitsToPeriodStatuses`,
  `USAGE_DATA_I18N_KEYS`, `USAGE_MODEL_LIMITS_I18N_KEYS`, and the types `FormatResetTime` /
  `ResetTimeDisplayLike`. All seven are documented in the package README, so their removal is a
  public API change regardless of the manifest's current `private: true`.
  No DTO-bound compatibility wrapper is left behind — that would preserve the very coupling being
  removed.
- New app-owned adapters in `apps/chat/src/utils/`:
  `map-usage-data-to-dashboard.ts` and `map-user-usage-to-model-limits.ts`, carrying the moved
  algorithms and constants unchanged, with the callback parameters (`formatResetTime`,
  `resolveIconUrl`, `resolveDisplayName`) collapsed where the app is now the only caller.
  `FormatResetTime` is replaced at the call site by the app's existing
  `ResetTimeDisplay` from `apps/chat/src/utils/usage-reset-time.ts`, which is already the exact
  same shape.
- `UsageTab.tsx` imports adapters from the app and components/types from the library. Its `useMemo`
  dependency arrays, `useCallback` stability, timer/visibility effects and notification behaviour
  are unchanged.
- Both mapper spec files move to `apps/chat/src/utils/tests/` with their assertions intact.
  Characterization cases are **added** first (before relocation) where the current suites leave a
  documented invariant unpinned; none are weakened or removed.
- `libs/usage-dashboard` sheds its generated-client edges: the `dependencies` entry, the
  `tsconfig.lib.json` project reference, and the now-dead vitest alias. The client stays installed
  for the projects that legitimately use it. Lockfile metadata is refreshed with a plain
  `npm install`, no upgrades.
- A narrow boundary check, built from conventions already in this repo (the per-project
  `eslint.config.mjs` override pattern plus the `dist`-scanning consumer fixture under `tools/`),
  makes a returning `@epam/ai-dial-chat-api-client` import fail — including through the barrel or an
  emitted `.d.ts`. No new repository-wide architecture framework.
- Docs updated in the same change: `libs/usage-dashboard/README.md` (exports, Utilities section,
  peer list, before/after host migration example), `docs/architecture.md`, and
  `docs/host-install-matrix.md` via `npm run docs:install-matrix`.

## Alternatives considered

1. **Direct move to app adapters — chosen.** Rendering props (`UsageLimitCardData`, `ModelLimitRow`,
   `ModelLimitPeriodStatuses`) already are the host-neutral boundary, so a second mapping abstraction
   would add surface without adding isolation. One in-repo consumer to migrate.
2. **Genuinely host-neutral mapper API in the lib** — keep the mappers but have them accept a
   normalized, DTO-free input type the host constructs. Rejected: the host then writes a
   DTO → neutral-input mapping that is nearly the whole of today's mapper, so the lib retains an API
   that earns nothing, and every period-field and sentinel rule still has to live app-side anyway.
   Strictly more code and two boundaries to keep in sync.
3. **Type-only imports + local DTO copies** — explicitly rejected by the policy and by this change:
   copying the interfaces or swapping the runtime enum for equivalent backend strings keeps BFF
   field/sentinel interpretation inside the UI lib. Isolation would be nominal.
4. **Do nothing / widen the chat-hooks exception** — rejected. The chat-hooks exception is scoped to
   transport against DIAL Core with an injected client; a presentational package is the case the
   policy exists to prevent, and the three specs would stay in conflict with AGENTS.md.

## Non-goals

Announcement normalization; generation/SSE/persistence fixes; backend endpoint, DTO, OpenAPI or
generated-client changes; new dashboards or metrics; visual redesign; broad hook refactoring;
framework upgrades; new libraries; unrelated dependency cleanup; calculation cleanup or unification
of the differing token-vs-cost unlimited behaviour (characterized, not changed); moving
`usage-reset-time.ts`, which is already app-owned and named by path in `docs/architecture.md` and the
`usage-period-reset-times` spec.

## Acceptance criteria

1. No file under `libs/usage-dashboard/src/**` imports `@epam/ai-dial-chat-api-client`; the manifest,
   `tsconfig.lib.json` reference and vitest alias for it are gone.
2. `npm exec nx build usage-dashboard` emits `dist/**` JS and `.d.ts` containing no
   `@epam/ai-dial-chat-api-client` specifier or re-exported DTO type name.
3. A packed-tarball consumer installs the package with only its documented peers — no generated BFF
   client, no workspace alias — and renders `UsageLimitCardGroup` and `ModelLimitsSection` from
   normalized data.
4. The Usage screen is behaviourally unchanged: moved mapper suites and
   `apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx` pass with assertions changed
   only for import/fixture ownership.
5. Library component and public-class-contract tests consume normalized fixtures, not DTO fixtures.
6. The four affected capability specs no longer place DTO interpretation in the library, and no
   behavioural requirement is silently dropped in the process.
7. The boundary check fails on a reintroduced generated-client import from the library.
8. `npm run validate:docs` passes; README documents the removal with a before/after host example.

## Rollback / backward compatibility

- **In-repo:** fully revertible as one commit. The only in-repo consumer is `UsageTab.tsx` plus its
  spec; nothing else imports the moved symbols (verified by repository-wide search — which is
  evidence about *this* repository only, not a claim that no external consumer exists).
- **External consumers:** source-incompatible. Any host importing the three mappers or two key
  constants must copy the adapters app-side; the README migration section gives the before/after.
  Component props, status enums, `./styles.css`, theme tokens and `dial-*` classes are untouched, so
  a host that only renders is unaffected.
- **Release:** the package is `private: true` at `0.0.1` with no verified publish history, so no
  version claim is made here. The removal is recorded as breaking so that whichever release first
  carries it is versioned accordingly. Proposal, implementation, merge and release remain separate
  statuses.

## Capabilities

### New Capabilities

<!-- none: this change relocates ownership across existing capabilities -->

### Modified Capabilities

- `usage-dashboard-lib`: today it states the library "additionally exports pure transform utilities
  that depend on `@epam/ai-dial-chat-api-client` types and runtime values" and requires that client
  as a peer dependency plus a `tsconfig.lib.json` reference. The three `map*` utility requirements
  and the Utilities purpose text move out; the library's requirement becomes an explicit prohibition
  on generated-client imports in source, barrel and emitted declarations, enforced by a boundary
  check.
- `usage-model-limits`: its purpose and `Library isolation for the adapter` requirement place the
  adapter in `libs/usage-dashboard/src/utils/map-user-usage-to-model-limits.ts` and say the lib owns
  field selection, sentinel checks, thresholds, formatting and the deployment join. Ownership moves
  to `apps/chat/src/utils/`; every behavioural rule (period-to-field mapping, join, exclusion,
  status model, formatting) is restated against the new owner, not dropped.
- `usage-data-hook`: its `Library isolation between apps/chat and libs` requirement says DTO
  interpretation "lives in `libs/usage-dashboard`'s transform utilities" and that the Usage tab
  imports them from `@epam/ai-dial-usage-dashboard`. Restated to app-owned adapters. The
  `useUsageData` contract itself is unchanged.
- `usage-period-reset-times`: its `Reset-time normalization at the application edge` requirement and
  the `Library never interprets a timestamp` scenario describe the mappers as library code taking a
  `formatResetTime` callback. Restated for app-owned adapters, with the library-side guarantee
  strengthened (it receives preformatted strings only because it has no mapper at all).

## Impact

- **Library:** `libs/usage-dashboard/src/index.ts`, `src/utils/**` (deleted), `package.json`,
  `tsconfig.lib.json`, `vite.config.mts`, `eslint.config.mjs`, `README.md`.
- **App:** `apps/chat/src/utils/map-usage-data-to-dashboard.ts` and
  `map-user-usage-to-model-limits.ts` (new), `apps/chat/src/utils/tests/**` (moved specs),
  `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx` and its spec.
- **Tooling:** one boundary check reusing `tools/*-consumer-fixture` + the
  `libs/chat-hooks/e2e-fixtures/harness.mjs` conventions; `package-lock.json` metadata.
- **Docs:** `libs/usage-dashboard/README.md`, `docs/architecture.md`,
  `docs/host-install-matrix.md` (regenerated), and the four capability specs above.
- **Unaffected:** backend, OpenAPI/generated client, `useUsageData`, `useDeployments`,
  `GET /api/v1/user/usage`, theme tokens, public `dial-*` classes, `lib-public-class-names`.
- **i18n:** no new user-visible strings. The existing `usage.*` keys are unchanged; only the
  location of the constants naming them moves. The app's `UsageI18nKeys` enum already carries the
  same key paths, so the moved adapters can reference it directly instead of a duplicate const.
- **Scope-creep flag:** this change touches a shared publishable lib's public API. That is the point
  of the change, and it is bounded to the seven exports listed above.

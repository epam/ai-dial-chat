# Design

## Context

See `proposal.md` "Why" and "Problem". The constraints that shape the approach:

- The SDK is pinned exactly and declared only in `apps/chat-api/package.json`.
  The lockfile holds it in two places: the `apps/chat-api` workspace entry and
  `node_modules/@epam/ai-dial-typescript-sdk`. The previous bump (`573a1b11a`,
  `0.2.0` → `0.2.1`) changed exactly those two files.
- One client instance (`DialClientService.client`,
  `apps/chat-api/src/dial/dial-client.service.ts:61`) serves every domain. That
  client is the only runtime surface of the SDK the BFF uses. Every other import
  is `import type`.
- Several BFF mappers read Core payloads defensively through
  `result.data as unknown as …` or `getString(raw, …)` allowlists (for example
  `apps/chat-api/src/deployments/details/deployments-details.service.ts:670`, and
  `mapAuthSettings` in `apps/chat-api/src/toolsets/utils/toolset-mapper.util.ts`).
  A cast hides a type change from `tsc`, so the type diff below was reviewed by
  hand and not only through compiler output.

## Goals / Non-Goals

**Goals:**

- Land the `0.3.1` pin with zero observable BFF change, backed by evidence from
  compiler, runtime and contract checks.
- Record a decision for every Core-contract delta that a chat-api consumer could
  observe, so change 02 and later follow-ups start from a known baseline.

**Non-Goals:**

- Typing away existing casts the new SDK makes redundant, and adopting any new
  SDK field or method. See `proposal.md` "Non-goals".

## Pre-planning evidence

This evidence was collected read-only on `development` `bdaad8ad0`
(2026-11-25). Both tarballs were fetched with `npm pack` into a scratch directory
outside the repo, and nothing was installed into the workspace.

1. **Registry.** `npm view @epam/ai-dial-typescript-sdk@0.3.1 dependencies`
   returns `{ "openapi-fetch": "^0.17.0" }`, with no peers. `0.3.0` was never
   published; the line is `0.3.0-dev.1…dev.10`, then `0.3.1`. `0.4.0-dev.1` is
   already out, so an exact pin matters. `package-lock.json` resolves
   `node_modules/openapi-fetch` to `0.17.0`.
2. **Compiler dry run.** A scratch tsconfig extended
   `apps/chat-api/tsconfig.app.json` (and, in a second config,
   `tsconfig.spec.json`), set `noEmit`, and used `paths` to map
   `@epam/ai-dial-typescript-sdk` to the unpacked `dist/index.d.ts`. All other
   base `paths` stayed as they are. `--traceResolution` confirmed that the import
   resolved to the scratch `0.3.1` file.
   - against `0.2.1`: app 0 errors, spec 0 errors (baseline)
   - against `0.3.1`: app 0 errors, spec 0 errors
3. **Runtime diff.** The core section of `dist/index.js` was compared method by
   method (`createSDK` return object) and URL builder by URL builder. Removed: 0.
   Changed: 0 of 260 methods and 0 of 257 URL builders. Added:
   `deletePlugin`, `getFileConfigPlugin`, `getPlugin`, `getPluginMetadata`,
   `listFileConfigPlugins`, `savePlugin`. None of the 86 methods chat-api calls is
   missing. The header and `fetch` wiring in `createSDK` is identical. The only
   other runtime addition is the self-contained `src/analytics/*` module
   (`createAnalyticsSDK`).
4. **Type diff.** The core `components['schemas']` (337 → 341) and the
   `operations` of every method chat-api calls were compared. The deltas follow
   below. Each is attributed to its SDK sync commit through
   `gh api repos/epam/ai-dial-typescript-sdk/commits/<sha>` patches of
   `src/schema.ts`.
5. **Spike result (task 1.3, `development` `03cbfd768`).** The installed result
   matches the dry run, so no type-level fix is needed and task 2.1 does not
   apply.
   - `npm install @epam/ai-dial-typescript-sdk@0.3.1 --save-exact --workspace apps/chat-api`
     changed one package. The lockfile diff has 4 changed lines: the workspace
     dependency, plus `version`, `resolved` and `integrity` of
     `node_modules/@epam/ai-dial-typescript-sdk`. `openapi-fetch` stays at
     `0.17.0`.
   - `nx run typecheck -p chat-api --skip-nx-cache` passes. `nx run test`
     reports 417/417 files and 9392/9392 tests.
   - Closing gates (tasks 4.1–4.3): `openapi:check` reports no drift; `build`
     and `lint` pass; `verify:changed` passes. In `verify:full`,
     `typecheck:full` and `lint:check` pass and `test:full` passes. Its
     `format:check` step flags only git-ignored, developer-local files
     (`*-prompts/**`, `refactoring-frontend.md`) that CI never sees. Every file
     this change touches passes `prettier --check`.
   - Two environment effects, unrelated to the SDK, showed up on the way.
     (a) With a developer-local `apps/chat-api/.env.local` that sets
     `MANAGED_CONFIG_MODE`/`MANAGED_CONFIG_INSTANCES`, Nx's dotenv loading
     makes 211 `app-config`/`config` tests fail with `pairs.map is not a
     function` (`managed-runtime.settings.ts`), whichever SDK version is
     installed. Run with `NX_LOAD_DOT_ENV_FILES=false`, as CI does, which has
     no such file. (b) `telemetry/tests/http-lifecycle-listener.spec.ts` (a bare
     `http.Server`, with no SDK in its import graph) failed 4 tests once under
     the full parallel run. It passes in isolation and on a full rerun, so it is
     timing-flaky and out of scope.
   - Nx flags need the `--` separator under npm (`npm exec -- nx …`). Without
     it, npm consumes `-t`/`--skip-nx-cache` as its own config.

## Contract deltas and per-field decisions

The commits are `611f8e4c6` (#66, routers/aliases/system import), `01ae29ffa`
(#70, plugin endpoints) and `78ce20700` (#71, deployments `fields` param and
schema tweaks).

| SDK delta | Commit | chat-api consumer | Decision |
| --- | --- | --- | --- |
| `LocalizedValue` was `{ localeMap?; plainValue? } & (string \| MapStringString)` and is now `string \| MapStringString` | #71 | `common/utils/localized-value.ts`, `common/utils/compose-localized-fields.ts`, and through them the application, toolset and deployment mappers | **No change.** The removed members were a generator artifact that never appeared on the wire. Nothing under `apps/chat-api/src` reads `localeMap` or `plainValue`, and both helpers already treat the value as `string \| Record<string,string>`. The type now matches what the code assumes. |
| `listCustomApplicationSchemas` response: `'dial:applicationTypeBucketCopy'` was `boolean?` and is now required `'ENABLED' \| 'DISABLED'` | #71 | `application-schemas/application-schemas.service.ts` | **Ignored on purpose.** The mapper copies only `$id`, display name, viewer/editor/schema URLs and icon, so the field never reaches `ApplicationSchemaSummaryDto`. Exposing it would be a contract change, out of scope. |
| `listDeployments` query gains `fields?: string` | #71 | `deployments/listing/deployments-listing.service.ts` (reads only the `interface_type` param type) | **Follow-up candidate.** The BFF does not send it, so Core still returns full deployments. Selecting fields could shrink the listing payload, which is a separate perf change. |
| `Pricing` / `PricingData` rates are now `string \| PricingRate` (was `PricingRate`) | #71 | `deployments/details/deployments-details.service.ts` forwards `raw.pricing` verbatim | **No change.** `ModelPricingRecord` in `deployments/dto/deployment-details.dto.ts` already types values as `string \| ModelPricingRateDto`. The SDK now matches the BFF. |
| `ResourceAuthSettings.discovery_url?` | #71 | toolset `mapAuthSettings` / `toDialAuthSettings`; `external-services/external-services.mapper.ts` | **Toolsets: ignored on purpose.** Core documents it as "External services only (OAUTH)". **External services: follow-up.** It enables Core-side dynamic client registration on `putExternalService`. Core keeps stored OAuth fields an OAUTH update omits, so not sending it erases nothing. Exposing it is a new DTO field and therefore a contract change. |
| `UserLimitStats.costObject?` | #70 | `getUserLimits` / `getUserUsage` return `result.data as unknown as UserLimitStatsResponseDto` | **No change.** `UserLimitStatsResponseDto.costObject` already exists in `openapi/openapi-response.dto.ts`, and the payload passes through untouched. |
| `BudgetStats.object?: PolicyObjectSet` (`string \| string[]`) | #70 | the same pass-through, `BudgetStatsDto` | **Follow-up candidate.** The BFF already relays it at runtime through the cast, but `BudgetStatsDto` does not declare it, so `@epam/ai-dial-chat-api-client` does not type it. Declaring it changes `openapi.json`, which is out of scope. |
| `ResourceTypes` gains `'PLUGIN'` | #70 | `share/utils/share-resource.util.ts` (`RESOURCE_KIND_BY_PREFIX`) | **No change.** The table maps known prefixes, and plugins are not shareable through the BFF. |
| `AliasPresentation` gains `'router'`; `Router.editorUrl?`; `Config.plugins?`; `Pattern` and `PolicyObjectSet` now typed as strings; `AdminManifest` gains `AdminPluginManifest`; new `Plugin`, `MapStringPlugin`, `AdminPluginManifest`, `ObjectNode` schemas | #66, #70, #71 | none (`grep` under `apps/chat-api/src`) | **Not consumed.** |
| `createAnalyticsSDK`, `Analytics*` exports | `8eb4d5c50` (#74) | none | **Unused here.** Change 02 adopts them. |

## Decisions

1. **Exact pin `0.3.1`, installed with npm.** Run
   `npm install @epam/ai-dial-typescript-sdk@0.3.1 --save-exact --workspace apps/chat-api`
   from the repo root. This keeps the declaration in `apps/chat-api/package.json`
   and rewrites both lockfile entries in one step. The AGENTS.md warning against
   `npm install --workspace` applies to fixing internal `@epam/*` resolution, not
   to bumping an external registry package. Rejected: editing `package-lock.json`
   by hand, which leaves `integrity` inconsistent, and `^0.3.1`, see `proposal.md`.
2. **Spike before fixes.** The dry run swapped declarations but not the
   installed package, so it did not cover nx's `tsc --build` project references,
   webpack's type checker, or vitest loading the real ESM/CJS bundle. Task 1
   therefore installs and runs `typecheck` and `test`. If either fails, the
   failing file, the SDK delta from the table that caused it, and the fix are
   added to this design and to `tasks.md` before any code is touched. A fix must
   be type-level (narrowing, a corrected local alias) and leave every DTO and
   `openapi.json` unchanged.
3. **Stop condition.** If the spike shows that a renamed or removed Core type
   forces a BFF response-shape change, work stops and goes back to the user,
   because that breaks `libs/chat-api-client` and is out of scope. The dry run
   found no such case.
4. **No spec deltas (`skip_specs: true`).** Requests, responses and error mapping
   stay the same. The two specs that state a minimum SDK version
   (`toolset-write-api`: `0.2.0-dev.23` or later; `deployment-details-api`:
   `0.3.0-dev.3` or later) remain true and need no edit.
5. **Docs.** No doc cites `0.2.1`. `README.md` does not name the SDK, and
   `apps/chat-api/README.md:127` and `docs/architecture.md:1174` name it without a
   version. The one stale version citation is the "Known divergence" note in
   `libs/chat-api-client/README.md`, which claims `@0.1.1` lacks `resetsAt`.
   `0.2.1` and `0.3.1` both type `CostItemLimitStats.resetsAt` and
   `ItemLimitStats.resetsAt`. The note is rewritten to say that the SDK now types
   the field, that the `as unknown as UserLimitStatsResponseDto` cast still
   carries the payload, and that the hand-authored DTO stays authoritative for
   the published contract. The note's own version is not one `validate:docs`
   checks (the lib does not declare the SDK); the edit is made for accuracy, per
   `.claude/rules/docs.md` "Describe what the code does".

## Risks / Trade-offs

- [The dry run used the declarations only] → Task 1 runs the real install, then
  `typecheck`, `build` (webpack plus type check) and `test`, with
  `--skip-nx-cache` so no cached result from `0.2.1` hides a failure.
- [A cast hides a semantic type change from `tsc`] → Every changed schema and
  every changed used operation was reviewed by hand (table above). Only
  `dial:applicationTypeBucketCopy` changed meaning (boolean to enum), and the
  BFF never reads it.
- [Core starts returning a field the BFF drops] → This does not depend on the SDK
  version. The cases visible today are recorded as follow-ups (`BudgetStats.object`,
  external-service `discovery_url`, `listDeployments` `fields`).
- [The lockfile regeneration drifts unrelated packages] → After install, check
  that `git diff package-lock.json` changes only the SDK's version, `resolved` and
  `integrity`. If npm reshuffles anything else, run
  `git checkout package-lock.json` and retry with a clean `npm install` on the
  pinned manifest.

## Migration Plan

There is no data or config migration, and nothing to roll out in order. To roll
back, revert the commit, or restore `"0.2.1"` and run `npm install` again.

## Open Questions

None that block. The follow-ups above (`BudgetStats.object`, external-service
`discovery_url`, `listDeployments` `fields`) are candidates for their own
changes. None of them is needed for this bump or for change 02.

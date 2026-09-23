## Context

`isolate-usage-dashboard-domain-contracts` (implemented, not yet merged — see
its own `openspec/changes/` directory) moved two DTO-interpreting mappers out
of `libs/usage-dashboard` because the library-isolation policy's `chat-hooks`
exception is scoped to transport ("thin request/response logic ... equivalent
in shape to `apps/chat/src/server-api/*.api.ts` wrappers"), and this is
adaptation, not transport. That change landed the mappers in
`apps/chat/src/utils/`, moved their ~1,000-line characterization suite with
them, and recorded in its own delta specs that this coupling must not be
relocated into `libs/chat-hooks` without "its own equivalent narrow-leak
justification recorded in that change's design doc" — the same closing
condition the AG-Grid exception already sets for itself.

This design is that justification, evaluated on its own terms rather than
folded into the move that first raised it.

Current state, re-verified against the merged repository plus the
not-yet-merged `isolate-usage-dashboard-domain-contracts` working tree:

- `apps/chat/src/utils/map-usage-data-to-dashboard.ts` —
  `mapUsageDataToDashboard`, and a local `UNLIMITED_TOTAL_THRESHOLD` /
  `RUNNING_LOW_THRESHOLD_PERCENT` / `isUsableStats` / `getStatus` /
  `buildResetFields` / `mapStatsToCardData` set of helpers.
- `apps/chat/src/utils/map-user-usage-to-model-limits.ts` —
  `mapUserUsageToModelLimits`, `mapOverallCostLimitsToPeriodStatuses`, and a
  larger helper set including the `DeploymentItemDtoTypeEnum.Model` join.
- Both files currently type their reset-time parameter against
  `ResetTimeDisplay` imported from the app's own
  `apps/chat/src/utils/usage-reset-time.ts`, and their translated strings
  against the app's `UsageI18nKeys` enum.
- `libs/chat-hooks` already depends on `@epam/ai-dial-chat-api-client` for
  types and thin transport (`useUsageData` itself lives at
  `libs/chat-hooks/src/usage/useUsageData/useUsageData.ts`, re-exported from
  the `./utils` entry point), and already carries several other pure,
  DTO-adjacent utility functions from that same entry point (`formatting`,
  `locale`, `string-utils`).
- `libs/usage-dashboard` has no dependency on `@epam/ai-dial-chat-api-client`
  in any form (dependencies, peers, tsconfig references, vitest aliases) as of
  the prior change, and a project-scoped `no-restricted-imports` rule plus
  `tools/usage-dashboard-consumer-fixture` mechanically prevent that from
  returning. Nothing in this change touches that boundary again.

## Goals / Non-Goals

**Goals:**

- Let every DIAL-Core-backed application `libs/chat-hooks` serves reuse the
  characterized DTO-to-display adaptation instead of copying it.
- Record a narrow, self-limiting AGENTS.md exception — in the same style and
  with the same "does not extend further" discipline as the existing AG-Grid
  one — rather than a general loosening of the transport-only boundary.
- Preserve every behavioral guarantee the prior move already proved: identical
  algorithms, identical characterization coverage, identical call shape from
  `UsageTab`'s perspective.
- Keep `libs/usage-dashboard` exactly as isolated as the prior change left it.
  This change never touches that library's manifest, source, or boundary
  checks again.

**Non-Goals:**

- Widening the transport exception in general — this is one recorded case,
  not a policy reversal.
- Changing any calculation, threshold, formatting rule, or the deliberately
  divergent token-vs-cost unlimited behavior.
- Introducing UI-kit rendering, i18n imports, or app-context access into
  `chat-hooks` — the callback boundary (`resolveIconUrl`, `resolveDisplayName`,
  `formatResetTime`, `t`) is unchanged.
- Publishing either package or asserting a release history.

## Decisions

### D1 — This case earns the exception; a general DTO-mapper amnesty would not

The three-part test this design applies, mirrored from the AG-Grid exception's
own structure (a specific leak, a specific reference case, a specific
scope-limiting sentence):

1. **Driven by response shape, not product decisions.** The unlimited
   sentinel (`total >= 2 ** 53`), the `75`/`100` status thresholds, and the
   `DeploymentItemDtoTypeEnum.Model` join are DIAL Core's contract, not an AI
   DIAL Chat product choice a future host might legitimately want to change
   independently of the API. A host that calls the same endpoint needs the
   same interpretation, not a customizable one.
2. **Already fully characterized across a real move.** The prior change's
   slice A added the missing characterization cases and proved the suite green
   *before* moving the code, then re-proved it green *after*. This is not a
   new, unverified transplant — it is the same ~600 lines and ~1,000 test
   lines that already survived one relocation with a byte-identical diff
   outside import substitutions.
3. **Consumed identically by every host this library serves.** Nothing about
   `mapUsageDataToDashboard` or `mapUserUsageToModelLimits` varies by host
   the way, say, icon-URL construction or display-name locale resolution does
   — those stay callback parameters. The only per-host variance is exactly
   the parameters already threaded through: `resolveIconUrl`,
   `resolveDisplayName`, `formatResetTime`, `t`.

A hypothetical case that fails any one of these three — a mapper that encodes
an AI-DIAL-Chat-specific product rule, one that has never been characterized,
or one two hosts would legitimately want to customize — does **not** qualify
under this exception and needs its own justification, exactly as the AG-Grid
paragraph already states for itself.

*Rejected:* leaving the mappers in `apps/chat/src/utils/` (status quo from the
prior change) — correct as a default when no exception is justified, but each
future host reintroduces the identical characterization risk the prior change
existed to eliminate for the rendering half; *rejected:* a general rule that
any host-agnostic DTO mapper may live in `chat-hooks` — this is the "widen the
exception to cover presentation mapping" outcome the prior change's specs
explicitly closed off, and would swallow the distinction between transport and
product-shaped adaptation this whole lineage of changes is trying to keep
legible.

### D2 — AGENTS.md gets a fourth exception paragraph, structured like the third

Insert after the existing AG-Grid paragraph (AGENTS.md's library-isolation
section), preserving its own three-part shape (what's allowed, the canonical
case, what doesn't extend):

> Fourth exception, narrower still: `libs/chat-hooks` may host a
> DIAL-Core-response-to-display adapter — not merely the request/response
> transport the second exception already covers — when the adaptation (a) is
> driven entirely by the generated response's own shape (a sentinel, a status
> threshold, a field-presence rule) rather than a product-specific decision,
> (b) is characterized by an existing test suite proven behavior-preserving
> across a prior relocation, and (c) is consumed identically by every
> DIAL-Core-backed chat application this library serves, with every
> per-host variance (icon-URL construction, locale resolution, date/time
> formatting, translated strings) still arriving as a caller-supplied
> callback or parameter. `mapUsageDataToDashboard` and
> `mapUserUsageToModelLimits` (with `mapOverallCostLimitsToPeriodStatuses`) are
> the reference case. This exception does not extend further: it does not
> license moving an app-specific business rule, an uncharacterized
> transformation, or a per-host-varying decision into `chat-hooks`, and does
> not apply to any other adapter without its own equivalent justification
> recorded in that change's design doc.

### D3 — Portable types return to the library tier, not the app tier

`ResetTimeDisplay` and `UsageI18nKeys` are app-owned (`apps/chat/src/utils/
usage-reset-time.ts`, `apps/chat/src/constants/translation-keys.ts`) — a
library cannot import either without violating the same isolation policy this
whole lineage protects. Two portable substitutes return, mirroring exactly
what `libs/usage-dashboard` carried before the prior change and what the prior
change's own design doc (D3) predicted would be needed if this move ever
happened:

- A structural `ResetTimeDisplay`-shaped type, declared locally in
  `libs/chat-hooks/src/usage/` (not re-imported from the app), matching
  `UsageTab`'s `formatUsageResetTime` return shape field-for-field. The app
  passes its own `formatUsageResetTime` wrapped in `useCallback` exactly as it
  does today — nothing about that callback's shape changes.
- Two `const` i18n-key objects (`USAGE_DATA_I18N_KEYS`,
  `USAGE_MODEL_LIMITS_I18N_KEYS`), reusing the exact same key path strings
  `UsageI18nKeys` already declares for these 20 keys. `UsageTab` continues to
  use its own `UsageI18nKeys` enum for the header, labels, and notifications
  this move does not touch; only the mapper call sites' key source changes
  back. No key path string changes, so no locale JSON file changes.

*Rejected:* keeping `UsageI18nKeys` as the mapper-facing key source and having
`chat-hooks` accept a generic `Record<string, string>` key map instead of a
named const — this loses the "here is exactly what strings your translation
bundle needs" contract the const object exists to provide, which is the same
reason the library carried it before the first move.

### D4 — `@epam/ai-dial-usage-dashboard` is a `dependencies` entry, not a peer

`.claude/rules/libs.md`'s peer table is a fixed enumeration reserved for
packages where a second installed copy is a bug — a rendering singleton
(`react`), a design-system instance (`@epam/ai-dial-ui-kit`), a shared context
layer (`@epam/ai-dial-chat-shared`), or an engine that only tolerates one
copy (`ag-grid-community` via `@epam/ai-dial-react-file-manager`). The need
here is exactly one type import — `ModelLimitRow`, `UsageLimitCardData`,
`ModelLimitPeriodStatuses` — erased at compile time, with no runtime import at
all. There is no "second copy" risk to avoid, so the peer table's own
rationale does not apply; per libs.md's default ("Everything else goes in
`dependencies`"), this is a `dependencies` entry. It is the same relationship,
mirrored, that `libs/usage-dashboard` itself carried toward
`@epam/ai-dial-chat-api-client` before the prior change removed it — a
workspace-sibling type-only dependency declared where it is used.

### D5 — Migration path for `UsageTab` is import-only, again

`UsageTab.tsx`'s three mapper imports move from
`../../../utils/map-usage-data-to-dashboard` /
`../../../utils/map-user-usage-to-model-limits` to
`@epam/ai-dial-chat-hooks`. Every `useMemo`/`useCallback` dependency array, the
boundary timer, the `visibilitychange` handler, and the notification effect
are untouched — the same guarantee D4 of the prior change's design made, now
proven twice.

## Risks / Trade-offs

- **A third relocation invites a fourth** → the AGENTS.md paragraph's
  three-part test and D1's explicit rejection of a general amnesty are the
  guard; a future case still needs its own design doc, not a precedent-citing
  shortcut.
- **`chat-hooks`'s own bundle/peer-closure fixtures might not cover the new
  `dependencies` entry** → `libs/chat-hooks/e2e-fixtures`'s packed-consumer
  suite already resolves a workspace sibling's `dependencies` closure
  generically (see `resolvePeerClosure`'s `workspaceDependencies` handling);
  no fixture code changes, only its resolved dependency set grows by one
  entry, which the suite proves resolves and installs.
- **Re-verifying the exact same characterization suite twice reads as
  redundant** → it is the point: a relocation this narrow only earns trust by
  re-proving the identical assertions pass unchanged against the new home,
  exactly as the first move did against `apps/chat`.
- **Divergence between `usage-dashboard`'s README (still describing the
  app-owned adapter from the prior, not-yet-merged change) and this change**
  → both changes' docs are updated in the same repository state before either
  merges; whichever merges second reconciles the other's README section, and
  this design records that dependency explicitly so it isn't missed.
- **Trade-off accepted:** `libs/chat-hooks` grows one more `dependencies` edge
  and ~600 more lines. That is the intended cost of centralizing
  characterized, host-invariant DTO adaptation the library's own stated
  purpose ("every DIAL-Core-backed chat application... calls the same
  generated client against the same API") already commits it to serving.

## Migration Plan

1. Confirm `isolate-usage-dashboard-domain-contracts`'s current state in the
   working tree (it is not yet merged) — this change's diff is expressed
   against that change's result, not against `apps/chat/src/utils/`'s
   pre-prior-change absence.
2. Create `libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts` and
   `map-user-usage-to-model-limits.ts`, moving the app-owned versions verbatim
   with the `ResetTimeDisplay`/`UsageI18nKeys` substitutions from D3; move
   their spec files alongside them into `libs/chat-hooks/src/usage/tests/`.
3. Re-export both from `libs/chat-hooks/src/entry-points/utils.ts`; add
   `@epam/ai-dial-usage-dashboard` to `package.json#dependencies`.
4. Update `UsageTab.tsx`'s imports (import-only diff, per D5); delete the
   app-owned files and their moved specs.
5. Update the AGENTS.md exception paragraph (D2) and the four capability
   specs' delta (see `specs/`).
6. Update `libs/chat-hooks/README.md` with a "Usage Utilities" section
   mirroring the `useUsageData` entry's style; correct
   `libs/usage-dashboard/README.md`'s migration note to point at the new
   location.
7. Run the moved characterization suites, `UsageTab.spec.tsx`, `chat-hooks`'s
   own build/lint/typecheck and packed-consumer fixture, `npm run
   validate:docs`, and `npm run verify:full`.

**Rollback:** revert the commit. `libs/usage-dashboard` is untouched by this
change in either direction, so a revert restores the
`apps/chat/src/utils/`-owned state from `isolate-usage-dashboard-domain-contracts`
with nothing else to undo.

## Open Questions

None blocking. One decision recorded as an assumption: the mappers are
re-exported from the existing `./utils` entry point rather than a new
dedicated subpath, matching `useUsageData`'s own placement — reviewable
without reshaping the plan.

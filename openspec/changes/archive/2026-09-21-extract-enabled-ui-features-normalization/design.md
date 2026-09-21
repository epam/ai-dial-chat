## Context

`AppConfigService.getClientConfig` resolves every `visibility: 'client'` key in
`CONFIG_DEFINITIONS` in one loop and dispatches on `def.key` through a long `else if`
chain (`apps/chat-api/src/app-config/app-config.service.ts:196-330`). Most branches are a
single type guard. Two are not: `announcement.items`, which was already lifted into
`private normalizeAnnouncements` (`app-config.service.ts:103`) and is now a one-line call
(`app-config.service.ts:262`), and `uiFeatures.enabledUiFeatures`, which still carries its
full normalization inline (`app-config.service.ts:271-300`).

The inline branch implements, in this exact order:

1. `Array.isArray(resolved) ? resolved : []` — a non-array (including `null` from
   `defaultValue`) becomes an empty array, and the whole block is skipped, leaving
   `enabledUiFeatures` at its initialized `null`.
2. For each entry, `String(entry)` coercion into `raw`.
3. `DEPRECATED_UI_FEATURE_ALIASES[raw]` lookup **before** the allowlist. A hit warns
   `ENABLED_UI_FEATURES entry "<raw>" is deprecated; using "<alias>" instead` and pushes
   the alias target.
4. Otherwise `KNOWN_UI_FEATURES.has(raw)` pushes `raw` unchanged.
5. Otherwise warns `Ignoring unrecognized ENABLED_UI_FEATURES entry: "<raw>"` and drops.
6. `[...new Set(filtered)]` — dedupe **after** normalization, so an alias colliding with
   its canonical name collapses, preserving first occurrence.
7. If nothing survived a non-empty input, warns `ENABLED_UI_FEATURES contained only
   unrecognized entries; falling back to compiled-in defaults` and leaves `null`.

`null` and `[]` are not interchangeable here: `null` means "use the compiled-in frontend
defaults", `[]` would mean "enable nothing", which disables the UI. That asymmetry is the
single most important invariant in this branch and the main reason it deserves isolated
tests.

Existing coverage (`apps/chat-api/src/app-config/tests/app-config.service.spec.ts`) tests
this only through the assembled service: known value passthrough (:186), mixed
known/unknown with a `stringContaining` warning assertion (:207), alias resolution (:228),
alias/canonical dedupe (:251), all-unknown fallback (:261), and the unset default (:100).
None of them pin warning *counts* or *order*, the silence of the empty/non-array path, the
`String` coercion, or input/constant immutability.

Constraints: `apps/chat-api/AGENTS.md` §1 (domain layout, `tests/` subfolder once a folder
holds more than one spec) and §services (Nest `Logger`, no `console.log`). The constants
stay duplicated in `apps/chat-api` rather than imported from `@epam/ai-dial-chat-overlay`
— that duplication is deliberate and documented in
`known-ui-features.constants.ts`.

## Goals / Non-Goals

**Goals:**

- Make every normalization rule listed above testable without constructing
  `AppConfigService`, its `CompositeConfigProvider`, or a cache.
- Reduce the `uiFeatures.enabledUiFeatures` branch to a delegating call, matching the
  shape `announcement.items` already has.
- Preserve warning text, level, order, and occurrence count exactly — including repeated
  entries, which each warn separately today because dedupe happens after the loop.
- Leave the HTTP contract, DTO, OpenAPI document, generated client, and frontend
  byte-identical.

**Non-Goals:**

- Splitting the rest of `getClientConfig`, building a resolver registry or dispatch table,
  or introducing a new package, provider, class hierarchy, or diagnostic framework.
- Fixing the prototype-pollution-adjacent plain-object alias lookup
  (`DEPRECATED_UI_FEATURE_ALIASES[raw]` on a `Record`, where `raw` could be
  `'constructor'`). Converting it to a `Map` or adding an own-property guard changes
  observable behavior and belongs in its own change.
- Adding trimming, case normalization, sorting, schema validation, or error swallowing.
  Env-layer trimming stays in `EnvConfigProvider` where it already lives.
- Touching announcements, sanitization, feature flags, persistence, auth, or
  observability. Unrelated defects found while reading are reported, not fixed here.

## Decisions

### D1 — A free function with an injected warning callback, not a private method

`normalizeEnabledUiFeatures(value: unknown, warn: (message: string) => void): string[] | null`,
exported from a new module beside the existing app-config helpers.

The obvious alternative is a `private normalizeEnabledUiFeatures` method, exactly
mirroring `normalizeAnnouncements`. Rejected: a private method still needs a constructed
service to reach, which is precisely the test cost this slice exists to remove — and
`normalizeAnnouncements` is the evidence, since its own rules are only tested through
`getClientConfig` today. The free function keeps the *call-site* shape identical to the
`normalizeAnnouncements` precedent while making the rules directly reachable.

A callback rather than a passed `Logger`: the helper must not construct a logger (it would
get the wrong context) and must not depend on `@nestjs/common`. The service passes an
arrow, `(message) => this.logger.warn(message)`, never `this.logger.warn` unbound — Nest's
`Logger.warn` reads instance state, so an unbound reference loses the
`AppConfigService` context prefix and silently changes log output.

Signature takes `unknown`, not `string[]`, because the branch's first job is rejecting
non-array input; narrowing at the boundary would move that rule back into the service.

### D2 — File placement: `apps/chat-api/src/app-config/enabled-ui-features.normalizer.ts`

Beside `html-sanitizer.ts` and `known-ui-features.constants.ts`, which are the existing
non-Nest helper modules in this domain folder. Not under `config-registry/`, which holds
provider machinery, and not in `libs/*`, since server configuration policy stays in the
app (`AGENTS.md` §Library isolation).

Its spec goes to `apps/chat-api/src/app-config/tests/enabled-ui-features.normalizer.spec.ts`
— `apps/chat-api/AGENTS.md` §1 requires the `tests/` subfolder once a source folder holds
more than one spec, and this one already holds four.

### D3 — Dedupe stays after the loop, so repeated entries still warn per occurrence

Today `['bogus', 'bogus']` emits the unrecognized warning twice, and
`['custom-applications', 'custom-applications']` emits the deprecation warning twice. That
is a consequence of `new Set` running after the `reduce`, not a decision anyone recorded,
but it is observable in operator logs. The helper keeps the same order of operations. No
input deduplication before warnings.

### D4 — Return type carries the `null` fallback; the service does not re-derive it

The helper returns `string[] | null` and owns rule 7 (the all-unrecognized warning plus
`null`). The alternative — returning `string[]` and letting the service map `[]` to `null`
— would split the `null`-vs-`[]` invariant across two files, which is the one thing this
change should make harder to get wrong. The service assigns the result directly:

```ts
} else if (def.key === 'uiFeatures.enabledUiFeatures') {
  enabledUiFeatures = normalizeEnabledUiFeatures(resolved, (message) =>
    this.logger.warn(message),
  );
}
```

Note this assigns on every pass through the branch, where the old code only assigned on
success. Behavior is identical because `enabledUiFeatures` is initialized to `null` and
the branch runs at most once per request (keys in `CONFIG_DEFINITIONS` are unique), but
the equivalence is worth stating since it is the one place the shape of the code changes
rather than moves.

### D5 — Purity: no shared mutable state, no input mutation

The helper allocates its own accumulator per call, never writes to the input array, and
never writes to `KNOWN_UI_FEATURES` or `DEPRECATED_UI_FEATURE_ALIASES`. No module-level
cache or memo — a per-call allocation on a request that is already cached for 60s is not
worth the aliasing risk of handing the same array to two responses.

## Risks / Trade-offs

- **Warning drift — text, order, or count changes silently and only operators notice.**
  → The helper spec asserts exact message strings and the full ordered warning sequence
  for a multi-entry input, not `stringContaining`. The existing service tests stay as the
  integration guard.
- **The `null` / `[]` distinction collapses during the move, disabling the UI for every
  deployment that has a partly-invalid `ENABLED_UI_FEATURES`.** → D4 keeps the rule in one
  place; the helper spec asserts `toBeNull()` (not `toEqual([])`) on all four paths that
  produce it: absent, non-array, empty array, all-unrecognized.
- **A "while I'm here" cleanup rides along** — trimming, a `Map` lookup, sorting for
  stable output. → Explicitly listed as Non-Goals; the acceptance criteria require
  byte-identical behavior, so any such change fails review by construction.
- **Tests that assert the helper was called rather than what it produced** would pass while
  the behavior regresses. → The strategy is value-based assertions only; mocking the
  helper inside the service spec is prohibited.
- **Low upside if the larger dispatch refactor never lands.** → Accepted: the tests alone
  justify the slice, and the extraction is independently revertible.

## Migration Plan

No runtime migration: no schema, no config, no persisted state, no client coordination,
and no deployment ordering constraint. The HTTP response is byte-identical before and
after, so old and new pods can serve the same traffic during a rolling deploy.

Sequencing:

1. Characterize the uncovered invariants against the *current* inline implementation
   first, so the baseline is recorded before anything moves.
2. Extract the helper and delegate the branch; run the focused specs through the Nx test
   workflow.
3. Run backend lint/typecheck and the repository's changed-slice verification. Confirm no
   diff in the OpenAPI document, the generated client, or `apps/chat/**`.

Rollback: inline the helper body back into the branch and delete the helper and its spec.
Nothing else is affected, and there is no forward-only step to undo.

## Open Questions

None blocking. Two items deliberately deferred rather than open:

- The plain-object alias lookup hardening (`Map` or own-property guard) — separate change,
  because it changes behavior for inputs like `'constructor'`.
- Whether `normalizeAnnouncements` should get the same treatment — plausible, but out of
  scope here; this slice deliberately changes one branch so the diff stays reviewable.

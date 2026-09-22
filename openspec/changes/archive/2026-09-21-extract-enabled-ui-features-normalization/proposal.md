## Why

`AppConfigService.getClientConfig` mixes provider/cache orchestration with a ~35-line
inline branch that normalizes `uiFeatures.enabledUiFeatures`
(`apps/chat-api/src/app-config/app-config.service.ts:271-300`). That branch owns five
distinct rules — array/empty fallback, `String(entry)` coercion, deprecated-alias
resolution, allowlist filtering with per-entry warnings, first-occurrence dedupe, and a
null fallback when nothing survives — but none of them can be exercised without standing
up the whole service, its composite provider, and its cache. The service already
demonstrates the target shape for exactly this problem: `normalizeAnnouncements`
(`app-config.service.ts:103`) is the announcements equivalent, lifted out of the loop and
called from a one-line branch (`app-config.service.ts:262`).

This is a behavior-preserving refactor. It is a small preparatory slice of the larger
app-config dispatch item; that item stays open.

## What Changes

- Add one app-local synchronous helper, `normalizeEnabledUiFeatures(value, warn)`,
  returning `string[] | null`, beside the existing app-config helpers. It takes an
  explicit `(message: string) => void` warning callback so it needs no logger, no Nest
  DI, and no framework initialization.
- Replace only the body of the `uiFeatures.enabledUiFeatures` branch with a call to that
  helper, passing `(message) => this.logger.warn(message)` so the existing Nest logger
  and its `AppConfigService` context are preserved. Resolution, `?? def.defaultValue`
  selection, cache lookup/set, and every other config-key branch stay exactly where
  they are.
- Keep `KNOWN_UI_FEATURES` and `DEPRECATED_UI_FEATURE_ALIASES`
  (`apps/chat-api/src/app-config/known-ui-features.constants.ts`) as the source of
  recognized values and aliases, unchanged.
- Add a focused helper spec covering the invariants existing service tests do not pin
  (empty/non-array input warning silence, warning count and order for repeated entries,
  `String` coercion, input/constant immutability). Keep the existing service tests as the
  integration guard — they are not replaced by mocked-helper assertions and not relaxed.

No **BREAKING** change: the endpoint, DTO, `null` semantics, feature values, metadata,
status codes, warning text, and cache behavior are all identical before and after.

## Capabilities

### New Capabilities

None. No new business capability is introduced — moving code does not create one.

### Modified Capabilities

- `config-registry-and-env-provider`: clarification only. The existing requirement
  "Unrecognized entries are filtered with a warning at the service layer, not at env
  validation" (`openspec/specs/config-registry-and-env-provider/spec.md:278`) describes
  filtering and the all-unrecognized fallback, but leaves the other normalization rules
  the code has always had — `String(entry)` coercion, alias-before-allowlist ordering,
  per-occurrence warning emission, and first-occurrence dedupe — undocumented. The delta
  states them so the extraction has an explicit contract to preserve. No externally
  observable behavior changes.

`client-config-endpoint` is **not** modified: its `enabledUiFeatures` requirement and all
six of its scenarios (`openspec/specs/client-config-endpoint/spec.md:168-207`) already
hold verbatim after this change.

## Impact

- **Production code:** `apps/chat-api/src/app-config/app-config.service.ts` (one branch
  body) plus one new helper file in `apps/chat-api/src/app-config/`.
- **Tests:** one new focused spec under `apps/chat-api/src/app-config/tests/`
  (the folder already holds multiple specs, per `apps/chat-api/AGENTS.md` §1); a narrow
  additive adjustment to `tests/app-config.service.spec.ts` only if a listed invariant
  is genuinely uncovered there.
- **Unchanged:** `GET /api/v1/client-config` path, `ClientConfigResponseDto`, OpenAPI
  document, generated `@epam/chat-api-client`, all frontend code, cache key/TTL/role
  isolation, `environment.config.ts`, and the `ENABLED_UI_FEATURES` contract in
  `apps/chat-api/README.md`.
- **Dependencies:** none added or removed.
- **i18n:** no user-visible strings. Warnings are operator-facing server logs, which this
  project does not translate.
- **Scope creep check:** nothing under `libs/*` is touched, so the library-isolation rule
  does not apply; the constants deliberately stay duplicated in `apps/chat-api` rather
  than imported from the browser-facing overlay package.

### Alternatives considered

1. **Extract to a helper with an injected warning callback (chosen).** Smallest
   reviewable diff; makes every normalization rule unit-testable; mirrors the
   `normalizeAnnouncements` precedent already in this file; reverting it restores the
   inline code with no migration.
2. **Extract as a private method (`private normalizeEnabledUiFeatures`)** — exactly the
   `normalizeAnnouncements` shape. Rejected: a private method still requires a
   constructed service (composite provider + cache) to test, which is the cost this slice
   exists to remove. The free function keeps the `normalizeAnnouncements` call-site shape
   while dropping the test setup.
3. **Do nothing / defer to the full app-config dispatch refactor.** Rejected: the full
   refactor is a much larger, riskier change, and this branch's behavior is the part most
   worth pinning down first — it is the one place where a wrong result silently disables
   or re-enables large parts of the UI.
4. **Move the allowlist and normalization into a shared library.** Rejected: server
   configuration policy belongs in `apps/chat-api`, and importing a browser package into
   the Node service is the coupling the current duplication deliberately avoids.

### Rollback

Non-breaking and trivially reversible: inline the helper body back into the branch and
delete the helper plus its spec. No data migration, no config migration, no client
coordination, and no deployment ordering constraint — the HTTP contract is byte-identical
in both directions.

### Acceptance criteria

- The same representative inputs produce the same `config.enabledUiFeatures` value **and**
  the same warning sequence (text, level, order, occurrence count) before and after.
- A cache hit still bypasses provider resolution and normalization and emits no warnings.
- `apps/chat-api/src/app-config/app-config.service.ts` no longer contains the
  normalization body; its `uiFeatures.enabledUiFeatures` branch is a delegating call.
- Existing service tests pass unmodified in substance; new helper tests are value-based,
  not `toHaveBeenCalled` assertions on the helper.
- No diff in the OpenAPI document, the generated client, or any frontend file.

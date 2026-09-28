## Why

`AppConfigService.getClientConfig` still mixes two jobs: provider/cache orchestration
and a 25-branch `if/else if` ladder that holds each client-config field's default and
type coercion (`apps/chat-api/src/app-config/app-config.service.ts:76-189`). Every new
client-visible registry key adds a mutable local, a ladder branch, and a response-literal
line in three places in the same method. Nothing checks that a new key is mapped at all.
If a key is forgotten, the service drops it without a trace
(`app-config.service.ts:103-188` has no `else`). The feature-list and announcement-list
normalizers have already been extracted (archived changes
`2026-09-21-extract-enabled-ui-features-normalization` and
`2026-09-22-extract-announcements-normalization`). This change does the matching
follow-up for the rest of the method.

Rechecked against current `development` (`a22ec0a53`). The ladder now has **25**
non-feature branches, not 23. The two added since the audit are `ui.activeEventId`
(`app-config.service.ts:113-114`) and `documents.allowedConnectOrigins`
(`app-config.service.ts:141-142`). Separate from the ladder are the `features.*` branch
(`:107-112`) and the pre-resolved `app.version` path (`:65-74`, `:266-274`).

## What Changes

- Add an app-local, pure mapping module, `apps/chat-api/src/app-config/client-config.mapper.ts`,
  that owns:
  - a default factory that returns a fresh, fully typed accumulator for the 25 mapped
    `ClientConfigDto` fields;
  - a typed, read-only table from registry key to response field and value conversion.
    It has exactly one entry per client-visible non-feature key except `app.version`;
  - a lookup-and-apply function that is safe against inherited object properties and
    does nothing for a key the table does not contain.
- Reduce `getClientConfig` to orchestration only. Its cache lookup, `app.version`
  pre-resolution, sequential registry-order resolution, `value ?? defaultValue`,
  `features.*` handling, metadata, and cache write stay where they are, unchanged. For
  each non-feature key, the loop calls the mapper instead of the ladder.
- Keep both existing normalizers, and the service's warning callback into them, exactly
  as they are. The mapper passes the same `(message) => this.logger.warn(message)`
  callback through.
- Add a registry-coverage guard test. It fails when a client-visible non-feature key has
  no mapping, when a mapping names a key that is missing from the registry or is not
  client-visible, or when two mappings write the same response field.
- Add the characterization tests the current service suite lacks, before the dispatch
  moves (see Acceptance criteria).
- **No** change to the DTO, OpenAPI, the generated client, the frontend, env vars,
  dependencies, providers, the cache key or TTL, or log text. Nothing is **BREAKING**.

Alternatives considered:

| Option                                                                                | Verdict                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Keep the ladder, only add a coverage test (baseline)                               | Rejected. It gives no structural gain, and a test can only see the ladder by string-matching the service source.                                                                                                                                                                                  |
| B. **Typed app-local mapping table plus default factory (pick)**                      | Smallest explicit design. One entry per key, one place for defaults. The service keeps orchestration. It is a pure module, like the normalizers. No Nest provider, no singleton state.                                                                                                             |
| C. Attach a `toResponse` handler to each `ConfigDefinition` in `CONFIG_DEFINITIONS`   | Rejected. It couples the provider-facing registry (read by `EnvConfigProvider`, `StaticDefaultsProvider`, `CompositeConfigProvider`) to the client DTO. It would also force a `ConfigDefinition` type rewrite, and the server-only keys would carry handlers they never use.                         |
| D. Generic dotted-path/declarative config engine                                      | Rejected. It needs dynamic writes and casts, and it does not fit the field-specific policies (sanitizers, normalizers, `%%VERSION%%`).                                                                                                                                                            |

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `client-config-endpoint`: adds a requirement for how the response is assembled. Field
  mapping belongs to a typed per-key table, and resolution order, `app.version`
  single-resolution, cache-hit side effects, response field set and order, and per-call
  isolation are preserved. Existing response requirements stay as they are.
- `config-registry-and-env-provider`: adds a requirement that every client-visible
  non-feature registry key has exactly one client-config mapping, or is the documented
  `app.version` special path, and that a test enforces this.

## Impact

- **Code:** `apps/chat-api/src/app-config/app-config.service.ts` (the ladder, locals,
  default constants, and `isApplicationVisualizerRegistry` move out). New
  `apps/chat-api/src/app-config/client-config.mapper.ts` and
  `apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts`. Additions to
  `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`.
- **Reference patterns:** the pure module plus warn callback in
  `apps/chat-api/src/app-config/enabled-ui-features.normalizer.ts:31-34` and
  `announcements.normalizer.ts:58`, and the service call sites at
  `app-config.service.ts:153-155` and `:165-167`.
- **Unchanged:** `CompositeConfigProvider` priority and fallbacks
  (`config-registry/composite-config.provider.ts:34-69`), `EnvConfigProvider`,
  `StaticDefaultsProvider`, `CONFIG_DEFINITIONS` contents and order, `isEnabled`,
  `resolveValue`, the controller, `ClientConfigResponseDto`, `libs/chat-api-client`, and
  `apps/chat`.
- **Scope:** backend app only. It does not touch `libs/*` or global providers, and adds
  no new Nest provider.
- **i18n / RTL / a11y:** no user-visible strings and no UI.
- **Docs:** `docs/architecture.md` describes `app-config/` only at folder level
  (`docs/architecture.md:425`), so it is expected to stay accurate. The task list
  re-checks it and `apps/chat-api/README.md`.
- **Rollback / compatibility:** not breaking. Revert the extraction commit. There is no
  data migration and no deployment-order dependency.
- **No claim** of memory, latency, or reliability improvement.

## Non-goals

Redesigning the provider architecture or env parser. Fixing alias behavior, including
the prototype-backed `DEPRECATED_UI_FEATURE_ALIASES` lookup, which is its own follow-up.
Tightening number, array, or string validation. Changing cache capacity or TTL.
OOM/upload-memory work. Generation, SSE, or persistence work. Frontend refactoring. New
shared libraries. Framework upgrades. Any `ConfigDefinition` or `CONFIG_DEFINITIONS`
type rewrite.

## Acceptance criteria

- `getClientConfig` contains no key-specific field mapping. The only branches left are
  `def.type === 'feature'` and the `app.version` pre-resolution and filter.
- For the same provider values, the response is deep-equal to the pre-change response,
  with the same `config` key order. This covers defaults, nullish inputs, wrong-shaped
  inputs, and every custom policy. Characterization tests prove it, and they are written
  and green **before** the dispatch moves.
- The provider call sequence is unchanged: `app.version` first, then client definitions
  in registry order, one call each, every call with the full context. A cache hit makes
  zero provider calls, keeps the cached `metadata`, and emits no normalizer warnings.
- The warning text, order, and count from both normalizers are unchanged.
- The coverage guard fails when a client-visible non-feature key is added without a
  mapping.
- Service, controller, normalizer, and config-registry suites pass. `chat-api` typecheck
  and lint pass. `npm run verify:full` has been run once, and its result is recorded
  against the actual revision.

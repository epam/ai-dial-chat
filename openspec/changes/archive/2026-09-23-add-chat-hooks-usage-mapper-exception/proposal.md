## Why

`isolate-usage-dashboard-domain-contracts` (implemented, not yet merged) moved
`mapUsageDataToDashboard` and `mapUserUsageToModelLimits` out of
`libs/usage-dashboard` into `apps/chat/src/utils/`, because AGENTS.md's
`libs/chat-hooks` exception is written for **"thin request/response logic ...
equivalent in shape to `apps/chat/src/server-api/*.api.ts` wrappers"** —
transport, not the ~600-line DTO-to-display-model transformation these two
functions perform (unlimited-sentinel detection, status-threshold derivation,
the `DeploymentItemDtoTypeEnum.Model` join, currency/number formatting). That
change's own delta specs explicitly record the resulting position: this
coupling "SHALL NOT be relocated into another library... the narrow
`libs/chat-hooks` generated-client exception in AGENTS.md SHALL NOT be widened
to cover presentation mapping."

That position was correct against the exception's *current* wording, and
correctly stopped a silent widening inside an unrelated change. The
architectural question underneath — whether this specific, fully
characterized, DTO-shape-driven adaptation deserves its own narrow exception,
the way `useGridEditingScroll`'s AG-Grid-type leak earned one — is a separate
decision this change exists to make explicitly, the way AGENTS.md's own
process requires: "a written reason in the change's design doc," not an
inline judgment call during an unrelated move.

The concrete motivation: `libs/chat-hooks` already states its reason for
existing — "every DIAL-Core-backed chat application this library serves calls
the same generated client against the same API." `useUsageData` already lives
there for exactly that reason. Every one of those same applications that hosts
a Usage tab needs the identical DTO interpretation these two mappers perform —
the sentinel, the thresholds, and the join are DIAL Core response shape, not
AI DIAL Chat product decisions. Today, each such host must copy ~600
characterized lines and their ~1,000-line test suite verbatim into its own
`apps/*/src/utils/`, per the README migration note the prior change shipped.
That copy has no natural point of divergence — a host that gets it wrong
reproduces a bug the reference implementation already fixed.

## What Changes

- **BREAKING (again) for `@epam/ai-dial-usage-dashboard` consumers, but not for
  this repository:** `mapUsageDataToDashboard` and `mapUserUsageToModelLimits`
  (plus `mapOverallCostLimitsToPeriodStatuses`, which the row mapper's own
  period-status derivation depends on) move a second time — from
  `apps/chat/src/utils/` into `libs/chat-hooks/src/usage/`, exported from the
  existing `@epam/ai-dial-chat-hooks/utils` entry point, matching how
  `useUsageData` itself is already exported from `./utils` rather than a
  dedicated subpath. AI DIAL Chat's own `UsageTab` switches its import back to
  the library; its behavior is unchanged.
- **AGENTS.md gets a fourth, narrow exception**, in the same recorded style as
  the AG-Grid one: `libs/chat-hooks` may host a DIAL-Core-response-to-display
  adapter — not just request/response transport — when the adaptation is
  (a) driven entirely by the generated response shape (sentinel, thresholds,
  field names) rather than a product-specific decision, (b) fully
  characterized by an existing test suite proven behavior-preserving across a
  prior move, and (c) consumed identically by every DIAL-Core-backed chat
  application this library serves. It does not license moving arbitrary
  DTO-consuming code into `chat-hooks`; each future case needs its own
  equivalent justification recorded in *that* change's design doc, exactly as
  the AG-Grid exception already requires of itself.
- Two portable types return to the library boundary, this time inside
  `chat-hooks` rather than `usage-dashboard`: a `ResetTimeDisplay`-shaped
  structural type (so the library never imports the app's own type) and two
  `const` i18n-key objects (so `chat-hooks` never imports the app's
  `UsageI18nKeys` enum). `libs/chat-hooks` gains `@epam/ai-dial-usage-dashboard`
  as a **`dependencies` entry, not a peer** — it is needed only for the
  `ModelLimitRow` / `UsageLimitCardData` / `ModelLimitPeriodStatuses` display
  types the mappers return, never for rendering, and per `.claude/rules/libs.md`
  a peer exists to avoid a second runtime copy of a singleton; a type-only need
  is erased at compile time and carries no such risk. This exactly mirrors how
  `usage-dashboard` itself used to depend on `@epam/ai-dial-chat-api-client`'s
  types as a `dependencies` entry before this lineage of changes began.
- `resolveIconUrl`, `resolveDisplayName`, `formatResetTime`, and the translate
  callback stay host-supplied parameters, exactly as today; nothing about the
  callback boundary changes.
- The four capability specs (`usage-dashboard-lib`, `usage-model-limits`,
  `usage-data-hook`, `usage-period-reset-times`) are updated a second time to
  name `libs/chat-hooks` as the adapters' owner, and the "not relocated to
  another library" scenario in `usage-model-limits` is narrowed to describe
  what *would* still be disallowed (arbitrary DTO logic, no equivalent
  justification) rather than forbidding this specific, now-justified case.
- `libs/usage-dashboard/README.md`'s migration note is corrected: the
  reference implementation moves again, this time to a public package other
  hosts install instead of copy.

## Capabilities

### New Capabilities

None — this reassigns ownership within existing capabilities.

### Modified Capabilities

- `usage-dashboard-lib`: no requirement text changes (the library still
  renders normalized models only), but its Purpose paragraph's pointer to
  "`apps/chat/src/utils/`" is corrected to `libs/chat-hooks`.
- `usage-model-limits`: the "Library isolation for the adapter" requirement's
  "SHALL NOT be relocated into another library" scenario is narrowed from an
  absolute prohibition to the AGENTS.md-recorded exception condition; the
  adapter's owning path changes from `apps/chat/src/utils/` to
  `libs/chat-hooks/src/usage/`.
- `usage-data-hook`: the "Library isolation between apps/chat and libs"
  requirement's adapter-location text and its "Usage adapters are app-owned"
  scenario move to name `libs/chat-hooks` instead of `apps/chat/src/utils/`.
- `usage-period-reset-times`: the "Reset-time normalization at the application
  edge" requirement's statement that the adapters are app-owned, and the
  `ResetTimeDisplayLike`/`FormatResetTime` removal note, are both reversed —
  the portable reset-display type returns to the library tier, now inside
  `chat-hooks` rather than `usage-dashboard`.

## Impact

- **Library:** `libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts` and
  `map-user-usage-to-model-limits.ts` (new), re-exported from the existing
  `./utils` entry point (`libs/chat-hooks/src/entry-points/utils.ts`),
  `@epam/ai-dial-usage-dashboard` added to `libs/chat-hooks/package.json`
  as a `dependencies` entry (type-only need, not a peer).
- **App:** `apps/chat/src/utils/map-usage-data-to-dashboard.ts` and
  `map-user-usage-to-model-limits.ts` deleted; `UsageTab.tsx` import source
  changes back to `@epam/ai-dial-chat-hooks/usage`; its i18n key references
  switch from `UsageI18nKeys` for the mapper-facing strings back to the
  portable const objects (`UsageI18nKeys` keeps owning every other Usage
  string — page header, labels, notifications).
- **Docs:** `AGENTS.md` (new exception paragraph), the four capability specs
  above, `libs/chat-hooks/README.md` (new `usage` entry-point section),
  `libs/usage-dashboard/README.md` (corrected migration note).
- **Unaffected:** `libs/usage-dashboard`'s components, props, and manifest;
  `useUsageData`; `useDeployments`; the backend; the consumer fixture proving
  `usage-dashboard` has no generated-client edge (still true — this change
  never touches that library again).
- **i18n:** no new strings. The two mapper-facing const objects reuse the
  exact same key paths `UsageI18nKeys` already declares; only which module
  owns the const changes.
- **Scope-creep flag:** this change edits `AGENTS.md`, a project-wide
  governance document, not just implementation code. That is the point of the
  change and is bounded to the one paragraph described above.

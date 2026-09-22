## Context

`apps/chat-api/src/app-config/app-config.service.ts` currently owns three unrelated concerns in one file: DIAL Core config-registry orchestration (`getClientConfig`'s dispatch loop over `CONFIG_DEFINITIONS`), cache management (`cacheManager`, `getClientConfigCacheKey`), and pure data-shape validation for two config values (`announcement.items`, and — via the module-level `toNullableText` helper — `announcement.title`/`announcement.description`/`welcomeScreen.description`). `#8955` already extracted the third such concern, `uiFeatures.enabledUiFeatures`, into `enabled-ui-features.normalizer.ts`: a pure `(value: unknown, warn: (message: string) => void) => Result` function with its own spec file, requiring no Nest bootstrap to test. That extraction is the reference implementation for this change; `announcement.items` is the next validation concern with the same shape (array of operator-authored entries, drop-and-log on invalid, capped list) and the largest number of assertions currently paid for by constructing the full service.

`toNullableText` (`app-config.service.ts:31-37`) is a complication: it is used by the announcement normalization being extracted, but also directly inside `getClientConfig`'s dispatch loop for `announcement.title`, `announcement.description`, and `welcomeScreen.description` (lines 254, 256, 262). It must end up somewhere both the new normalizer and the service can import from, without the normalizer importing the service (that would invert the intended dependency direction and defeat the "test without constructing the Nest service" goal).

## Goals / Non-Goals

**Goals:**

- Make `announcement.items` normalization unit-testable without a Nest testing module, cache mock, or provider mock.
- Preserve byte-for-byte observable behavior: response shape, field values, warning text/order/multiplicity, and all other `getClientConfig` branches.
- Keep the new module private/internal in scope — no new public capability, no change to `AnnouncementItemDto`/`AnnouncementLinkDto`, no OpenAPI impact.
- Match the established `enabled-ui-features.normalizer.ts` shape exactly, so a future reader who has seen one recognizes the other immediately.

**Non-Goals:**

- Redesigning `getClientConfig`'s dispatch loop (the long `if/else if` chain over `CONFIG_DEFINITIONS`) — untouched, out of scope for this slice.
- Extracting or hardening `uiFeatures.enabledUiFeatures` further (e.g., alias-map validation) — already merged, not reopened here.
- Any new normalization framework, generic "config validator" abstraction, or injectable service — one function, following the one existing precedent.
- Any change to cache policy, provider precedence, role filtering, or the client-config response schema.

## Decisions

**1. New file `apps/chat-api/src/app-config/announcements.normalizer.ts`, one exported function.**
Exports `normalizeAnnouncements(value: unknown, warn: (message: string) => void): AnnouncementItemDto[]`. Keeps `parseAnnouncementLink`, `isExternalHttpUrl`, the `AnnouncementRejection` type, and `MAX_ANNOUNCEMENTS` as module-private (unexported) — they are implementation details of this one function, exactly as they are today inside the service, and `enabled-ui-features.normalizer.ts` keeps its own helpers (`DEPRECATED_UI_FEATURE_ALIASES` lookup, etc.) equally private. `AnnouncementItemDto`/`AnnouncementLinkDto` are imported with `import type` only — the module constructs plain objects matching those shapes but never needs the classes at runtime (mirrors how DTOs are used purely as compile-time contracts elsewhere in `app-config`).

_Alternative rejected_: exporting the helpers separately "for reuse" — nothing else in the codebase needs `isExternalHttpUrl` or `parseAnnouncementLink` today, and exporting them would widen the module's public surface without a caller, contradicting the "no generic normalization framework" boundary in the proposal.

**2. `toNullableText` moves to a new shared module, not duplicated.**
Because `toNullableText` is a one-line, dependency-free helper reused by three `getClientConfig` branches in addition to the normalizer, it moves unchanged into a small new file `apps/chat-api/src/app-config/text.util.ts`, matching the existing `*.util.ts` single-purpose helper convention already used elsewhere in `apps/chat-api` (e.g. `apps/chat-api/src/auth/utils/callback-url.util.ts`, `apps/chat-api/src/files/dial-resource-path.util.ts`) rather than the generic `.utils`/`.types`/`.models` suffix ban in `.claude/rules/all-ts.md`, which governs frontend/lib domain files, not this backend single-function-helper pattern. Both `announcements.normalizer.ts` and `app-config.service.ts` import it from there. This keeps the dependency direction one-way (`app-config.service.ts` → `announcements.normalizer.ts` and `app-config.service.ts` → `text.util.ts`; `announcements.normalizer.ts` → `text.util.ts`; never normalizer → service), so the normalizer still has zero Nest/service dependency.

_Alternative rejected_: duplicating `toNullableText` inside the normalizer. Rejected because the proposal explicitly disallows it ("Do not duplicate it") and because a duplicate would silently diverge if one copy is ever tweaked (e.g., a future whitespace-trimming change applied to only one copy).

_Alternative rejected_: leaving `toNullableText` in `app-config.service.ts` and having the normalizer import it from there. Rejected because it would make the pure normalizer module depend on the file that also declares `@Injectable() AppConfigService`, reintroducing exactly the “can’t test without constructing the Nest service” coupling this extraction removes (even though the function itself has no DI, static analysis and future refactors would treat the normalizer as coupled to the service file).

**3. Service delegates with the same inline-arrow `warn` pattern already used for `uiFeatures.enabledUiFeatures`.**
`app-config.service.ts:258-259` becomes:
```ts
} else if (def.key === 'announcement.items') {
  announcements = normalizeAnnouncements(resolved, (message) =>
    this.logger.warn(message),
  );
}
```
identical in shape to the existing `uiFeatures.enabledUiFeatures` branch at lines 268-271. This preserves the `Logger` context (`AppConfigService`) on every warning, which a bound method reference (`this.logger.warn`) would not, since `Logger.warn` reads `this` internally — the same reasoning already documented in `enabled-ui-features.normalizer.ts`'s JSDoc.

**4. Characterization tests are added to the existing service spec *before* the move (task-ordering decision, detailed in tasks.md).**
`apps/chat-api/src/app-config/tests/app-config.service.spec.ts` already has one `describe` block per announcement behavior (see lines 532-707: empty list, complete entry, no-link entry, invalid-link table test, blank label, blank title, mixed valid/invalid, order preservation, sanitization, null-description, non-object entry, cap-with-leading-entries-kept). The gaps the proposal calls out — exact warning text/multiplicity/order, and duplicate-entry preservation — are added as new `it` blocks in the same file, run and confirmed green against the *current* (pre-move) implementation, and then left untouched through the move itself so they function as a regression harness.

## Risks / Trade-offs

- **[Risk]** A subtle behavior difference introduced during the mechanical move (e.g., forgetting `.trim()` somewhere, or reordering the cap check relative to the warning loop) would silently change server logs or drop announcements differently. → **Mitigation**: task ordering in Decision 4 — add characterization tests first, confirm green pre-move, keep them unchanged post-move; add the new `announcements.normalizer.spec.ts` for the extracted unit directly; run `npm run test:file` for both spec files after the move, not just at the end.
- **[Risk]** Moving `toNullableText` touches three unrelated `getClientConfig` branches (`announcement.title`, `announcement.description`, `welcomeScreen.description`), which are outside the "announcement-list normalization" scope stated in the proposal, so a mistake there would regress banner/welcome-screen text unrelated to the announcements list. → **Mitigation**: the move is a pure re-export (same implementation, same signature, only the import path changes in `app-config.service.ts`); existing service-spec assertions for banner title/description and welcome-screen text (already present) are re-run unchanged after the move as regression coverage, per the proposal's slice C.
- **[Risk]** A cache-hit path could theoretically re-run normalization or re-log warnings if the delegation were wired incorrectly (e.g., inside a per-request path not gated by the cache check). → **Mitigation**: `getClientConfig`'s existing early return on `cached` (line 173) is untouched by this change — the delegation only replaces the call site of an already-cache-gated function with another cache-gated function of the same signature-shape (`unknown -> AnnouncementItemDto[]`). Slice C adds one integration test asserting a cache hit does not re-invoke the provider or emit additional announcement warnings.

## Migration Plan

No runtime migration — this is an internal, same-behavior code move. Deploy as a normal merge; no environment variable, feature flag, or data migration involved. Rollback is a plain revert of the commit(s): restore the private method and imports in `app-config.service.ts`, delete the new `announcements.normalizer.ts` and `text.utils.ts` files (and their spec files).

## Open Questions

None — the proposal's boundaries table and behavior list fully constrain the implementation; no ambiguity remains that needs resolution before writing tasks.

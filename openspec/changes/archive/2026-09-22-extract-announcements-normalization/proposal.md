## Why

`AppConfigService.normalizeAnnouncements` (`apps/chat-api/src/app-config/app-config.service.ts:100-158`), together with its private helpers `parseAnnouncementLink`, `isExternalHttpUrl`, `toNullableText`, and `MAX_ANNOUNCEMENTS`, mixes announcement-entry validation, link parsing, sanitization dispatch, and list truncation into the same class that owns provider/cache orchestration (`getClientConfig`, `resolveValue`, cache-key derivation). That algorithm cannot be unit-tested without constructing the full Nest service (`compositeProvider` + `cacheManager` mocks), and every characterization test for it pays the setup cost of an unrelated subsystem. The pattern was already validated for `uiFeatures.enabledUiFeatures` in #8955 (`apps/chat-api/src/app-config/enabled-ui-features.normalizer.ts`), which extracted a pure `(value, warn) => result` function taking a `warn` callback instead of a logger — exactly the shape needed here.

This is a preparatory slice of remediation-plan item 9. It extracts only the announcement-list normalization; the broader `getClientConfig` dispatch loop and any UI-feature alias hardening remain untouched and out of scope.

## What Changes

- Add `apps/chat-api/src/app-config/announcements.normalizer.ts`, exporting `normalizeAnnouncements(value: unknown, warn: (message: string) => void): AnnouncementItemDto[]`, following the `normalizeEnabledUiFeatures` callback pattern (`apps/chat-api/src/app-config/enabled-ui-features.normalizer.ts:31-68`). The existing algorithm moves without semantic changes: non-array resolution, invalid-entry rejection with per-reason warnings, link parsing (`isExternalHttpUrl`, `parseAnnouncementLink`, `AnnouncementRejection`), sanitized-description dispatch, and the `MAX_ANNOUNCEMENTS = 10` cap with its warning all move together and stay private to the new module.
- Move `toNullableText` (also used by `announcement.title`, `announcement.description`, and `welcomeScreen.description`) into one small app-config-local module shared by both the new normalizer and `AppConfigService`, without changing its behavior. `AnnouncementItemDto`/`AnnouncementLinkDto` imports in the new module stay type-only.
- `AppConfigService` deletes the moved private method and its now-unused imports, and delegates the `announcement.items` branch (`app-config.service.ts:258-259`) to `normalizeAnnouncements(resolved, (message) => this.logger.warn(message))`, preserving the existing `Logger` context exactly as `uiFeatures.enabledUiFeatures` already does at `app-config.service.ts:268-271`.
- Add missing characterization coverage to `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` before extraction (warning text/order, null-vs-invalid input, mixed valid/invalid entries beyond the cap, duplicate preservation) so the move is verified against the pre-extraction behavior.
- Add `apps/chat-api/src/app-config/tests/announcements.normalizer.spec.ts` for the extracted function directly (no Nest bootstrap), using the real `sanitizeAnnouncementHtml` — including malicious/fully-stripped descriptions, allowed anchor transforms, warning sequencing around the cap, and input/entry immutability.
- Add delta scenarios to `client-config-endpoint` making explicit two behaviors that today are enforced only by the implementation, not by the spec: that entries beyond the maximum are still validated (and their own rejection warnings logged) before the cap is applied, and that the cap warning is emitted last, after every per-entry rejection warning, using the total count of valid entries. No new capability, no schema change, no endpoint/DTO/OpenAPI change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `client-config-endpoint`: adds scenarios to the existing "client-config response includes the validated announcements list" requirement clarifying warning ordering/multiplicity when the entry count exceeds the cap (protects the extraction; does not change the `AnnouncementItemDto`/`AnnouncementLinkDto` schema or any response field).

## Impact

- **Code**: `apps/chat-api/src/app-config/app-config.service.ts` (delegation only), new `apps/chat-api/src/app-config/announcements.normalizer.ts`, a small shared text-helper module (exact location decided in design.md), plus their spec files under `apps/chat-api/src/app-config/tests/`.
- **API surface**: none — `GET /api/v1/client-config` request/response shape, `AnnouncementItemDto`/`AnnouncementLinkDto`, provider precedence, cache key/TTL, and cache-hit behavior are all unchanged. No OpenAPI/generated-client regeneration is required.
- **i18n**: none — no user-visible strings change; warnings are server logs only.
- **Docs**: `apps/chat-api/README.md`'s announcement section already documents the observable behavior (max 10 entries, drop-and-log validation); no wording becomes inaccurate, so no doc edit is expected. `npm run validate:docs` is still run because the change touches `apps/chat-api/**` public API surface indirectly (new source file, no lib/README impact expected).
- **Rollback**: purely internal; reverting is a straight file revert (delete the new normalizer/shared-helper modules, restore the private method and its imports in `AppConfigService`). Not breaking — no consumer-visible contract changes.

## Alternatives Considered

Kept the same shape as the merged `enabled-ui-features.normalizer.ts` precedent (pure function + `warn` callback) rather than introducing a generic "config-value normalizer" abstraction or a new injectable service: the codebase already has exactly one validated pattern for this, and a second differing shape (e.g., a class, a shared normalization framework) would add abstraction with no behavioral benefit and diverge from the established convention.

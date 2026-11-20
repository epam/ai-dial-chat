## Why

Operators still need a redeploy to change the announcement banner or the seasonal celebration. On dev the first real need is switching `UI_EVENT=halloween` to `new-year` without a redeploy and replacing the ENV announcements, whose `ANNOUNCEMENTS` JSON is malformed today: the second entry has no opening `{`, so `admitJsonArray` drops the whole list. Schema `1.0.0` manages only `onboarding.hints` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, `ONBOARDING_HINTS_SCHEMA`). No `1.1.0` was ever uploaded or released, so its contents can still be chosen.

## What Changes

- New managed schema **`1.1.0`** for `ai-dial-chat` (a MINOR bump that adds optional keys only). Every `1.0.0` payload stays valid under it. It adds nine managed config keys and no feature:
  - announcements: `announcement.title`, `announcement.description`, `announcement.items` (with `severity`);
  - celebrations: `ui.activeEventId`, `ui.celebrationsEnabledByDefault`;
  - the celebration delivery policy: `ui.celebrationDelivery.mode`, `.revision`, `.externalScenes`, `.externalEvents`. These four are **reclassified** from local-only `security-policy` to managed (design D2). `THEMES_CONFIG_URL`, every URL, and the BFF's pack admission stay local.
- Every string and array in the value schemas is bounded with keywords Studio's Ajv enforces (`validateFormats: false`, no `$ref` or `format`):
  - texts: title ≤ 200 characters, description ≤ 2,000;
  - announcement items: ≤ 10, link label ≤ 100, `href` matching `^https?://\S+$` and ≤ 2,048 characters, `severity` an enum of `info` and `warning`;
  - event IDs: the kebab-case pattern ENV already uses, ≤ 64 characters;
  - allowlists: ≤ 64 entries, `uniqueItems`;
  - revision: the `UI_EVENT_DELIVERY_REVISION` pattern.

  Each operator description says which HTML survives sanitizing, and names no environment variable.
- The managed values pass through the same `client-config.mapper.ts` normalization as ENV values (`sanitizeAnnouncementHtml`, `normalizeAnnouncements`, `toExternalScenes`). The one mapping change: `ui.activeEventId` `none` maps to `null` for every source, so a published `none` turns celebrations off exactly as `UI_EVENT=none` does.
- The four delivery keys are one group:
  - a registry rule requires them to be managed in the same schema version;
  - in `active` mode, listing only some of them in `MANAGED_CONFIG_ACTIVE_KEYS` fails startup and names the missing ones. Activating part of the group would merge a Studio-edited policy with ENV fragments the editor cannot see.
- `MANAGED_CONFIG_SCHEMA_VERSION` becomes `1.1.0`, `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS` becomes `['1.0.0', '1.1.0']`. The change commits the generated `ai-dial-chat-1.1.0.json`, updates `index.json`, adds the pin and the `1.1.0` contract fixtures, and bundles both artifacts in `snapshot-acceptance.ts`. A `1.0.0` snapshot keeps working after the upgrade.
- Shadow comparison now covers ten managed keys. A `1.0.0` snapshot reports the nine new keys as `absent`.
- Docs:
  - `docs/managed-config-schema.md`: the rollout table with `1.1.0` as announcements and celebrations and the eight earlier keys moved to `1.2.0`, the counts (10 managed, 29 local-only, 14 eligible), and the delivery reasoning;
  - `apps/chat-api/README.md`: the variables that become fallbacks;
  - a new editor guide, `docs/managed-content.md`, for Chat content editors.

## Non-goals

- `announcement.html` and `footer.html` stay local-only and unmanaged; they are decided together with the footer in a later wave.
- `welcomeScreen.description`, `fileManager.availableTabs`, `usageLimits.*` and `features.usageLimitsControl` belong to schema `1.2.0` (prompt 14).
- A `dial:semanticConstraints` rule that ties `ui.activeEventId` to compiled or allowlisted events (design D5).
- Any Config Studio, UI-kit (K3, K4, K10), Launchpad or deployment change. The dev upload, publication and activation are prompt 13.
- Changing ENV parsing. The managed bounds apply only to published values, as for the tour.
- Any frontend, lib, OpenAPI or i18n change. The client-config response shape is unchanged.

## Alternatives considered

1. **`1.1.0` contents.**
   - **Chosen: announcements and celebrations now, the eight earlier keys in `1.2.0`.** This matches the ordered need (New Year), keeps shadow comparison on dev limited to keys someone publishes, and `1.2.0` can then carry the `features.usageLimitsControl` semantic rules on their own.
   - Rejected: all seventeen keys in one `1.1.0`. It delays the season switch behind usage-limit review and puts eight keys nobody publishes into dev's shadow report.
   - Rejected: celebrations only, announcements later. Dev's malformed `ANNOUNCEMENTS` would stay broken for another wave.
2. **Delivery keys.**
   - **Chosen: manage all four.** A publisher can only choose among packs the operator's own themes host serves and the BFF admits (design D2).
   - Rejected: keep them local-only and manage only `ui.activeEventId` and `ui.celebrationsEnabledByDefault`. External-only events (`externalEvents`) and allowlisted scenes would still need a redeploy, which defeats the "everything related to celebrations" goal.
3. **`revision`.**
   - **Chosen: an operator value, managed like the other three.**
   - Rejected: derive it from the published `revisionId` whenever delivery keys are managed. Every unrelated publication would then restart a playing scene, the composite provider would need to report which source answered, and ENV would keep a second mechanism (design D3).
4. **`activeEventId` schema.**
   - **Chosen: a pattern.** External events cannot be enumerated.
   - Rejected: an `enum` of compiled events, which would make external-only events unpublishable.
   - Rejected: `anyOf` an enum plus the pattern, which is outside `ManagedValueSchema` and gains nothing without K4 labels (design D4).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `managed-config-contract`:
  - the `1.1.0` managed set and its value bounds;
  - the delivery keys are managed while the pack source stays local;
  - a new opt-in prerequisite: the four delivery keys are managed in the same version.
- `managed-config-schema-artifact`: the build accepts `["1.0.0", "1.1.0"]`.
- `managed-config-runtime-reader`: a `1.1.0` snapshot is supported and `1.2.0` is the unsupported example; a `1.0.0` snapshot is still accepted against its own artifact.
- `managed-config-activation`:
  - the delivery group activates as a whole;
  - `1.1.0` keys are accepted in `MANAGED_CONFIG_ACTIVE_KEYS`;
  - shadow comparison covers every managed key of the build.
- `config-registry-and-env-provider`:
  - the blank managed-text rule now applies to `announcement.title` and `announcement.description`;
  - `none` for `ui.activeEventId` maps to `null` for every source.
- `celebration-delivery-policy`: the policy may come from Config Studio, the pack source stays local, and the documented variables become fallbacks.

## Impact

- Code (`apps/chat-api` only):
  - `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`;
  - `apps/chat-api/src/app-config/managed-config/managed-config.constants.ts`;
  - `apps/chat-api/src/app-config/managed-runtime/snapshot-acceptance.ts`;
  - `apps/chat-api/src/app-config/managed-runtime/managed-runtime.settings.ts`;
  - `apps/chat-api/src/app-config/client-config.mapper.ts` (the `none` mapping);
  - `apps/chat-api/src/app-config/types/celebration-delivery.ts` (the shared ID patterns that `apps/chat-api/src/config/environment.config.ts` now imports).
- Artifacts: `apps/chat-api/managed-config-schema/ai-dial-chat-1.1.0.json` (new) and `index.json`.
- Tests under `apps/chat-api/src/app-config/tests/`, plus `apps/chat/src/context/tests/CelebrationHost.spec.tsx` (a runtime event change).
- Docs: `docs/managed-config-schema.md`, `docs/managed-content.md` (new), `docs/architecture.md` (the celebrations paragraph), `apps/chat-api/README.md`, `apps/chat-api/.env.template`.
- Compatibility:
  - not breaking: `1.0.0` stays supported and frozen;
  - effective values are unchanged without publication and activation;
  - one provider-level difference: a blank `ANNOUNCEMENT_TITLE` or `ANNOUNCEMENT_DESCRIPTION` resolves to `undefined` instead of `''`, and the client field is `null` either way.
- Rollback:
  - per deployment: remove keys from `MANAGED_CONFIG_ACTIVE_KEYS`, or set the mode to `off`;
  - per configuration: publish an earlier revision in Studio;
  - per code: revert this change. A deployment must first stop reading `1.1.0`, because a build without it rejects a `1.1.0` snapshot as `unsupported_schema` and goes `degraded`, then `stale`.
- **Handoff to prompt 13:** an explicit ENV variable always wins over a managed value. On dev, `UI_EVENT=halloween`, `ANNOUNCEMENT_TITLE` and `ANNOUNCEMENT_DESCRIPTION` therefore shadow their published values until they are removed. Only the malformed `ANNOUNCEMENTS` already resolves to `undefined`. The runbook must remove each variable when it activates the key, not a day later.
- No library, i18n, RTL, accessibility, OpenAPI or feature-flag impact. The change touches no `libs/*` source.

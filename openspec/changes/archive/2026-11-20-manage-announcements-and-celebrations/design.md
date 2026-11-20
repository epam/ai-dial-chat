## Context

See `proposal.md` for the motivation. This section separates what the code does today on `development` `567f111d0` (observed) from what this change proposes.

**Observed:**

- **Registry and generator.** `CONFIG_DEFINITIONS` declares 53 keys: 1 managed (`onboarding.hints`), 33 local-only, 19 eligible. The test `config-registry.constants.spec.ts` asserts these counts. `docs/managed-config-schema.md` still says 31 local-only, which is stale. The generator `apps/chat-api/src/managed-config-schema.ts` regenerates only `MANAGED_CONFIG_SCHEMA_VERSION`, reads older artifacts back unchanged, and refuses to rewrite a pinned version.
- **Snapshot acceptance.** `snapshot-acceptance.ts` bundles one artifact per supported version and compiles each with Studio's Ajv options. It validates a snapshot against the artifact of the snapshot's own `schemaVersion`.
- **Resolution order.** `CompositeConfigProvider` resolves explicit ENV → managed → registry default.
  - `EnvConfigProvider` answers only for an explicitly present variable.
  - `ui.activeEventId` is special-cased: `UI_EVENT=none` returns `null`, which wins as an explicit off. Unset returns `undefined`. (This change removes the special case: see D8.)
  - `ANNOUNCEMENTS` goes through `admitJsonArray`. Unset, invalid JSON or a non-array returns `undefined`, so dev's malformed value does not shadow a managed list.
  - The delivery variables go through the generic explicit-presence path. Their class defaults are not explicit.
- **Mapping.** A managed value reaches the client only through `CLIENT_CONFIG_MAPPINGS` in `client-config.mapper.ts`, the same entry an ENV value uses:
  - `announcement.title` → `toNullableText`, never markup;
  - `announcement.description` → `sanitizeAnnouncementHtml`: tags `a b strong em br span`, only `href`, `target` and `rel` on links, links that leave the page forced to `target="_blank" rel="noopener noreferrer"`;
  - `announcement.items` → `normalizeAnnouncements`: blank titles and non-http(s) links dropped, unknown severity becomes `info`, descriptions sanitized, at most 10 entries;
  - `ui.celebrationDelivery.*` → one `celebrationDelivery` object, each key writing its own part. `toExternalScenes` splits `eventId/sceneId` without re-validating, because ENV validation already did.
- **Celebration ID rules.** The patterns and limits live as private constants in `apps/chat-api/src/config/environment.config.ts`:
  - `CELEBRATION_ID`: kebab-case starting with a letter;
  - scene pairs with each part ≤ 64 characters;
  - ≤ 64 entries per list;
  - revision `^[A-Za-z0-9._-]{1,64}$`.

  `UI_EVENT` has the pattern but no length bound.
- **Frontend.** `CelebrationHost.tsx` reads `config.activeEventId` and `config.celebrationDelivery` from `useAppConfig()`. A background client-config refresh keeps the references of unchanged fields (`keepUnchanged` in `AppConfigContext.tsx`). Changing the event, the delivery mode, the revision, the catalog revision or the resolved pack changes `resetKey`, which cancels a playing scene and loads the current event. `useCelebrationPacks` refetches only when its plan (target, event, scene IDs) changes. `delivery.revision` is not part of the plan: it only restarts a scene.
- **Pack serving.** `/api/v1/celebrations` (`apps/chat-api/src/celebrations/`) reads only under `<THEMES_CONFIG_URL>/celebrations/`. It refuses redirects and checks the declared size, SHA-256 and media type of every resource. It answers 503 when `THEMES_CONFIG_URL` is unset. No import path is ever derived from an ID.

**Constraints:**

- Studio's Ajv runs with `validateFormats: false`, and the typed subset `ManagedValueSchema` has no `$ref`, `format`, `oneOf` or `anyOf`.
- Studio fails closed on an unknown `dial:semanticConstraints` code.
- The payload limit is 57,344 canonical bytes, enforced by Studio at publish and again by Chat (`payload_too_large`).

## Goals / Non-Goals

**Goals:**

- A `1.1.0` artifact whose bounds Studio enforces before Chat ever sees a value.
- The same client output for the same content from ENV or from a snapshot.
- A `1.0.0` snapshot keeps working on a `1.1.0` build.

**Non-Goals:**

- New client-config fields.
- Frontend behavior changes.
- Studio editor controls (K3, K4, K10).
- A runtime source attribution in `CompositeConfigProvider`.

## Decisions

### D1. `1.1.0` = announcements + celebrations; the earlier eight keys move to `1.2.0`

The rollout table changes from "1.1.0 = texts, lists, usage limits; Next = celebrations" to:

| Schema | Keys |
| --- | --- |
| 1.0.0 | `onboarding.hints` |
| 1.1.0 | `announcement.title`, `announcement.description`, `announcement.items`, `ui.activeEventId`, `ui.celebrationsEnabledByDefault`, `ui.celebrationDelivery.{mode,revision,externalScenes,externalEvents}` |
| 1.2.0 | `welcomeScreen.description`, `fileManager.availableTabs`, `usageLimits.warningThresholdPercent`, `usageLimits.spendingLimitsMode`, feature `features.usageLimitsControl` |
| Next | `mcpApps.theme`; `features.projectsEnabled`; `footer.html` with `announcement.html`; the default-deployment pair; `uiFeatures.enabledUiFeatures` |

The counts become 10 managed, 29 local-only (33 − 4) and 14 eligible (19 − 5), still 53 keys. Alternatives are in the proposal (one big `1.1.0`; celebrations only). `1.1.0` is a MINOR bump: it adds optional properties under `config`, and every `1.0.0` fixture validates under it (rule 3 of the artifact test).

### D2. The four delivery keys become managed; the pack source stays local

**Security argument.** `security-policy` covers CSP, iframe, embedding, HTML and external-content admission. Pack admission does not change here:

- The **source** is `THEMES_CONFIG_URL`. It stays a local-only deployment value, and no managed key carries a URL. The BFF reads only under `<THEMES_CONFIG_URL>/celebrations/` with redirects refused.
- **Admission** stays the BFF's: declared size, SHA-256 and media type per resource, byte caps, normalized index and manifests. Nothing a publisher writes reaches that code.
- **The client** composes only through the fixed `@epam/ai-dial-celebrations/packs` import. No import path comes from an ID.

So a publisher can only choose among packs the operator's own themes host already serves and the BFF admits:

- `bundled` versus `prefer-external`;
- which `eventId/sceneId` pairs may come from a pack;
- which uncompiled event IDs may come entirely from one;
- a restart token.

The managed value schema keeps every ID at the ENV pattern, so the mapper's unchecked `split('/')` stays safe.

**Residual risk.** A themes host shared by several deployments may serve a pack an operator did not intend for one of them. A publisher of that deployment can now enable it. Mitigations:

- the operator controls the host's `index.json`;
- a publisher can only select among packs that host already serves;
- `UI_EVENT_DELIVERY_MODE=bundled` set explicitly in ENV is a kill switch, because explicit ENV wins. The editor guide states this.

**Group activation.** The four keys build one object. If only some are active, the client receives a policy that merges Studio values with ENV values the editor cannot see. Two rules prevent it:

- a registry rule requires all four or none to be managed in a schema version, like the default-deployment pair;
- `managed-runtime.settings.ts` fails startup in `active` mode when `MANAGED_CONFIG_ACTIVE_KEYS` lists one to three of them, naming the missing keys.

An explicit ENV value for one of the four can still shadow its part. Shadow mode reports `env_shadowed` for it, and the runbook removes all four variables together.

**Alternative.** Keep them local-only and manage only `ui.activeEventId` and `ui.celebrationsEnabledByDefault`. Rejected (see the proposal).

### D3. `revision` stays an operator value

`ui.celebrationDelivery.revision` is managed with the ENV pattern `^[A-Za-z0-9._-]{1,64}$` and the default `"0"`. Its description reads: "Change it to restart a scene that is already playing; other policy changes restart it anyway." No derived value exists.

**Rejected: derive the restart token from the snapshot `revisionId` when delivery keys are managed.**

- Every publication would restart playing scenes, including an unrelated announcement edit.
- `CompositeConfigProvider` returns values, not their source, so the derivation needs new plumbing through `AppConfigEvalContext`.
- ENV would keep `UI_EVENT_DELIVERY_REVISION`, so two mechanisms would coexist, which the decision explicitly forbids.

A content hash of the policy is also rejected: `resetKey` already contains the mode and the resolved pack, so a hash would add nothing.

### D4. Value schemas

All strings carry `maxLength`, and all arrays carry `maxItems`:

| Key / member | Schema |
| --- | --- |
| `announcement.title` | string 1–200, `\S` (non-blank) |
| `announcement.description` | string 1–2,000, `\S` |
| `announcement.items` | array ≤ 10 of closed objects |
| item `title` | required, string 1–200, `\S` |
| item `description` | optional, string ≤ 2,000 |
| item `link` | optional closed object; `label` and `href` both required |
| `link.label` | string 1–100, `\S` |
| `link.href` | string ≤ 2,048, `^https?://\S+$` |
| item `severity` | optional, enum `info`, `warning` (from `AnnouncementSeverity`) |
| `ui.activeEventId` | string ≤ 64, `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` |
| `ui.celebrationsEnabledByDefault` | boolean, default `true` |
| `ui.celebrationDelivery.mode` | enum `bundled`, `prefer-external` (from `CelebrationDeliveryMode`), default `bundled` |
| `ui.celebrationDelivery.revision` | string ≤ 64, `^[A-Za-z0-9._-]{1,64}$`, default `"0"` |
| `ui.celebrationDelivery.externalScenes` | array ≤ 64, `uniqueItems`, items string ≤ 129 with the ENV pair pattern |
| `ui.celebrationDelivery.externalEvents` | array ≤ 64, `uniqueItems`, items string ≤ 64 with the event pattern |

- **Single source for the patterns.** The ID patterns and limits move from `environment.config.ts` into `apps/chat-api/src/app-config/types/celebration-delivery.ts`. The env class and the registry both import them, so the ENV and managed rules cannot drift.
- **Shapes match ENV.** Each value has the shape ENV already produces after admission: `externalScenes` stays a list of `"eventId/sceneId"` strings, not objects, so `toExternalScenes` needs no second input shape.
- **`href` is stricter than ENV, and still a pattern.** The normalizer parses with `new URL`. Its case-insensitive scheme and the trimming it does are not reproduced: the pattern accepts only a lowercase scheme and no whitespace, which is stricter. A value that passes the pattern but fails `new URL` (for example `https://[`) is dropped by the normalizer with a warning, exactly as from ENV. A semantic rule would need a Studio change first (D5), so none is added.
- **What an editor sees without kit K3, K4 and K10:**
  - `activeEventId` is a single-line text field. Its description lists the compiled IDs (`halloween`, `new-year`) and says that an external event must also be listed under external events. A pattern error names the field. An `enum` would hide external events. An `anyOf` of an enum plus the pattern is outside `ManagedValueSchema`, and without K4 it would render only raw values anyway.
  - `mode` and `severity` are selects with raw values (`prefer-external`, `warning`). Their descriptions explain each value.
  - The descriptions are single-line inputs. Editors type HTML into them, and the description states the surviving subset (D7).
  - Allowlists are reorderable array editors, one string per row.

### D5. No semantic rule for `activeEventId`

Rejected: a `dial:semanticConstraints` code that requires `activeEventId` to be compiled or listed in `externalEvents`.

- Studio fails closed on an unknown code, so the rule needs a Studio release first.
- Chat would need the same rule in `managed-semantics.ts`, where it would reject the whole snapshot.
- The frontend already ignores an unknown or unadmitted ID and shows nothing. No security property depends on the rule.

The editor guide and the key description carry the rule instead.

### D6. Payload size

The canonical size of each key at its maximum, ASCII text:

| Value at its maximum | Canonical bytes |
| --- | --- |
| announcement items | 44,314 |
| banner title and description | 2,255 |
| scene allowlist | 8,449 |
| event allowlist | 4,289 |
| tour (from 1.0.0) | 36,601 |
| everything except the tour | 59,687 |
| every key at its maximum | 96,308 |
| limit | 57,344 |

Each key alone fits; all of them together cannot. The 57,344-byte limit is a total: Studio enforces it at publish and Chat enforces it again (`payload_too_large`).

Tightening bounds until everything fits would cut the item description well below the 2,000 characters Launchpad uses, and the tour already takes 36 KB. The contract therefore asserts two things:

- each key at its maximum validates and fits on its own;
- a representative publication fits: the dev tour, three announcements, a banner and a full delivery policy.

The editor guide tells editors that the whole publication is limited and that Studio reports the overrun at publish.

### D7. Operator descriptions state the HTML subset

Descriptions name no environment variable, and an existing test checks every `EnvironmentVariables` name. Their wording:

- **`announcement.title`:** "Plain text in bold at the start of the banner; markup is shown as typed."
- **`announcement.description` and item descriptions:** "HTML: bold (`<b>`, `<strong>`), italic (`<em>`), line break (`<br>`), `<span>` and links (`<a href>`). Everything else is removed, and a link keeps only its address, target and rel; links to other pages open in a new tab."
- **`severity`:** "`warning` highlights the entry; `info` is the default."

### D8. `none` maps to `null` for every source

The `ui.activeEventId` mapping in `client-config.mapper.ts` maps `none` to `null`. A published `none` then means "off" exactly like `UI_EVENT=none`, and the client field never carries the sentinel. Omitting the key also gives `null` when no ENV value is set, because the registry default is `null`. The guide still recommends `none`: it records "off" in the revision history instead of leaving the key absent. An explicit `UI_EVENT` still wins over either.

`EnvConfigProvider` returns an explicit `UI_EVENT=none` unchanged, so it still wins over a published event as an explicit kill switch; the mapping is the one place that turns `none` into `null`.

### D9. Tests prove the parity rather than restate it

- **Sanitizer and normalizer parity.** The same raw content goes into ENV, and into a fresh `1.1.0` snapshot with the key active. The tests assert identical `announcementDescription`, `announcements` and `celebrationDelivery` fields (in `app-config.service.spec.ts`, next to the existing managed tests).
- **Export is not activation.** The existing strip-`management` test runs with the announcement and celebration ENV variables set, a blank `ANNOUNCEMENT_TITLE` included.
- **Frontend.** `CelebrationHost.spec.tsx` rerenders with `activeEventId` changed from `halloween` to `new-year` and asserts that the provider receives the new event and a new reset key. No frontend source changes.

## Risks / Trade-offs

- **[Risk] Explicit ENV shadows a published value.** On dev, `UI_EVENT=halloween`, `ANNOUNCEMENT_TITLE` and `ANNOUNCEMENT_DESCRIPTION` win until they are removed. → Shadow mode reports `env_shadowed`; the docs and prompt 13 remove each variable when its key is activated.
- **[Risk] A publication of maximal values exceeds 57,344 bytes.** → Studio rejects it at publish, and Chat rejects it again and keeps the last snapshot. The guide documents the total limit (D6).
- **[Risk] Delivery keys managed against a shared themes host** (D2). → The operator owns the host index, and explicit `UI_EVENT_DELIVERY_MODE=bundled` is a kill switch.
- **[Risk] Partial delivery activation.** → Startup fails in `active` mode (D2).
- **[Trade-off] No enum labels (K4) or multiline control (K3).** Editors see raw values and single-line HTML fields. → The descriptions explain each value; the schema can gain K-annotations in a later PATCH or MINOR version after the kit ships them.
- **[Risk] Reverting the code while a `1.1.0` revision is published.** → The rollback order (Migration Plan) moves the deployment off `1.1.0` first.

## Migration Plan

1. Merge. The `1.1.0` artifact is committed. A deployment's behavior is unchanged until it is activated: `1.0.0` snapshots still validate, and the new keys are inactive.
2. Prompt 13 (dev, outside this change):
   - upload `ai-dial-chat-1.1.0.json` from the image's commit and compare the returned `sha256` with `index.json`;
   - publish the ENV content, with `ANNOUNCEMENTS` fixed;
   - remove each ENV variable whose key is activated;
   - add the keys to `MANAGED_CONFIG_ACTIVE_KEYS`, the four delivery keys together or none.
3. Rollback:
   - per key: remove it from `MANAGED_CONFIG_ACTIVE_KEYS` (the four delivery keys only together), and restore the ENV variable if one is needed;
   - per deployment: `MANAGED_CONFIG_MODE=off`;
   - per configuration: publish an earlier revision from Studio History.
4. Code revert: first publish a `1.0.0` revision, or set the mode to `off`, so that no pod reads a `1.1.0` snapshot it no longer supports. Only then deploy the revert.

## Why

Issue [#9219](https://github.com/epam/ai-dial-chat/issues/9219) (stage S0) is the base for moving celebration artwork and authored animation into versioned theme packs. Today every scene is compiled into `@epam/ai-dial-celebrations`. Each layer that later stages touch (themes host, BFF, app adapter, library, overlay SDK) has no agreed input/output contract. There is also no reproducible measurement of current behavior to compare against. Without both, S1–S8 (#9220–#9227) would each invent their own wire shapes, and "no regression" would have nothing to be checked against.

**Problem.** Four concrete gaps, all observed in source at the inspected revision:

- **No asset contract.** `CelebrationEvent` (`libs/celebrations/src/models/celebration.ts:32-53`) requires compiled React `Decoration`/`Component` fields. Event registration is a compiled map (`apps/chat/src/context/CelebrationHost.tsx:23-27`). No data shape exists that a themes host could publish.
- **Theme field naming disagrees between layers.** `ThemeService.getThemes` returns the upstream JSON unchanged with a type cast (`apps/chat-api/src/themes/theme.service.ts:116-122`). The upstream uses kebab-case fields (`chat-logo-light`, `app-logo`). The Swagger DTO declares the same kebab-case names (`apps/chat-api/src/openapi/openapi-response.dto.ts:599-620`), but the generated client renames them to camelCase (`libs/chat-api-client/src/generated/src/models/index.ts:6907,6938`). The app reads raw kebab-case through legacy `get()` (`apps/chat/src/context/ThemeContext.tsx:76`).
- **Theme identity is treated as the color scheme.** The logo is chosen by `resolvedId === 'dark'` (`ThemeContext.tsx:48-51`). `system` works only when the themes are named exactly `light`/`dark` (`ThemeContext.tsx:106-111`). The overlay can only set a persistent theme string (`apps/chat/src/context/overlay/OverlayContext.tsx:869-871`, which calls `setTheme`, `ThemeContext.tsx:160-167`).
- **No baseline.** There is no browser trace, frame timing, payload or cleanup measurement for any scene. The figures in the local research notes come from an earlier feature tree.

**Why now.** S1 (#9220) is about to extract the shared Lottie lifecycle from GiftWrapping. That extraction needs a fixed player profile and a recorded behavior to keep. PenguinStar merged into `development` after the planning reference was taken (`1cfb11468`, #9217), so the plan's numbers are already stale and must be re-measured.

## What Changes

This change produces planning and evidence only. **It changes no runtime behavior.**

- **Three separate contracts, each with a named owner:**
  1. Published catalog/pack JSON. The themes repository authors and publishes it; this repository's specs are the schema authority.
  2. Normalized camelCase BFF DTOs, owned by `apps/chat-api/src/themes`.
  3. Transport-independent library descriptors and an asset-loader callback, owned by `libs/celebrations`.

  Each contract gets concrete example payloads and explicit field mappings, including how legacy kebab-case fields are normalized.
- **One pinned first authoring profile**, capability ID `lottie-light-svg-v1`. It is pinned to the `lottie-web` version found in `package-lock.json` (5.13.0) and its `build/player/lottie_light` SVG player. That is the only player already in the product (`libs/celebrations/src/new-year/utils/gift-wrapping-player.ts:9-13`). The profile also covers:
  - schema evolution and capability negotiation
  - stable IDs and immutable, SHA-256-hashed assets
  - payload and structure caps
  - coordinate systems and placement: `viewport-stage-v1` and `composer-anchor-v1` only, plus one reserved interaction extension point for the S4 Cat pilot
  - playback duration versus load, readiness and total-lifetime deadlines
  - posters; mobile/desktop, direction and color-scheme variants
  - labels and locale fallback
- **App-owned celebration source selection:**
  - eligibility gates and source/pack precedence
  - a primitive cancellation identity
  - lazy-loading and reduced-motion rules
  - compatibility with existing event IDs, scene IDs and click/secret pools
  - construction of external-only events without a compiled event module
  - three separate fallback cases: known bundled events, external-only events, and failure after playback has started (no bundled replay in the same activation)
- **Minimal appearance seams for #9224/#9225 only:**
  - theme identity separated from color scheme
  - catalog `defaultThemeId`, `systemThemeIds`, branding and pack references
  - a new transient overlay `appearance` field where omitted = unchanged, `null` = clear, and an object = atomic replacement
  - the legacy `theme: string` behavior stays exactly as it is
- **Renderer strategy decision.** The design compares retaining CSS/bundled scenes, a shared Lottie JSON runtime, and adopting dotLottie later. It records which concerns can move into assets and which must stay compiled, and makes no promise of code or performance savings before measurement.
- **Reproducible baseline:**
  - source inventory at both the planning reference and the implementation checkout, using one committed counting rule
  - a per-scene inventory
  - raw/gzip/Brotli asset payloads
  - deterministic browser scenario definitions for New Year sleigh, GiftWrapping and Halloween Cat
  - results of the existing regression suites

  Browser capture needs new automation, so its harness is added as a dev-only test target. The measurements themselves are published on #9219 instead of being committed, because they describe one revision.

## Capabilities

### New Capabilities

- `celebration-pack-contracts`: Covers the three-layer contract (published catalog/pack JSON, normalized BFF DTOs, library descriptors and loader callback) with owners, examples, field mappings, legacy normalization, schema versioning, stable IDs, immutable hashed assets and payload caps.
- `celebration-lottie-authoring-profile`: Covers the pinned player/JSON profile and what a motion author must satisfy: allowed Lottie features, coordinate systems, placement templates, timing and deadlines, posters, variants, labels and locale fallback, and the reserved interaction extension point.
- `celebration-source-selection`: Covers the app-owned eligibility and precedence rules, cancellation identity, lazy loading, reduced motion, legacy ID/pool compatibility, external-only event construction, and fallback and rollback per event class.
- `appearance-override-contract`: Covers the seam between theme identity and color scheme, the catalog defaults/branding/pack-reference fields, and the transient overlay `appearance` override semantics. The legacy theme string is preserved.
- `celebration-migration-baseline`: Covers the revision-pinned inventory, counting rules, deterministic browser scenarios, evidence locations, and the regression suites that define what behavior must be preserved.

### Modified Capabilities

None. Existing requirements in `celebration-events`, `celebrations-library`, `theme-selection`, `themes-module` and `chat-overlay-protocol` stay unchanged in S0. Later stages that implement these contracts will add their own deltas to those specs.

## Solution

1. Specify each contract once, at its owning layer, and cross-reference it from the others instead of restating it. All external knowledge is mapped at the app edge. `libs/celebrations` receives resolved descriptors, resolved labels, semantic anchors and a `loadAsset(assetId, signal)` callback. It never sees a URL, a client or a locale. This extends the existing pattern in which `CelebrationHost.tsx:30-38,69-82` already passes anchors and translated labels into the library.
2. Pin the profile to what is already installed, rather than choosing a new player.
3. Leave the existing compiled registry as the default source. External content can only replace a scene by stable ID inside an event the app already allows. An external-only event can appear only through an app-policy allowlist.
4. Measure before migrating. Every inventory number comes with its command and revision. Every browser scenario comes with its controls and capture points. Anything not yet captured stays explicitly pending.

### Alternatives considered

| Option | Correctness | Delivery risk | Security/perf | Migration/rollback | Verdict |
| --- | --- | --- | --- | --- | --- |
| A. Keep all scenes compiled (conservative baseline) | Proven today | None | No new attack surface; no new payload | Nothing to roll back | Kept as the **default source** and fallback; rejected as the end state because any artwork change still needs a Chat rebuild |
| B. Shared Lottie JSON runtime on the existing `lottie_light` SVG player, with external packs | Data-only; interaction stays in compiled adapters | Moderate; the GiftWrapping lifecycle can be reused | Same player already lazy-loaded; validated JSON only | Per-scene allowlist, bundled default | **Picked** |
| C. Adopt dotLottie (`@lottiefiles/dotlottie-web`) now | Adds slots/themes inside the container | High: a different WASM/canvas stack, CSP review, decompression limits | Second player in the bundle | Two players to roll back | **Deferred** until a measured need appears; the profile's renderer capability ID reserves the space |
| D. A universal scene DSL in manifests | Would need to encode DOM borrowing, geometry and cleanup | Very high | Manifest becomes executable in effect | Hard to version | **Rejected**; excluded by #9219 |

The design doc has the full comparison, including which artwork and choreography can move and which must stay compiled.

## Non-goals

- Any runtime behavior change, new endpoint, new DTO, OpenAPI regeneration, published asset, or GitHub issue edit.
- Implementing S1–S8. Extraction (#9220), BFF delivery (#9221), scene migration (#9222, #9223, #9226), custom-theme resolution (#9224), embedding overrides (#9225) and rollout (#9227) stay in their own tickets.
- End-user ZIP uploads, arbitrary remote URLs, custom scripts, CSS or fonts, a second animation player, and a universal scene DSL.
- Promising LOC, payload or FPS reductions before S2–S4 measure them.

## Acceptance criteria

Each criterion maps to #9219.

1. **AC1, first asset is authorable.** A motion author can produce a valid v1 manifest, animation and poster using only `celebration-lottie-authoring-profile` and `celebration-pack-contracts`, with no access to the local research notes. The profile names the exact `lottie-web` version and player file.
2. **AC2, baseline is reproducible.** Inventory numbers are produced by a published command at a named revision. The 20-scene planning reference (`62b34e244`) and the 21-scene implementation checkout (`1cfb11468`) are reported separately. The 24,785-line figure appears only with its revision. Browser evidence exists for every defined scenario, or its task is still open.
3. **AC3, every layer has a named owner.** Each contract names its owner and consumer. No contract places HTTP paths, generated clients, auth, app configuration, persistence, routing or locale resolution in a hand-authored library.
4. **AC4, rollback distinguishes three cases.** Known bundled events, external-only events and post-start failures each have their own rollback rule.
5. **AC5, excluded scope is excluded.** ZIP uploads, arbitrary URLs, custom scripts/CSS/fonts, a second player and a universal DSL appear only as exclusions.
6. **The artifacts validate.** `openspec validate define-celebration-pack-contracts-and-baseline --strict` passes.

## Rollback / backward compatibility

Nothing is breaking. S0 adds planning artifacts and contract examples under this change directory, plus a dev-only browser baseline harness (tasks 3.x). Measurements are published on #9219, not committed. That harness is a test target, not shipped code. To revert, delete the change directory and the harness files. No runtime path imports any of them.

Compatibility rules defined here bind the follow-up stages:

- `/api/themes` and `/api/themes/icon` stay as they are.
- `theme: string` keeps its persistent `setTheme` behavior.
- Event IDs, scene IDs and click/secret pools stay stable.
- Bundled delivery stays the default.

## Impact

- **Code:** None in S0. Files that later stages will touch are referenced by path:
  - `libs/celebrations/src/models/celebration.ts`
  - `libs/celebrations/src/context/CelebrationContext.tsx`
  - `apps/chat/src/context/CelebrationHost.tsx`
  - `apps/chat/src/context/ThemeContext.tsx`
  - `apps/chat-api/src/themes/`
  - `libs/chat-overlay/src/protocol/overlay-protocol.ts`
  - `apps/chat/src/context/overlay/OverlayContext.tsx`
- **Shared libs / global providers (scope flag):** The contracts define future additive surface in `libs/celebrations` (descriptors, loader callback, capability IDs) and `libs/chat-overlay` (`appearance`). They also define future state in the global `ThemeProvider`. S0 implements none of it. Each follow-up must re-check library isolation (AGENTS.md §Library isolation).
- **Library isolation:** All host/external knowledge (BFF paths, generated client, `THEMES_CONFIG_URL`, locale, routes, policy, storage) stays in `apps/chat-api` and `apps/chat`. The library gets resolved values and narrow callbacks.
- **i18n:** No new user-visible strings in S0. The contract requires pack labels to be resolved by the host, and requires existing `newYear.*`/`halloween.*` keys to keep priority for bundled events.
- **External repository:** `epam/ai-dial-chat-themes` was inspected read-only at `22cdaddbcb00c3b69c2dc021cb3bc594ace79f8d` and is not modified.
- **Dependencies:** None added. `lottie-web` is declared as `^5.13.0` in `libs/celebrations/package.json:34` and resolved to 5.13.0 in `package-lock.json:19162-19166`. The profile pins that exact resolved version (see design D2).

## Open questions (for the reviewer)

1. Which revision should be the frozen baseline: `1cfb11468` (current `development`, 21 scenes, PenguinStar merged) or the issue's `62b34e244` (20 scenes)? This plan records both and treats `1cfb11468` as the implementation baseline. PenguinStar is tracked as a measured delta and is outside the pilot set.
2. Durable storage for binary browser evidence (traces, videos, frames). This plan publishes the measurements and the digest of the binaries' hash list on #9219, and keeps the binaries in Git-ignored `tmp/celebrations-baseline/`. A CI artifact or issue attachment needs a maintainer decision.
3. Should `lottie-web` be pinned to an exact version in `libs/celebrations/package.json` (an S1 decision)? Alternatively, the profile check can verify the installed version at runtime/build. This change does not edit the manifest.

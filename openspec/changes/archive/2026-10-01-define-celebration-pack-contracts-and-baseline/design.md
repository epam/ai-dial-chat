## Context

**Inspected revisions:**

- `ai-dial-chat` at `1cfb11468688de5c13c7c4e6de4e0e8771b3776e` (2026-10-01, equal to `origin/development`). Preparation started on branch `fix/catalog-details-limits-calendar-periods`, whose HEAD was this same commit. The checkout was later switched to `development` outside this workflow; HEAD stayed the same.
- Planning reference: `62b34e244`, which is an ancestor of `1cfb11468`. The difference between them is PenguinStar (#9217) and three unrelated commits.
- `epam/ai-dial-chat-themes` at `22cdaddbcb00c3b69c2dc021cb3bc594ace79f8d` (`development`, 2026-09-23).

**Uncommitted differences:** At the start of preparation, the working tree had staged changes in `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/hooks/useCatalogItems/`, `apps/chat/src/i18n/locales/en.json`, `libs/chat-hooks/**` and `openspec/**` (catalog-details limits). None of them is under `libs/celebrations`, `apps/chat/src/context`, `apps/chat-api/src/themes` or `libs/chat-overlay`. They do not affect this baseline, and this change does not touch them. After the branch switch, the only untracked path is this change directory.

**What exists today.** Everything here is source-verified.

- **Runtime.**
  - `CelebrationProvider` (`libs/celebrations/src/context/CelebrationContext.tsx`) loads one compiled event per `activeEventId` and plays one scene at a time in a fixed, `aria-hidden`, pointer-transparent portal.
  - It unmounts the scene at `durationMs` and cancels on any `resetKey` change, comparing by identity.
  - It reloads only on `[activeEventId, hasLoader, resetKey]` (`:89-112`).
  - Selection (`resolveCelebrationPools`, `utils/celebration.ts:51-77`) filters the click, secret and decor pools.
- **Events.** Two compiled modules, registered in `apps/chat/src/context/CelebrationHost.tsx:24-27`:
  - Halloween: 16 scenes; 11 click and 5 secret; 4 decor behaviors.
  - New Year: 5 scenes; all click; `confetti` is also the secret scene.
  - `CelebrationHost` passes event, route key, `t()` labels, toast, `isMobile` and anchors. It passes no `selection` and no `trainSoundtrackUrl`.
- **Lottie.** Two scenes use `lottie-web/build/player/lottie_light` (SVG renderer):
  - `gift-wrapping` and `penguin-star` lazy-load it through `new-year/utils/gift-wrapping-player.ts`.
  - Both build their Lottie JSON in TypeScript: `gift-wrapping-composition.ts` (751 lines) and `penguin-star-composition.ts` (446 lines) plus `penguin-star-art.ts` (793 lines).
  - `gift-wrapping-elves.json` is a contour rig, not a Lottie file.
  - `lottie-web` is declared as `^5.13.0` and resolves to 5.13.0.
- **Themes.**
  - `GET /api/themes` passes the upstream `config.json` through unchanged with a cast (`apps/chat-api/src/themes/theme.service.ts:116-122`). It uses a 5-minute HTTP cache and a 5-minute in-memory cache. The in-memory cache is a shared LRU with 100 entries (`apps/chat-api/src/app/cache.config.ts:4-5`).
  - `GET /api/themes/icon` uses a file-name allowlist and a sandboxed SVG CSP.
  - The Swagger DTO names fields in kebab-case, but the generated client types them in camelCase. The app avoids this by using raw `get()` (`ThemeContext.tsx:76`).
- **Theme state.**
  - `ThemeProvider` holds selected and current IDs and persists `setTheme` to local storage.
  - Logo, `system` and editor/code-block themes infer the scheme from the ID, and they disagree with each other (see `appearance-override-contract`).
- **Overlay.** `SET_OVERLAY_OPTIONS` `theme` is applied only when truthy, through the persistent `setTheme`. `null`/absent mean unset. A malformed payload gets no response. Extra keys are not rejected.
- **Themes repository.**
  - nginx serves `static/` with `expires 1w`, a JSON autoindex, `Access-Control-Allow-Origin: *`, and gzip for JSON and SVG.
  - It holds 41 static files.
  - `config.json` (15,463 bytes) has only `themes` (`dark`: 142 tokens, `light`: 141, each also carrying `topicColors` and `authColors`) and `images` (including `admin-*` keys). No theme carries `app-logo`.
  - There are no celebration resources.

**Constraints:**

- AGENTS.md §Library isolation.
- `.claude/rules/libs.md` (public exports, string enums, `styles.css` contract).
- `apps/chat-api/AGENTS.md` (URI versioning, Swagger DTOs, `ConfigService`, typed exceptions).
- `.claude/rules/docs.md`: docs describe what exists, so S0 adds no `docs/` page for unimplemented contracts.

**Stakeholders:** the runtime/frontend lead (S1–S4), the backend lead (S2), the themes maintainer and motion author (S2–S4), and the overlay SDK maintainer (S6).

## Goals / Non-Goals

**Goals:**

1. Fix contracts C1, C2 and C3 with owners, examples and mappings, so S2 can be built from both sides in parallel without inventing shapes.
2. Pin one authorable profile that a motion author can target today.
3. Fix the app-owned selection, cancellation and fallback rules before any external scene exists.
4. Define only the appearance seams that the celebration migration needs.
5. Produce a reproducible baseline, and mark explicitly what is still pending.

**Non-Goals:**

- runtime extraction (S1)
- BFF endpoints and publication (S2)
- scene migration (S3, S4, S7)
- theme resolution (S5)
- overlay transport (S6)
- rollout (S8)
- ZIP uploads, arbitrary URLs, custom scripts/CSS/fonts, a second player, or a scene DSL

## Decisions

### D1 — Three contracts, mapped once at each boundary

```text
 C1 published JSON              C2 BFF DTOs                    C3 library descriptors
 (themes repo, kebab legacy  →  (apps/chat-api/src/themes,  →  (libs/celebrations types,
  + camelCase additions)         camelCase, validated,          IDs + numbers + resolved
                                 no paths/URLs)                 labels + loader callbacks)
        │                              │                               ▲
        └── THEMES_CONFIG_URL ─────────┘   generated client            │
                                           → apps/chat/src/server-api  │
                                           → app celebration resolver ─┘
                                             (policy, locale, theme
                                              variant, asset loaders)
```

| Concern | C1 owner | C2 owner | C3 owner | Never in |
| --- | --- | --- | --- | --- |
| File paths, upstream host | themes repo | resolved and hidden by BFF | — | C2, C3 |
| HTTP routes, generated client, Raw responses | — | BFF/OpenAPI | `apps/chat/src/server-api` wrapper | `libs/*` (except `libs/chat-api-client`) |
| Validation, size caps, hash | publication pipeline (pre-check) | BFF (enforced) | runtime structural check (DOM cap) | — |
| Capability support | manifest declares | passes through | library exports the set; app intersects | BFF |
| Locale, labels | manifest provides | passes through | app resolves; library receives strings | `libs/*` |
| Policy and eligibility | — | client-config DTO (S2) | app adapter | manifests, themes |

Worked mapping for one field chain, the sleigh desktop animation:

| Stage | Value |
| --- | --- |
| C1 manifest asset | `{ "assetId": "new-year-default-sleigh-desktop-9c1e4b7a2f3d6e80", "file": "sleigh.desktop.9c1e4b7a2f3d6e80.json", "mediaType": "application/json", "bytes": 148213, "sha256": "9c1e…" }` |
| BFF resolution | `<THEMES_CONFIG_URL>/celebrations/new-year-default/1.0.0/sleigh.desktop.9c1e4b7a2f3d6e80.json`, built server-side with a containment check |
| C2 | `{ "assetId": "new-year-default-sleigh-desktop-9c1e4b7a2f3d6e80", "mediaType": "application/json", "bytes": 148213, "sha256": "9c1e…" }` (no `file`) |
| App wrapper | `themesApi.getThemeAssetRaw({ assetId })` → body bytes → `JSON.parse` |
| C3 | `variants[0].animationAssetId = "new-year-default-sleigh-desktop-9c1e4b7a2f3d6e80"`; `loaders.loadAnimationData(assetId, signal)` resolves the parsed object |

*Alternatives considered:*

- A single shared DTO that is published as-is. Rejected: it would leak upstream paths and couple the lib to the transport.
- Letting the library fetch by URL. Rejected: it violates library isolation.

### D2 — Pin the profile to the resolved player, not the semver range

`lottie-light-svg-v1` = `lottie-web@5.13.0` + `build/player/lottie_light` + SVG, with the exact `loadAnimation` options GiftWrapping uses today.

Inspection of the installed build shows that `lottie_light` registers only the `svg` renderer, registers no effects, and installs expressions only through an explicit `installPlugin`. The profile is still stricter than the player. It excludes text, image, audio and camera layers, solids, expressions, effects and fonts, because:

- text would need fonts and locale handling
- images would add external fetches
- the light player silently ignores expressions and effects, so authored output would differ from the player's rendering

Range drift (`^5.13.0`) is a real risk. S1 must either pin the dependency exactly or add a build-time check that fails when the resolved version is not 5.13.0. A future player gets a new capability ID; it never redefines this one.

*Alternatives considered:*

- The full `lottie.min.js` (305,704 bytes raw vs 168,394 for light). Rejected: no feature in scope needs it.
- dotLottie now. Deferred; see D10.

### D3 — Negotiation happens in the client

The BFF validates structure but cannot know the client's runtime version, so it never filters by capability. The library exports `CelebrationCapability`, and the app intersects it with a manifest's `requiredCapabilities`. Unsupported means "not this scene": for a known event the bundled scene is used, and for an external-only event the poster or a no-op. Schema-version changes are breaking; additive optional fields are not.

### D4 — Two placement templates and one reserved namespace

`viewport-stage-v1` covers decorative flyovers such as the sleigh. `composer-anchor-v1` covers GiftWrapping's contact with the composer. Today that composition is built from the measured composer width (`gift-wrapping-composition.ts`, consumed at `NewYearGiftWrapping.tsx:91-96`), so a stretched viewport export would lose contact on phones.

`interaction-*` IDs are reserved for S4. Everything else (multi-target geometry, live DOM copies) stays in compiled adapters. A scene DSL is rejected.

### D5 — Playback clock versus deadlines

The model is copied from GiftWrapping, which already implements it:

- load timeout: 2000 ms
- readiness timeout: 250 ms
- playback: starts at `DOMLoaded`
- provider lifetime: `maxLifetimeMs` bounds everything

A pack scene's `maxLifetimeMs` becomes the composed scene's `durationMs`. Example: the external sleigh needs 2000 + 250 + 10100 ≤ 12500, which is longer than the bundled 12000 ms. That is acceptable, because the composed event carries the descriptor's lifetime.

### D6 — Selection precedence and cancellation identity are app-owned

The ordering (gates → source mode/allowlist → pack precedence) is in `celebration-source-selection`.

`resetKey` becomes one primitive string, joined with `|`. Example:

```text
<locationKey>|new-year|prefer-external|policy:3|cat:2026-10-01.1|new-year-default@1.0.0|acme-night:dark|rtl|mobile|sel:0
```

A primitive string is required because the provider compares `resetKey` by identity. A new loader function does not reload, so a new composition must change the key.

Locale stays out of the key, because labels already re-translate through the `labels` prop.

*Alternative considered:* a new `CelebrationSourceContext`. Rejected until S2 shows a second consumer; a hook inside `CelebrationHost` is enough.

### D7 — External-only events use a descriptor factory, not an import path

`createCelebrationEventFromDescriptor(descriptor, loaders)` (S2, `libs/celebrations`) returns a normal `CelebrationEvent` built from a generic `static-trigger-v1` decoration and generic Lottie scene components. The app registers `{ [eventId]: () => Promise.resolve(event) }` only for IDs that policy admits.

The existing `CelebrationEvent`/`CelebrationEventLoader` API stays unchanged. In v1, external-only events have no secret phrases and no decor behaviors. A secret phrase changes message submission, so it needs explicit host permission in a later change.

### D8 — Fallbacks separated by when they fail

The rule "never replay bundled after playback starts" exists to prevent three problems:

- a duplicate notification (the provider notifies on activation, `CelebrationContext.tsx:152-158`)
- double DOM side effects (copied or faded controls)
- a total time beyond the provider deadline

Failure before any side effect may use the bundled scene for known events; otherwise the scene shows its poster. External-only events have no compiled fallback, so rollback means removing the policy admission.

### D9 — Appearance seams only

- `colorScheme` is separated from the theme ID.
- `defaultThemeId`/`systemThemeIds` default to today's behavior.
- Branding and pack references go through registries.
- The overlay gets `appearance` with omitted/null/object semantics.

Two existing protocol rules conflict with this design, and S6 must resolve them:

- `null` currently means unset for every existing field.
- A malformed payload currently gets no response, whereas this design asks for a structured rejection.

State lives in `ThemeProvider`, which is above both `CelebrationHost` and the overlay provider (`apps/chat/src/main.tsx:54-105`; `OverlayModeGate` → `OverlayProvider` is nested at `:71`). No new provider is needed.

### D10 — Renderer strategy

| Criterion | A. Keep CSS/bundled scenes | B. Shared Lottie JSON runtime (`lottie_light`) | C. dotLottie (`@lottiefiles/dotlottie-web`) later |
| --- | --- | --- | --- |
| Artwork change without a Chat release | No | Yes, for supported capabilities | Yes |
| Player cost | None beyond today | Already shipped lazily: `lottie_light.min.js` is 168,394 B raw / 46,584 gzip-9 / 40,345 Brotli-11 | A second, WASM-based player; CSP impact (likely `wasm-unsafe-eval`, unverified), memory and visual-parity work |
| Theming of the artwork | Native CSS variables | Prebuilt variants per color scheme | Slots/themes in the container (animation palette, not app CSS) |
| Security surface | None | Validated JSON subset; posters only through `<img>` | ZIP container: decompression bombs and file-count limits |
| Rollback | n/a | Per-scene allowlist | Two players to keep compatible |
| Fit | Particles (snow, confetti) and simple CSS flyovers | Authored character motion | Only if slots or packaging prove necessary |

**Pick B as the delivery mechanism and A as the default and fallback. C is deferred.** Keeping a scene in CSS is a valid S7 outcome. Each pilot has a different split between what can move into assets and what must stay compiled:

| Pilot | Can move into pack assets | Must stay compiled (host-independent, in `libs/celebrations`) |
| --- | --- | --- |
| `sleigh` (CSS keyframes, inline SVG, deterministic paths from `utils/flying-characters.ts`, no anchors) | Sleigh/reindeer artwork, flight paths, timing | Generic Lottie scene, viewport stage, lifetime and cleanup |
| `gift-wrapping` (Lottie built in TypeScript from the measured composer) | Elf artwork and poses, authored timeline in local stage coordinates | Composer measurement, `composer-anchor-v1` mapping, target-change observers (`gift-wrapping-animation.ts:62-139`), interrupt listeners, static fallback |
| `cat` (WAAPI plus copies of up to 2 controls, CSS crossing fallback, 25 s story) | Cat artwork, poses, transferable motion segments | Target discovery (`halloween-cat-targets.ts`), snapshot copies and restoration (`utils/celebration-snapshots.ts`), one-clock synchronization, interrupt handling. S4 adds the reserved `interaction-*` adapter |

The research does not support any claim about LOC, payload or FPS reductions. Savings are measured in S2–S4 as scene code deleted minus runtime and adapter code added, with assets and authoring tools counted separately.

### D11 — Baseline harness: static Storybook plus Playwright

The real app needs auth, the BFF and DIAL Core, which makes it non-deterministic. `StoryHostPage` provides every anchor with stable markup, and the stories `Sleigh`, `GiftWrapping` (with Mobile, Rtl and ReducedMotion variants) and `Cat` already exist. The runner follows the existing `node --test` plus Playwright pattern (`apps/chat/browser-tests/*.browser.spec.mjs`, Nx targets `test-*-browser` in `@epam/chat`), and is added as `@epam/ai-dial-celebrations:test-baseline-browser`. Chromium for Playwright 1.60.0 (`chromium-1223`) is installed locally, so the capture environment exists. The runner was added and run during apply (tasks 3.x). Its results are published in the #9219 baseline comment, part 2.

**Caveat.** `StoryHostPage` is a stand-in for the composer, not `ConversationInput`. Contact geometry under the real app is captured in S3/S4, not here.

*Alternative considered:* recording in the real app. Deferred, because the host fixture would have to be rebuilt for each run.

### D12 — Evidence storage

Measurements describe one revision on one day. Once a scene changes, a committed copy would read as current and be wrong, so they are **published as comments on #9219, not committed**.

The repository keeps only what repeats or checks the baseline at any revision:

- the counting rules in `specs/celebration-migration-baseline`
- the harness and its summarizer in `libs/celebrations/browser-tests/`
- the contract examples and their checker in this change's `examples/`

The counting script is published inside the comment. Binaries stay in Git-ignored `tmp/celebrations-baseline/<rev>/` with an `artefacts.sha256` list, and the comment carries the count and the digest of that list. Durable hosting of the binaries is still an open question.

*Alternative considered:* committing the measurements under the change's `evidence/` directory. Rejected: they would go stale in the repository and stay forever in the OpenSpec archive.

## Baseline

### Observed while preparing this change

**Source inventory.** These are the counting rules from `celebration-migration-baseline`, produced by a revision-reading script, identical to the one tasks 2.1 commits:

| Revision | Halloween (files / lines / non-empty) | New Year | Shared | Total |
| --- | --- | --- | --- | --- |
| `62b34e244` (20 scenes) | 92 / 19,592 / 18,959 | 17 / 2,063 / 2,005 | 15 / 1,124 / 1,062 | **124 / 22,779 / 22,026** |
| `1cfb11468` (21 scenes) | 92 / 19,592 / 18,959 | 26 / 4,069 / 3,975 | 15 / 1,124 / 1,062 | **133 / 24,785 / 23,996** |

The 24,785 figure for `1cfb11468` was measured on current `development`. It is equal to the earlier feature-tree count only because PenguinStar was merged unchanged. It is not the 20-scene reference.

**Payload** (`zlib` gzip level 9, Brotli quality 11, file-level only, not chunk size):

| File | Raw B | gzip B | Brotli B |
| --- | ---: | ---: | ---: |
| `new-year/assets/gift-wrapping-elves.json` (contour rig) | 157,360 | 6,660 | 3,953 |
| `new-year/assets/new-year-logo.svg` | 1,101 | 501 | 440 |
| `halloween/assets/halloween-logo.svg` | 1,207 | 577 | 520 |
| `lottie-web/build/player/lottie_light.min.js` (reference) | 168,394 | 46,584 | 40,345 |
| `lottie-web/build/player/lottie.min.js` (reference) | 305,704 | 76,318 | 63,744 |

**Regression suites** (`npm run test:file`):

| Suite | Result |
| --- | --- |
| Library: CelebrationRuntime, CelebrationSelection, NewYearGiftWrapping, gift-wrapping, NewYear, HalloweenCatScene, halloween-cat-targets, halloween-cat-animation, HalloweenEvent.integration | 9 files / **251 passed** |
| App: CelebrationHost and CelebrationHost.integration | 2 files / **19 passed** |

**Scene inventory summary.** Source inspection at `1cfb11468`. Line counts are each scene's own production files. Shared files are excluded. Task 2.2 commits the full table with `path:line` citations.

| Scene | Pool | `durationMs` | Renderer | Host interaction | Fallback | Own lines |
| --- | --- | ---: | --- | --- | --- | ---: |
| halloween/spiders | secret | 14000 | WAAPI, SVG silk, copies | copies ≤ 3 composer/heading/history targets | CSS abseil drop | 509 |
| halloween/ghost | click | 14000 | WAAPI, copies | copies ≤ 5 homes; animates the live pumpkin svg in place | CSS flock | 1,231 |
| halloween/web | click | 14000 | Canvas 2D, 30 fps | measures only | static frame | 887 |
| halloween/bats | click | 18000 | WAAPI, copies | copies ≤ 5 surfaces | CSS night flight | 1,466 |
| **halloween/cat** (S4 pilot) | click | 25500 | WAAPI, copies | composer required (≥ 300 px); copies ≤ 2 buttons | CSS crossing cat | 1,826 |
| halloween/witches | click | 20500 | WAAPI, copies | copies 2 (1 mobile) | static witches | 1,534 |
| halloween/train | click | 12000 | WAAPI, CSS, optional audio | fades the live pumpkin; no `CelebrationAnchors` | static train; silent | 859 |
| halloween/portal | click | 10000 | CSS and WAAPI clones | copies 2 history rows | static rift | 466 |
| halloween/ravens | click | 13000 | WAAPI, cropped copies | composer, pumpkin, history | static birds | 1,694 |
| halloween/candy | click | 35500 | WAAPI | measures only | static row | 1,487 |
| halloween/footprints | click | 12000 | WAAPI, 1 copy | composer ledge, starter card | static paws | 1,093 |
| halloween/skeletons | click | 12000 | WAAPI, CSS Highlight API | hides heading glyph paint | static skeletons | 1,784 |
| halloween/cauldron | secret | 9000 | CSS, copies | history rows | static stage | 226 (shares `HalloweenSecrets.module.scss`) |
| halloween/mimic | secret | 9000 | CSS, WAAPI, copies | history rows | static chest | 537 |
| halloween/bowling | secret | 9000 | WAAPI, copies | history rows, text ranges | static ball | 441 |
| halloween/mummy | secret | 13000 | WAAPI, composer copy | composer with enabled textarea | static mummy | 731 |
| new-year/penguin-star (merged after the reference) | click | 22500 | Lottie (generated in TS) | **moves a live starter/model-selector control** through WAAPI | still image | 1,960 |
| **new-year/gift-wrapping** (S3 pilot) | click | 18500 | Lottie (generated in TS) | measures the composer | still elves | 1,439 |
| new-year/snow | click | 12000 | CSS particles | none | parked | 68 (shared with confetti) |
| new-year/confetti | click + secret | 9000 | CSS particles | none | parked | (shared) |
| **new-year/sleigh** (S2 pilot) | click | 12000 | CSS keyframes, inline SVG | none | parked at rest | 91 (+ shared `FlyingCharacters`) |

Randomness: `pickCelebrationScene` (`utils/celebration.ts:33`), the Halloween plans and targets listed in task 2.2, and New Year `particles.ts`. `cat`, `gift-wrapping` and `sleigh` have no `Math.random` call of their own, but activation through the click pool uses `pickCelebrationScene`.

### Captured during apply

At proposal time the following were pending: browser scenarios, frame timings, DOM counts, transferred bytes, post-cleanup resources, Vite chunk sizes and 20-cycle retention checks. All of them were measured during apply:

- chunk sizes: [#9219 baseline comment, part 1](https://github.com/epam/ai-dial-chat/issues/9219#issuecomment-5933161567) (task 5.4)
- 46 browser cells and 20+20 cycles per pilot scene: [#9219 baseline comment, part 2](https://github.com/epam/ai-dial-chat/issues/9219#issuecomment-5933167447), which also lists the method and caveats and the digest of the 365-file `artefacts.sha256`

Both comments were published and their saved text verified on 2026-10-01. Part 2 explicitly records the preparation-cancellation coverage gap and rerun provenance limitations found during review. Publishing the measurements completes task 5.4; it does not close the remaining validation or review work.

Findings that matter for later stages:

- The sleigh does not react to user input, so it has no interrupt path to preserve.
- GiftWrapping already loads its player lazily, keeps the player out under reduced motion, and keeps a cancelled load dead.
- Cat preparation finishes in about 11 ms, before any external input can arrive.
- None of the three scenes retained copies or detached `svg` nodes across 20+20 cycles.
- Headless Chromium on the capture host paced frames at about 120 Hz.

The capture host was not idle, and the Storybook stand-in is not the real composer, so real-app contact geometry stays with S3 and S4.

## Risks / Trade-offs

- [Contracts are fixed before any implementation, so S2 may find a gap] → Each later stage MODIFIES these specs through its own delta. Caps are labelled as initial pilot values.
- [`^5.13.0` lets the player drift] → S1 pins it exactly or adds a resolved-version check (task 4.2 records the decision).
- [The Storybook host differs from the real composer] → S0 measures lifecycle and cost only. S3/S4 capture real-app contact.
- [The shared 100-entry BFF LRU could be evicted by large assets] → The contract requires a separate byte-bounded store (S2).
- [`appearance: null` conflicts with the existing null-means-unset rule] → It is a new field with its own documented semantics, and the conflict is flagged for S6.
- [Main specs will contain contract requirements before code exists] → Each requirement is tagged **[Contract]** or **[Invariant]**. Archive S0 only after its evidence tasks are complete, and expect S2–S6 deltas to MODIFY these requirements.
- [Binary evidence stored in `tmp/` is not durable] → Publish the digest of `artefacts.sha256` in the #9219 comment. The durable location is an open question.
- [Measurements live outside the repository] → The harness, the rules and the published script let any later stage repeat them at its own revision. The #9219 comments are linked from this section.

## Migration Plan

S0 ships no runtime change. Apply order:

1. Measure the source, payload and regression baseline, and draft it (tasks 1.x and 2.x).
2. Add the browser baseline harness and capture the evidence (tasks 3.x).
3. Commit the contract examples and record the decisions handed to S1 and S2 (tasks 4.x).
4. Validate, then publish the baseline comments on #9219 after review (tasks 5.x).

Rollback means deleting this change directory and the harness files; no runtime imports them.

Follow-up boundaries:

| Stage | Consumes from S0 |
| --- | --- |
| S1 #9220 | D2 profile, D5 timing, the baseline GiftWrapping evidence |
| S2 #9221 | C1/C2/C3, D3, D6, D7, D8, the sleigh evidence |
| S3 #9222 | `composer-anchor-v1`, the GiftWrapping evidence |
| S4 #9223 | the `interaction-*` reservation, the Cat evidence |
| S5 #9224 | `appearance-override-contract` (colorScheme, defaults, branding, packs) |
| S6 #9225 | `appearance-override-contract` (overlay field, capability advertisement) |
| S7 #9226 | the scene inventory, the renderer decision rule (D10) |
| S8 #9227 | the rollback matrix (D8), evidence format |

## Open Questions

1. Should the frozen baseline be `1cfb11468` (21 scenes) or `62b34e244` (20 scenes)? This proposal uses `1cfb11468` and reports both.
2. Where should binary browser evidence be stored durably?
3. Exact pin of `lottie-web` versus a resolved-version check (S1).
4. Where should the delivery policy live: the central app-config registry (`apps/chat-api/src/app-config/config-registry/`) or a deployment-only env var? Either way it is app config, decided in S2.
5. Should the themes repository commit a machine-readable JSON Schema generated from these specs (S2), and which repository owns its canonical copy?

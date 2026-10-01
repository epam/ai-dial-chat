## Why

Issue [#9220](https://github.com/epam/ai-dial-chat/issues/9220) (stage S1, priority Low) extracts the lazy Lottie playback lifecycle from GiftWrapping into reusable internals of `libs/celebrations`. The extraction must not change behavior, and it comes before S2 (#9221) delivers external assets. Two scenes currently copy one lifecycle by hand:

- `NewYearGiftWrapping.tsx:43-140` with `gift-wrapping-animation.ts:9-147`
- `NewYearPenguinStar.tsx:43-140` with `penguin-star-animation.ts:10-180`

Each copy has its own load deadline, readiness deadline, playback deadline, cancellation flags and teardown. A pack scene in S2–S4 would be a third copy. Two decisions handed over by S0 (#9219) also have no owner yet:

- The `lottie-web` manifest range `^5.13.0` can drift away from the `lottie-light-svg-v1` profile.
- The S0 browser harness merges reruns into one directory per revision, so it cannot take a clean comparison capture.

**Why now.** S0 is merged upstream (`d59f60d83`, #9242). It fixed the player profile and the timing model (`celebration-lottie-authoring-profile`) and published the baseline that S1 must preserve ([part 1](https://github.com/epam/ai-dial-chat/issues/9219#issuecomment-5933161567), [part 2](https://github.com/epam/ai-dial-chat/issues/9219#issuecomment-5933167447)). S2 needs one tested lifecycle before it adds remote data.

**Revision record.** Planning ran on branch `docs/celebrations-s0-contracts-baseline` at `605b21273`, and the tracked tree was clean. `libs/celebrations/src` is byte-identical at the runtime baseline `1cfb11468`, at `605b21273`, and at `origin/development` `11b0219ca` (`git diff --stat` prints nothing). Inside `libs/celebrations`, `605b21273` differs from `1cfb11468` only in the S0 harness (`browser-tests/**`, the `test-baseline-browser` Nx target, and the `eslint.config.mjs` ignore entry). PenguinStar is already part of the baseline (#9217) and calls the same `loadGiftWrappingPlayer` (`NewYearPenguinStar.tsx:84`). Implementation should branch from `origin/development`.

## What Changes

**New internal modules.** Nothing is exported from the package.

- `libs/celebrations/src/utils/lottie-player.ts`
  - holds the one dynamic `import('lottie-web/build/player/lottie_light')`, with no module-level state
  - owns the `lottie-light-svg-v1` `loadAnimation` options and `setSubframe(true)`
  - replaces `new-year/utils/gift-wrapping-player.ts`
- `libs/celebrations/src/utils/lottie-scene-session.ts`, a small imperative session
  - owns player import, readiness, the load, readiness and playback deadlines, cancellation, and exactly-once teardown and destruction
  - reports three distinct outcomes, `Completed`, `Cancelled` and `Failed`, as string enums
- `libs/celebrations/src/hooks/useLottieSceneSession.ts`, a thin React adapter
  - creates one session per effect setup and disposes it on cleanup, so StrictMode setup/cleanup/setup never imports twice
  - maps outcomes to scene state, so a cancelled scene can never come back as the static fallback

**GiftWrapping becomes a scene adapter.** It keeps its interrupt events, the parcel/composer target choice, observers, the 0.5 px tolerance, generated-SVG mutation filtering, composition, static art and every timing value. Its observers are registered with the session as disposers.

**PenguinStar** changes only its import of the shared loader and the profile options helper. Its lifecycle is left as it is: readiness shortcut, frame-driven borrowing, 20000/22500 ms. Migrating it belongs to S7 (#9226).

**Composition ownership.** Every animation-data source declares one of two ownership modes:

- *transferred* data is built fresh for each session and handed to the player once
- *shared* data is cloned for every playback

GiftWrapping uses *transferred*, so it is not cloned at all. *Shared* is the path S2 cached data will take.

**Player pin.** `libs/celebrations/package.json` pins `"lottie-web": "5.13.0"` exactly, which resolves the S0 open decision. A unit test fails if the installed `lottie-web` or the manifest drifts from the profile version. `package-lock.json` changes only in its workspace entry.

**Harness correction (prerequisite).** The S0 browser harness gets a capture identity:

- it writes a working tree with uncommitted changes to its own fingerprinted directory
- it refuses to write into a finalized capture
- it records environment and source provenance for each scene

The published `1cfb11468` baseline is never rewritten.

Nothing here is **BREAKING**. `CelebrationEvent`, the entry points, exports, README and styles are unchanged.

## Capabilities

### New Capabilities
- `celebration-lottie-playback-session`: the shared lazy Lottie playback lifecycle inside `libs/celebrations`. It covers:
  - ownership of each timer, listener, observer and cleanup step
  - the boundary between session and provider
  - the readiness rule
  - outcomes and cancellation at every phase
  - StrictMode behavior
  - exactly-once teardown that tolerates a failing `destroy`
  - composition ownership and cloning
  - lazy loading
  - what stays in scene adapters

### Modified Capabilities
- `celebration-lottie-authoring-profile`:
  - "One pinned player profile": the manifest pin and the enforcing check replace the "S1 or S2" placeholder, and the source citations move to `utils/lottie-player.ts`.
  - "Timing and deadlines": the GiftWrapping invariant is restated against the extracted session, with the same four values.
- `celebration-migration-baseline`: a new requirement covers comparison captures by later stages: a separate capture identity, per-scene provenance, and no overwriting or merging into the published baseline.

## Non-goals

These stay out of scope and belong to #9221–#9227:

- External packs, manifest or BFF validators, endpoints and generated clients.
- Theme resolution, overrides of the embedding appearance, and remote asset fetching or caching.
- dotLottie, another renderer, and any player upgrade.
- Migrating any other scene, including PenguinStar's lifecycle (S7) and Cat (S4).
- A general animation framework, new public exports, or changes to `CelebrationProvider` and its notifications.
- Closing the Cat pre-readiness cancellation gap that S0 published (S4).

## Alternatives considered

| Option | Correctness | Delivery risk | Rollback | Verdict |
|---|---|---|---|---|
| A. Conservative: share only the loader and options | Leaves two hand-copied lifecycles; S2 would add a third | Lowest | Trivial | Rejected: misses #9220's "session owns readiness, lifetime, cancellation" |
| B. Hook-only `useLottieSceneSession` | Timers spread across effects; needs React to test teardown ordering | Medium | Easy | Rejected: StrictMode and late-callback rules are hard to state and test |
| **C. Imperative session plus thin hook** | One state machine, testable with fake timers alone; the hook only maps outcomes | Medium | Revert one PR | **Chosen** |
| D. Migrate PenguinStar too | Must reconcile its different readiness rule (`penguin-star-animation.ts:70,175`) | Higher | Harder | Deferred to S7; not an S1 prerequisite |

For the pin, the options were an exact pin or keeping `^5.13.0` with a resolved-version check. The pin is the only option that also fixes what a host resolves once the library is published. The unit test catches workspace hoisting and lockfile drift. Either way, an intentional 5.13.x patch becomes an explicit profile decision.

## Acceptance criteria

| #9220 criterion | Proven by |
|---|---|
| Story, duration, target preparation, public event contract and fallback stay the same | 41/41 `NewYearGiftWrapping.spec.tsx` and 31/31 `gift-wrapping.spec.ts` pass with assertions unchanged (only the mock path changes). The 18500/16000/2000/250 budget test passes. `CelebrationRuntime`/`Selection`/`NewYear`/Host suites pass. The browser comparison matches the `1cfb11468` element counts, targets and cleanup |
| Player stays in a lazy chunk; nothing downloads for an inactive event or the reduced-motion poster | Inspection of the `@epam/ai-dial-celebrations` and `@epam/chat` build output (dynamic import only). Hook tests show that disabled or reduced use makes no loader call. Browser reduced-motion cells show no `lottie_light` request |
| Every termination path releases timers, listeners, observers and the player exactly once, including when `destroy` throws | `lottie-scene-session.spec.ts`: an outcome × phase matrix, a throwing `destroy`, a throwing disposer, repeated cancellation, late callbacks, StrictMode. The `getTimerCount() === 0` and `callbacks.size === 0` checks stay in the scene suites |
| No scene geometry, host routes, API clients, storage or i18n in the generic session | An architecture-guard grep over `utils/lottie-*.ts` and `hooks/useLottieSceneSession.ts`, plus lint `@nx/dependency-checks` |

## Impact

- **Code:**
  - added: `libs/celebrations/src/utils/lottie-player.ts`, `utils/lottie-scene-session.ts`, `hooks/useLottieSceneSession.ts` and their tests
  - changed: `new-year/components/NewYearGiftWrapping/NewYearGiftWrapping.tsx`, `new-year/utils/gift-wrapping-animation.ts`, and the import lines in `NewYearPenguinStar.tsx` and `penguin-star-animation.ts`
  - unchanged: `new-year/constants/new-year.ts` keeps `GIFT_WRAPPING_MS + 2500`
  - deleted: `new-year/utils/gift-wrapping-player.ts`
  - updated mock paths in the two component specs
- **Dependencies:** `libs/celebrations/package.json`: `lottie-web` `^5.13.0` → `5.13.0`. `package-lock.json:346` is the workspace entry only. No new dependency.
- **Harness:** `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs` and `summarize-baseline.mjs`. These are dev-only and not shipped.
- **Library isolation (`libs/*` rule):** the session knows only the browser APIs it uses (timers, `document.hidden`), the injected player and adapter callbacks. Host knowledge already arrives through `CelebrationProvider` props (`anchors`, `isMobile`, `labels`, `onNotify`). No app adapter changes. `apps/chat` is not touched.
- **Scope creep flag:** this touches a shared lib, but not the global provider. `CelebrationContext.tsx` is read-only for this change.
- **i18n:** no new user-visible strings. Notifications stay with the provider (`CelebrationContext.tsx:152-158`).
- **Docs:** the README and `docs/` need no change, because the public API is unchanged. `npm run validate:docs` still runs because the manifest changes.

## Rollback and compatibility

The change is not breaking. Rollback is reverting the S1 PR, which restores `gift-wrapping-player.ts`, the scene-local lifecycle and `^5.13.0`. No published pack, host or public type depends on these internals. The harness correction is independent and can stay in place even if the extraction is reverted.

## Prerequisite gaps (recorded, not inferred)

1. S0 was archived with task 5.2 open: `verify:full` was not green because of two failures outside the change, `useSkillFileSystemPicker.spec.ts` and the order-dependent `app-config.service.spec.ts`. S0's task 5.3 is also open. S1's final `verify:full` will hit the same failures unless they are fixed separately or explicitly accepted.
2. Part 2 of the baseline documents rerun merging and non-fingerprinted source. S1 corrects this (task group 1) before it captures anything.
3. The baseline has no browser cell for cancellation during GiftWrapping's deferred preparation or renderer initialization. S1 covers those with deterministic jsdom tests only and reports them as unmeasured in the browser.
4. Cat cancellation before readiness stays unmeasured. It is S4's gap, not an S1 dependency.

## Context

The motivation is in `proposal.md`. This document records what the code does at the baseline and how the extraction keeps that behavior.

**Where the baseline stands.** `libs/celebrations/src` is identical at `1cfb11468`, `605b21273` and `origin/development` `11b0219ca`. All line citations below are valid at all three.

### What exists today

| Concern | GiftWrapping | PenguinStar |
|---|---|---|
| Player import | `gift-wrapping-player.ts:9-13`, a dynamic `import('lottie-web/build/player/lottie_light')` with no memoization | Same function (`NewYearPenguinStar.tsx:84`) |
| Deferred start | `await Promise.resolve()` then a check for disposal or cancellation (`NewYearGiftWrapping.tsx:73-74`) | Identical (`:73-74`) |
| Hidden document | Checked before the import and after it resolves (`:75-78`, `:87-90`) | Identical |
| Load deadline | 2000 ms, armed immediately before the import and cleared when it settles (`:79-85`) | Identical |
| Target measurement | After the import resolves (`:91-96`) | After the import resolves (`:91-96`) |
| Renderer creation | `gift-wrapping-animation.ts:73-90`: profile options, `setSubframe(true)`, 4 listeners | `penguin-star-animation.ts:94-112`: same options, plus `enterFrame` |
| Readiness | `DOMLoaded`, which **fails** when `!isLoaded` (`:46-51`) | `DOMLoaded`, which **ignores** `!isLoaded` (`:70`). Also an already-loaded shortcut, `if (animation.isLoaded) queueMicrotask(ready)` (`:175`) |
| Readiness deadline | 250 ms, armed after the listeners and observers (`:142`) | 250 ms (`:174`) |
| Playback deadline | `GIFT_WRAPPING_MS` = 16000, armed at readiness (`:55`) | `PENGUIN_STAR_MS` = 20000, armed at readiness (`:74`) |
| Observers | One source: a `MutationObserver` that filters out renderer-generated mutations, and a `ResizeObserver` on up to 24 ancestors, with a 0.5 px tolerance (`:62-139`) | Five sources and a wider attribute filter (`:81-173`) |
| Scene choreography | None during playback | Borrows the live control at frame 306 and restores it in `finish` (`:57-68`, `:40`) |
| Teardown | Hide the host, clear timers, disconnect observers, remove listeners, `destroy` (on a throw, `replaceChildren`), then `onStop` (`:23-43`) | Same order, with `restoreBorrowed` before `destroy` |
| Interrupts | Window capture on 11 events plus `visualViewport` resize and scroll (`NewYearGiftWrapping.tsx:56-71`) | Identical list |
| Provider lifetime | 18500 = 16000 + 2500 (`new-year/constants/new-year.ts:20`) | 22500 (`:19`) |

**Provider boundary.** `CelebrationContext.tsx` owns the following, and this change leaves all of it unchanged:

- the scene lifetime: `setTimeout(setActive(null), durationMs)` at `:114-121`
- mount and unmount
- replay: each `celebrate()` call increments `token`, and `<ErrorBoundary key={active.token}>` remounts the scene (`:148`, `:227`)
- the single notification (`:152-158`)

**Player behavior that affects the design** (`node_modules/lottie-web/build/player/lottie_light.js`, 5.13.0):

- `_useWebWorker` is `false` by default (`:9`). `dataManager.completeAnimation` therefore runs synchronously on the caller's object.
- `completeData` mutates that object in place and marks it `__complete` (`:929-941`).
- `checkLoaded` sets `isLoaded = true` before it calls `renderer.initItems()`, and it dispatches `DOMLoaded` through `setTimeout(…, 0)` (`:1687-1696`). So `isLoaded` alone does not prove the renderer initialized. The GiftWrapping test at `NewYearGiftWrapping.spec.tsx:387-400` encodes this.
- `destroy` nulls `_cbs` and the renderer (`:1954-1971`).

**Evidence to preserve.** These GiftWrapping cells come from [part 2](https://github.com/epam/ai-dial-chat/issues/9219#issuecomment-5933167447) of the baseline, recorded at `1cfb11468`:

- 316 elements with `data-gift-target=composer` at 50 %, and 320 with `parcel` when the composer is missing
- 128 static elements under reduced motion, with no player request
- a cancelled load inserts no renderer
- at end + 500 ms the layer is gone, with 0 animations and 0 detached `svg`
- 20+20 cycles leave nothing retained

The baseline does **not** contain:

- a browser cell for cancellation during deferred preparation or during renderer initialization
- any PenguinStar browser cell

## Goals / Non-Goals

**Goals:**

- One tested lifecycle that S2–S4 reuse.
- GiftWrapping behavior preserved to the level of its 72 existing tests and the browser cells above.
- A named owner for every resource.
- Resolve the S0 pin decision.
- A comparison capture that cannot overwrite the baseline.

**Non-Goals:** see `proposal.md` §Non-goals. In addition:

- No `ReadinessPolicy` switch, frame hooks or borrowing support for PenguinStar. Those wait for S7.
- No `AbortSignal` loader for animation data. That is S2's C3 contract. The session API leaves room for it (see D7).

## Decisions

### D1 — Imperative session plus a thin hook (option C)

`createLottieSceneSession` is a plain state machine that has no React dependency. It can be tested with fake timers alone. `useLottieSceneSession` creates one session for each run of its effect, translates the outcome into React state, and passes the host element to it.

*Rejected:* a hook-only design (option B), because its timers would spread across effects and its ordering could only be tested through rendering. The loader-only extraction (option A) does not meet #9220.

```ts
// libs/celebrations/src/utils/lottie-player.ts (internal; replaces new-year/utils/gift-wrapping-player.ts)
export const LOTTIE_LIGHT_SVG_V1_PLAYER_VERSION = '5.13.0';
export interface LottiePlayer {
  loadAnimation(options: AnimationConfigWithData<'svg'>): AnimationItem;
}
/** The only import of the player; holds no module state. */
export const loadLottiePlayer = async (): Promise<LottiePlayer> => { /* import('lottie-web/build/player/lottie_light') */ };
/** Applies the lottie-light-svg-v1 options, then setSubframe(true). */
export const createLottieLightSvgAnimation = (
  player: LottiePlayer, container: HTMLElement, animationData: object,
): AnimationItem => { /* … */ };

// libs/celebrations/src/utils/lottie-scene-session.ts (internal)
export enum LottieSceneSessionState {
  Idle = 'idle', Loading = 'loading', Prepared = 'prepared', Initializing = 'initializing',
  Playing = 'playing', Completed = 'completed', Cancelled = 'cancelled', Failed = 'failed',
}
export enum LottieSceneOutcome { Completed = 'completed', Cancelled = 'cancelled', Failed = 'failed' }
export enum LottieDataOwnership { Transferred = 'transferred', Shared = 'shared' }
export interface LottieSceneTimings { loadTimeoutMs: number; readyTimeoutMs: number; playbackMs: number }
export interface LottieAnimationContext<P> {
  preparation: P;
  host: HTMLElement;
  addDisposer: (dispose: () => void) => void; // run at teardown, LIFO, each isolated
  cancel: () => void;                         // ends the session as Cancelled
}
/** Static per-scene adapter: no geometry or policy reaches the session except through these. */
export interface LottieScenePlayback<P> {
  timings: LottieSceneTimings;
  ownership: LottieDataOwnership;
  getAnimationData: (preparation: P) => object;
  onAnimationCreated?: (context: LottieAnimationContext<P>) => void;
}
export interface LottieSceneSession {
  readonly state: LottieSceneSessionState;
  start(): void;                  // Idle → Loading (after one microtask)
  attach(host: HTMLElement): void; // Prepared → Initializing; no-op in any other state
  cancel(): void;                 // → Cancelled; notifies
  dispose(): void;                // → Cancelled; does NOT notify (React cleanup)
}
export const createLottieSceneSession = <P>(options: {
  playback: LottieScenePlayback<P>;
  prepare: (player: LottiePlayer) => P;      // scene measurement + composition, after the import
  onPrepared: (preparation: P) => void;
  onTerminal: (outcome: LottieSceneOutcome) => void; // at most once; never after dispose()
  loadPlayer?: () => Promise<LottiePlayer>;  // defaults to loadLottiePlayer
}): LottieSceneSession => { /* … */ };

// libs/celebrations/src/hooks/useLottieSceneSession.ts (internal)
export enum LottieScenePhase { Idle = 'idle', Loading = 'loading', Prepared = 'prepared', Ended = 'ended', Failed = 'failed' }
export const useLottieSceneSession = <P>(options: {
  enabled: boolean;                      // false: no session, no import
  playback: LottieScenePlayback<P>;      // module constant
  prepare: (player: LottiePlayer) => P;  // read through a ref; never restarts the session
}): {
  phase: LottieScenePhase;
  preparation: P | null;
  hostRef: RefObject<HTMLDivElement | null>;
  cancel: () => void;                    // stable; for the adapter's interrupt listeners
} => { /* … */ };
```

The names are a contract for this change only. Nothing is exported from `src/index.ts` or `src/new-year/index.ts`. The modules live in the shared `src/utils` and `src/hooks` folders because S2 and S4 consumers live outside `new-year/`.

### D2 — Call flow and ownership

```text
Provider celebrate() ─ token++ ─► <ErrorBoundary key=token> mounts NewYearGiftWrapping
  adapter: reads anchors/isMobile/reduced once (initial), supported = RO && MO
  hook effect [enabled, ended, failed]:
    session = create…; session.start()          ── StrictMode: cleanup → dispose(); re-setup → new session
  session.start:
    microtask → state ≠ Idle? stop │ document.hidden? → Cancelled
    → Loading: arm loadTimeout(2000) ; loadPlayer()
        settle after terminal/timeout → ignored (import cannot be aborted)
        reject → Failed │ timeout → Failed
        resolve → clear loadTimeout; hidden? → Cancelled
                → preparation = prepare(player)   (measure composer, build composition; throw → Failed)
                → Prepared; onPrepared(preparation) ─► hook setState ─► host <div ref> renders
  hook attach effect [preparation state, which carries its session] → session.attach(hostRef.current)
  session.attach:
    data = Shared ? clone(getAnimationData(p)) : getAnimationData(p)
    animation = createLottieLightSvgAnimation(...)   (throw → Failed)
    add DOMLoaded/complete/data_failed/error listeners
    onAnimationCreated(ctx) → adapter adds observers via ctx.addDisposer   (throw → Failed)
    → Initializing; arm readyTimeout(250)
    DOMLoaded: state ≠ Initializing → ignore; !isLoaded → Failed
               → Playing; clear readyTimeout; remove DOMLoaded; arm playback(16000); play() (throw → Failed)
    complete │ playback timer → Completed ;  data_failed │ error → Failed ;  ctx.cancel/cancel() → Cancelled
  finish(outcome) — once:
    state = outcome; host.style.visibility = 'hidden'; clear 3 timers;
    run disposers LIFO (each try/catch); remove listeners; destroy() (throw → host.replaceChildren());
    notify onTerminal(outcome) unless disposed
  hook onTerminal: Completed|Cancelled → Ended (render null) ; Failed → Failed (adapter renders static art)
Provider deadline 18500 → unmount → hook cleanup → session.dispose()
```

| Resource | Created by | Released by |
|---|---|---|
| Start microtask | session `start` | Needs no release; the state check makes it inert |
| Load deadline 2000 ms | session, on entering `Loading` | Session: when the import settles, and at every terminal transition |
| Readiness deadline 250 ms | session `attach` | Session: at readiness, and at terminal |
| Playback deadline 16000 ms | session, at readiness | Session, at terminal |
| Lottie listeners | session `attach` | Session: `DOMLoaded` at readiness, all of them at terminal |
| `AnimationItem` and renderer nodes | session `attach` | Session at terminal: `destroy`, with `replaceChildren` as the fallback |
| Mutation and Resize observers | adapter `onAnimationCreated` | The adapter's disposer, which the session runs at terminal |
| Window and `visualViewport` interrupt listeners | the GiftWrapping component's own effect (scene policy) | That effect's cleanup: on ended, changed or unmount. They stay installed while the static fallback shows, as today |
| React state (`phase`, `preparation`) | hook | The effect cleanup clears its session's preparation, so a disabled hook reports `idle` and a re-enabled one reports `loading` until the new session prepares |
| Scene lifetime, notification, replay | `CelebrationProvider` | Provider (unchanged) |

The interrupt list stays in the scene because it is interaction policy. Cat (S4) uses a different list (`HalloweenCatScene.tsx:58-69`).

The `document.hidden` guard moves into the session because it is a lifecycle rule. A hidden page never starts an import or a renderer.

### D3 — Time budget and the provider/session boundary

The session runs three sequential waits, and each one is cleared before the next is armed. For GiftWrapping:

`loadTimeoutMs` 2000 + `readyTimeoutMs` 250 + `playbackMs` 16000 = 18250 ≤ `durationMs` 18500

That holds the S0 budget `maxLifetimeMs ≥ load + ready + playback`. No deadline bounds the remaining 250 ms. That margin covers composition building and the React commit between the import resolving and `attach`, exactly as today.

The rules that keep the budget:

- The session never re-arms a deadline. Each one is armed once, on its state transition.
- The hook keeps `prepare` in a ref and depends only on booleans, so a parent re-render neither restarts the session nor resets a deadline.
- The provider deadline is the only outer bound. The session never extends it, and provider unmount always wins.

The timings live in `new-year/utils/gift-wrapping-animation.ts` as `GIFT_WRAPPING_TIMINGS`. A new test in `gift-wrapping.spec.ts` asserts the values 2000/250/16000 and the inequality above.

### D4 — Readiness: GiftWrapping's rule, strictly

Readiness requires both `DOMLoaded` and `animation.isLoaded === true` at that moment.

| Condition | Outcome |
|---|---|
| `DOMLoaded` arrives while `!isLoaded` | `Failed` immediately |
| `isLoaded` is set but `DOMLoaded` never arrives | `Failed` at 250 ms |
| `DOMLoaded` repeats, or arrives after terminal | Ignored |
| `play()` throws | `Failed` |
| `data_failed` or `error` in `Initializing` or `Playing` | `Failed` |
| `complete` before the deadline | `Completed` |

PenguinStar differs in two places: it ignores `!isLoaded` (`penguin-star-animation.ts:70`) and it has the already-loaded shortcut (`:175`). Because the light player dispatches `DOMLoaded` through `setTimeout` after setting `isLoaded` synchronously, the shortcut starts PenguinStar one macrotask earlier than strict readiness would.

Unifying the two rules would change one scene's observable behavior. So **PenguinStar keeps `animatePenguinStar` unchanged** and adopts only `loadLottiePlayer`, `LottiePlayer` and `createLottieLightSvgAnimation`. Its loadAnimation options and their order are identical, so the adoption is mechanical. The following stay covered by its existing tests:

- 20000 ms playback and 22500 ms lifetime
- frame-driven borrowing at frame 306
- restoring the borrowed control exactly once, in `finish`

S7 (#9226) decides whether to add a readiness policy or align PenguinStar, through its own spec delta.

### D5 — Cancellation, StrictMode, replay and recovery

| When | Trigger | Result |
|---|---|---|
| Before the start microtask | StrictMode cleanup, unmount, `enabled=false` | `dispose()` → `Cancelled`, silently. The loader is never called |
| Deferred start, document hidden | `start` microtask | `Cancelled` and notified (→ Ended). No import |
| Import pending | user input, hidden page or target observer → `cancel()`; unmount → `dispose()` | `Cancelled`. The load deadline is cleared. When the import settles later it is ignored: no `prepare`, no renderer, no `Failed` |
| Prepared, not yet attached | `cancel()` / `dispose()` | `Cancelled`. A later `attach` is a no-op |
| Renderer initializing | `cancel()`, `dispose()`, observer `ctx.cancel()` | `Cancelled`. The readiness timer and listeners are released. A late `DOMLoaded` is ignored |
| Playing | the same, plus `changed` (anchors, isMobile, reduced) through effect cleanup | `Cancelled`. Teardown runs once |
| Load or readiness failure, then input | adapter listener → hook `cancel()` | Static art → Ended (render null). This preserves today's path |

**StrictMode.** At mount `preparation` is `null`, so only the session effect double-runs. The first session is disposed before its microtask, so the import and `prepare` each run once. `NewYearGiftWrapping.spec.tsx:134-180` keeps asserting this. `attach` on a disposed session is a no-op, so an effect re-run with stale preparation state, for example from React `Activity` re-show, cannot replay data.

**Replay.** Every activation is a new component instance (new `token`), so it gets a new session, calls `loadPlayer` again (served from the module map) and builds its preparation again.

**Recovery.** The loader holds no state, and cancelling one session never touches it. After an import rejection, the next activation calls `import()` again. Whether the browser re-fetches a module that failed to load is browser-defined. The guarantee is narrower: a later session falls back to static art within its own `loadTimeoutMs` and never inherits another session's state.

### D6 — Exactly-once teardown

`finish(outcome)` is guarded by the terminal state, so every later trigger is a no-op: a deadline, `complete`, `error`, `cancel`, `dispose`, or a late callback.

Every step runs inside its own `try/catch`, in today's order: hide the host, clear timers, run disposers in LIFO order, remove listeners, call `destroy`. When `destroy` throws, `host.replaceChildren()` removes the renderer nodes. A throwing disposer does not skip the other disposers or `destroy`.

`onTerminal` runs last and exactly once for every terminal transition that `dispose()` did not cause. Errors are not logged, because the library has no logging transport.

### D7 — Composition ownership

`LottieDataOwnership.Transferred` means that `prepare` built the data for this session. The session hands it to the player once, and `attach` is one-shot, so it cannot be reused. GiftWrapping uses this mode:

- its composition is built per session (`NewYearGiftWrapping.tsx:91-96`)
- its rig is already deep-copied per build (`gift-wrapping-composition.ts:145-146`)
- its freshness test stays (`gift-wrapping.spec.ts:465-475`)

Today's latent reuse path also disappears. Changing anchors A→B→A could re-run the playback effect with an already-mutated object (`NewYearGiftWrapping.tsx:113-140`). That object is now bound to a disposed session.

`LottieDataOwnership.Shared` means the data is an immutable source the caller may keep, such as an S2 cache. The session clones it before **each** `loadAnimation`, using `JSON.parse(JSON.stringify(…))`. That matches the `cloneArt` precedent and the JSON-only C3 data, and it satisfies C3's rule that "the library SHALL clone animation data before passing it to the player".

The session never clones DOM targets or the preparation object, and it never shares an `AnimationItem` or mutable playback state. Only the player module is shared. S1 adds no cache.

Tests use a fixture player that mutates `animationData` in place, the way `completeData` does. They show two things:

- with `Shared`, the source and a second session's input stay pristine
- with `Transferred`, a second session receives a freshly built object

### D8 — Pin `lottie-web` exactly (the S0 decision)

`libs/celebrations/package.json` changes `"lottie-web": "^5.13.0"` to `"5.13.0"`. `npm install --package-lock-only --ignore-scripts` updates only the workspace entry at `package-lock.json:346`. The resolved node at `:19162-19166` is already 5.13.0.

`src/utils/tests/lottie-player.spec.ts` asserts two things:

- the installed `lottie-web/package.json` version, read through `createRequire`, equals `LOTTIE_LIGHT_SVG_V1_PLAYER_VERSION`
- the library manifest declares exactly that version

*Why a pin rather than only a check:* a resolved-version check guards only this workspace's lockfile. The manifest range is what a host resolves once the library is published, and hosts re-bundle the library (S0 part 1, "Library build chunks").

*Rules check:* an exact version has an upper bound, so `validate:docs` check 5 passes. No other library declares `lottie-web` (check 6). It stays in `dependencies` (`.claude/rules/libs.md`, one package, one role).

*Trade-off:* a 5.13.x patch no longer arrives automatically. Under S0 that is intended: a different player gets a new capability ID or an explicit re-verification.

### D9 — Harness capture identity (small prerequisite)

Today the harness writes to `tmp/celebrations-baseline/<HEAD>/`, merges results into one `results.json`, and overwrites one global `environment` record (`celebrations-baseline.browser.spec.mjs:28-32`, `:598-626`). The correction is limited to the following:

- **Capture ID.** It is `<rev9>` for a clean tree. Otherwise it is `<rev9>-wt-<sha256[0..8]>` of `git diff HEAD --binary` plus every untracked, non-ignored file. Uncommitted S1 work therefore never lands in a revision directory.
- **Refuse finalized directories.** The harness refuses to start when the target directory already holds `artefacts.sha256`, which means it is finalized. So the published `1cfb11468` directory can never be written to.
- **Provenance per scene.** Each scene entry carries its own `environment` record: capture ID, revision, dirty flag, fingerprint, the modification time of the Storybook `index.json`, browser, OS, CPU, Node, seed, `startedAt` and `finishedAt`. The top-level record is no longer overwritten.
- **Mixed provenance fails.** `summarize-baseline.mjs` prints the per-scene environments, and it exits non-zero when the scenes in one capture disagree on revision or fingerprint.
- **No manifest rewrites.** Today `summarize-baseline.mjs:141` always rewrites `artefacts.sha256`. After the correction it writes the file only when the file is absent or the new content is byte-identical. Legacy captures that have only a top-level `environment` still summarize, so the published tables stay reproducible. Verification runs against a copy, never inside `1cfb11468/`.

No matrix, metric or scene changes. Cat's historical `cancel-prepare` cell name keeps its documented meaning.

### D10 — Verification

**Unit tests (jsdom):**

- New: `utils/tests/lottie-scene-session.spec.ts`, `hooks/tests/useLottieSceneSession.spec.tsx` and `utils/tests/lottie-player.spec.ts`.
- Kept, with only the mock path changed: `NewYearGiftWrapping.spec.tsx` (41) and `NewYearPenguinStar.spec.tsx`.
- `gift-wrapping.spec.ts`: 31 existing tests plus the budget test.
- Unchanged: `penguin-star.spec.ts`, `penguin-star-selector.spec.ts` and the S0 regression list.

**Build inspection:**

- `dist/new-year.js` reaches `lottie_light-*.js` only through `import(`.
- `dist/index.js` and `dist/halloween.js` do not mention `lottie_light`.
- In the `@epam/chat` build, the chunk that contains `data-new-year-scene` references `lottie_light` only dynamically.

**Browser:** run `gift-wrapping` only, under a new capture ID. Compare it with the part 2 table cell by cell:

- element counts at 50 %
- `data-gift-target`
- presence of a player request
- renderer inserts after a cancelled load
- the end + 500 ms cleanup
- detached `svg`
- the cycle maxima

Report readiness times and frame or heap figures as observations only, with no pass/fail and no performance claims. Cancellation during deferred preparation and renderer initialization stays jsdom-only, and is labelled unmeasured in the browser.

## Risks / Trade-offs

- **The hook's two-phase render reorders commits.** → The host `<div>` still renders only after preparation. `attach` runs in the effect right after commit, as `NewYearGiftWrapping.tsx:113-140` does today, so element counts in the browser cells stay comparable.
- **A subtle ordering change in teardown or readiness.** → The existing component tests stay unchanged: release counts, `getTimerCount() === 0`, `callbacks.size === 0`, and the destroy-throws test. The new session matrix tests each phase × trigger pair.
- **The pin blocks automatic patch updates.** → This is intended (D8). Updating means a profile decision.
- **Over-generalizing for S2.** → There are no policy switches, no new exports, and nothing PenguinStar-specific. S2 extends through its own delta, such as an `AbortSignal` data loader before `prepare`.
- **Module-map caching of a failed import is browser-defined.** → This is documented, not worked around. The fallback still arrives within `loadTimeoutMs`.
- **A browser comparison on a busy host.** → Record whether the host was idle, and compare counts rather than timings. A harness failure leaves its task unchecked, with no inferred values.
- **`verify:full` was already red in S0** (two unrelated tests). → Rerun S1 and record the result. Do not mark it green without a separate fix or explicit acceptance.

## Migration Plan

The order is risk-first:

1. Harness capture identity.
2. Shared loader, pin and check, with PenguinStar's imports moved.
3. The session and its tests.
4. The hook and its tests.
5. GiftWrapping adoption.
6. Build inspection.
7. Browser comparison.
8. Validation.

Each slice keeps every existing suite green.

**Rollback:** revert the S1 PR. No public API, host or published pack depends on the new modules. The harness slice can stay or be reverted on its own.

## Open Questions

1. Should S1 publish its browser comparison on #9220, as S0 did on #9219, or only summarize it in the PR? This plan writes it to local `tmp/` and publishes nothing without an explicit request.
2. Should `verify:full`'s two failures from S0 be fixed before S1 merges, or accepted again? A separate owner has to decide.

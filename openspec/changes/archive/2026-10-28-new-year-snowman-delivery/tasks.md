Slicing strategy: **risk-first, then vertical**.

- Slices 1–3 prove the two main risks before any artwork is invested:
  - synchronizing the copied card with the Lottie character on one clock;
  - fitting the story into real responsive layouts (Ledge/Rim/Platform staging).
- Slice 3 runs end to end in Storybook with placeholder shapes.
- The scene stays out of the gift click pool until slice 6.

Conventions for every slice:

- Commands run through Nx (`npm exec nx run-many -t test,lint,typecheck -p @epam/ai-dial-celebrations`), or `npm run test:file -- <spec>` for focused runs.
- Relative imports are extensionless.
- No host integration details enter `libs/celebrations`.

## 1. Session playback-start callback (contract)

- [x] 1.1 In `libs/celebrations/src/models/lottie-scene.ts`, add the `LottiePlaybackStartContext<P>` interface (the `LottieAnimationContext<P>` fields plus `timelineZeroMs: number`) and the optional `onPlaybackStarted` on `LottieScenePlayback<P>`, with JSDoc.
- [x] 1.2 In `libs/celebrations/src/utils/lottie-scene-session.ts`, after a successful `play()`, add a one-shot `enterFrame` listener. It calls `onPlaybackStarted` once with `timelineZeroMs = document.timeline.currentTime − currentFrame / fr × 1000`, then removes itself. A throw makes the session `failed`. Teardown removes the listener, and the callback is never called after a terminal state.
- [x] 1.3 Extend `libs/celebrations/src/utils/tests/lottie-scene-session.spec.ts` with:
  - the callback is called once, with the computed time;
  - it is not called when cancelled before the first frame;
  - a throw makes the session fail and runs the disposers;
  - an adapter without the callback adds no `enterFrame` listener and behaves as before.
  Run the GiftWrapping and session suites unchanged.
- [x] 1.4 Architecture guard: the grep in the `celebration-lottie-playback-session` spec ("The generic session stays host- and scene-agnostic") prints nothing.

## 2. Staging and card eligibility (pure, risk-first)

- [x] 2.1 Create `libs/celebrations/src/new-year/utils/snowman-delivery-rig.ts`, the shared geometry in native units (D3):
  - ball radii, the neck socket and the head pivot;
  - the shoulders, the two-segment arm lengths and the mitten grip;
  - the seat and the foot pads;
  - the scale constants (0.9 desktop, 0.68 mobile);
  - forward-kinematics helpers.
- [x] 2.2 Create `libs/celebrations/src/new-year/utils/snowman-delivery-targets.ts`, returning a `SnowmanDeliveryTargets` with:
  - the measured stage, direction and mode (`Ledge | Rim | RimSled | Platform | Static`, a string enum in `libs/celebrations/src/new-year/types/new-year.ts`);
  - floor y, the travel start and end, the tree x and the slide length;
  - the borrowed card (`element`, `rect`) or `null`;
  - the watched elements (composer, starter list, card, heading).

  It reuses `getGiftWrappingTarget` for the composer stage and implements the D2 card filter, with these bounds:
  - scan: ≤4 buttons and ≤24 ancestors;
  - card size: 36×24 to 240×96 px, ≤40 nodes;
  - excluded states: hover, active and focus;
  - the row and reach rules.
- [x] 2.3 Unit tests in `libs/celebrations/src/new-year/utils/tests/snowman-delivery-targets.spec.ts`, with mocked rects, at 360/900 mobile and 1280/1920 desktop, in LTR and RTL:
  - starters below → Ledge;
  - starters above with a free rim → Rim;
  - crowded rim → Platform;
  - no starters → RimSled;
  - no free band → Static;
  - each excluded card state (disabled, focused, hover, transformed, clipped, too big, too many nodes, unreachable) is rejected;
  - the scan bounds hold;
  - the minimum and maximum travel hold.
- [x] 2.4 Architecture guard for `libs/celebrations/src/new-year/`. Grep confirms none of these:
  - `/api`, `server-api` or `chat-api-client`;
  - i18n or app contexts;
  - storage, `process.env` or feature flags;
  - route knowledge;
  - app class names other than the host-provided `CelebrationAnchors`.

## 3. Vertical slice: placeholder composition + synchronized card in Storybook

- [x] 3.1 Create `libs/celebrations/src/new-year/utils/snowman-delivery-composition.ts`:
  - `SNOWMAN_DELIVERY_MS = 25000`, 60 fps;
  - a plan with the D8 beat times;
  - world tracks for the rig null, head, present, sled, branch and particles;
  - a contact table typed by a `SnowmanContactKind` string enum (grip, release, stance, seat, push, impact, compression, head-launch, head-lodge, branch-release, head-catch, slot), modelled on `SkeletonContactKind`;
  - the card track (D7);
  - a placeholder native-vector art pass, simple shapes only.
- [x] 3.2 Create `libs/celebrations/src/new-year/utils/snowman-delivery-card.ts`. It turns the card track into ≤48 WAAPI keyframes, relative to the original rect, at scale 1 with unmirrored text, and computes the `hideAt`/`restoreAt` offsets. It starts `animateCelebrationSnapshots` with `startTime = timelineZeroMs` in an owned card layer. A helper stop before `restoreAt` maps to the session's `cancel`.
- [x] 3.3 Create `libs/celebrations/src/new-year/utils/snowman-delivery-animation.ts`, with `SNOWMAN_DELIVERY_PLAYBACK`:
  - timings 2000/250/25000 ms and ownership `Transferred`;
  - `onAnimationCreated`: prepend the card layer beneath the SVG and register `observeSceneTargets` (from `libs/celebrations/src/utils/scene-targets.ts`) over the watched elements, with the host as an owned root. Both are registered as disposers;
  - `onPlaybackStarted`: start the card companion.
- [x] 3.4 Create `libs/celebrations/src/new-year/components/NewYearSnowmanDelivery/NewYearSnowmanDelivery.tsx`, mirroring `NewYearGiftWrapping.tsx`:
  - `useLottieSceneSession`;
  - the `changed` guard for anchors, mobile and reduced motion;
  - the same window and `visualViewport` interrupt set;
  - an `inert`, `aria-hidden`, pointer-transparent host with `data-new-year-scene="snowman-delivery"` and a `data-snowman-mode` attribute.
- [x] 3.5 Add `NewYearScene.SnowmanDelivery` to `libs/celebrations/src/new-year/types/new-year.ts`, its duration in `libs/celebrations/src/new-year/constants/new-year.ts`, and the overlay mapping in `libs/celebrations/src/new-year/components/NewYear/NewYearSceneOverlay.tsx`. Do **not** add it to `NEW_YEAR_CLICK_SCENES` yet.
- [x] 3.6 Add `SnowmanDelivery`, `SnowmanDeliveryMobile` and `SnowmanDeliveryStartersAbove` stories to `libs/celebrations/src/new-year/stories/NewYearScenes.stories.tsx`.
- [x] 3.7 Risk checkpoint (browser), placeholders only. At normal speed and frame by frame in Storybook (`npm exec nx run @epam/ai-dial-celebrations:storybook`), verify:
  - the card copy stays on the mitten grips and the seat;
  - it stops at the snowbank;
  - it returns exactly to the original rect;
  - the original reappears on completion and immediately on a click or keypress.

  Record the observed skew in `openspec/changes/new-year-snowman-delivery/verification.md`. If grips visibly separate, stop and revise D6/D7 before slice 4.
- [x] 3.8 Component tests in `libs/celebrations/src/new-year/components/NewYearSnowmanDelivery/tests/NewYearSnowmanDelivery.spec.tsx`, with a mocked player and session:
  - every interrupt event cancels, restores the original and removes the copy and the card layer;
  - target mutation or resize cancels;
  - load and readiness failure fall back to the static still;
  - reduced motion never loads the player or borrows;
  - unmount releases everything;
  - five activate/cancel cycles leave no snapshots, listeners, observers or animations.

## 4. Articulated artwork and full choreography

- [x] 4.1 Create `libs/celebrations/src/new-year/utils/snowman-delivery-art.ts`, with native vectors at the final on-screen size:
  - rounded snow balls with flat blue shadows and a dark contour;
  - a prominent carrot;
  - mutually exclusive brow and mouth groups (neutral, idea, smug, indignant, sneeze);
  - a `face-back` group;
  - mittens on two-segment sticks;
  - a burgundy scarf with a separate tail;
  - stubby feet;
  - the wrapped present;
  - the small tree, a separate lower branch and the front needles;
  - the snowbank back and front lip;
  - the ground strips (rim cap, ledge, platform);
  - the drawn sled;
  - the snow puffs.

  No gradients, masks, mattes, filters, text or image layers.
- [x] 4.2 Replace the placeholder art with the D4 layer stack in the composition. Author every D8 beat with sparse, phase-appropriate Bézier keys:
  - entrance walk with planted feet;
  - gaze holds and the idea;
  - present set down;
  - reach, the resisted tug and the free tug;
  - carry at arm's length, place;
  - foot test, sit, hug the present;
  - the two pushes;
  - the accelerating slide with the cautious-to-smug change and the lagging scarf;
  - the impact and the head flight (D5 ballistic arc, landing socket, snowbank derived from the contact speed);
  - branch recoil, the indignant hold;
  - present delivery, the pat and the spread;
  - the sneeze and the branch release, the catch;
  - the backwards face swap with a pause and the correction;
  - straightening the present;
  - card retrieval, the return walk with a wobbling head, the slot;
  - the exit holding the head;
  - the final hold and fade.
- [x] 4.3 Create `libs/celebrations/src/new-year/components/NewYearSnowmanDelivery/SnowmanDeliveryStill.tsx`: a static snowman holding his head beside the delivered present and the tree, ≤60 SVG nodes, sharing the art palette. Render it for reduced motion, unsupported APIs, failure and the Static mode.
- [x] 4.4 Plan tests in `libs/celebrations/src/new-year/utils/tests/snowman-delivery.spec.ts`, for every mode, width and direction:
  - beat order and times;
  - impact order: contact → compression ≤1 frame → separation ≥3 frames;
  - head launch speed against the sled speed within ±20 %, flight 0.35–0.7 s, ≤1.25 turns, landing in the socket;
  - the head follows the branch tip while lodged, and branch flex precedes release;
  - catch ≤1.5 u;
  - neck continuity ≤0.5 u while attached;
  - planted-foot drift ≤0.5 u;
  - mitten ↔ card ≤1.5 px and ≥100 ms grip holds;
  - card identity within 0.5 px ≥200 ms before `restoreAt`;
  - no zero-scale transform;
  - the exit fully outside the viewport by 24.6 s;
  - all layers out by 25.0 s.

## 5. Budgets

- [x] 5.1 Budget tests in `libs/celebrations/src/new-year/utils/tests/snowman-delivery.spec.ts` (D10):
  - ≤16 top-level layers, shape/null layers only;
  - no `hasMask`, `tt`, `ef` or `x`;
  - no gradient items;
  - animated properties ≤56 desktop / ≤48 mobile;
  - ≤128 keys per property (revised from 96, see design D10);
  - total keyframes ≤1,300 (revised from 1,200 / 1,000);
  - serialized size ≤170 KB;
  - static art ≤48 KB minified and ≤650 vertices;
  - particles ≤10 / ≤4;
  - card keyframes ≤48;
  - the timing sum `2000 + 250 + 25000` ≤ the 27,500 ms deadline ≤ 32,000 ms.
- [x] 5.2 In the component test, measure the generated SVG with the real light player (as the existing scene tests do, where practical): ≤360 descendants and ≤150 paths on desktop, ≤320 and ≤130 on mobile. Also assert ≤2 WAAPI animations and ≤2 MutationObservers + ≤1 ResizeObserver per run.
- [x] 5.3 Build the library (`npm exec nx build @epam/ai-dial-celebrations`) and record the gzip size of the scene chunk, excluding `lottie_light`, against ≤35 KB.

## 6. Event integration and host translation

- [x] 6.1 Add `snowmanDeliveryToastMessage` to `libs/celebrations/src/new-year/models/labels.ts` (with JSDoc) and the English default `Delivered in one piece, almost. Send "{{phrase}}" in the start-page chat for a secret surprise.` to `libs/celebrations/src/new-year/constants/labels.ts`. Map it in `MESSAGES` in `libs/celebrations/src/new-year/event.tsx`.
- [x] 6.2 Set `NEW_YEAR_CLICK_SCENES = [NewYearScene.PenguinStar, NewYearScene.SnowmanDelivery]` in `libs/celebrations/src/new-year/constants/new-year.ts`. Keep the secret pool as `[GiftWrapping]`.
- [x] 6.3 Add `SnowmanDeliveryToastMessage = 'newYear.snowmanDeliveryToastMessage'` to `NewYearI18nKeys` in `apps/chat/src/constants/translation-keys.ts`, and the English string to `apps/chat/src/i18n/locales/en.json`. No other app code changes: `CelebrationHost.tsx` maps every `NewYearI18nKeys` member already.
- [x] 6.4 Tests:
  - event registration, deadlines and both click-pool members in the existing New Year event spec;
  - selection: disabling either click scene leaves the other, and the secret phrase still selects only GiftWrapping;
  - the host label mapping in `apps/chat/src/context/tests/CelebrationHost*.spec.tsx` (or its existing equivalent) includes the new key.

## 7. Storybook coverage

- [x] 7.1 Complete the stories in `libs/celebrations/src/new-year/stories/NewYearScenes.stories.tsx`:
  - `SnowmanDelivery` (desktop, starters below → Ledge);
  - `SnowmanDeliveryStartersAbove` (Rim);
  - `SnowmanDeliveryMobile`;
  - `SnowmanDeliveryRtl`;
  - `SnowmanDeliveryReducedMotion`;
  - `SnowmanDeliveryNoStarters` (decorative sled);
  - `SnowmanDeliveryUnsuitableGeometry`;
  - `SnowmanDeliveryInterruption`: a `play` function that dispatches `pointerdown` mid-ride and asserts the original card is visible and no snapshot remains.
- [x] 7.2 For the unsuitable-geometry story, add one story-only prop to `libs/celebrations/src/stories/StoryHostPage.tsx` and `libs/celebrations/src/stories/ScenePlayer.tsx`: `composerAlign: 'center' | 'bottom'` (default `center`), which pins the composer and starters to the viewport bottom. Existing stories stay unchanged.

## 8. Documentation and specs

- [x] 8.1 Update the New Year section of `libs/celebrations/README.md`:
  - the scene list and the story;
  - the random click pool (PenguinStar + SnowmanDelivery), with the secret pool unchanged;
  - the staging modes and fallbacks;
  - the `snowmanDeliveryToastMessage` label;
  - the reduced-motion still;
  - borrowing and restoration guarantees.

  Document the `onPlaybackStarted` session callback wherever the README describes the Lottie session.
- [x] 8.2 Run `npm run validate:docs`, `openspec validate new-year-snowman-delivery --strict` and `npm run validate:specs`. The last one needs Node 22+: `~/.nvm/versions/node/v24.14.0/bin/node scripts/validate-spec-references.mjs`.

## 9. Browser verification and profiling

- [x] 9.1 Normal-speed playback review in Storybook at 360×900 and 1280×900/1920×1080, LTR and RTL, light and dark surfaces, for each mode. Confirm every acceptance item and note any defects with timestamps:
  - readable silhouette and expressions at actual size;
  - intention before action;
  - contact before movement;
  - consequences after;
  - the impact order;
  - head momentum;
  - branch recoil;
  - the backwards-head pause and correction;
  - exact card restoration;
  - a complete exit.
- [x] 9.2 Frame-by-frame review of the contact frames: grip, resisted tug, placement, foot test, pushes, impact, launch, lodge, sneeze release, catch, face swap, slot.
- [x] 9.3 Chrome Performance profiles of a full run, on desktop and on mobile emulation with 4× CPU throttling. Record:
  - frame intervals and long tasks;
  - style, layout and paint time;
  - generated SVG node counts.

  Confirm there are no per-frame layout reads in the scene code.
- [x] 9.4 Resource accumulation: activate and interrupt the scene five times (input, scroll, resize, hidden tab, motion-preference change). Compare the DOM node count, the listener count (DevTools `getEventListeners` on `window`) and the WAAPI animations (`document.getAnimations()`) before and after.
- [x] 9.5 Record every result, its limits and the commands that were run in `openspec/changes/new-year-snowman-delivery/verification.md`. Keep browser observations separate from unit-test results.
- [x] 9.6 Final checks: `npm exec nx run-many -t test,lint,typecheck,build -p @epam/ai-dial-celebrations @epam/chat`.

## 10. Follow-ups (out of scope, record only)

- [x] 10.1 Open a follow-up issue to extract a shared starter-card eligibility helper used by PenguinStar and SnowmanDelivery. Do not refactor `penguin-star-targets.ts` in this change.
- [x] 10.2 If browser review shows ride-phase skew above 2 px, open a follow-up for a bounded checkpoint resync. Do not add per-frame work in this change.

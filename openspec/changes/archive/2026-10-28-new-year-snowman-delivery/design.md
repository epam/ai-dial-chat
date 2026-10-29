## Context

New Year (`libs/celebrations/src/new-year/`) has two story scenes:

- **`PenguinStar`** — gift click. Lottie composition built in TypeScript at preparation (`utils/penguin-star-composition.ts`). Its own playback loop moves the live starter button with one WAAPI transform (`utils/penguin-star-selector.ts`).
- **`GiftWrapping`** — secret phrase. Lottie through the shared session (`utils/lottie-scene-session.ts`, `hooks/useLottieSceneSession.ts`), with an adapter (`utils/gift-wrapping-animation.ts`, `GIFT_WRAPPING_PLAYBACK`) that registers its observers as session disposers.

Reusable pieces that already exist:

| Mechanism | Where | Use here |
| --- | --- | --- |
| Lazy SVG-only player and profile options | `utils/lottie-player.ts` | Unchanged |
| One-activation Lottie session (load/ready/playback deadlines, exactly-once teardown, disposers) | `utils/lottie-scene-session.ts`, `models/lottie-scene.ts` | Reused; one optional callback added (D6) |
| Inert computed-style snapshot, hides the original with WAAPI opacity, restores on cancel, accepts a shared `startTime` | `utils/celebration-snapshots.ts` (`animateCelebrationSnapshots`) | The borrowed card copy |
| Target observer that ignores the scene layer's own mutations | `utils/scene-targets.ts` (`observeSceneTargets`) | Composer, starter list, card and heading watching |
| Composer stage with the 4-candidate / 24-ancestor eligibility scan | `new-year/utils/gift-wrapping-targets.ts` (`getGiftWrappingTarget`) | Rim and platform staging |
| Starter-button eligibility (connected, visible, unfocused, enabled, neutral transform, size, inside the viewport) | `new-year/utils/penguin-star-targets.ts` (`getPenguinStarTargets`) | Model for the card filter |
| Contact evidence enum used by tests | `halloween/utils/halloween-skeleton-plan.ts` (`SkeletonContactKind`) | Model for the contact table |
| Detached-head slapstick (the skeleton loses its skull) | `halloween/utils/halloween-skeleton-plan.ts` | Precedent for a part with its own track, caught and replaced |

The host already supplies the anchors this scene needs (`apps/chat/src/context/CelebrationHost.tsx`: `composer`, `starterList`, `welcomeRegion`) and the New Year labels through `NewYearI18nKeys`.

In production the starters render below the input by default, or between the greeting and the input with `starters-below-greeting` (`NewConversationComposer.tsx`). The story host reproduces both through `startersBelowComposer`.

## Goals / Non-Goals

**Goals**

- The full story reads without sound on desktop, mobile and RTL, with real cause and effect: grips, a sled stop that makes the head fly, a branch recoil that releases the head, and an exact card restoration.
- One Lottie clock for the cast. The card copy runs on that same clock, from the same plan.
- Stage from measured geometry. Never obscure host text, never touch real controls, and restore everything on any interruption.
- Numerical budgets that tests enforce, and a recorded browser profile.

**Non-Goals**

- Changing PenguinStar or GiftWrapping.
- New anchors, triggers, sound or live control.
- A general starter-eligibility refactor across scenes. Snowman gets its own small filter; extracting a shared helper is a follow-up.

## Decisions

### D1. Staging modes, chosen once at preparation

The scene measures the anchors once, after the player import, as PenguinStar and GiftWrapping do. It picks the first mode that qualifies. Units: the scene scale is `s = 0.9` on desktop and `s = 0.68` on mobile (the penguin's scale). The snowman stands 120 u tall, reaches 128 u with his arms raised, sits 92 u tall, and his base is 56 u wide.

| Mode | When | Floor (y) | Card | Notes |
| --- | --- | --- | --- | --- |
| **Ledge** | The eligible card's row is the lowest host content in the welcome region. This is the default production layout. | `card.bottom + 128·s − 4` | Borrowed. He stretches on tiptoe and grips the card's bottom edge. | A drawn snow ledge (≤14 u thick) under the starter row. The free band `[card.bottom, floor + 14·s]` must be inside the viewport (≥16 px margin) and clear of the composer, the heading and any other measured host rect. |
| **Rim** | A safe composer stage exists (`getGiftWrappingTarget`). The cast band `[floor − 150·s, floor]` over the travel span is clear of the heading and of every starter except the borrowed one. The card is reachable from a rim stance (`card.bottom ≥ floor − 128·s`, horizontally next to the stance). | `composer.top` | Borrowed. He reaches up and forward. | A drawn snow cap along the composer's upper edge, over the travel span only. The composer itself is only measured. |
| **Rim, decorative sled** | As Rim, but no eligible or reachable card. | `composer.top` | None; a drawn sled. | Same story. Real UI is untouched. |
| **Platform** | No safe composer stage, or the rim band is crowded. A free band of `150·s + 16` exists below the lowest measured host rect, inside the viewport. | Bottom of that band | None; a drawn sled. | Self-contained snowy platform, `min(340, width − 32)` px wide on desktop and `min(250, width − 32)` on mobile. |
| **Static** | Reduced motion, missing `ResizeObserver`/`MutationObserver`, a player load or readiness failure, or no free band for Platform. | — | None | `SnowmanDeliveryStill` (D9). |

**Travel.**

- **Direction.** The tree goes at the inline end. When that side has less than the minimum travel and the inline start has enough, it goes at the inline start instead.
- **Minimum travel.** 160 px on desktop, 100 px on mobile.
- **Slide length.** At most 460 px on desktop and 220 px on mobile; the longest ride that the viewport and the host content allow is chosen, so mobile shortens the distance but keeps every beat.
- **Entrance and exit.** He enters from the viewport edge on the side opposite the tree, and leaves the same way.
- **Start stance.** Next to the card: under it in Ledge, beside it in Rim. Otherwise at the travel start.

*Alternatives:* rim-only staging (rejected by the user: in production it would never borrow the card); a hop from the side margin (desktop-only and fragile).

### D2. Card eligibility (at most one card, bounded scan)

The filter scans at most 4 buttons in the first `starterList` element inside the welcome region, and at most 24 ancestors each for clipping. A card is eligible only if it is:

- connected and visible;
- not `:disabled` or `[aria-disabled="true"]`;
- not focused and not containing focus;
- not `:hover` or `:active`, so no transient state is captured;
- not under `[hidden]`, `[inert]` or `[aria-hidden="true"]`, and not `[data-celebration-snapshot]`;
- at rest: computed `transform` is `none`;
- not clipped by a scrolling ancestor;
- inside the viewport;
- at most **240 × 96 px**, and at least 36 × 24 px;
- at most **40 nodes** (`1 + querySelectorAll('*').length`);
- in the row the mode needs: the bottom row of the starter list for Ledge, the row next to the composer for Rim;
- reachable from the mode's stance.

Among eligible cards, the scene picks the one nearest the travel start. If none qualifies, it falls back to a decorative sled.

*Why a new filter and not `getPenguinStarTargets`:* the penguin's filter differs in size (≤240×72), carries the model-selector fallback, and has no node, row or reach rules. Reusing it would couple two scenes' eligibility. A shared helper is a follow-up.

### D3. The rig is shared by art, plan and tests

`snowman-delivery-rig.ts` holds the geometry in native units:

- the three ball radii;
- the neck socket on the body;
- the head pivot and the carrot base;
- the shoulder points;
- upper and lower stick lengths, with the elbow working range kept between 20° and 120°, as in GiftWrapping;
- the mitten grip point;
- the seat point;
- the foot pads.

Art, composition and the card keyframes all compute contact positions from this rig through forward kinematics. Nothing duplicates a magic number. Tests read the same rig to measure contact errors. This follows `new-year/utils/gift-wrapping-rig.ts`.

### D4. Lottie composition structure (one player, native vectors)

`buildSnowmanDeliveryComposition(targets, isMobile)` returns a single composition:

- authored at 60 fps, with subframe interpolation (profile setting);
- stage = viewport;
- `ddd: 0`, no assets.

It contains only shape layers and null layers: no text, image, mask, matte, effect or expression. Layers, top to bottom:

1. `particles`: ≤10 small snow puff groups on desktop, ≤4 on mobile, each with position and opacity keys only.
2. `snowbank-front`: the snowbank's front lip, which covers the card's leading edge after impact.
3. `branch-front`: a few static needles, so the lodged head reads as "inside" the tree.
4. `arm-front`: a two-segment stick and mitten, parented to `rig`.
5. `present`: an unparented world track; it follows the mitten grips while carried.
6. `head`: unparented world track (D5).
7. `scarf`: parented to `rig`; the tail group's rotation lags the body.
8. `body`: parented to `rig`, holding the two balls and two foot groups. Mild squash of about 8 % comes through `rig` scale.
9. `arm-back`: parented to `rig`.
10. `branch`: the lower branch, pivoting at the trunk, with rotation keys.
11. `tree`: static trunk, crown and a few baubles.
12. `snowbank-back`.
13. `sled`: decorative modes only.
14. `ground`: the snow cap, ledge or platform strip, faded in and out.
15. `rig`: a null layer with position, rotation and scale.

At most 16 top-level layers. Shadows are flat, restrained blue shapes, with no gradients. The palette works on light and dark surfaces: white snow with a mid-blue `#7d9cc7` shadow and a dark contour, a saturated orange carrot, and a burgundy `#8e2436` scarf. The contour keeps him readable against white backgrounds.

**Expressions** are mutually exclusive brow and mouth groups on `head`, switched with hold keys on opacity: neutral, idea, smug, indignant and sneeze. Confusion is shown by the body: the mittens spread with the palms up.

**Walking** uses foot planting. A planted foot keeps its world x (drift ≤0.5 u) while the body ball bobs and leans. No rigid whole-body slide is allowed outside the sled ride.

**Easing** uses sparse Bézier keys chosen per phase:

- slow anticipation, then a sharp push;
- a linear-ish slide that accelerates through a speed curve;
- a hard stop at contact.

Ease-in-out is not applied between dense samples.

### D5. The detached head without re-parenting

Lottie cannot re-parent a layer mid-animation, so `head` is unparented throughout. Its world track is computed in TypeScript:

- **Attached** (0 → contact + 50 ms, and again after the replacement): head position = neck socket of the rig transform at each key time. Keys are placed at the body's key times, so the neck error stays ≤0.5 u.
- **Flight** (≈12.07 → 12.6 s): a ballistic arc from the neck socket to the branch socket. The horizontal launch speed equals the sled's speed at contact, within ±20 %. The flight time is clamped to 0.35–0.7 s. The plan places the snowbank so that the arc lands in the lower branches: `snowbank.x = branchSocket.x − dir · (vContact · T + neckOffset)`. The head spins at most 1.25 turns during flight.
- **Lodged:** the head follows the branch tip transform, so it dips and recoils with the branch.
- **Release and catch:** a short drop from the branch tip into the mitten grip pair. At the catch, the head's bottom equals the mitten grip within 1.5 u.
- **Backwards:** shown by a face swap (`face-front` ↔ `face-back` opacity holds) made while the mittens hold the head at the top of a small lift. No facing flip through zero scale, as GiftWrapping's spec requires. The carrot then points behind him and the scarf knot is visible in front. The correction repeats the lift and swaps back.

### D6. One clock for Lottie and the card copy (narrow session extension)

**Extension.** `LottieScenePlayback<P>` gains an optional:

```ts
onPlaybackStarted?: (context: LottiePlaybackStartContext<P>) => void;
/** LottieAnimationContext plus timelineZeroMs. */
```

**When the session calls it.** Exactly once, on the first `enterFrame` after `play()` succeeds. It passes `timelineZeroMs = document.timeline.currentTime − currentFrame / fr × 1000`, which is the document-timeline time that corresponds to Lottie frame 0. The session then removes its one-shot `enterFrame` listener.

**Failure semantics.**

- If the callback throws, the session ends as `failed`, the same as an `onAnimationCreated` throw.
- It is never called after a terminal state.
- It does no layout reads and holds no host knowledge, so the architecture guard stays empty.

**The card companion** (`snowman-delivery-card.ts`) runs from `onPlaybackStarted`. It calls `animateCelebrationSnapshots` with these inputs:

- `targets`: `[card]`;
- host: one owned `cardLayer` element. The adapter prepends it to the Lottie host in `onAnimationCreated`, so it sits beneath the renderer's SVG, and registers its removal as a disposer;
- `durationMs`: `SNOWMAN_DELIVERY_MS`;
- `hideAt`: the grip contact time ÷ duration;
- `restoreAt`: the slot-release time ÷ duration;
- `frames`: ≤48 keyframes generated from the plan's card track (D7);
- `startTime`: `timelineZeroMs`.

The helper's stop function is registered as a session disposer. If the helper stops before `restoreAt` (an interruption it detected itself), the companion calls `context.cancel()`.

**Expected skew** is bounded by one rAF interval, not accumulated: both clocks advance from rAF timestamps. The plan holds every grip still for ≥100 ms around each contact change, so a one-frame skew never shows a gap at a grip transition.

*Alternatives:*

- Start the WAAPI animation in `onAnimationCreated`. Skew is up to the readiness time, at most 250 ms. Rejected.
- Expose the `AnimationItem` to adapters. That widens the session boundary. Rejected.
- Per-frame resync. This breaks the no-per-frame-work rule. Rejected.

### D7. Card track and occlusion rules

The card's centre and rotation come from the plan:

- **Handling:** the midpoint of the two mitten grips, offset by the card's grip-to-centre vector.
- **Ride:** the seat point minus half the card height.
- **Impact:** stops at the snowbank contact x.
- **Return:** grips again, then the original rect.

The keyframes are `translate()`/`rotate()` in viewport pixels relative to the original rect. Scale stays 1, so the text keeps its size. Text is never mirrored in RTL: only the travel and staging flip.

**Occlusion.** The card layer sits under the whole SVG, so the choreography never places the card behind the snowman's body except as the seat under him. While carried, the card is held out at arm's length beside his body. The mittens overlap only its edges. The snowbank's front lip covers the card's leading edge after impact.

**Restoration.** The copy reaches identity (translate 0, rotate 0) at the original rect ≥200 ms before `restoreAt`. The helper then fades the original back in, and the copy goes transparent after the fade.

### D8. Timeline (25 s authored; 27.5 s mount deadline)

| Time (s) | Beat | Contact and motion evidence |
| --- | --- | --- |
| 0.0–1.2 | Fades in a few steps before his stance and walks in, the present held at his chest in both mittens | Feet planted on alternate steps |
| 1.2–3.3 | Settles; looks at the tree, along the distance, then up at the card; "idea" brows, a small proud bounce | Gaze holds of ≥300 ms each |
| 3.3–3.85 | Balances the present on his head (the snow is out of reach for his stick arms) | Present between the mittens until released on the head |
| 4.0–5.1 | Crouches and jumps (or reaches, when the card is low enough); grip contact at 4.3; hangs; tug 1 is resisted (the card dips ≤2 px under his weight); tug 2 tears the copy free and both drop | Mitten ↔ card ≤1.5 px |
| 5.1–5.9 | Lands; lowers the copy in front of him at arm's length, releases it at 5.75 and it drops onto the snow at 5.9 | Release precedes the drop |
| 6.0–8.3 | Takes the present down to his chest, walks along the card, tests it with one foot (it dips 1 px), crouches and sits hugging the present | Seat on the card; present between the mittens |
| 8.3–9.6 | Two scoots, at 8.6 and 9.2, the second bigger | Body lunges move the sled |
| 9.6–12.0 | Glide accelerates; cautious → smug at about 10.6; the scarf trails behind | Card under the seat |
| 12.0 | The sled hits the snowbank and noses up 14° | Card x stops at this frame |
| 12.0–12.25 | Body compresses (squash 8 %) and settles by 12.5 | Compression starts ≤1 frame after contact |
| 12.05–~12.5 | Head leaves the neck and lodges in the bough; the flight time is the actual launch-to-socket distance at the sled's speed, clamped to 0.35–0.6 s | Separation ≥3 frames after contact; launch speed within ±20 % of the sled speed |
| 12.6–13.1 | Branch dips and recoils (one overshoot) | Head follows the branch tip |
| 13.1–14.8 | Hold: the head glares indignantly at the body; the body sits stunned, still holding the present | Present still in the mittens |
| 14.8–16.2 | Body stands, walks to the tree and places the present with a deep bow (contact at 15.8), then shuffles under the bough | Present base on the floor |
| 16.2–17.3 | Pats the empty air above his shoulders; spreads his mittens | — |
| 17.3–18.4 | Head inhales (17.3–17.8) and sneezes at 17.8 (≤4 puffs desktop, ≤2 mobile); the branch flexes; the head drops into the waiting mittens (catch at 18.35) | Branch rotation precedes the release; catch ≤1.5 u |
| 18.4–20.2 | Puts the head on backwards; pause (carrot pointing behind); lift, swap, settle | No zero-scale flip |
| 20.2–21.0 | Straightens the present (rotation → 0) | Mitten on the present's edge |
| 21.0–23.2 | Lifts the card by the raised end out of the snowbank; walks back holding it level; raises it to his reach and jumps it into the slot, reaching identity by 23.0; release at 23.2 | Copy within 0.5 px of the original before `restoreAt` |
| 23.2–24.6 | Drops back, grips his head with both mittens and walks off the start side, fading out | Past the stage start by 24.6 |
| 24.6–25.0 | Hold on the tree and the delivered present; all decor fades | All layers out at 25.0 |

**Beat order.** "Straighten present" comes before "return card". This avoids a second traversal and lets him exit on the card's side. Every brief beat is kept. Open question 1 asks to confirm the order.

**Impact particles.** ≤6 on desktop, ≤2 on mobile. With the sneeze puffs this stays within ≤10 on desktop and ≤4 on mobile.

**Mobile** keeps the same beat times. Only distances shrink.

**Changes found during implementation.**
- *Present on the head.* The snow is below his stick arms' reach, so instead of setting the present down he balances it on his head while handling the card, and takes it down before sitting.
- *Jump pickup.* In Ledge mode the floor is `card.bottom + card.height + 130 units`, so his seated head clears the starter row. The card is then above his standing reach: he jumps, hangs from it until his weight tears the copy free, and the return jumps it back into the slot. Cards taller than 66 units use the drawn sled instead.
- *Rim reach.* A card above the rim is borrowed only when its bottom is 40–128 units above the floor; he never bends for it.
- *Drawn sled.* It starts planted upright in the snow and is pulled free by its upper end; on the way back he carries it by its top edge and sets it down where he placed it.
- *Entrance and exit.* He enters from at most 200 units before his stance and the snowman precomposition fades in over 0.35 s (and out at the end); the host is clipped to the welcome region, so nothing crosses a side panel.

### D9. Fallbacks, interruption and accessibility

**Component.** `NewYearSnowmanDelivery.tsx` mirrors `NewYearGiftWrapping.tsx`:

- `useLottieSceneSession` with `enabled = !reduced && supported && !changed`;
- `changed` covers a change of anchors, mobile mode or reduced motion after mount, which cancels the scene;
- the same window and `visualViewport` interrupt set: `pointerdown`, `click`, `keydown`, `focusin`, `focusout`, `beforeinput`, `input`, `compositionstart`, `scroll`, `resize`, `visibilitychange` (hidden).

**Adapter.** `SNOWMAN_DELIVERY_PLAYBACK`:

- timings: 2000 / 250 / 25000 ms;
- ownership `Transferred`;
- `onAnimationCreated` registers `observeSceneTargets([composer?, starterList?, card?, heading?], cancel, [host])` and the card layer;
- `onPlaybackStarted` starts the card companion.

**Teardown.** Navigation unmounts the provider's scene, and loading failure ends as `Failed`. Both run the session's exactly-once teardown: helper stop (the original opacity animation is cancelled, so the original shows immediately, and the copies are removed), observers, listeners, timers and `destroy()`.

**Static still.** `SnowmanDeliveryStill` is ≤60 SVG nodes: the snowman holding his head in both mittens beside the delivered present and a small tree. It sits at the bottom centre, like the other stills, and never borrows UI.

**Accessibility.** Every layer is `inert`, `aria-hidden` and `pointer-events: none`. Keyboard activation of the gift trigger is unchanged, and the notification carries the only announced text.

### D10. Numerical budgets (proposed limits, not measurements)

These are grounded in the inspected scenes:

- PenguinStar (20 s): ≤120 KB serialized, ≤32 animated properties, ≤80 keys per property, ≤140 generated artwork nodes (`new-year-penguin-star` spec, `penguin-star.spec.ts`).
- GiftWrapping (16 s, two characters): ≤240 KB, ≤12 top-level layers, ≤500 SVG descendants, ≤180 path nodes, ≤1,400 keyframes, ≤80 KB of static art and ≤900 vertices (`new-year-gift-wrapping` spec, `gift-wrapping.spec.ts`).

The snowman is one character with more beats and particles over 25 s:

| Budget | Desktop | Mobile |
| --- | --- | --- |
| Authored playback / mount deadline | 25,000 ms / 27,500 ms | same |
| Load / readiness timeouts | ≤2,000 / ≤250 ms | same |
| Characters / borrowed cards | 1 / ≤1 | 1 / ≤1 |
| Card snapshot | ≤40 nodes, ≤240 × 96 px | same |
| Snow particles | ≤10 | ≤4 |
| Concurrent Lottie players | 1 | 1 |
| Serialized composition | ≤170 KB | ≤170 KB |
| Top-level layers (shape, null and the one snowman precomposition) | ≤16 | ≤16 |
| Animated properties | ≤56 | ≤48 |
| Keys per property / total keyframes | ≤128 / ≤1,300 | ≤128 / ≤1,300 |
| Static native-vector art (minified) / Bézier vertices | ≤48 KB / ≤650 | same |
| Generated SVG descendants / rendered paths | ≤360 / ≤150 | ≤320 / ≤130 |
| Masks, mattes, filters, gradients, expressions, text or image layers | 0 | 0 |
| WAAPI animations (copy transform + original opacity) / card keyframes | ≤2 / ≤48 | same |
| Observers | ≤2 `MutationObserver` (scene + snapshot helper), ≤1 `ResizeObserver` | same |
| Preparation scan | ≤4 composer candidates × 24 ancestors; ≤4 starters × 24 ancestors; one computed-style copy of ≤40 nodes at playback start | same |
| Per-frame host layout reads / React updates during playback | 0 / 0 | 0 / 0 |
| Scene chunk, gzip, excluding the shared `lottie_light` chunk | ≤35 KB | — |

The tests enforce the structural numbers. Frame time, long tasks and style/layout/paint cost are browser observations, recorded separately (D11).

**Budget revision (measured during implementation).** The first proposal had ≤96 keys per property and ≤1,200 / ≤1,000 keyframes in total. The arm angles needed up to 106 keys to keep every grip within 1.5 px through the jump and the handling arcs (sampled every 0.04 s, then pruned by grip drift), and walks add root and foot keys. All other numbers stand.

### D11. Verification approach

**Unit tests (Vitest, jsdom).**

- Plan: beat order and times; the contact table (grips, planted feet, seat, catch, card ↔ mitten ≤1.5 px); head launch speed against sled speed; impact ordering; branch recoil before release; card end rect within 0.5 px before `restoreAt`; the exit leaving the viewport.
- Budget counters.
- Target selection for each mode, using mocked rects.
- Session callback semantics.
- Component fallbacks and the cleanup of every interruption path.
- Repeated activation and cancellation leave no copies, observers or animations.
- Click-pool selection.

**Storybook.** Desktop, mobile, RTL, reduced motion, starters below (Ledge), starters above (Rim), no starters (decorative sled), unsuitable geometry (Platform or Static) and interruption.

**Browser review.** In the Storybook host, at normal speed:

- inspect the contact frames: grip, foot test, pushes, impact, flight, catch, backwards head, slot;
- check readability at mobile size on light and dark surfaces;
- take Chrome performance profiles on desktop and a 4× CPU-throttled mobile emulation;
- check DOM-node and listener counts across 5 activate/cancel cycles.

Results go in `verification.md`. Unit tests are not evidence of believable motion or smooth rendering.

## Risks / Trade-offs

- **[Two renderers drift at contact]** → The plan derives the card from the same rig, starts it at Lottie frame 0 (D6) and holds grips for ≥100 ms around transitions. The browser review checks the contact frames. If a visible gap remains during the ride, a bounded fix is a one-time resync at the slide start using an extra `onPlaybackStarted`-style checkpoint. That would be a separate, reviewed change.
- **[Responsive layouts leave no room for the full story]** → Adaptive modes (D1) with a minimum travel and per-mode band checks. Mobile keeps every beat and shortens the distances. When no free band exists, the scene shows the static still rather than covering host text.
- **[The snapshot looks different from the original]** (hover or transitions in progress, web fonts) → Exclude `:hover`, `:active` and focused cards. The helper freezes the computed style with transitions and animations off. Snapshot at the first frame, while the original is still visible and untouched.
- **[Head physics reads as arbitrary]** → Launch speed is tied to the sled speed, and the impact order is tested. The snowbank position is derived from the landing socket, so the arc always ends in the branches.
- **[Lottie parenting limits]** → The head, present and sled are unparented world tracks computed from the rig, with tests checking neck and grip continuity.
- **[Shared session change]** → The callback is optional, additive and host-agnostic. GiftWrapping and the session tests are unchanged, and the architecture-guard grep still prints nothing.
- **[Click-pool variety changes what users see]** → Intended. Hosts can disable either scene through `selection`.
- **[25 s instead of about 24 s]** → The return walk needs time to stay readable. The deadline stays below the profile's 32 s cap.

## Migration Plan

1. Land the session callback with its tests (no behaviour change).
2. Land the scene behind the enum and stories, with the click pool unchanged.
3. Add the scene to the click pool, the label and the host key, and update the docs and specs.
4. Browser verification. Then archive.

**Rollback.** Revert step 3 to remove the scene from the pool without deleting code, or revert everything. Nothing is persisted, and hosts with explicit `enabledScenes` are unaffected.

## Open Questions

1. **Beat order (needs product confirmation):** straighten the present first, then return the card and exit on the card's side (D8), instead of the brief's order of return card → straighten present → leave. The alternative costs a second traversal of about 1.5 s and pushes the story to about 26.5 s.
2. Card copy scale: kept at 1.0, so the text is unchanged. If a 240 px card dwarfs the snowman on mobile, a ≥0.85 scale is the only allowed adjustment, decided during browser review.

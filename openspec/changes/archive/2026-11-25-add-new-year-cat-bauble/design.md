## Context

New Year scenes live in `libs/celebrations/src/new-year/`. Each one is a lazy part of the `./new-year` entry, selected by `NewYearSceneOverlay` and timed by `NEW_YEAR_SCENE_DURATIONS`. The closest model is the elf fireworks scene:

- `utils/elf-fireworks-targets.ts` measures the composer once with `measureComposer` and picks one borrowable button.
- `utils/elf-fireworks-composition.ts` plans the whole story as `Track`s from `utils/snowman-delivery-timeline.ts`, then emits native Lottie layers with the shape helpers in `utils/snowman-delivery-art.ts`. It also emits the button copy's WAAPI frames from the same plan and a `probe(t)` for contact tests.
- `utils/elf-fireworks-animation.ts` contributes the timings, a copy layer under the SVG, target observers, and `onPlaybackStarted` to start `animateCelebrationSnapshots` on the Lottie clock.
- `components/NewYearElfFireworks/NewYearElfFireworks.tsx` wires `useLottieSceneSession`, `useComposerInterrupts` and `useReducedMotion`, and renders a still for the stationary case.

The model selector is already an anchor (`composerModelSelector`, filled by `apps/chat/src/context/CelebrationHost.tsx`). The penguin already borrows it with eligibility checks in `utils/penguin-star-targets.ts`.

## Goals / Non-Goals

**Goals:**

- An original cat story whose personality comes from timing: anticipation, a miss, grooming, fright and pride.
- One measured, precomputed plan with tested paw, mouth, rim and hook contacts. The copy is exactly restored.
- Desktop, mobile, RTL, reduced motion and interruption all coherent, within numerical budgets.

**Non-Goals:**

- New anchors, contract changes or shared-engine changes.
- Reusing the Halloween cat rig.
- Sound or live control.
- An external pack.

## Decisions

### D1. Elf-fireworks architecture, copied per scene, not abstracted

Create `cat-bauble-targets.ts`, `cat-bauble-art.ts`, `cat-bauble-composition.ts` and `cat-bauble-animation.ts`, plus `NewYearCatBauble`, which mirror the elf modules one for one. Reuse the generic pieces: `measureComposer`, `observeSceneTargets`, `animateCelebrationSnapshots`, `useLottieSceneSession`, `useComposerInterrupts`, `Track`, and the shape helpers `group`, `ellipse`, `rect`, `path`, `fixed` and `identity`.

*Alternative:* extract a shared "rim scene with one borrowed control" engine from the elf. Rejected: the skill asks to keep the animation mechanism scene-local, and an engine refactor would touch a shipped scene for one idea.

### D2. Rim coordinates and stage orientation

Everything is planned in "along" pixels from the composer's logical start edge: `X(a) = startEdge + dir·a`, with `dir = rtl ? −1 : 1`. The rim height is `floor = composer.top − 3`.

The selector's along position `selA` decides the stage. The fir stands at the far end (`firA = span − 40·s` when `selA < span / 2`, otherwise `40·s`). `toward = sign(firA − selA)` is the direction of the story. The cat therefore enters from the selector's side, walks past the selector without noticing it, and works toward the fir. This holds wherever the host places the selector, and it is mirrored by RTL through `dir`. In tangerine mode, the tangerine rests on the rim at `selA = 0.3·span`, so the layout is the same.

### D3. The cat rig is authored here, in native units

The cat faces +x, with its origin on the ground between its feet. It is a few broad flat shapes with no gradients, about 74 native units tall when standing:

- **Body:** an ellipse at about (0, −29), 56 × 31 units, with a white chest patch and three broad tabby stripe shapes. The proportions are deliberately cartoon-cute: a big round head, short chunky legs and a compact body. The first, longer body with thin legs and a small head read as unsettling.
- **Head:** a group pivoting at the neck (24, −38), containing:
  - the ear groups, which rotate to point forward or lie flat;
  - the eyes, whose scale-y blinks;
  - round pupils with a white catchlight, whose uniform scale widens for anticipation; vertical slit pupils read as a predatory stare and are avoided;
  - a muzzle with a small "ω" mouth, a cheek blush and a mouth point.
- **Tail:** a group pivoting at (−28, −30), whose rotation and scale give the swish and the puff.
- **Legs:** four legs pivoting at the hips and shoulders. The near foreleg also has a stretch channel, its scale-y, for the reach down to the selector.
- **Bell:** a group on the collar, rotating with lag.

The facing direction is a parent scale-x of ±1, as in the elf. Body pose channels are the root position (along, up), lean (rotation about the feet), squash, head tilt, tail angle, tail scale, ear angle, pupil scale, eye open, the four leg angles and the foreleg stretch.

Two body postures are expressed by lean and squash alone, with no extra art:

- **Lying on the rim:** lean −8°, squash [104, 70].
- **Rearing:** lean −62° about the hind feet.

### D4. Contacts are solved, not eyeballed

The probe gives world points for the forepaw tip (shoulder plus stretched leg), the mouth, the feet, the copy's grip and bottom, the fir hook and the lowest bauble. Each contact is solved from these points:

- **Hook down.** The leg's world direction is straight down: its local angle is `−lean` in the facing frame. The stretch is `(selectorTop − shoulderWorld.y) / (LEG_LENGTH · s)`, clamped to [1, 2.6]. The cat's along position puts the shoulder above the selector's centre. A selector whose top is out of reach (stretch > 2.6) is not eligible.
- **Slide.** The copy's centre slides from its rim landing spot to `X(firA) − toward·(w/2 + trunkHalf)`, with an ease-out curve that keeps speed at impact (`[0.15, 0.55, 0.55, 1]`).
- **Hanging.** The hook is at the middle tier's tip on the cat's side (`CAT_FIR.hook`), which the fir's tilt carries. The copy hangs by a grip `g` on its top edge, 8 px in from its fir-side end, so its body stays clear of the branches (a first top-centre version hid a 72 px selector behind the tree; see `evidence.md`). Its swing θ is an 8° rest tilt plus a damped pendulum, and its centre is `hook − R(θ)·g`. This makes the copy's WAAPI transform a translate and rotate about its centre.
- **Rearing grab.** The rearing mouth height in native units is chosen to equal the hook height, so the cat reaches the hook without a jump.
- **Carry.** The grip is the mouth, and the tilt levels out over 0.4 s. The centre y is clamped to `floor − h/2`, which drags the copy on the rim when it would hang lower.

The selector height limit (44 px) and the mouth height make the clamp a short slide only for the tallest selectors.

### D5. Beat timeline (seconds; `CAT_BAUBLE_MS = 23000`)

| Beat | Time |
| --- | --- |
| Enter and trot to below the bauble | 0–2.6 |
| Look up, pupils widen | 2.6–3.1 |
| Crouch and two rear wiggles | 3.1–4.0 |
| Pounce (the bauble starts swinging away at 4.05) | 4.0–4.45 |
| Land, forelegs then hind legs | 4.45–4.7 |
| Groom | 4.9–6.0 |
| Look back and turn | 6.1–6.4 |
| Walk to the selector | 6.4–8.2 |
| Lie down and stretch the paw | 8.2–8.8 |
| Contact, `hideAt` | 8.9 |
| Flick onto the rim | 9.0–9.4 |
| Step behind, crouch and swat | 9.6–10.3 |
| Slide | 10.3–11.3 |
| Impact; fir tilt and bauble swings | 11.3 |
| Copy pops onto the hook | 11.3–11.75 |
| Fir leans toward the cat, which freezes | 11.75–12.6 |
| Fir straightens | 12.6–13.2 |
| Admire, with head tilts | 13.2–15.0 |
| Rear, bite and unhook | 15.0–15.9 |
| Carry back | 16.1–18.4 |
| Lower into the slot | 18.5–19.0 |
| `restoreAt` | 19.1 |
| Curl | 19.3–20.4 |
| Stretch | 20.5–21.2 |
| Walk off and fade | 21.3–22.9 |

Timing is a plan, not a library-wide limit.

### D6. Motion character

- **Anticipation:** the pupils widen before the crouch, and the rear wiggles twice before the pounce.
- **Weight:** landings squash the forequarters first, then the hind feet.
- **Reaction:** after the miss, the cat grooms instead of reacting. That is the joke.
- **Fright:** the tail puffs (scale 1.5) and the ears flatten before the body moves.
- **Secondary motion:** the bell lags the head, and each bauble has its own pendulum with its own decay.
- **The fir** tilts about its base with one overshoot, and its baubles inherit the tilt.

### D7. Copy track and restore

Following `elf-fireworks-composition.ts`, the copy is shown from 0.3 s before `hideAt` until after the helper's 4 % fade-in following `restoreAt`. Its frames are emitted at every key time of the copy track. The copy layer is prepended beneath the renderer SVG, so the fir and the cat's mouth draw over it. `observeSceneTargets` watches the composer and the selector. A snapshot stop before `restoreAt` cancels the scene.

### D8. Fallbacks

`CatBaubleMode` has three values:

- **Selector** borrows the model selector.
- **Tangerine** draws a tangerine as the toy and borrows nothing.
- **Static** applies when no composer qualifies: minimum width 320 px on desktop and 260 px on mobile, and headroom 180 px on desktop and 150 px on mobile.

The still is a hand-authored `aria-hidden` SVG. It is used under reduced motion, without observers, on player failure, and in static mode.

### D9. Budgets

Desktop scale is 0.82 and mobile scale is 0.6. The layers are:

1. fir
2. tangerine (in tangerine mode)
3. cat
4. a hook-glint layer is not added; the hook is part of the fir.

That gives at most 3 layers in practice, under the budget of 8.

Animated properties stay roughly within:

- cat: 18 channels;
- fir: about 6 channels (tilt and four bauble or hook swings);
- tangerine: 2–3 channels.

Tracks are sampled at 1/30 s and pruned, as the elf's are. Tests assert the spec's limits.

### D10. Host boundary

There is no host-specific knowledge in the lib. Anchors and translated labels arrive through `CelebrationEnvironmentContext` from `apps/chat/src/context/CelebrationHost.tsx`. DIAL Chat only gains a new enum key and an en.json string.

## Risks / Trade-offs

- [The stretched foreleg reads as rubbery] → Cap the stretch at 2.6 and keep it only during the reach. A selector out of reach uses the tangerine.
- [The copy track drifts from the paw contact] → The frames come from the same `Track`, start on the reported frame-0 time, and the probe tests assert contact within 2 px.
- [The selector is tall or wide in some hosts] → The eligibility limits fall back to the tangerine.
- [Cat art complexity grows the node count] → Use flat shapes, assert the budget, and add no gradients or filters.
- [The spec for `celebration-source-selection` still lists four New Year scenes] → Out of scope here. Recorded as a follow-up task.

## Migration Plan

The change is additive. A host gets the new scene through the existing New Year entry. Disable it with `disabledScenes: ['cat-bauble']`. Roll back by reverting the commit.

## Open Questions

None blocking. The browser profile may suggest trimming sample density on mobile.

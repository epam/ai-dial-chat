## Context

Witches currently uses `HalloweenNightFlight`, `buildHalloweenWitchFlight` and the common fourteen-second deadline. Bats and Cat already demonstrate bounded page snapshots, measured physical coordinates, precomputed WAAPI timelines and cancellation. The user selected the “Wrong spell” story and explicitly requires performance, OpenSpec propose/apply and a matching performance update to the personal scene-ideas skill.

The root AGENTS.md library isolation rules apply. All geometry arrives through `CelebrationAnchors` and the existing celebration environment; no app adapter or provider changes are needed. Existing uncommitted StoryHostPage edits belong to the user.

## Goals / Non-Goals

**Goals:** readable two-character narrative, meaningful button interaction, twenty-second finite playback, bounded setup/rendering cost, immediate restoration, desktop/mobile and RTL parity.

**Non-goals:** physics engine, gameplay, new public API, audio, backend, host state mutation, new i18n keys, global lifecycle refactoring or changing unrelated scenes.

## Decisions

### Scene ownership and six story beats

`HalloweenWitches.tsx` owns one stable plan and stopped state for an activation, following `HalloweenBats.tsx`. `CelebrationProvider` retains scene selection, notifications and replacement. Local effects guard deferred preparation against cancellation and StrictMode rehearsal. No new context, shared cache, network request or persistent state is introduced.

The sequence is: arrival and overshoot (0–3s), apprentice's levitation gesture (3–6s), frog-like buttons hopping (6–10s), broom herding and accidental broom enchantment (10–14s), mentor gesture and exact button restoration (14–17s), embarrassed departure with a last broom hop (17–20s). Use articulated decorative SVG artwork consistent with existing Halloween illustrations, not UI icons. The apprentice and mentor have distinct colors, silhouettes/poses and timing. Eyes, arm, hat, cloak and broom motion convey intent without text or sound.

### Measured geometry and bounded targets

Add `halloween-witch-targets.ts` for a bounded scan of at most 24 buttons from the supplied composer and starter-list anchors. Cache geometry/styles during setup; limit ancestor checks to 32 levels. Select up to two visible idle buttons on desktop or one on mobile, each at most 40 descendants, 240×64px and 15,360px². Reject hidden, clipped, disabled, expanded, focused and editable subtrees. The composer is a measured stage, never copied. Anchor classes/routes remain host supplied.

`halloween-witch-plan.ts` creates character paths, spell gestures, button squash/jump/landing trajectories, return positions and final broom hop. Button labels stay readable and upright; no scaling by -1 on snapshots. Characters may face toward their actual destinations. Geometry remains physical in either document direction. Plan the button's landing and the herding broom from the same points/times so the prop never appears to teleport or react before contact.

Zero targets keeps the same two-character lesson with the apprentice enchanting her broom. Without a usable composer, stage this version in a bounded viewport area. On constrained viewports reduce travel and artwork size, retaining all essential beats. Reduced motion or unsupported WAAPI bypasses target collection/copying and renders a static mentor/apprentice/enchanted-broom composition.

### Playback and performance budget

Use existing `animateCelebrationSnapshots` for copies and original opacity ownership. A scene-specific `halloween-witch-animation.ts` synchronizes artwork and snapshots on a single start time. Frog eyes/legs attach to snapshot wrappers; their transform follows the button while its content stays unchanged. Animations use transform and opacity; no animated layout/filter attributes, physics dependency or steady-state requestAnimationFrame/setState loop.

Budgets: two witches, two/one snapshots, at most 48 active WAAPI animations including snapshot visibility and frog parts, and at most 160 keyframes per track. Precompute bounded samples only for curved/parabolic paths; use sparse keyframes for pauses and gestures. Setup caches layout/style reads; playback does not poll layout. Mutation batches may remeasure existing anchors solely to cancel if geometry changed. A ResizeObserver catches actual anchor resizing. Avoid animated blur, drop-shadow and particle systems.

Playback ends at 20,000ms; provider deadline is 20,500ms. Copy appearance is delayed to the first spell and originals return before departure. Keyboard, pointer down, focus, input/composition, scroll, resize, hidden document, relevant source mutation, changed motion/mobile preference, replacement and unmount cancel all work. Cancellation is idempotent. Unrelated notification-portal removal must not stop the story. An API/snapshot failure restores every original immediately.

The simpler baseline of generic flight does not satisfy the story. A physics or frame-loop engine would increase runtime cost and reduce determinism. Bounded precomputed tracks fit the existing implementation and are directly testable.

### Integration and accessibility

Register the scene through the existing Witches branch, preserve the scene enum value and click/secret pools, and set only its individual duration. Remove the obsolete Witches-only generic-flight drawing/helper where no longer called; retain the bat fallback and shared FlyingCharacters renderer used by New Year.

Keep `halloween.witchesToastMessage`, the notification announcement and host label injection. There are no new strings, feature flags, API endpoints, telemetry or cache TTLs. The existing `UI_EVENT`/activeEventId gate still applies. Artwork and copies are inert, aria-hidden and pointer-transparent; the existing pumpkin remains the labelled keyboard/touch trigger. Follow `.claude/rules/libs.md` and `.claude/rules/lib-styling.md`; static layout uses Tailwind, dynamic measured geometry and SVG articulation use computed transforms, and colors live in the illustration stylesheet.

### Verification

Tests cover eligible/oversized/unsafe targets; one/two/no targets; finite ordered keyframes; matching landing/restoration coordinates; mobile and RTL geometry; resource caps; no layout reads during uninterrupted playback; focus/draft/selection preservation; interruption, mutation, failed animation setup, StrictMode and repeated cleanup. Existing event and story-coverage tests verify routing and deadlines. Browser evidence at 360/900/1280/1920 includes narrative frames, reduced motion and RTL, snapshot counts, animation counts and cleanup. A browser performance sample records setup and steady playback separately; report measurements and limitations without treating unit tests as proof of FPS.

### Motion-quality follow-up

The user requested applying the updated scene skill to the implemented lesson. Browser samples in `tmp/witches-polish/before.json` confirmed an approximately 20–25px palm/spell-origin mismatch and an invisible copy at 17s while the original is still fading in. The plan also applies the same easing to body travel and joints, eases horizontal progress during airborne hops, and settles cloak/hat with little delay. These are a focused refinement of this change, not a new scene or runtime.

Derive spell launch positions from the SVG hand pivot and held casting angle, and center the spell illustration on that point. Keep the apprentice and broom steady while the accidental spell travels to the broom; the recoil follows its arrival. Share the broom contact position and timeline with the chased button. Use precomputed curved flight samples with linear interpolation, ballistic horizontal progress for hops, short compression/stretch and a damped landing recovery. Use different timing for the impulsive apprentice and composed mentor, with delayed hat/cloak settling. Retain the copy until the existing snapshot helper has fully restored the original, then depart. The twenty-second deadline, 48-animation and 160-keyframe caps remain unchanged, as do cancellation and host isolation.

Compare the same moments before/after using browser animation scrubbing and record uninterrupted playback. Verify contact/launch coordinates, source/copy handoff, phase ordering, finite tracks, all responsive layouts and reduced motion; repeat the active-phase CPU-throttled profile. No runtime sampling, new dependencies, particles, blur, public contracts or host integration changes are needed.

## Risks / Trade-offs

- Dense custom controls can make computed-style copying expensive → reject large subtrees and keep a bounded target scan; record setup separately from playback.
- Small viewports obscure gestures → one target, bounded travel and two readable characters; fallback to broom-only when necessary.
- Observer callbacks can mistake scene mutations/toasts for host changes → ignore decorative descendants and only remeasure anchors for potentially relevant layout mutations.
- Sparse keyframes can make hops mechanical → sample only flight arcs and squash/land transitions, keeping bounded tracks.
- Browser/GPU differences affect throughput → check actual playback/resource counts, not an unsupported universal FPS promise.

## Migration Plan

No migration. Replace the internal Witches renderer and deadline, retain public IDs/labels/selection, and update the lib README. Rollback restores the old branch/helper and duration. Archive is a separate explicitly requested workflow.

## Open Questions

None blocking. Exact gesture angles and travel distances are implementation details to tune against browser frames within the agreed budgets and story.

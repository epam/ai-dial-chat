# Design

## Context

See proposal.md for motivation and inspected baseline. Shared snapshot and authored-track utilities exist; S7 generic copy-track does not exist on this branch. The local Themes checkout already contains unrelated pending work, so the new pack is staged under ignored Chat `tmp/` and is not published. Production LottieScene and Storybook provide a preview without creating another application.

## Goals / Non-Goals

**Goals:** retain physical contact and readable effort at actual mobile size; share the player's clock between authored art and copied composer; preserve the editable original through every exit path.

**Non-Goals:** arbitrary DOM selectors or scripting in packs, vertical physics/falls, runtime character choreography, persistent decoration, or universal whole-page borrowing.

## Decisions

1. **Minimal opt-in adapter.** Use `interaction-composer-carry-v1`, composer anchoring and direction `none`. Reusing Cat unchanged would impose button selection and falling physics; adapting the whole Mummy would mix scene art with the runtime. The bounded adapter uses the existing snapshot session and copies only an eligible composer of at most 300 nodes. Character poses and timing remain in native JSON. No library reads app settings, URLs, environment or session state; descriptors, anchors and loader callbacks supply integration.

2. **One authored horizontal carrier.** A root null `composer-carry` starts/ends at `[0,0,0]`, has fixed scale and rotation, and uses an authored x domain 0..1000. The adapter maps x1000 to `viewportWidth - composer.left + 32px`, adds the composer-top-center pivot and uses the same transformed track for the snapshot. A direct-child `composer-decoration` uses reference x±260; only its horizontal geometry is fitted to measured composer width. Bears retain uniform scaling. Desktop uses a 1200×360 reference stage and anchor `{x:340,y:240,width:520,height:56}`. Mobile uses720×330 and anchor `{x:210,y:220,width:300,height:56}`, with its own larger authored bear proportions and uniform scale range0.85..1. The decoration reference width stays520 in both variants. Any amended validation details must agree with the authored assets and tests.

3. **Two authored viewport variants.** Desktop and mobile reuse the story but adjust bear scale and staging. Desktop actors stand beside the composer; mobile actors stand below a side corner, as selected by the user. Round eager bear wears cranberry; calm helper wears pine. Connected contours, flat white/blue masses and compact limbs follow SnowmanDelivery. Tiny glow gradients avoid filters; ornaments hang from visible caps and swing on braking. The carrier never mirrors text; the scene is direction-agnostic.

4. **Finite decoration.** The user selected a short decorated hold followed by cleanup. Timeline: enter0–2.5s; grip2.5–4; solo strain/recovery4–6; seek help6–8.5; return together8.5–11.5; joint failed attempt11.5–14.5; successful load14.5–17; tow17–19.5; hidden20; return20.5–24; reveal/hold24–26; departure/cleanup26–28. Load/readiness allowances keep total lifetime under the existing32s cap. There are no persistent DOM decorations or new timers.

5. **Local preview only.** Use a development descriptor/custom loaders in existing Storybook. Source JSON/SVG plus manifest/hash metadata remain staged outside compiled production scene pools. Older runtimes reject the new capability through existing fallback. A separate release would require Themes checker support and BFF/policy acceptance; local native playback does not prove that path.

## Risks / Trade-offs

- [Characters overlap or become too small on mobile] → inspect grip/effort/recovery at360px first, then extend and check the full timeline at360/1280px in light/dark.
- [Paws slide relative to the composer] → parent art and snapshot to the same authored carrier; do not generate an independent motion path.
- [Long playback interrupts writing] → synchronous existing input/pointer/focus cancellation, no real composer translation or disabled state.
- [Extra opt-in capability before S7 lands] → narrowly scoped contract, no generic marker language; revisit reuse when S7 is actually merged rather than importing incomplete unrelated changes.
- [Local Themes checker rejects the experimental capability] → report that limitation explicitly and validate structural caps and native adapter behavior separately. No publication claim.
- [Performance] → hard ceilings live in scene spec; target≤200KiB,≤12layers and≤320SVG nodes per variant. Record actual sizes, counts, preparation timing and cleanup; exceeding targets needs an explanation but never raises runtime caps.

## Validation and rollback

Add adapter behavior tests for malformed geometry, source isolation, bounded copying, shared timing and cancellation. Preview real-time playback and sampled contact poses, exercise RTL/reduced motion/missing target, and repeat cancellation to detect leaked snapshots. Run focused checks through Nx, the changed-slice verification once and the full repository gate once; distinguish unrelated existing failures from this slice. Keep runtime/documentation checks proportional to the change. Removing the local descriptor stops the prototype immediately; no state migration or deployed rollback is needed.

## Rope and Snowman-style revision

The first completed prototype's technical evidence does not establish artistic acceptance: the user disliked its bear proportions and jerky motion. The archived local before state is `tmp/polar-bears-preview/revisions/before-rope/` at revision `a465eec67bd0`.

Use SnowmanDelivery's round connected masses, short mitten-like hands, simple dark facial features, restrained navy contours and flat white/blue volumes. Its artistic source is `libs/celebrations/src/new-year/utils/snowman-delivery-art.ts`; the locally available native pack preserves that visual language. Remove the tall neck, projecting muzzle, long tapered forearms and elaborate fur gradients. A few coherent poses take priority over rig complexity.

The first rope revision tied the rope to the top-center rim. Subsequent user feedback rejects actors above the input; the side/corner revision below supersedes that placement. The loop must clasp the selected edge, and the free rope connects to the actual authored paw positions. Pulling begins only after slack is taken up. During the offscreen gap, restage the actors to the opposite pulling side for the return. Untie/release the rope for the final decorated hold and departure.

Motion changes address observed authored defects: the original helper applied the same ease-in/out to every waypoint, the gait stopped every 0.14 seconds, and held whole-body scale flips caused instantaneous turns. Use action-specific easing, continuous travel segments, restrained foot/weight movement, held acting poses and a readable turn. Avoid rapid offscreen-to-onscreen transit that appears as a pop. Do not add runtime physics or more articulation to compensate for weak drawing.

The first revision slice is entry, tie, slack-to-taut solo pull and recoil at actual 360/1280 display sizes. Then extend the same poses through the helper attempt and decorated return. Preserve the 28-second duration and existing hard budgets (512 KiB, 30 layers, 4000 keys, 800 SVG nodes, one copy of at most300 nodes). Targets remain below200 KiB and at most12 layers, with fewer paths/gradients than the original where possible. Rope complexity is bounded to at most12 path shapes, two grip stations and one attachment loop. Keep copied text unmirrored in RTL and use the existing reduced-motion poster path.

Record rendered pose comparisons, normal-speed browser/frame-time evidence and geometry/lifecycle checks separately. A saved recording or sampled frames do not count as continuous artistic review. Leave that explicit assessment open when it cannot be performed, while completing the authorized asset corrections and local refresh.

## Side and lower-corner staging revision

The user asks why the bears stand above the input instead of beside it. The top-center staging was an authoring choice, not a necessary runtime constraint. Desktop has enough lateral room for the compact duo. At360px the composer leaves approximately16px at each side; the user explicitly chose bears below a side corner instead of temporarily shifting the visual input. Do not shrink or pre-shift the copy to manufacture room.

Add optional `composer-side`, an identity null directly under `composer-carry`. Its authored position uses normalized x in[-1,1], y in[0,1] and z0. Before playback, map these coordinates to x multiplied by measured composer half-width and y multiplied by measured height, divided by the existing uniform art scale. Allow bounded static or finite ordered position keys so authored timing can change the attachment while fully offscreen. The slot binds geometry only: no runtime character choreography, new frame loop, app knowledge or snapshot behavior. Missing optional slot preserves existing0.1.0/0.1.1 behavior; a present malformed/duplicate slot fails preparation safely.

Desktop attaches to the right-edge midpoint for outbound pulling and the left-edge midpoint for the return. Bears and rope descend from the slot and stand on the same vertical level as the input. Mobile attaches to the bottom-left corner, with both bears extending rightward and below it, then switches to the bottom-right corner with the pair extending leftward for the return. These positions keep the actual horizontal pull direction consistent with carrier travel. Reblock the tying poses around the new knot so arms remain compact and connected. Preserve the existing drawing, story, timing, decoration fitting and hard budgets; one additional null is sufficient.

Inspect the first tie/pull slice at actual360/1280 sizes before completing the timeline. Verify both actors' visible bounds, knot-to-copy contact, corner switching while offscreen, and mobile clearance below the input. Preserve the previous local pack and stage the result as0.1.2 only after full verification. Keep normal artistic assessment separate from automated completion and geometry checks.

## Face correction

The user rejects the0.1.2 faces as strange. The current frontal eyes, strongly offset profile nose, outlined muzzle and human-like frown do not form a coherent bear face at scene size. The scratch path helper also joins multiple move commands into one contour, connecting the intended separate brows. Correct the native face drawing and poster with a compact muzzle, coherent eye/nose placement, small rounded dark nose and restrained animal mouth. Use distinct simple eye shapes for attentive, effort and surprised expressions. Any brows must be separate shapes; do not add fur detail, face outlines or gradients to compensate for the drawing.

Preserve the accepted side/corner staging, body silhouette, poses, rope contacts, timing and cleanup. No runtime changes are needed. Inspect neutral, effort and recovery/reaction poses at actual360/1280 light/dark size before staging0.1.3. Keep existing performance ceilings and compare non-face native data against the0.1.2 baseline. Validate the updated static fallback and local delivery, without rerunning unrelated repository gates for this asset-only correction.

## Joint-pull weight and decoration revision

The user requests a visible small displacement on the first joint attempt and a slow, accelerating second attempt. Version0.1.3 keeps the carrier still throughout the first attempt and applies the same ease-in/out to outbound travel. Author a small impulse only after the rope is taut, a slight settling movement and a readable displaced hold. The second attempt starts from that held position and accelerates through visible travel. Braking or stopping for the hidden turnaround must happen after the composer leaves the viewport. Preserve the28s lifetime, original final position and existing shared native/snapshot clock; no runtime physics or adapter change is needed. Keep foot movement consistent with the load using bounded authored steps rather than a frozen bracing pose sliding with the carrier.

The user also rejects the old decoration style. Replace the thick repeated evergreen scallops and small glossy red/gold gradient balls with a slim restrained light strand, warm light points and a sparse set of clean matte/pearl-like baubles in the scene's existing winter palette. Use clear hang points, small variation in drop lengths and a short settling motion. Preserve visible glowing lights, spherical ornaments and the final fade; do not substitute an unrelated decorative effect. Aim for fewer paths/gradients than the previous decoration, within all existing hard budgets.

The representative verification slice is the two joint attempts plus the decorated reveal at actual360/1280 light/dark size. Record copy displacement and velocity from normal-speed native playback separately from sampled pose/art assessment. Preserve the corrected faces and desktop side/mobile corner staging. Stage local0.1.4 only after reviewed native bytes and lifecycle checks; retain0.1.3 and all earlier local versions.

## Natural light wire with accepted scene preserved

After viewing0.1.4, the user explicitly accepts the bears and scene but rejects the new garland as worse and unnatural. The user selects a flexible wire with soft sags and small volumetric bulbs. The nearly straight cable and triangular end tails of0.1.4 are therefore a rejected direction despite passing technical checks.

Lock all0.1.4 non-decoration native data, including faces, body/foot motion, rope, side staging and carrier travel. Revise only the decoration layer and corresponding poster details. Use a believable supported wire with visible gentle downward curves, compact sockets and small rounded warm bulbs whose broad shaded shapes communicate volume. Avoid mechanical repetition, rigid guy-line supports and extra effects. Keep bauble accents required by the original story; keep all decoration out of the text line and preserve final fading.

Verify actual mobile width fitting keeps bulbs round. Inspect a representative reveal on both palettes before local staging, then prove non-decoration byte equivalence. Existing numerical caps remain unchanged; native curves and restrained fills are sufficient without filters or a new runtime mechanism. Technical motion profiling is already complete and the user's explicit scene approval means this iteration must not reopen bear or travel choreography.

## Pull-request preparation and archive

The user subsequently requested Chat and Themes PRs and OpenSpec archival. Prepare Chat against current development, including the shipped CopyTrack adapter and the tagged companion preparation contract. Add composer carry as a separate companion kind and preserve the existing restriction to one interaction capability. Keep the final reviewed native assets unchanged in the companion Themes package; no local preview helpers, environment files or personal skills are published.

The local preview used a welcome composer with room below it. A bottom-docked composer can leave the lower-corner actors outside the viewport. For a recognized optional side slot, interpret source stage height minus reference anchor y as the authored lower artwork extent. Reserve that extent at the selected uniform scale below the lowest mapped side attachment, with the existing20CSSpx viewport margin. Insufficient space falls back before snapshot preparation or hiding the real input. This is measured geometry, with no app or welcome-page knowledge and no change to the approved art or motion.

The archived evidence distinguishes completed automated checks and sampled art inspection from the outstanding continuous assistant artistic review. The user's explicit acceptance of the bears and scene is recorded, but does not fabricate that missing review.

The user selected a separately enabled **New Year Polar Bears** event for independent publication. Themes publishes `new-year-polar-bears@1.0.0` with event ID `new-year-polar-bears`, its own static trigger, English labels and catalog default. The existing `new-year` default and pools remain intact. This avoids changing or deleting retained New Year pack versions, and does not depend on the pending Snowman/retirement PRs. Operators use existing event/external-delivery settings to opt in; publishing the pack does not automatically activate it.

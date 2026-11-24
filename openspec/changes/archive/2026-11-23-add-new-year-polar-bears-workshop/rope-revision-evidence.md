# Rope and Snowman-style revision evidence

The user's feedback reopened artistic acceptance: the original bears looked wrong and jerked during motion. Technical checks from the first prototype remain lifecycle evidence only.

## Before state and reference

The original local revision `a465eec67bd0` is preserved under ignored `tmp/polar-bears-preview/revisions/before-rope/`, including native assets, metadata, screenshots and a hash inventory. The reference is the existing SnowmanDelivery artwork, inspected from its source and a fresh native-player rendering at the authored mobile/desktop scale. Its useful visual features are round white masses, broad flat blue shadows, thin navy contours, short mitten-like hands and simple readable facial marks.

The initial bear had an elongated neck/muzzle, tall body, long arms and numerous gradients. These are being replaced rather than defended by the first prototype's passing tests.

## Confirmed motion defects

The before version's universal ease-in/out stopped velocity at every intermediate waypoint and every 0.14-second foot sample. Held whole-body scale flips also changed pose instantly. The authored-track diagnostic found 13 desktop and 9 mobile same-direction waypoints with near-zero intermediate speed, plus three potentially visible held mirror flips per variant; visibility is a geometric estimate rather than an artistic verdict.

Normal-speed browser sampling around the first failure/turn found a paw displacement of approximately48 CSS pixels on mobile and58 on desktop near6.62seconds. The recording and rAF coordinates are in `tmp/polar-bears-preview/rope-motion/before-local-polar-bears-a465eec67bd0/`. Those diagnostic DOM/SVG reads are harness work, not runtime work or a deployment frame-rate benchmark.

## Verification boundaries

Intermediate authored previews intercept only the local Storybook animation requests. They identify the actual native bytes and preserve the running app's old cached manifest/assets. They do not establish BFF/hash validation for the revised pack. The local catalog and API will be refreshed only after the full revised assets are frozen.

Rendered-pose inspection, contact/continuity diagnostics, native normal-speed technical playback, lifecycle safety and continuous perceptual review are separate evidence. A recorded video alone is not a completed perceptual review. Task4.6 remains open unless that review is actually performed.

## Revised result

The representative0–6.5s slice was inspected at0.8/2.2/3.2/4.5/5.4/6.3s in native360/1280 light/dark previews. The revised bear has a compact round silhouette, short connected arms, flat white/blue shading and a restrained outline. The tie, take-up of slack, effort and released-rope reaction are distinguishable in those frames. Feet and their shadow have a16px authored gap above the rim rather than standing on the carried input.

That slice contained184 renderer-host SVG/DOM nodes and90 rendered paths with one snapshot on the simple fixture host (the metric includes host/copy nodes; final native-SVG counts are recorded separately). It was142,874bytes desktop/142,544bytes mobile. Those are first-slice values, not final totals. A contact sampler across85 samples from4.15–5.55s measured at most0.001 authored unit between the rope and near paw on desktop and0 on mobile. No held whole-body mirror flips exist in that slice. Its held post6.5s placeholder does not establish corrected full-scene locomotion.

The dark-background pose review found the rope too dark; the full pass adds a restrained warm hemp highlight over the dark rope contour. The continued work preserves the full helper/failed-joint-pull/decorated-return story and verifies actual motion after those remaining beats exist.

Final local delivery uses a new unpublished staging version0.1.1, retaining0.1.0 files, because the BFF serves manifest URLs as immutable. An API restart alone would not invalidate the browser's cached packId@version manifest. The author's ignored native scratch directory can remain0.1.0; metadata copies final bytes into0.1.1 and updates the local event default.

## Frozen full-scene revision

The revised native assets preserve the complete28s plot. The knot remains fixed to the composer rim; the rope becomes taut before the composer starts moving at16.2s. Outbound travel ends at19.5s. While fully offscreen, the actors move to the other side so that the return from20.5–23.3s is also a pull. The lead bear releases the knot around23.6–24.1s. Decorations remain briefly, then fade by the end.

Frozen SHA-256 hashes are `d53144c74956e876ccc07740285225dc1c8a807b58a03a731555bd4571e5e2b7` (desktop) and `ac9f8a33e6d40e7b5aec224f47d40bfd62c519e426944423603b73a9bb993758` (mobile). Their sizes are216,933 and216,285bytes. Each contains6 layers,1,253 keyframes and1,968 vertices across static and animated shape values, within the hard512KiB/30layer/4,000key/8,000vertex limits. The approximately212KiB size exceeds the soft200KiB target because separate walking foot tracks and connected hand poses replace the aliased gait. The hard budgets were not raised. Bears use flat fills; the remaining11 gradients belong to lights and ornaments.

Full native360/1280 light/dark captures at2.5/4.5/6/8/10.5/12.7/14.3/16.3/18.6/20/22/24.4/26.2/27.5s are recorded under `tmp/polar-bears-preview/evidence-rope/`. Inspection of the tie, solo exit, paired return, failed pull, loaded pull, leftward decorated return, release and fade found connected silhouettes and visible rope contrast. These are sampled-pose observations, not continuous artistic-motion acceptance. The simple fixture reports319 renderer-host nodes and129 paths, with one composer snapshot and no browser errors.

The read-only full native diagnostic in `tmp/polar-bears-preview/motion-after.json` found finite sorted keys, no held whole-body flips and no repeated same-direction rest waypoints (before:13 desktop/9 mobile). At60Hz it checked573 lead-hand and512 helper-hand samples per variant across the declared grip windows. Maximum rope-to-paw error was0.001 authored unit and taut-span deviation rounded to0. Runtime source hashes are unchanged from the pre-revision snapshot. Source diagnostics do not establish perceived smoothness or frame-rate performance.

## Native playback and lifecycle verification

The normal-speed browser recording in `tmp/polar-bears-preview/rope-motion/native-asset-preview-7a2b3e8ce078/` sampled the real native player without seeking or changing speed, including solo failure/exit, joint effort and return. In the same4–8s comparison window, the maximum lead-paw displacement normalized to60Hz fell from47.78 to2.63 CSS pixels on mobile and from58.16 to7.34 on desktop. Larger exit deltas around8.55s occur after the actor leaves the viewport: its root is atx638 for the360px viewport andx1639 for1280px. The corresponding8.5s screenshots show no bear. These values describe motion, not an artistic-quality score.

The diagnostic rAF interval summary (`frame-intervals.json` beside that report) contains1,518 intervals per viewport: median/p95 approximately16.7ms, maximum33.4ms mobile/33.3ms desktop, and none over50ms. DOM/SVG sampling and concurrent verification browsers affect these measurements; this is not a deployment performance benchmark or proof of perceived smoothness.

After staging the final bytes, `realtime-safety.json` passed27 checks:20 interruption cycles across360/1280 LTR/RTL, six missing-target/reduced-motion/oversized-target poster cases, and actual keyboard editing. `realtime-completion.json` passed four normal-speed28s runs with the real conversation-input fixture in both viewports and directions. Each reached approximately frame1679 of1680 before cleanup, with zero remaining snapshots/containers/players and unchanged draft, selection and focus. There were no browser errors. Native SVG count is311 with129 paths; the real input snapshot contains29 nodes mobile/33 desktop, within the existing300-node cap. Both source audit and runtime budgets passed; the soft byte-target exception is documented above.

The authored poster was also rendered through the actual fallback component at360/1280 in light/dark mode. Sampled inspection found readable round silhouettes, faces, scarves and rope with no clipping. Existing fallback placement differs from the animated composer anchor. No continuous full-scene perceptual review was performed: task4.6 remains open, and recorded video/technical completion do not close it.

## Active local delivery

The selected local pack is now `new-year-polar-bears@0.1.1`, catalog revision `local-polar-bears-897bb53783b6`, served overlay/API revision `local-full-stack-31e12a858be736b1`. Owned Themes and API processes were restarted; Chat and Storybook remain running. The existing authentication and remote Core configuration were preserved. The working preview is `http://localhost:4207/`; reload it, then use **Play polar bears workshop** on the welcome page.

The frontend-proxied themes, client config, celebration catalog,0.1.1 manifest and all three asset requests returned200 with the expected final asset IDs and byte sizes. `full-stack/live-retention-check.json` separately verified both versions' manifest and asset hashes and exact preservation of the served0.1.0 baseline. Original Themes event defaults, including `new-year-default@1.2.0`, are unchanged. Only the local external event `polar-bears-preview` selects the new scene.

The released Themes pack checker still reports the unpublished `interaction-composer-carry-v1` capability as unknown for both retained versions. This is an existing compatibility boundary of this local experiment, not release validation. Strict OpenSpec validation passes. Runtime code was unchanged by this art revision; earlier source/build verification is recorded in `evidence.md` rather than claimed as rerun here. Nothing was committed, published or archived.

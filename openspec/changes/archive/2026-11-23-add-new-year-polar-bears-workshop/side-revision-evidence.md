# Side and lower-corner staging evidence

The user rejected the above-input placement. Desktop now uses the measured side midpoint. For mobile, the user explicitly chose actors below a side corner, retaining the input's size and initial position. This supersedes the top-center placement recorded in the previous rope revision, without changing its drawing or story.

## Baseline and runtime scope

The immutable `tmp/polar-bears-preview/revisions/before-side/` preserves the served0.1.1 assets, authoring source, catalogs and earlier evidence. Runtime changes are limited to an optional `composer-side` null under the existing carrier. Preparation maps its bounded normalized positions to measured composer width/height, compensating for uniform art scale. Snapshot and shared track helpers are unchanged. No per-frame measurement, runtime character animation or app integration was added.

All 37 focused composer-carry tests pass, including existing packs, measured height/scale, RTL, source immutability and malformed optional slots. Validation now checks every supplied easing component rather than only the first dimension. Celebrations Nx typecheck/lint and documentation validation pass. These establish the geometry contract and preservation of input behavior, not visual quality.

## First slice

The first side/corner slice was rendered at360/1280 in light/dark mode through the production player. Desktop tie and effort poses place the bear beside the field. Mobile effort places the bear below the corner. Inspection caught a partially clipped mobile face during tying in the16px-margin simple fixture; the tying pose is being corrected before final acceptance.

The independent `evidence-side/authored-836ba67649a5-slice/report.json` uses the real conversation-input fixture. Desktop bounds are700×114 atx425–1125, leaving155px on the right; the knot and first rope vertex coincide with(1125,460). Mobile bounds are296×114 at(32,403); knot and rope coincide with bottom-left(32,517) within0.00001px. The lead face is visible; the helper is still hidden in this slice and requires full paired-pose verification. There are no browser errors.

Mobile actors temporarily overlap starter-card content below the field. The current local trigger is on the welcome page; these centered-host checks do not establish below-composer clearance for arbitrary hosts with an input at the viewport bottom. Continuous full-scene artistic assessment remains separate from sampled poses and technical completion.

## Frozen full-scene geometry

The corrected tying pose moves the mobile bear inward and limits its lean. The face and ears are visible in the16px-margin fixture at2.5s. Full light/dark captures under `evidence-side/` show the tie, solo failure, helper, joint failure, removal, return, release and departure at360/1280. Desktop helper spacing is tighter so both characters fit the real700px composer layout. The round drawing, compact limbs and rope appearance are preserved.

Final native hashes are `4c8ffc8ca098256d282abe79bd38d8e10be4d66270440a3a9dc5ebfc0dd48141` (desktop) and `737c2bd6a7f9f3408878b6b479cf477bf66ca20e69f8d1b77c17c5c20c7298bf` (mobile), with217,427/216,969bytes. They use7 layers,1,258/1,252 keyframes and46 shape paths, within the existing hard limits. The previously documented approximately212KiB soft-target exception remains; no budget was raised.

`evidence-side/authored-7a671954e024/report.json` verifies the frozen native bytes with the real input in LTR and RTL. Both faces are visible at13.2s and16.1s. On desktop, the helper face's right edge remains within the1280px viewport (1275.91px and1278.63px). On mobile both faces lie below the field. At22.5s the knot follows the copied opposite edge within0.000061px and both faces are visible. Post-untie hidden-rope transforms are excluded from contact assertions because the rope has been released. These observations are sampled geometry and poses, not continuous perceptual acceptance.

`motion-after-side.json` records2,170 rope/paw samples across both variants, maximum error0.001 authored unit, and taut deviation rounded to0. Keys are finite and sorted; no held whole-body flips or repeated travel stops were introduced. Only the intended carry-adapter source hash changed; snapshot/shared track helpers remain unchanged. `npm run verify:changed` passed its affected typecheck, lint and test stages.

## Local delivery and checks

The selected local pack is `new-year-polar-bears@0.1.2`, authored revision `local-polar-bears-34cc6f9e68ab` and served/API revision `local-full-stack-b6799c357fd3f5bc`. Owned Themes and API processes were restarted, preserving existing authentication and remote Core configuration. Chat and Storybook remain running. Reload `http://localhost:4207/` and use **Play polar bears workshop** on the welcome page.

The frontend-proxied themes, client configuration, catalog,0.1.2 manifest and all three current assets return200 with expected byte counts. `full-stack/live-retention-check.json` verifies unchanged0.1.0/0.1.1 bytes and original event defaults. `full-stack/api-retention-check.json` verifies all three manifests and nine assets through Chat/API with exact hashes. The sibling Themes repository remains unchanged. Its released checker reports only the known unpublished `interaction-composer-carry-v1` capability for the three retained local versions; these results do not claim release compatibility.

All27 final safety checks pass against selected0.1.2:20 interruption cycles in360/1280 LTR/RTL, six missing-target/reduced-motion/oversized-target poster cases, and actual keyboard editing. There are no browser errors.

All four final normal-speed28s completions pass at360/1280 in LTR/RTL (`realtime-completion.json`). Each reaches the end of the native timeline and cleans up the visual copy, carrier container and registered player while preserving the live draft, focus and selection. Native SVG count remains311 and snapshot contents remain29 nodes mobile/33 desktop. These technical completions and the inspected poses do not close the separate continuous artistic-review task4.6.

The full repository gate passed full typecheck and lint, then stopped at the same six pre-existing formatting failures in `celebrations-prompts/README.md` and the README files under9224-s5-themes,9225-s6-overlay,9226-s7-scenes,9227-s8-rollout and9960-defects. These files were not changed by this task. The full-repository test stage therefore did not run; affected tests and37 focused adapter tests passed separately. The format log is `tmp/agent-logs/2026-11-23T15-08-33-855Z-format-check.log`. Strict OpenSpec validation and `git diff --check` pass. No commit, publication or archive was performed.

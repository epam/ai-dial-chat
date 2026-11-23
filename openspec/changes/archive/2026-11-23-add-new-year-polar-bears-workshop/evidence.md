# Local prototype evidence

Baseline: Chat `dd37ad783`, local branch `feat/new-year-polar-bears-workshop`.

## Runtime and contracts

- Focused Nx verification: 63 tests passed across the new carry adapter and existing Cat, snapshot and capability suites. Celebrations typecheck and lint passed (existing lint warnings remain).
- Source review: authored x travel and the snapshot share the existing playback clock; the live input is only hidden with cancellable opacity. The snapshot remains inert and has a 300-node limit. Cached JSON is copied before fitting. CSS individual transforms and transformed ancestors are rejected before copying.
- `npm run validate:docs` passed. Main spec-reference validation passed with zero errors and 173 existing warnings. The new OpenSpec change passes strict validation.

## Representative art slice

Initial native-player snapshots at 3, 4.5 and 6 seconds were inspected at 360 and 1280 CSS pixels in light and dark. The first version had readable character art but insufficient effort: upright torso, long straight forearm and a relaxed face. The requested correction was a lowered center of mass, distinct elbow and hooked paw, a tense face, and a stronger released reaction before extending the story.

The initial native render contained 236 SVG nodes and 62 paths, with one snapshot. These are initial-slice measurements, not the final decorated scene's totals. Capture scripts seek both the Lottie animation and its WAAPI companions to the same time; seeking Lottie alone would not provide valid contact evidence.

## Scope of evidence

Local preview files, native assets, metadata refresh helper, screenshots and browser reports live under ignored `tmp/polar-bears-preview/`. The existing Storybook server is used, with production LottieScene and the real composer fixture available. This is not a deployed pack.

The original Themes checker accepts the initial pack's hashes, paths and structural limits but reports the new experimental capability as unsupported. No Themes validator, published version, index or deployment policy was changed. Publication requires a separate compatible runtime/checker rollout and delivery-path verification.

## Final checks

Final local catalog revision: `local-polar-bears-a465eec67bd0`. Desktop JSON is 159,458 bytes, mobile JSON is 159,390 bytes; both contain five layers, 55 native path shapes and 930 authored vertices. Desktop has 1,064 keyframes; mobile has 1,061. Both are 28 seconds at 60 fps and have the same 14-key carrier with an offscreen maximum of 1000 and a return to zero. The poster is 3,593 bytes.

Native SVG rendering uses 381 nodes and 105 rendered paths. The real composer copy has 29 nodes on mobile and 33 on desktop, within the 300-node cap. The 320-node art target was exceeded because of articulated paws, garland and baubles; the 800-node hard ceiling is satisfied. The below-200-KiB and below-12-layer targets are satisfied.

The full-story predecessor `bb2ae99dd9f6` passed four normal-speed real-composer runs at 360/1280 in LTR/RTL and 27 safety checks: 20 cancellation cycles, six poster/fallback cases and a real keyboard edit. Reports retain their exact revision. The final revision changes entrance pacing and a neutral walking-pose hold; carry, decoration and runtime are unchanged. The current `realtime-completion.json` records two complete final-revision runs at 360/1280; `capture.json` records final-revision light/dark pose captures at both widths. Focus, draft and selection remain unchanged; snapshots and registered animations are removed at completion. Normal-speed browser runs prove finite playback and cleanup; visual inspection is of rendered poses, not a claim of a human continuous-video review.

The second visual pass caught a long invisible approach and premature crouching during the return with the helper. Authored waypoints now show the helper approaching by 10.5 seconds, and neutral pose keys hold the walking stance until the grip. Copies and artwork move together after waiting for the actual shared-clock start before seeking. Real-composer reveal frames were also inspected.

- `npm run verify:changed`: passed affected typecheck, lint and tests.
- `npm run build:quiet`: passed affected builds.
- `npm run verify:full`: full typecheck and lint passed; formatting failed on six existing, untouched `celebrations-prompts/**/README.md` files, so the full-test stage was not reached. The existing prompt files were not reformatted as part of this scene.
- `git diff --check`, documentation validation and strict change validation passed.

All measurements are from local development Storybook and may overlap other verification work. They establish structural bounds and lifecycle correctness, not deployment CPU/latency performance. Publication and delivery-policy acceptance remain outside this local prototype.

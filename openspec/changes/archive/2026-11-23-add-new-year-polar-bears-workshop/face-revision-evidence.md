# Bear face revision evidence

The user rejected the faces in local version 0.1.2. The preserved baseline is `tmp/polar-bears-preview/revisions/before-face/`; the accepted desktop side/mobile lower-corner staging remains in place.

## Observed drawing defects and correction

At actual scene size, frontal eyes conflicted with the strongly offset profile nose. The outlined muzzle and long smile/frown read as a separate mask. The scratch author's path parser connected two intended eyebrow subpaths into a continuous forehead line, and the eyes' transform shifted them toward the muzzle.

The revised face aligns the eyes, compact unoutlined muzzle and small rounded triangular nose. A short animal mouth replaces the broad human-like smile/frown. Neutral brows are absent; effort uses two separate restrained strokes and a mild eye squeeze around stable centers. Surprise uses a small open mouth. Whole-face gaze movement is reduced from 8 to 3 authored units. The poster uses the same facial treatment.

Native scene captures at 2.5, 4.5, 5.85, 6.3, 12.7, 14.3 and 24.4 seconds are under `tmp/polar-bears-preview/evidence-face/`, at 360/1280 in light and dark mode. Inspection of neutral, tie, effort and surprised poses found consistent feature placement, separated eyes/nose and no connected forehead line. These are sampled-pose assessments, not user acceptance or a continuous full-scene artistic review.

## Scope and budgets

Removing only the named `face` subtree from each new native composition yields data identical to version 0.1.2. Head silhouette, ears and transforms, body poses, paws, rope, carrier and side/corner binding are unchanged. Runtime source hashes are unchanged. The raw authoring scratch helper remains outside Git; authored JSON is the delivered source.

Frozen native hashes are `52300e2d95f68f609048a07c8fd80d951cdeabbf184e9c9a5da3616128496d88` (desktop, 219,564 bytes) and `b144e201c7b282008d562f17da26b1876f4a9aa2d073d16bb2aca90a27eb5dc9` (mobile, 219,106 bytes). The poster is 2,798 bytes with hash `f0adb88e2d38a7c6c402e89ca9b65a1d0fb885fe54a067b8c2f5471af78cd4a8`. The simple fixture reports 333 renderer-host nodes and 133 paths, with one snapshot and no browser errors. Additional small face shapes replace the joined eyebrows and stabilize eye centers; no performance limit was raised.

The actual fallback component was inspected in all four viewport/theme cases. `evidence-face/poster-report.json` and its screenshots record readable faces, no clipping and zero browser errors. Existing poster sizing/placement is unchanged. This asset-only correction does not require repeating the prior repository gates; their outcomes remain recorded in `side-revision-evidence.md`.

The final source audit records 7 layers, 1,276/1,270 keyframes, 1,887/1,895 vertices and 52 shape paths for desktop/mobile. The native renderer contains 325 SVG elements and 133 paths. This exceeds the soft 320-node target by five elements because the facial features now have separate shapes and stable eye pivots; the 800-node hard cap and all other hard budgets remain satisfied. The previously documented soft byte-target exception also remains. The face-only invariance and runtime hashes are recorded in `tmp/polar-bears-preview/face-scope-check.json`.

## Local delivery and lifecycle

The selected pack is `new-year-polar-bears@0.1.3`, authored catalog revision `local-polar-bears-2a175dd4db46` and served/API revision `local-full-stack-2be7a9d99eae880d`. Owned Themes/API processes were refreshed while preserving existing authentication and remote Core configuration. The current preview is `http://localhost:4207/`; reload and use **Play polar bears workshop**.

The frontend-proxied themes, client configuration, catalog, current manifest and all three current assets return 200 with the expected IDs and sizes. Live retention verifies all four versions and preserves the exact earlier manifests/assets and original Themes defaults. The sibling Themes checkout is unchanged. The unpublished carry-capability compatibility boundary remains; this revision does not claim release validation.

All 27 final safety checks pass against version 0.1.3, covering interruption in mobile/desktop LTR/RTL, fallback, reduced motion and actual keyboard editing. There are no browser errors. Earlier source tests are not presented as rerun for this face-only change. No commit, publication or archive was performed.

Both final 28-second native completions pass at 360/1280 in LTR, with restoration of draft, focus and selection and no remaining copy or registered player. The unchanged staging was already checked for full RTL completion in the preceding revision; this revision reruns RTL interruption checks rather than claiming a repeated full RTL run. Strict OpenSpec validation and `git diff --check` pass. Continuous full-scene artistic review remains open as task 4.6; the current visual findings come from the explicitly inspected face poses and poster.

# Joint-pull weight and decoration evidence

The user requested a small first joint displacement, a slow accelerating second pull, and a more contemporary garland/bauble design. The version 0.1.3 baseline is preserved under `tmp/polar-bears-preview/revisions/before-tug-decor/`. This revision changes authored assets; the runtime and snapshot adapter remain unchanged.

## Motion change

The first joint pull starts at 12.85s, after rope slack has been removed, and reaches a small displacement at 13.35s. It settles slightly by 13.7s, then holds that displaced position until 15.8s. The second pull uses one accelerating cubic through 19.5s, without intermediate braking while the composer is visible. The hidden pause and return at 20.5–23.3s retain the previous timing and final original position.

Both bears now take bounded authored steps under the accelerating load. The first draft's fully planted foot compensation visibly separated one foot from the compact body at 13.2–13.35s. The correction limits the combined compensation to ten local units, preserving the connected silhouette. The first nudge also exposed a desktop margin issue with the real 700px input: the helper face reached x1292.14 in a 1280px viewport. Its desktop home/grip positions were moved inward by 15 units; the mobile staging and face drawing are unchanged.

The initial normal-speed diagnostic observed a 9.72px mobile / 15.97px desktop nudge, a 1.08px / 1.77px settling movement and zero velocity during the hold. Average velocity over successive thirds of the second pull increased from 17.10 to 80.10 to 187.76px/s on mobile, and 42.48 to 198.99 to 466.44px/s on desktop. These initial measurements belong to the explicitly recorded first-pass asset hashes, before the foot and helper-margin corrections. Final selected-byte evidence is recorded separately below.

## Decoration change

The thick repeated green scallops and glossy red/gold balls were replaced by a slim neutral cable, warm light points with small translucent halos and three matte pearl, cranberry and champagne ornaments. Two fine attachment tails meet the input's upper corners. Ornaments use short hanging threads and restrained settling motion. All eleven gradients were removed; no blur or filters were added. The final pause and fade remain unchanged.

Actual-size 360/1280 light/dark reveal frames under `evidence-tug-decor/` show clear input text, visible warm lights on dark and restrained contrast on light. Inspection caught and corrected the initially floating cable endpoints. The three clean ornament shapes and their hang points remain legible. These are sampled-pose/art observations, not a claim of user acceptance or continuous artistic-motion review.

The final real-input joint-pull frame at 13.35s is `evidence-tug-decor/geometry-authored-adeefd816ebc-joint/1280-ltr-light-13.35.png`. The helper face now ends at x1277.14, inside the1280px viewport. Both faces, scarves and compact body contours remain distinguishable. The new near-foot position stays connected instead of reproducing the first draft's detached oval. Mobile first-nudge positions and the corrected faces were also inspected without a new clipping issue.

Final source diagnostics in `motion-after-tug.json` and `tug-scope-check.json` check 2,170 rope/paw samples, with maximum error0.001 authored unit and taut deviation rounded to0. Keys remain finite and ordered, without held whole-body flips, repeated unintended stops or decreases in second-attempt speed. Nudge/tow foot positions remain within23 authored units of their root. Only approved carrier positions, foot tracks, decoration art and the desktop helper's15-unit reposition/derived grip geometry differ from0.1.3. Faces, head/body drawing, side mapping, knot loop and runtime code remain unchanged.

## Verification scope

Source and browser checks distinguish carrier displacement/velocity, rope contact, connected foot poses, facial/staging invariants, resource budgets and lifecycle restoration. Final normal-speed browser sampling uses the selected version after publication to the local overlay. No repository source changes or repeated unrelated full-repository gate are needed for this asset-only revision. Earlier repository gate outcomes remain in `side-revision-evidence.md`.

## Final0.1.4 verification and user feedback

Selected-byte native evidence is `evidence-tug-decor/motion-adeefd816ebc/report.json`, with videos and exact captured native JSON beside it. Requests used the selected catalog without interception. It confirms a9.72/15.966px nudge,1.08/1.774px settlement and zero hold velocity. Second-pull velocity over successive thirds rises17.10→80.10→187.76px/s mobile and42.49→199.00→466.45px/s desktop. Maximum knot error is0.000122px. Median rAF interval is16.7ms, p95 is16.7/16.8ms and maximum16.8/50ms. These concurrent local diagnostic readings are not a deployment FPS benchmark. No browser errors occurred.

Final JSON hashes are `a7c2185df996d3ae0d7a7d2a02ff92ffc56e4cce22ea472209d3acc971583566` (desktop,243,819bytes) and `576cebdd81d989b0e7734b24c5f1fc4bf3b0b25d78817f8c7e69143f93d2ea73` (mobile,230,405bytes). Both have7layers and44shape paths, with1,585/1,409keys and295 rendered SVG nodes. The soft200KiB byte target is exceeded because of the bounded load-driven foot keys; all hard budgets are preserved and gradient removal lowers renderer node count. Poster size is2,879bytes.

Version0.1.4 is served with catalog `local-polar-bears-ace459cc4c26` and API revision `local-full-stack-c35569a8219ab59d`. Current manifest/assets and frontend configuration return200; all five local manifests and fifteen assets are retained with exact hashes. Two full28s native completions at360/1280 LTR and27 safety/fallback/RTL-interruption checks pass, with restored input state and no remaining copies or registered players. Source/runtime code is unchanged.

The user subsequently explicitly accepted the bears and scene but rejected the garland as unnatural. This is user acceptance of the character/story/motion result, not acceptance of the decoration and not an assistant claim of continuous artistic review. The selected next direction is a flexible wire with soft sags and small volumetric bulbs. Task group8 tracks decoration-only work against the accepted0.1.4 scene baseline.

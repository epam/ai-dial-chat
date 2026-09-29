# SVG Character Quality

Use when creating or artistically improving celebration characters. An easing-only change does not need this reference. Motion, lifecycle and scene-wide budgets remain in the main skill and [motion quality](motion-quality.md).

## Choose an achievable visual result

Inspect the current character at actual mobile/desktop size, on the host's light/dark backgrounds, in a neutral pose and key gesture. Enlarging an SVG reveals contour defects but does not establish in-product readability. Without visual access, distinguish source-based hypotheses from observed defects.

If the user asks for more realism without specifying a style, propose stylized realism: plausible proportions, volume and materials with an expressive silhouette. This is not mandatory for every event. Preserve the approved cartoon style, palette and personality; an artwork request does not imply changing the plot.

References can guide shape and lighting. Raster concept generation is a separate option when a concept image is requested. Edit vector sources for an existing SVG; do not automatically install a generator or produce a PNG. A bitmap embedded in `<image>` is not an editable vector character.

## Build from silhouette to detail

- **Silhouette and pose:** distinguish head, body, arms and the main prop in a single-color silhouette. Separate accidental contour tangencies. Gaze and action direction must read at scene size.
- **Proportions and joints:** keep upper-arm, forearm and hand lengths consistent; inspect elbow bends and neck/body connections in working poses. Deliberate exaggeration is valid; accidental limb-length changes are defects. Slight joint overlap prevents animation gaps.
- **Face and hands:** use a few readable shapes to establish nose, eyes, brows and mouth. A hand should explain the grip or gesture; every finger need not be drawn. Extra strokes that disappear at small sizes do not repair weak expression.
- **Contours:** use smooth curves for bodies/fabric and intentional angles for folds and distinctive details. Remove accidental kinks and unnecessary points. Stroke weight and contrast support volume and hierarchy rather than emphasizing every seam equally.
- **Materials:** fabric folds follow tension, support and gravity; a hat needs a readable brim, thickness and bend; a broom needs a shaft, binding and bristle mass. Add detail only when it clarifies form or material at the final size.

## Lighting and volume

Choose a consistent light direction. Separate light, midtone and shadow with broad shapes; use gradients where they explain curvature. Shadows beneath a brim, chin or arm communicate overlap and depth. Highlights follow the material and form rather than appearing identically everywhere.

Prefer a few static shadow paths and simple gradients. Glow and blur cannot repair flat proportions or incorrect form. Check tonal separation of face, clothing and background across host themes; important gestures must not depend solely on hue. Artwork must preserve the readability of borrowed controls.

## Keep the drawing animatable

- Group only parts with independent motion, such as body, arm, head, hat, cloak or broom. Static details follow their parent part; each path does not need its own animation.
- Preserve animation selectors, `data-*` hooks, stacking order, `viewBox` and pivots, or update their consumers together. Moving a palm changes a spell origin; changing a broom changes its contact point. Verify geometry after nested transforms and character mirroring.
- Keep shading inside the corresponding material group. A raised arm must carry its shadow; a turned head must remain attached to its hat. Test the extreme poses used by the scene.
- Gradient, mask and clipPath IDs must be unique among mounted instances. Use the existing stable-ID mechanism or React `useId`, updating `url(#...)` references consistently.
- SVG optimization must preserve the groups, IDs and coordinates used by animation. Merge paths/groups only after checking their consumers. Preserve decorative accessibility and the static reduced-motion composition.

For Witches, useful criteria include distinct apprentice/mentor faces, readable hands, volumetric hats and cloak folds within the same lesson story. Recheck palm → spell, broom → button and extreme reaction poses after redrawing. This is a verification example, not a design every event must repeat.

## Artwork budget

Before implementation, record a measured baseline and scene-specific numerical limits: SVG nodes per character and across the cast, path count and `d` complexity, gradients/masks/filters, independently animated groups, SVG size or event-module growth. Count segments for complex paths: one path containing thousands of commands is not cheap merely because it uses one DOM node. Do not turn example budgets into universal limits or silently raise approved limits.

Avoid unbounded hair/bristle/texture strokes, nested expensive filters and per-frame `d` changes for detail. Prefer static geometry and CSS/WAAPI transforms of existing groups. Masks, filters and large effect regions need separate cost evaluation; small file size does not guarantee cheap rendering.

Compare before/after profiles with the same scene, viewport and CPU conditions, including mobile. Measure style/layout/paint and frame intervals alongside JavaScript: SVG transforms do not guarantee GPU-only work. If over budget, simplify details invisible at actual size while retaining silhouette, expression, contact and plot. Record results and measurement limitations in OpenSpec verification.

## Verify the result

Choose observable criteria before editing: the hand stays attached throughout the working range; the face reads on both backgrounds; the brim shadow matches the light; spell contact has not shifted. “Looks more premium” is not sufficient.

Compare actual-size mobile/desktop views and enlarged contours. Inspect the key gesture, contact and extreme pose, then normal playback: an attractive still drawing can fail in motion. Check RTL, multiple instances sharing gradients/masks, and reduced motion. Fix form/joint defects before adding embellishment.

Separate evidence: visual comparisons establish artistic changes, geometric checks establish contact/connections, and browser measurements establish cost. Report the frames/playback actually inspected and any remaining limitations. Implementation follows `opsx-propose` → `apply`; an audit alone needs prioritized recommendations.

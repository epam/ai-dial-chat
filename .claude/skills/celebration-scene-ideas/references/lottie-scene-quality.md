# Lottie for Celebration Scenes

Use when a new story scene calls for authored vector motion. The existing New Year gift-wrapping scene is a repository example, not a template for every story; inspect its current source before copying a pattern.

## Plan one readable timeline

- Storyboard the complete action first: entrance, gaze and anticipation, contact, UI reaction, hold, resolution, departure and restoration. Give each beat time to read at normal playback speed. The character should not jump between walking, sitting and pushing poses or end a story when a supporting character reaches the main character.
- Prefer one bounded, non-looping Lottie composition for characters and their drawn props. Keep a consistent local coordinate system, shared rig/attachment points and one clock for hands, web strands, stolen copies or other loads. If a real UI snapshot must move outside the composition, derive its timing and contact coordinates from the same plan; avoid two animations that merely start at roughly the same time.
- Draw articulated parts and purposeful pose transitions. A moving whole-body translation is not a walk; show stance changes, foot planting, weight transfer and settling. Give repeated actions their own small variations: target glance, effort, push, prop movement, reaction, look back. Use holds and sparse meaningful Bézier keyframes; dense samples with ease-in-out on every segment can repeatedly brake the motion.
- Design vector shapes at their final on-screen size. Check silhouette, visible facial expression, materials and occlusion on mobile as well as desktop. Native vector artwork does not become realistic merely by being in Lottie. Reuse a small rig; avoid flattening an articulated character into one image or fading entire bodies between poses.

## Fit the repository

- Keep the composition and player scene-local in `libs/celebrations`; `lottie-web/build/player/lottie_light` is already dynamically imported by the gift-wrapping scene. Load it only after that scene is selected. Prefer local vector data without remote assets or raster sprites unless the design calls for them.
- Measure host anchors once before building the composition. Page elements remain inert visual copies or measured supports; the live composer, conversation data, focus and hit targets remain usable. For text-bearing copies, preserve actual direction and content; do not mirror RTL text with character art.
- Use a pointer-transparent, inert decorative host. Reduced motion, unavailable APIs, late/failed import and missing targets need a small static fallback that still conveys the scene. Give player loading and renderer readiness bounded deadlines.
- Treat `complete`, user interruption, navigation, viewport or target change, hidden tab, errors and unmount as cleanup paths. Stop timers and observers, restore any hidden originals, remove copied props and destroy the Lottie instance once. If observing the page for target changes, ignore SVG nodes created by the Lottie renderer itself.

## Budget and verify

Record scene-specific numerical limits for duration, characters, concurrent copies and players, animation data bytes, layers, paths/vertices, generated SVG nodes and keyframes. Reduce cast and copied UI for mobile. Inspect the actual built payload when practical; a JSON file size alone does not describe generated DOM or paint cost.

Use Storybook or the host page to watch full playback at normal speed, then inspect contact frames and repeated gestures. Test desktop, mobile, RTL, reduced motion, missing anchors, repeated activation and interruption during loading and playback. Profile browser frame time, long tasks, style/layout/paint and DOM-node growth while the scene runs. A successful unit test, a pretty still frame or an absence of long tasks alone does not establish smooth or believable motion.

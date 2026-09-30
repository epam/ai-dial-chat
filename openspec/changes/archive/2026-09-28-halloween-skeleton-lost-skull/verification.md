## Automated

- `halloween-skeleton-plan.spec.ts` (14): 21 tracks, ≤ 80 keyframes each, ordered offsets 0→1; beat order launch → impact → catch → place; dancers' feet on the measured edge; free skull appears exactly at the hidden attached skull; outline dips only within 100 ms after a landing/impact; partner hand reproduced from emitted root/body/arm keyframes and the held skull stays `hand + (0, r)` for every 50 ms sample from 7900 to 9400 ms (desktop and mobile), never below the edge once lifted; the turn at 8300 ms keeps the hand on the body axis; catch at the physical corner; RTL mirroring; floor fallback without/with too-high/too-narrow composer; determinism.
- `halloween-skeleton-targets.spec.ts` (9): focused draft only measured once and unchanged; transformed/hidden/filtered/translucent/clipped/aria-hidden rejected; four-candidate bound; RTL read from the composer; anchor-less fallback.
- `halloween-skeleton-animation.spec.ts` (20): draft/focus/selection intact, no geometry reads during playback, 21 animations on one start time, every interruption event, composer mutation/removal/ancestor change/resize, unrelated toast revalidation without polling, partial setup failure, keyframe limit and missing artwork release everything once.
- `HalloweenSkeletons.spec.tsx` + `HalloweenExtras.spec.tsx`: cast, outline, ≤ 100 SVG nodes, unique gradients, no filter/mask/image, RTL layer mirroring, static fallbacks without measurement (reduced motion, no WAAPI, no ResizeObserver), StrictMode single preparation, cancelled preparation, mobile/anchor changes cancel; registration with the 12 s deadline.
- `nx run-many -t typecheck lint test build -p @epam/ai-dial-celebrations`, `npm run validate:docs`, `openspec validate --strict`, `git diff --check`: pass.

## Browser (Storybook, headless Chromium, `tmp/skeletons-lost-skull/`)

- Frames at 1100/2600/5050/5600/6300/7600/7900/8700/9400/9700/10250/11000 ms for 1280 LTR, 360 LTR and 1280 RTL: landings on the composer edge with the outline, jig, launch over the partner with the skull turned to its back, headless panic, teeter and catch at the corner, belly carry, backwards placement, spin, celebration, drop.
- Defect found and fixed from frames: at 10250 ms both skeletons overlapped and raised arms crossed over their heads → partner steps back 36 art units after landing, cheer arms raised to 120°.
- Reduced motion: static headless showman, skull and partner at the bottom edge.
- Natural playback: 21 scene animations, unmounted after ≈ 11.95 s, no long tasks on desktop or mobile at 4× CPU throttling; the only remaining document animations belong to the decor.
- Typing into the composer mid-scene: scene ends immediately with 0 animations, draft `hi` and textarea focus preserved, no snapshots created.

## Limits

- Playwright's `page.screenshot` rewrites the story composer textarea's inline style, which the scene (like Candy) correctly treats as a composer change and cancels; frames were therefore captured with CDP `Page.captureScreenshot` on paused animations.
- Headless development Chromium only; no production-phone profile, frame-time measurement or real `apps/chat` host run. Structural budgets are tested; frame timing is not claimed.

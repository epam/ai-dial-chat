## 1. Scene and interface interaction

- [x] Add the reference-shaped penguin, Santa hat, stationary potted fir, crumpled-paper and star native-vector artwork; stage a direct side entrance, one visual pickup/conversion, star throw, reaction, bow and solo exit.
- [x] Read existing starter/composer anchors, choose one eligible idle control, and animate that original control reversibly to the shared flipper capture point. Keep the no-control decorative fallback.
- [x] Cancel player and borrowed-control motion on completion, user activity, viewport/target change and unmount; preserve reduced-motion/static fallback.

## 2. Integration and verification

- [x] Register `PenguinStar` in the New Year scene pool, host translation and Storybook variants while preserving existing scenes and the confetti secret phrase.
- [x] Assert contact frames, target eligibility, resource budgets, restoration and lifecycle in focused tests; check browser frames at 360, 900 and 1920 pixels in LTR/RTL.
- [x] Record final ordinary-speed browser playback, relevant Nx checks, documentation validation and OpenSpec validation in `verification.md`.

## 3. Align New Year event organization with Halloween

- [x] Move `NewYearScene` to `types/new-year.ts`, collect scene durations, click pool and secret phrase in `constants/new-year.ts`, and route event scenes through `NewYearSceneOverlay`.
- [x] Keep all scene ids, click-pool order, labels, deadlines and the secret phrase unchanged; verify the event overlay, full celebrations suite, typecheck, lint, build and docs.

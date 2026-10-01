# Penguin star verification

Date: 2026-10-01. Local working tree; no commit or archive requested.

## Result

The New Year click pool includes PenguinStar alongside GiftWrapping, Snow, Confetti and Sleigh. The scene now takes one idle starter suggestion, or the model selector when suggestions are unavailable, crumples its visual appearance into a paper ball and star, and throws the star onto a nearby stationary fir. The original control returns on normal completion and interruption. No chat component implementation changed.

The New Year event now follows Halloween's registration layout: scene ids in `types`, deadlines and trigger constants in `constants`, and a single overlay that selects scene artwork. The public event export, scene selection, labels and timing stay the same.

## Checks

| Check | Result |
| --- | --- |
| Focused composition, borrowed-control and component lifecycle tests | Passed. |
| `nx run @epam/ai-dial-celebrations:test` | 66 files, 1,164 tests passed after the event refactor. |
| `nx run @epam/ai-dial-celebrations:typecheck`, `:lint`, `:build` | Passed; lint retains 221 warnings elsewhere in the library, with zero errors. |
| `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.integration.spec.tsx` | Passed. |
| `nx run @epam/chat:typecheck` | Passed, including the celebrations dependency. |
| `npm run validate:docs`, `openspec validate add-new-year-penguin-star --strict`, `git diff --check` | Passed. |

## Browser evidence

Chromium Storybook captures at 360px LTR, 900px RTL and 1920px LTR are in `/private/tmp/penguin-borrow/`. The captured frames show an eligible starter suggestion leaving its original location at 5.1 seconds, approaching the flipper, disappearing into a crumpled-paper layer at 6.7 seconds and becoming a star at 7.6 seconds. The star lands on the fir crown at 10.7 seconds. The scene stayed below the greeting and starter row on the decorative snow stage, with zero page errors and no horizontal overflow. The final composition creates 112 SVG nodes in the Storybook fixture, under the 140-node budget; structural keyframe/data budgets are asserted in the composition tests.

`live-report.json` records ordinary-speed playback at 360px LTR and 900px RTL and a 360px scroll interruption. In all three runs the button moved visibly, returned to identical HTML, computed transform and opacity, retained zero active animations, and the scene unmounted without page errors. This confirms normal and interrupted restoration in a real browser. The report is a functional playback check, not an FPS benchmark.

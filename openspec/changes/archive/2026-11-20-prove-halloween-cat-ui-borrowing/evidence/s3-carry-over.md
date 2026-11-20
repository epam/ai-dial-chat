# S3 carry-over evidence

Covers tasks 1.1–1.5 and spec `celebration-composer-anchoring` ("The external GiftWrapping path has committed browser coverage", "Anchored preparation time is measured under CPU throttling").

## Environment

| Item | Value |
| --- | --- |
| Base revision | `567f111d0`, working tree on `feat/celebrations-s4-cat-borrowing` |
| Browser | Playwright Chromium 156.0.8078.4, headless |
| Machine | Apple M4 Pro, macOS 26.6.2, Node 24.14.0 |
| Assets | `new-year-default@1.1.1` GiftWrapping desktop (`28260bbc…`), mobile (`3d541976…`) and poster (`964179e2…`), byte-identical to `epam/ai-dial-chat-themes` `origin/development` (#182) and asserted by `libs/celebrations/src/stories/tests/external-fixtures.spec.ts` |
| Runner | `npm exec nx run @epam/ai-dial-celebrations:test-external-gift-wrapping-browser` (`libs/celebrations/browser-tests/external-gift-wrapping.browser.spec.mjs`) |

## Behaviour checks

All pass.

| Check | Result |
| --- | --- |
| Slow load (4 s, past the 2 s deadline) | Poster within 3.5 s, no renderer inserted |
| Broken load | Poster within 2 s, no renderer inserted |
| Cancellation during loading (key at 300 ms) | Nothing renders, through the 4 s late resolution and the deadline |
| Cancellation during playback (key at 6 s, then a replay cancelled at 1 s) | Renderer and anchor removed within 500 ms, draft, focus and composer rectangle unchanged, and window+document listener counts equal across both activations |
| Cached replay at 1280 px, then at 520 px | One data request. The outline traced each composer (560 px, then 488 px). "Check cache" reports the cached clip equal to the pinned asset |
| Contact frames: 360/390/1280/1920 px × LTR/RTL, plus `stage-anchor` at 1280 and 390 px | The stage stays on screen in every captured frame. Every composer cell has a frame where a rendered path traces the composer with insets of 3/−1/3/3 px (left/top/right/bottom, the top bow included). Both fallback cells report `data-celebration-anchor="stage-anchor"` |

Frames are in `tmp/celebrations-baseline/567f111d0-wt-000162bc/external-gift-wrapping/<cell>/{01800,04500,08700,13300,15400}ms.png`, together with `contact-frames.json`. They are Git-ignored and attached to the #9223 comment listed below. A reviewer checks the feet on the composer's top edge in those frames.

## Preparation timing (4× CPU throttling, 20 runs, style invalidated before each run)

Capture `567f111d0-wt-fbb4dd5a`. The case is `prepareAnchoredSceneData` on the live story composer: measurement, private copy, root re-basing and outline fitting.

| Variant | Width | First run | p50 | p95 | Target |
| --- | --- | --- | --- | --- | --- |
| Desktop | 1280 px | 8.5 ms | 5.2 ms | 8.5 ms | ≤ 50 ms ✅ |
| Mobile | 390 px | 8.9 ms | 5.7 ms | 8.9 ms | ≤ 50 ms ✅ |

## Findings

- **F1. Playwright's `page.screenshot()` cancels scenes in mobile-emulated contexts.** It re-applies the device metrics, which resizes the visual viewport, and anchored scenes cancel on that resize, as they should. The new spec captures frames through CDP `Page.captureScreenshot` (`captureFrame` in `libs/celebrations/browser-tests/storybook-harness.mjs`). It also asserts that the stage is still present in every frame, so a silent cancellation now fails the test. The S0 baseline (`celebrations-baseline.browser.spec.mjs`, "frames" pass) still uses `page.screenshot()` on its `mobile390`/`mobile360` cells. Its mobile frames after the first capture may therefore show an already-cancelled scene. That is out of scope here, and it is recorded as a follow-up for the baseline owner.

## Binary evidence

_To be linked: comment on #9223 with the frame archive (task 1.5)._

## Context

Portal owns reversible row animations but omits input events. Train observes only source removal. Web retains target rectangles without target identities. All three already own stop callbacks that release their effects.

## Goals / Non-Goals

Restore borrowed elements and stop stale geometry immediately after relevant events. Preserve uninterrupted stories, durations, fallbacks, notification text and inert artwork. Keep host-owned integration at the existing anchors boundary; no new public API, app imports, routing, storage, strings or telemetry.

## Decisions

Use one internal `observeSceneTargets` utility, modeled on Cat's filtered MutationObserver and Witches' ResizeObserver. It accepts selected DOM elements and a stop callback. Watch relevant attributes/content, and compare cached rectangles only after structural mutations or resize notifications. Ignore scene-owned changes and unrelated mutations that do not move targets. Disconnect both observers before calling stop, and expose idempotent disposal for normal scene cleanup.

Web target selection optionally collects the selected element identities while retaining its existing rectangle return shape and bounded traversal. Pass those elements into canvas playback so its existing stop callback owns disposal, including natural completion. Portal and Train use their already-selected originals. Add all four input events to Portal's symmetric listener lifecycle.

Alternatives: three copied observers would duplicate subtle filtering/cleanup rules; continuous geometry polling would add layout cost each frame. Neither is needed for this fix.

## Budgets and unchanged story

Portal retains two row copies and its 9-second borrowing/10-second provider lifetime. Train retains one passenger source and its 11/12-second lifetimes. Web retains at most 12 target rectangles, 54/80 mobile/desktop spiders, 30 draws/second, one canvas frame chain and 14-second lifetime. Add at most one mutation observer and one resize observer per affected scene, observing at most 12 target elements. Add zero animations, keyframes, particles, snapshots or per-frame layout reads. Missing targets keep existing decorative fallbacks; reduced motion keeps static artwork. No frame-rate promise is inferred from these structural limits.

## Risks / Trade-offs

- Self-cancellation from scene DOM changes → ignore the scene layer/owned roots and verify replay in a real browser.
- Unrelated toast removal → only cancel structural changes when cached target geometry actually changes.
- Mutation callbacks do not cover every possible compositor-only position animation → explicitly cover target/ancestor attributes, structural layout changes and target resizing, without polling.
- Optional ResizeObserver unavailable → mutation cancellation still works and resource cleanup remains safe.

## Verification and rollout

Regression tests cover pre-focused typing/IME, source and ancestor CSS changes, source removal/resize, irrelevant mutations and observer disposal. Browser verification covers the three fixes at 360/900/1280/1920 widths, mobile without history, RTL, reduced motion and unchanged normal playback; inspect geometry-read activity between mutations. Run library checks and repository verification commands, recording unrelated baseline failures. Update the README in the same commit. No migration; rollback is a revert.

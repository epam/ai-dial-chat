# Footprints verification

## Implemented behavior

The twelve-second invisible-cat story is implemented through a private target selector, immutable plan, finite playback owner and dedicated SVG component. One safe starter copy takes the contact dips, sitting weight and departure rebound. The face peers over the open side and lands beside the near composer corner. The existing scene registration, provider lifetime, trigger, notification, anchors and public API are unchanged.

SVG work adds asymmetric toe pads, a three-lobed pad, restrained highlights, separate pupils, blinking eyes and a delayed grin. The real-size mobile browser pass found overlapping starter labels; the face and landing geometry were corrected before completion. No bitmap assets or filters were added.

## Bounded structure

| Resource | Mobile | Desktop | Ceiling |
| --- | ---: | ---: | --- |
| Prints | 8 | 12 | 8 / 12 |
| Owned animations, including source opacity | 15 | 19 | 20 |
| Artwork SVG nodes | 67 | 95 | 80 / 110 including copied icon |
| Snapshot | 1 | 1 | 240×96px, 40 descendants, 12 SVG nodes |
| Unique SVG paths | 9 | 9 | 485 characters / 59 commands; below 2KiB |

No per-frame JavaScript loop, layout measurement or React state update is present. All tracks animate transform/opacity and share one clock. Copy and attached-print frames/pivots are identical. Reduced/unsupported motion uses three static prints and one face without target discovery.

## Browser evidence

Local Chromium Storybook at port 3005; scripts and PNGs are in ignored `tmp/footprints-implementation/`. The pre-change audit is in `tmp/footprints-audit/`.

- `verify.cjs` / `verification.json`: 360, 900, 1280 and 1920px; RTL at 360/1280; native reduced motion; missing anchors; repeat interruption. Tests rendered card/print bounds and transforms, exact return and opaque handoff at 10320–10800ms, scene budgets, no overflow, unchanged copied text and clear starter labels in resting/final poses.
- `natural.cjs` / `natural.json`: natural playback at 360/1280 on default light and injected dark test palettes. Frames at approach/contact, sitting, jump and last grin; natural cleanup confirmed at 12.4s. Dark palette is a local contrast fixture, not a claim about every host theme.
- Inspected real-size before/after frames, mobile resting face and desktop contact, plus final dark desktop sitting frame. The new pads retain readable separation without the old glow; the final grin remains visible near the deadline instead of disappearing around 9.4s.
- `profile.cjs` / `profile.json`: eight-second active-phase trace (scene seconds 1–9) on 360px CPU ×4 and 1280px CPU ×1. Both: 7 setup geometry reads, no setup long tasks, 0 steady geometry reads and 0 long tasks. Native paint/style/layout work is measured, not assumed to be GPU-only. Mobile traced totals: paint 69.609ms, layout 28.783ms, style updates 295.646ms; desktop: paint 18.515ms, layout 6.202ms, style updates 107.027ms.
- A second profile without tracing uses the same instrumentation as the baseline (`profile-comparable.json`): p95 frame interval 9.1ms on both mobile/desktop, versus 9.2/9.1ms before; no long tasks or steady geometry reads in either version. Total native layout over eight seconds changed from 10.717 to 34.210ms on mobile and 16.128 to 12.968ms on desktop. The additional card/face motion has a measurable native layout cost on mobile, within this local frame sample; it is not claimed to be free or universally faster.

These are local headless development measurements including the story fixture and Halloween decoration. They do not establish device FPS or production-phone performance. Reduced motion and lifecycle tests provide separate correctness evidence.

## Automated checks

- Geometry/target slice tests passed. First `verify:changed`: affected types and lint passed; backend tests could not bind local HTTP servers in the sandbox.
- Playback tests passed. An escalated affected lint attempt exhausted the default 4GiB Node heap; retry with 8GiB passed affected types/lint.
- Escalated `verify:changed` then reached all affected tests: celebrations passed; existing attachment-canvas raw/gzip/unpacked budgets failed (65617/17097/243202 versus 57000/16000/230000), and backend `app-config.service.spec.ts` failed the undefined refinement-model availability case. Those files were not modified.
- Focused final suite: 75 tests passed across six files, including scene integration, plan/target/playback, Storybook coverage and Halloween event integration.
- Nx celebrations typecheck/lint/test/build passed. Documentation validation passed (49 markdown files and install matrix).

## Five-axis self-review

- Correctness: contact precedes reaction; copy stays opaque until source restoration; all effects stop idempotently on input, focus, scroll, resize, source changes/removal, hidden documents, environment changes and unmount. Partial setup failures, deferred cancellation and StrictMode have regression coverage. Draft, focus and selection are preserved.
- Readability: artwork, pure plan, bounded target selection and playback ownership are separate private modules. Lifecycle patterns follow Witches; no unrelated shared-engine refactor is included.
- Architecture: explicit library-isolation check passed. Host integration uses existing anchors/environment; no app routes, flags, contexts, APIs, storage or dependencies entered the library. No public-export or structural architecture-map change.
- Security/accessibility: inert, aria-hidden, pointer-transparent copies/artwork; no input submission or navigation. No new external assets or dangerous markup API.
- Performance: caps apply before snapshots, including copied SVG icons; only transform/opacity tracks; trace/profile and repeated cleanup evidence above.
- Responsive/docs: mobile story, RTL physical geometry and reduced/unsupported motion covered. README matches implemented behavior; documentation validator passed.

## Final verification and verdict

- Exactly one `npm run verify:full` invocation: all typecheck and lint tasks passed; formatting stopped the chain on the unchanged `apps/chat-api/README.md`. The full-test stage therefore did not run; the completed affected-test run above is the broad test evidence. No unrelated formatting or backend/budget fixes were made.
- `npm run build:quiet`: passed affected builds (69 tasks, 52 cached).
- Final Nx celebrations `typecheck`, `lint`, `test`, `build`: passed after the copied-icon/clipping guard. See `tmp/footprints-implementation/nx-final.log`.
- Changed-source Prettier check, strict OpenSpec validation and `git diff --check`: passed.
- `npm run validate:docs`: passed; README and public API remain consistent.
- Five-axis verdict: approve with recorded repository-baseline failures outside Footprints. No required finding remains in this scene. Measurements cover local Chromium fixtures, not all host themes or physical devices.

## Embedded-host regression follow-up

The initial browser verification used starter buttons above the composer. The real `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx` renders `ConversationInput`, then intro text and the starter children. The original one-sided eligibility condition (`card.bottom + 8 < composer.top`) incorrectly rejected every ordinary starter in that order. This was a coverage gap in the earlier completion claim.

- Eligibility now allows a visible starter on either side of the composer while retaining the 8px separation and all copy/visibility budgets. Ranking uses the distance to the nearest composer edge so cards below are not penalized by the composer's height.
- Added a red/green regression: both below-composer LTR/RTL cases failed before the fix and pass afterward. Added overlap/edge rejection and unbiased nearest-target tests.
- The main Footprints Storybook story now uses composer-before-starters order. A separate FootprintsStartersAbove story retains the original host variant; coverage asserts both exist. Other scenes keep their current default fixture layout.
- `tmp/footprints-host-fix/verify.cjs` and `verification.json`: eight browser cases, 360/900/1280/1920 plus mobile/desktop RTL and above-composer alternatives. All select a real fixture card, maintain identical copy/print bounds and transform, restore exactly at handoff, and clean up when typing without losing the draft. Natural contact and sitting screenshots were inspected at mobile/desktop sizes.
- Owned animation counts remain 15 mobile / 19 desktop; this fix adds no animation track, frame loop, snapshot or dependency. Library isolation is unchanged: targets still use caller-provided anchors only.
- Focused selector/plan/story suite: 21 tests passed. Docs and strict OpenSpec validation passed.
- The real local frontend at `http://localhost:4207` redirects the isolated test browser to sign-in. Authenticated application playback was therefore not verified; the regression fixture reproduces the component order proven by the host source. No authentication configuration was changed.
- The user's local Footprints-only `HALLOWEEN_CLICK_BURSTS` override was present before this follow-up and is preserved.

Follow-up checks: 53 targeted tests passed across five files (selector, plan, playback, component and story coverage). Nx celebrations typecheck/lint/build and documentation validation passed. Affected typecheck/lint passed; affected tests still fail the previously recorded attachment-canvas/backend cases plus six scene-pool assertions caused by the existing Footprints-only debug override (celebrations: 820 passed, 6 failed). The override was preserved instead of broadening this fix.

The five-axis follow-up review found no remaining defect in this correction: eligibility uses geometry without host coupling; copy safety and resource limits are unchanged; both component orders and RTL have regression evidence. Authenticated real-app playback remains an explicit verification limit above. The previously recorded single full-verification run is retained; the reopened bugfix slice used fresh affected and scoped checks.

All seven apply tasks are complete. The change remains unarchived; no commit or push was requested.

## Composer-only follow-up

When no eligible starter exists, Footprints now uses the visible composer's top edge. Attached paws and an empty decorative outline share a transform: 1.5px contact dips, 3px sitting weight and a small departure rebound. The walking span is bounded to 144px; the face jumps toward the opposite corner. Composer discovery no longer requires a starter-list anchor. Unsafe geometry retains the decorative route.

The live composer is only measured: no input subtree copy, source-opacity animation or transform is applied. Its corner radius comes from the existing preparation-time style cache. The outline adds one empty `div`, with no additional SVG nodes, filters, frame loop, dependency or public API. Library isolation remains unchanged.

- Dedicated target/plan/playback/component and Storybook coverage: 60 tests passed across five files. New cases cover a focused draft without a starter anchor, insufficient headroom, contact-before-reaction, shared geometry, empty outline rendering, unchanged draft/focus/selection and input cleanup.
- `tmp/footprints-composer/verify.cjs` / `verification.json`: 360/900/1280/1920px, mobile/desktop RTL and reduced motion via Storybook's motion override. All six moving cases preserve the exact live composer DOM, bounds, draft, focus and selection; no input copy or live-control animation exists. Rendered paw centers stay attached to the translated outline, with 13/17 animations and 67/95 SVG nodes. Typing and resize remove the outline, and reduced motion has no outline or animation.
- Natural screenshots at 3500/8200ms on mobile/desktop were captured with the caret retained. Inspected mobile contact/resting and desktop contact at actual size. The input remains visible and its text is unobscured.
- Existing `tmp/footprints-host-fix/verify.cjs` reran successfully: eight above/below-card, responsive and RTL cases retain the previous 15/19 tracks, exact contact/handoff and typing cleanup.
- `tmp/footprints-composer/profile.cjs` / `profile.json`: local Chromium after broad checks finished, scene seconds 1–9, 360px CPU ×4 and 1280px CPU ×1. Both have zero steady geometry reads and zero long tasks. P95 frame intervals were 9.2ms in both cases, with 13/17 animations and natural cleanup after twelve seconds. Native layout remains measurable (31.549/6.467ms over eight seconds); these development-fixture samples do not establish production-device FPS.
- Scoped Nx celebrations typecheck/lint/build, documentation validation, changed-source Prettier, strict OpenSpec validation and whitespace checks passed.

Five-axis follow-up review: the private surface plan preserves the existing card track/handoff, while a composer outline owns no live-source animation. Eligibility and teardown remain bounded, focused drafts are allowed without changing input semantics, and artwork remains inert and pointer-transparent. No new host coupling, public contract, dependency or accessibility control was introduced. The README and composer-only Storybook variant describe and demonstrate the actual fallback. No required finding remains in this slice; authenticated real-chat playback retains the login limitation recorded above.

Fresh affected verification passed typecheck and lint. Tests reached all 35 affected projects: 72 tasks passed, with the same three failing targets recorded before this slice. Attachment-canvas still exceeds its three package budgets; chat-api still fails the undefined refinement-model availability case (4063 passed / 1 failed). Celebrations has 827 passed / 6 failed, all six failures caused by the preserved Footprints-only debug scene pool. No new Footprints test fails. Full logs: `tmp/footprints-composer/affected.log` and `tmp/agent-logs/2026-09-27T20-54-54-810Z-test-changed.log`. The existing single full-verification run was not repeated.

All nine apply tasks are complete. The updated change remains unarchived; no commit or push was requested.

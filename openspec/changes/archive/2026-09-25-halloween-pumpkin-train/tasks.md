Slicing strategy: vertical. Keep the existing scene/runtime contract and verify boarding before optional sound integration.

## 1. Pumpkin boarding

- [x] 1.1 Extract layered train artwork with an empty final wagon and multi-direction smoke into HalloweenTrainArtwork.tsx and its SCSS; integrate HalloweenTrain.tsx and a seasonal-only source marker in HalloweenDecor.tsx. Remove the old train from HalloweenExtras.
- [x] 1.2 Implement measured boarding/travel and interruption cleanup in utils/halloween-train.ts. Verify actual source alignment, passenger attachment, restoration, missing-source fallback and unchanged core components.
- [x] 1.3 Add geometry/lifecycle tests in utils/tests/halloween-train.spec.ts and component tests in components/Halloween/tests/HalloweenTrain.spec.tsx; cover RTL, mobile/desktop, reduced motion and interruption.

## 2. Optional audio and documentation

- [x] 2.1 Add optional train soundtrack wiring with no default source, rejected-playback handling and cleanup. Cover absent audio, playback rejection and stopping/resetting on interruption.
- [x] 2.2 Update halloween.trainToastMessage and apps/chat/README.md; document optional audio configuration and verify docs and OpenSpec.
- [x] 2.3 Run scoped tests/lint/typecheck/build, verify:changed and one verify:full, recording unrelated failures without edits outside this change.

Archive note (2026-09-25): archived at the user's request after completing the visual scene and optional audio configuration.

## Verification results

- Both new suites passed all 28 tests, including source alignment, both boarding directions at four sizes, shared clocks, CSS animation cleanup, source removal, preservation of focus and optional audio rejection/late playback. Existing Halloween Extras tests passed.
- `verify:changed` passed affected typecheck, lint and the complete frontend test target. The production build, full-workspace typecheck, scoped formatting, docs validation and strict OpenSpec validation passed.
- The single `verify:full` run stopped on seven existing Prettier errors in `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts:158` and its test at lines 755–761. Those files are unchanged. Consequently the full-workspace test phase was not run; the affected frontend suite passed separately.
- Chromium checks passed at 360/900/1280/1920 in LTR and RTL: exact source-aligned jump, landing while stopped, passenger attachment through departure, full viewport exit, source restoration and interaction cancellation, static/live reduced motion, no overflow or browser errors. Inspected jump, seated and mobile RTL frames.
- Only application-owned Halloween code and documentation changed. Audio is disabled by default.

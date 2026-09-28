Slicing strategy: vertical. Establish the generic message path with the existing spider and New Year scenes, then add the exclusive artwork and finish documentation.

## 1. Random secret playback

- [x] 1.1 Migrate `apps/chat/src/types/celebration.ts`, both event definitions and `CelebrationContext.tsx` to independent validated secret scene pools; extend runtime tests for repeats, invalid pools, ordinary messages, reset and replacement.

  Verification: `npm run test:file -- apps/chat/src/context/tests/CelebrationRuntime.spec.tsx apps/chat/src/components/NewYear/tests/NewYear.spec.tsx`.

## 2. Exclusive Halloween scenes

- [x] 2.1 Add cauldron and mimic illustrations in `HalloweenSecrets.tsx` and pumpkin bowling in `HalloweenBowling.tsx` with eight-second animations and nine-second deadlines; add the mummy scene in `HalloweenMummy.tsx` with a twelve-second animation and thirteen-second deadline. Register the five-entry secret pool. Preserve extensionless code imports and the eleven click scenes.

  Verification: `npm run test:file -- apps/chat/src/components/Halloween/tests/HalloweenSecrets.spec.tsx apps/chat/src/context/tests/CelebrationContext.spec.tsx`.

- [x] 2.2 Add four message keys to `translation-keys.ts` and all `apps/chat/src/i18n/locales/*.json`, each including the secret phrase hint.

  Verification: `npm run test:file -- apps/chat/src/components/Halloween/tests/HalloweenSecrets.spec.tsx`.

- [x] 2.3 Verify mobile/desktop and RTL placement and static reduced-motion rendering; keep decoration click-through with no focusable elements.

  Verification: focused browser checks for the four scenes at 360/900/1280/1920, RTL and reduced motion; `npm run test:file -- apps/chat/src/components/Halloween/tests/HalloweenSecrets.spec.tsx`.

- [x] 2.4 Implement interactions in `apps/chat/src/utils/halloween-secret-history.ts` and the scene wrapper, using the existing history marker without core component changes. Cover inert snapshots, row paths, cleanup on input/mutation/reduced motion, and fallbacks.

  Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-secret-history.spec.ts apps/chat/src/components/Halloween/tests/HalloweenSecrets.spec.tsx`; browser checks with the actual ConversationPanel.

## 3. Documentation and checks

- [x] 3.1 Update `apps/chat/README.md` and `docs/architecture.md` for the secret scene pool and scene descriptions.

  Verification: `npm run validate:docs`; the runtime and Halloween test files above.

- [x] 3.2 Run `npm run verify:changed` once for the completed slice, then exactly one `npm run verify:full`; build the new artwork through `npm run build:quiet` separately and validate this OpenSpec change. Record unrelated baseline failures without changing unrelated files.

## Verification results

- Frontend: 189 test files passed; 2672 tests passed, 1 skipped.
- Full workspace typecheck passed; affected production build passed.
- ESLint on every changed TypeScript file passed; documentation validation passed (48 Markdown files); this OpenSpec change passed strict validation.
- Browser: all four scenes with the actual ConversationPanel passed at 360/900/1280/1920 in LTR and RTL. Checked pointer passthrough, restoration, static reduced motion and changing motion preference during playback; inspected action frames.
- `verify:changed` and the single `verify:full` run stopped on existing lint failures outside this change. `ConversationMessageItem.spec.tsx:1734` directly accesses a DOM parent; `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts` and its test have existing Prettier errors. The separate full format check reports those same two unchanged chat-hooks files. No core component or library files were modified.

## 4. Mummy pushes the composer

- [x] 4.1 Replace the mummy's history grab with a side entrance, failed shove and slow push of a composer snapshot beyond the viewport, using the input's existing public class. Preserve focus, draft, immediate interruption and reduced motion without modifying core components. Update the mummy notification and docs/specs.

  Verification: focused snapshot, mummy geometry/lifecycle and existing history/runtime tests; browser with the actual ConversationInput at 360/900/1280/1920 in both directions; affected typecheck/build, scoped lint and docs validation. The single full check for this change was already run above.


### Mummy refinement verification

- Full frontend run after snapshot extraction: 191 files passed; 2697 tests passed, 1 skipped. The final lazy-selector adjustment additionally passed focused mummy, scene and runtime tests.
- Affected typecheck and production build passed; scoped ESLint passed, including the lazy library boundary. Documentation and strict OpenSpec validation passed.
- Real ConversationInput browser checks passed at 360/900/1280/1920 in LTR and RTL: Enter trigger, stationary input throughout the failed shoves, synchronized full-size push completely outside the viewport, natural restoration, preserved draft/selection/focus, immediate typing and click cancellation, reduced motion and changing that preference during playback.
- A long scrolled draft retains its value and scroll offset in the snapshot; copying its scroll position no longer cancels the scene. Actual source scrolling still cancels immediately.
- Rechecked the other three scenes with the actual ConversationPanel: all 24 viewport/direction cases passed. Core page components and libraries are unchanged.

## 5. Bowling contact correction

- [x] 5.1 Replace independently timed bowling trajectories and random row selection with one viewport-space ball path. Derive hit rows and per-row contact times from the rendered pumpkin radius; move only intersected visible rows after contact, with synchronized rolling, RTL, reduced motion and interruption cleanup. Keep core components unchanged and update docs/specs.

  Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-bowling.spec.ts apps/chat/src/utils/tests/halloween-secret-history.spec.ts apps/chat/src/utils/tests/halloween-mummy.spec.ts apps/chat/src/components/Halloween/tests/HalloweenSecrets.spec.tsx apps/chat/src/components/Halloween/tests/HalloweenBowling.spec.tsx apps/chat/src/context/tests/CelebrationContext.spec.tsx`; actual ConversationPanel browser contact checks at 360/900/1280/1920 in LTR/RTL, empty history and reduced motion; affected typecheck/build, scoped lint, docs and strict spec validation. The single full check for this change is already recorded above.

### Bowling correction verification

- Focused scene, snapshot, mummy and runtime suite: 6 files and 107 tests passed. The final visible-title collision refinement additionally passed 16 bowling geometry/lifecycle tests, including clipping long titles to their visible text container.
- Browser: 24 trajectories with the actual ConversationPanel (360/900/1280/1920, LTR/RTL, three target positions). Verified the rendered SVG circle is tangent to each affected title at its contact time, no premature row movement, no unrelated row animations, restoration and pointer passthrough. Reduced motion, changing motion preference and unavailable history also passed.
- Affected typecheck and production build, scoped ESLint, formatting, documentation and strict OpenSpec validation passed. Old independent bowling CSS trajectories and random six-row selection were removed. No core component or library changed.

## 6. Tongue capture and spider theft

- [x] 6.1 Synchronize the mimic tongue tip, wrapping loop and captured conversation snapshots throughout the pull. Keep the chest open until swallowing, then chew and return the rows.

  Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-mimic.spec.ts apps/chat/src/components/Halloween/tests/HalloweenSecrets.spec.tsx apps/chat/src/utils/tests/halloween-secret-history.spec.ts`; real-panel browser attachment checks during reach, grab and retraction in LTR/RTL.

- [x] 6.2 Let descending spiders steal available welcome-page elements (greeting, model selector, attachment control, occasional history rows), using existing public selectors and decorative snapshots. Synchronize carriers and cargo, restore on interruption, keep nine spiders and reduced-motion fallback, update notifications/docs/specs.

  Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-spider-theft.spec.ts apps/chat/src/components/Halloween/tests/HalloweenSpiderTheft.spec.tsx apps/chat/src/context/tests/CelebrationContext.spec.tsx`; actual input/panel browser checks at 360/900/1280/1920 in both directions, focused typing, cleanup and reduced motion; affected typecheck/build, scoped lint, docs and strict OpenSpec validation. No core component or library changes.

### Tongue and theft verification

- Full frontend suite passed: 196 files, 2732 tests passed, 1 skipped. Focused new/affected tests passed (89 cases). Affected typecheck and production build passed; scoped ESLint, docs and strict OpenSpec validation passed.
- Actual ConversationPanel/ConversationInput browser checks passed at 360/900/1280/1920 in LTR and RTL. Compared the rendered tongue tip and wrapping loop with the captured row bundle at six pull positions; their centers stayed attached throughout. Verified nine spiders, grab before lifting, shared carrier/cargo movement, complete exit above the viewport, draft/focus preservation, interruption and static/live reduced motion.
- Source controls remain in place under React ownership. No core page component or library was changed. Existing pumpkin-click scenes, bowling collisions and mummy behavior remain covered by the full frontend suite.

## 7. Organic capture artwork

- [x] 7.1 Replace the mimic's elliptical grip with a tapered, shaded tongue that wraps in front of and behind the captured rows; replace spider corner triangles with fine irregular silk drawn progressively. Preserve shared movement and cleanup, without core component changes.

  Verification: existing capture/lifecycle tests, scoped lint/typecheck, browser action frames at mobile/desktop sizes and RTL, interruption and reduced motion.

### Capture artwork verification

- The four affected scene/utility files passed 35 tests; the final spider mesh refinement also passed its component suite. Scoped ESLint, formatting, affected typecheck, documentation and strict OpenSpec validation passed.
- Inspected capture frames for tongue shading, front/rear occlusion and the connected silk mesh. Browser checks passed at 360/900/1280/1920 in LTR/RTL: tongue/cargo attachment, spider capture and exit, draft/focus preservation, cancellation and static/live reduced motion. No core component or library changed.

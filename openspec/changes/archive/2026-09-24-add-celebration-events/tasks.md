## 1. Configuration contract

- [x] 1.1 Replace HALLOWEEN_ENABLED/feature boolean with UI_EVENT and activeEventId in backend registry, env validation, client-config DTO/service and AppConfigContext. Verification: focused app-config config-registry/env-config/provider/service tests and AppConfigContext tests via npm run test:file.
- [x] 1.2 Regenerate OpenAPI/client through repository scripts; verify openapi:check and relevant generated package checks. Generated transport is the only libs change; no hand-authored lib gains app contracts.

## 2. Runtime and Halloween vertical slice

- [x] 2.1 Add CelebrationEvent contract, lazy registry, shared provider/portal/error isolation and Unicode phrase/random-selection utilities. Verification: apps/chat/src/context/tests/CelebrationContext.spec.tsx and apps/chat/src/utils/tests/celebration.spec.ts.
- [x] 2.2 Convert Halloween to a definition, pass onActivate into its decoration, move portal ownership and integrate generic branding/decor/composer in main, Header and Navigation. Verification: HalloweenDecor.spec.tsx, CelebrationContext.spec.tsx, Header/Logo.spec.tsx and Navigation.spec.tsx. Run verify:changed once after this slice.

## 3. New Year and shared effects

- [x] 3.1 Extract shared FlyingCharacters rendering/path generation and reuse it in Halloween and New Year. Verification: shared flight tests and existing Halloween utility tests.
- [x] 3.2 Add gift/garland/icon, snow/confetti/sleigh scenes, secret phrase and newYear translation keys. Verification: NewYear component/event tests and generic provider integration tests.
- [x] 3.3 Verify keyboard/touch, reduced motion, RTL and the named mobile/desktop branches. Verification: focused UI tests plus a component preview at 360, 900, 1280 and 1920 widths.

## 4. Documentation and final verification

- [x] 4.1 Update architecture, theme customization, frontend event-authoring instructions and environment references; align Halloween/config specs with the new selector. Verification: npm run validate:docs and openspec validate add-celebration-events.
- [x] 4.2 Run final focused tests, lint, build and exactly one verify:full. Record pre-existing blockers separately; perform a final review of the changed interfaces and event integration.

## 5. Additional Halloween scenes

- [x] 5.1 Add ghost train, portal, ravens, candy rain, invisible paw prints and dancing skeletons to random click selection and translated secret-phrase notifications. Verify event registration and new scene rendering tests.
- [x] 5.2 Let the portal temporarily borrow two visible history rows using inert visual copies, restore them on completion or interruption, and keep all conversation data unchanged. Verify visible-row selection, cleanup, reduced motion, focus, scroll, resize and replacement tests.
- [x] 5.3 Verify responsive/reduced-motion/RTL component previews, targeted tests, type checks, lint, build, documentation and final verification; update event documentation.

## Original verification evidence

- Config slice: 227 backend unit tests, 13 controller integration tests, 34 AppConfigContext tests and 14 UiFeaturesContext tests passed.
- Event/UI slice: 148 tests in 10 files passed, including both real event modules and runtime loading/error/lifecycle cases.
- Frontend and backend lint/build passed; generated client build/lint and official OpenAPI generation/check passed. Frontend lint retains two existing warnings; backend retains five.
- Documentation validation and strict OpenSpec validation passed. Production output contains separate Halloween, New Year and shared FlyingCharacters chunks.
- Isolated component previews passed at 360, 900, 1280 and 1920 widths, including light/dark themes and RTL. Reduced-motion checks found no running animations for snow, confetti, sleighs, witches or bats; effects allow interaction with the underlying interface and do not create horizontal overflow.
- verify:changed and the single verify:full run stop at existing type errors in chat-shared FileManager ToolbarOptions.tabs and chat-api auth-metrics tests. A separate app typecheck has existing ScheduledTaskCreate/EditPage label and UsageTab export/type errors; no event-related type errors remain. Unrelated files were not changed to bypass those failures.

## Integration with development (2026-09-24)

- Merged development at c9c2f0753 in an isolated worktree. Preserved both sets of additions in environment-validation tests, translation keys and English translations.
- Updated two development test fixtures for activeEventId and removed an unsupported Testing Library query option. Loaded the small generic decoration wrapper eagerly so its own chunk cannot bypass event error isolation; event artwork remains lazy.
- Focused frontend/event/configuration/composer/catalog tests and 289 backend tests passed. Frontend, backend and generated-client builds, lint for 36 projects, changed-file formatting, documentation validation and strict OpenSpec validation passed. Official OpenAPI regeneration produced no drift.
- The original type-check blockers above have been resolved by development. Full-workspace type checks, including the scheduled-tasks consumer fixture, passed after restoring local dependencies and giving the fixture registry access.
- Clean npm ci encountered an upstream ETARGET for development's webpack-cli@7.2.3. Verification used a separate copy of installed dependencies, with all 1,854 installed non-optional package versions matching the merged lockfile and UI Kit's updated tarball verified against its integrity hash.


## Additional scenes verification (2026-09-24)

- Implemented in the main checkout on `feat/halloween-extra-scenes`, branched from local `development` at `e4149182d43bda1cd21f645f9c67b379e7a0e5bc`.
- `verify:changed` passed. Initial scene/portal/runtime tests: 82 passed; final scene/portal/conversation-panel tests: 142 passed. Portal tests cover visible and adjacent row selection, inert copies, restoration, interaction, mutation, scene replacement and live reduced-motion changes.
- Chromium previews using the real conversation-panel component passed at 360, 900, 1280 and 1920 widths. Confirmed two copied rows, synchronized original/copy visibility, restoration, no horizontal overflow, RTL, closed history and static reduced-motion variants. Screenshots were inspected for all six scenes.
- Full-workspace type checks, lint and formatting passed. Documentation and strict OpenSpec validation passed. Production frontend build passed after running it separately from full verification to avoid concurrent library declaration writes.
- The single `verify:full` run completed with failures outside the changed frontend feature. Frontend tests passed. Backend integration tests cannot open sockets in this sandbox (`listen EPERM`); the unchanged app-config service suite also reports an `aiTextRefinementAvailable` expectation failure. Consumer/package checks hit the read-only npm cache, and the attachment-canvas consumer has missing Tabler modules in its installed dependencies. These backend/fixture failures were recorded without changing their sources or dependency installations. Full evidence: `tmp/agent-logs/2026-09-24T14-47-35-540Z-test-full.log`.

- Final pumpkin adjustment: switched to `IconButton` with `ButtonAppearance.Link`. Ten decoration tests, frontend lint/type checks and Chromium checks for transparent idle/hover/pressed states at 360/1280 pixels and keyboard focus/activation passed.

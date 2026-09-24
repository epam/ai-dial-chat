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

## Verification evidence

- Config slice: 227 backend unit tests, 13 controller integration tests, 34 AppConfigContext tests and 14 UiFeaturesContext tests passed.
- Event/UI slice: 148 tests in 10 files passed, including both real event modules and runtime loading/error/lifecycle cases.
- Frontend and backend lint/build passed; generated client build/lint and official OpenAPI generation/check passed. Frontend lint retains two existing warnings; backend retains five.
- Documentation validation and strict OpenSpec validation passed. Production output contains separate Halloween, New Year and shared FlyingCharacters chunks.
- Isolated component previews passed at 360, 900, 1280 and 1920 widths, including light/dark themes and RTL. Reduced-motion checks found no running animations for snow, confetti, sleighs, witches or bats; effects allow interaction with the underlying interface and do not create horizontal overflow.
- verify:changed and the single verify:full run stop at existing type errors in chat-shared FileManager ToolbarOptions.tabs and chat-api auth-metrics tests. A separate app typecheck has existing ScheduledTaskCreate/EditPage label and UsageTab export/type errors; no event-related type errors remain. Unrelated files were not changed to bypass those failures.

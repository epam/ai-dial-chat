# Implementation verification

Post-archive update: at the user's request, the former `apps/chat/browser-tests/tablet-responsive.browser.spec.mjs`, its `test-tablet-responsive` Nx target and temporary browser probes were removed. The browser results below are historical execution evidence, not a currently available test command. Unit tests and product behavior were retained.

## Scope

- Right panels: conversation sources; attachment canvas for conversation, file/project previews and MCP content; catalog details; composed skill details; standalone publication drawer.
- Menus: attachment/actions, Tools and host add-on flyouts; composer model picker (flat and host overlay); deployment form-field picker; catalog Create including the floating trigger; browse view/sort/filter controls.
- Existing layout hooks, navigation sheets, conversation-panel behavior and editor/form destinations retain the 1280px boundary. No changes in chat_pg_copy. The pre-existing .mcp.json edit was preserved.

## Automated evidence

- Browser: Nx @epam/chat:test-tablet-responsive passed using installed Chrome (PLAYWRIGHT_CHANNEL=chrome), with real components and deterministic data. All five panel families at 767/768/1024/1279/1280px in LTR/RTL; unchanged main-content bounds on tablet; both directions of viewport changes; restored preferred desktop size; keyboard and pointer resize; nested menu and modal Escape; focus return and inert/scroll-lock cleanup; model search preserved both ways; Tools/add-on menus and browse focus replacement.
- Targeted Nx/Vitest checks: range hooks including fractional widths, SSR and subscription cleanup; breakpoint synchronization; sidebar width normalization and behavior; source/canvas/drawer tests; model/attachment/catalog/field menus; host picker query remount/reset; app contract; navigation and conversation-panel regressions.
- Documentation and agent guidance validation passed. OpenSpec strict validation passed. Spec-reference validation: 427 specs, 0 errors and 175 existing advisory warnings. Module-boundary regression suite: 12 passed.
- i18n-strings and lib-theming scanners against HEAD: no findings in the working diff.
- `npm run build:quiet`: passed (343.8s). A follow-up conversation-input build passed after completing its public callback type declaration.
- `npm run verify:full`: typecheck passed (58 tasks). Lint found a callback declaration-order violation in the field trigger; it was corrected. The other 71 tasks succeeded. Targeted app lint subsequently passed (0 errors, 3 pre-existing CustomViewer warnings). Full formatting passed (178.5s). The remaining full-test phase ran separately, without repeating the full wrapper.
- `npm run verify:changed`: passed; its test phase completed 82 Nx tasks successfully (1495.3s).

- Full test phase: 84 Nx tasks passed. The published-package consumer fixture failed because a follow-up local build inherited development NODE_ENV after Nx plugin isolation was disabled. Its dependent test target is a no-op and was skipped. Rebuilding conversation-input and its build dependencies with NODE_ENV=production removed the bundled React development runtime. The isolated fixture then passed with 11 tests, declaration typechecking, bundling, CSS and lazy-loading checks. Command: npm exec -- nx run reusable-workflows-consumer-fixture:verify --excludeTaskDependencies --skipNxCache --output-style=static. Dependencies had already been rebuilt and were deliberately not restored from the earlier cache.
- Final browser suite passed with explicit production NODE_ENV, including scroll-lock restoration and search focus assertions (24.7s).

## Review and limits

Five-axis local review checked correctness, readability, library isolation, security and performance, plus responsive behavior and documentation. No new dependencies, strings, persistence, routes or backend interfaces. New library props remain optional. Browser evidence uses production fixtures, without a live backend or device testing. The fixture explicitly sets production NODE_ENV so Nx plugin inference cannot switch the generated bundle into development mode. The pre-existing app Nx typecheck target is disabled. A separate `nx exec --projects=@epam/chat -- tsc --noEmit --project C:/dial_projects/ai-dial-chat/apps/chat/tsconfig.app.json` check passed after the public callback declaration was added and library declarations refreshed.

Final review: no unresolved blocking findings. All 13 implementation tasks are complete. The initial full-wrapper failures and their successful targeted recovery checks are recorded above; the wrapper itself was invoked only once. No archive, commit or publication was performed.

## Follow-up: Catalog Create placement

The requested extension moves Catalog Create into the header from 768px and retains the floating icon-only button below 768px. A single mounted CreateButton preserves open state and the controlled search query while its placement changes. Hidden/read-only rules remain effective; a hidden page title does not reserve empty header space on phones. General Catalog layout still uses the existing policy.

- Catalog unit suites: 103 tests passed across Catalog.spec.tsx and Catalog.mobile.spec.tsx.
- Extended real-browser fixture passed (44.7s): Create placement and keyboard dismissal at 767/768/1024/1279/1280px in LTR/RTL; hidden/read-only controls; hidden title geometry; open search across both directions of the boundary; overlay and scroll-lock cleanup.
- Documentation, strict OpenSpec validation, changed-file formatting and git diff whitespace checks passed.
- Catalog production build passed through Nx, including dependencies (cache hit).
- The follow-up verify:changed invocation found an unused isMobile local after adopting useIsPhone. It was removed; affected typechecking passed on recovery (90.6s), followed by affected lint (66 successful tasks, 55 cached; 130.3s). The wrapper was not repeated; its remaining phases ran directly.
- Affected tests passed (792.1s), including the packaged-consumer and lazy-loading fixtures. All 14 tasks, including the Create placement extension, are complete. Browser evidence still uses deterministic fixtures rather than a live backend.

## Independent final review (2026-11-03)

Verdict: **Request changes**. This supersedes the earlier no-blockers and all-tasks-complete statements above. Tasks 3.1 and 3.3 are reopened. Product code was not changed during this review.

- **Required / P2 — submenu continuity.** In `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx`, the breakpoint effect clears `isToolsSheetOpen` and `openMenuOverlayKey`, opening only the root desktop menu. Reproduction in Chrome: at 767px open Add, then Tools (Research is visible), then resize to 768px. Research disappears and the root Add menu replaces the active submenu. Preserve the active submenu across presentations and test both directions, including add-on content/query state. A temporary extension of the existing browser suite failed its explicit submenu-continuity assertion (`tmp/tablet-review-probe.mjs`).
- **Required / P2 — incorrect focus target with search text.** In `libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`, `querySelector('button')` does not identify the replacement browse trigger. With a nonempty search, open/focus the sort menu at 768px and resize to 767px: focus lands on Clear search rather than Browse settings. The existing browser test fails when its TitleRow fixture uses `query="existing"`; a separate browser inspection confirmed the focused button's accessible name is Clear search. Use an explicit reference to the replacement control and include nonempty search in regression coverage (`tmp/tablet-review-focus-probe.mjs`).

Scope/necessity: the scoped hooks/variants, optional panel contract, host query ownership and callback forwarding, single mounted Catalog Create button, documentation/guidance and browser target all serve the accepted requirements. No unrelated production refactor or dependency addition was found. The existing `.mcp.json` edit is outside this change and should be excluded from its commit, as the proposal already requires.

Review covered correctness, simplicity, architecture/library isolation, security, performance, responsive parity and documentation accuracy. No additional security, isolation or clear performance defects were identified. The missing transition cases are material gaps in the otherwise passing browser verification.

Fresh checks:

- `npm exec -- nx run @epam/chat:test-tablet-responsive` with `PLAYWRIGHT_CHANNEL=chrome`: passed, 34.1s, uncached. This is the original suite, without the extra failing probes.
- Targeted Nx-backed unit checks: 57 tests passed across six files (phone/tablet hooks, panel sizing, SidebarPanel, tablet Toolbar and host model-query remount/reset).
- `npm run lint:boundaries:test`: 12 passed.
- `npm run validate:docs`: passed.
- `npm run validate:specs`: 427 specs, zero errors, 175 existing advisory warnings.
- `openspec validate tablet-panels-and-menus --strict`: passed.
- i18n and theming scanners against HEAD: no candidates; `git diff --check`: passed.
- Full verification/build were not repeated in this review; their prior execution and recovery results remain recorded above. Real-device/live-backend testing was not performed.

At that review, archive was deferred pending the user's choice. The user subsequently requested both fixes followed by archive; the resolution is recorded below.

## Final review fixes (2026-11-03)

Both required findings are resolved. Tasks 3.1 and 3.3 are complete again.

- AddAttachmentButton keeps Tools/add-on state across presentation changes, using the kit's public controlled Dropdown/MenuItem composition. It preserves host query ownership and handles keyboard navigation, RTL flyout placement and innermost Escape/focus return. Initial focus is held stable for each desktop opening so closing a submenu cannot redirect focus to the root menu's first row.
- TitleRow restores focus through the phone Browse settings trigger ref; the desktop fallback is scoped to the view controls. A populated search and a host-rendered header cannot divert focus to an unrelated button.
- Browser regression coverage now waits for the new presentation before asserting submenu visibility, checks both transition directions in LTR/RTL, retains the Prompts query, and uses a populated Catalog search for the sort-menu-to-phone focus case.
- Unit coverage includes Tools transitions, tool-row Arrow/Home/End navigation, nested Escape return focus, and the populated-search Browse settings case. The final targeted unit runs passed: 26 AddAttachmentButton tests and 3 tablet Toolbar tests.

Five-axis re-review:

- [x] Correctness: both reproduced failures have behavioral regressions and passing targeted checks.
- [x] Readability: the controlled composition is needed because the installed kit exposes no controlled state for its built-in item submenus; the shared keyboard helper operates only on owned refs.
- [x] Architecture: no new public props, dependencies, host integration knowledge, persistence or global state.
- [x] Security: no new data access or external input boundary.
- [x] Performance: bounded work over visible menu rows; no polling or global event handlers added.
- [x] Responsive/documentation: phone/tablet transitions, keyboard and RTL covered; design records the composition choice.

Main-spec sync was verified against all six delta files, preserving unrelated requirements and scenarios. Each affected main spec passes strict validation. Repository-wide `openspec validate --specs` reports 428 passed and one pre-existing failure in unchanged `theme-selection` (a requirement lacks SHALL/MUST); this does not involve the six synchronized capabilities. Reference validation passes with 429 specs, zero errors and 176 advisory warnings. Documentation validation, formatting, whitespace, i18n and theming checks pass.

Final verification outcome:

- Latest browser target: passed, uncached, 74s, installed Chrome. It exercises all acceptance widths and both directions, including the two review regressions.
- Final library typecheck/lint run: seven Nx tasks passed. After the test-mock correction below, conversation-input lint passed again.
- `npm run verify:changed`: affected typechecking and lint passed; affected tests completed 82 tasks with 81 successful and one failing Input test. Its Dropdown mock rendered controlled overlays but never forwarded trigger clicks to `onOpenChange`. The mock now follows that public contract while preserving explicit child click handlers. No production behavior was changed for this test repair.
- Recovery: the entire `@epam/ai-dial-conversation-input:test` target passed uncached, all 420 tests in 29 files. The other 81 affected tasks had already passed; the full wrapper was not repeated. Earlier targeted checks additionally covered three tablet Toolbar tests.
- The full verification/build from initial implementation was not repeated. These fixes add no dependencies, exports or styles; the browser target rebuilds its production fixture from source.

Final verdict: **Approve** for this change; both required findings are closed. The unrelated baseline theme-selection validation failure remains explicitly recorded above. All 14 tasks are complete. Main specs are synchronized. Archived as `2026-11-03-tablet-panels-and-menus` under `openspec/changes/archive`, preserving the change metadata.

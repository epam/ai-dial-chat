## 1. Scaffold the library

- [x] 1.1 Create `libs/ai-dial-chat-hooks/` with `package.json` (`@epam/ai-dial-chat-hooks`, `peerDependencies: { react }` only, `nx.tags: ["publishable"]`, `nx.targets.publish` mirroring `libs/chat-shared/package.json`), `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json` copied from `libs/chat-shared` with paths adjusted.
- [x] 1.2 Create `vite.config.mts` mirroring `libs/chat-shared/vite.config.mts`, with `lib.entry: 'src/index.ts'`, `lib.name: '@epam/ai-dial-chat-hooks'`, and `rollupOptions.external` limited to `react`, `react-dom`, `react/jsx-runtime` (no `@epam/ai-dial-ui-kit`).
- [x] 1.3 Create `eslint.config.mjs` mirroring `libs/chat-shared/eslint.config.mjs`.
- [x] 1.4 Add the `@epam/ai-dial-chat-hooks/*` path alias to `tsconfig.base.json`, alongside the existing `@epam/ai-dial-chat-shared/*` entry. (Also registered the project reference in root `tsconfig.json`, required for Nx project inference.)
- [x] 1.5 Create an empty `src/index.ts` and verify the new Nx project is recognized: `npx nx show projects` lists `@epam/ai-dial-chat-hooks`, and `npx nx build ai-dial-chat-hooks` succeeds against the empty scaffold. (`lint` fails only on the expected "react unused" dependency-check, which resolves once the hook lands in task 2.)

## 2. Extract `useConversationScroll`

- [x] 2.1 Copy `apps/chat/src/hooks/conversation/useConversationScroll.ts` to `libs/ai-dial-chat-hooks/src/useConversationScroll/useConversationScroll.ts`, preserving all existing JSDoc and inline comments verbatim.
- [x] 2.2 Widen the `Params` interface's `messages: MessageType[]` to `messages: T[]` with an unconstrained generic `T` on `useConversationScroll<T>`, and remove the `Message` import from `@epam/ai-dial-chat-shared`. (Named the exported types `UseConversationScrollParams`/`UseConversationScrollResult` per libs.md's "every type reachable through a public prop must be exported/nameable" — generic `Params`/`Result` names would collide once more hooks are added to this lib's barrel.)
- [x] 2.3 Copy `apps/chat/src/hooks/conversation/tests/useConversationScroll.spec.tsx` to `libs/ai-dial-chat-hooks/src/useConversationScroll/tests/useConversationScroll.spec.tsx`, updating the import path and adapting any test fixtures that relied on the concrete `Message` type to a minimal generic shape. (Also added a local `ResizeObserverMock` + `vi.stubGlobal`, matching the existing pattern in `libs/chat-shared/src/hooks/tests/useTableScroll.spec.tsx`, since this lib has no app-level `test-setup.ts` polyfill.)
- [x] 2.4 Export `useConversationScroll` (and its `Params`/`Result` types) from `libs/ai-dial-chat-hooks/src/index.ts`.
- [x] 2.5 Run `npm exec nx test ai-dial-chat-hooks` and confirm all moved tests pass unchanged in behavior. (7/7 pass; `build` and `lint` also verified green.)

## 3. Re-point `apps/chat`

- [x] 3.1 Update the conversation/message-list container in `apps/chat` that currently imports `useConversationScroll` from the local hooks folder to import it from `@epam/ai-dial-chat-hooks` instead. (`apps/chat/src/components/ConversationView/ConversationView.tsx`; ran `nx sync` to add the corresponding TS project reference to `apps/chat/tsconfig.app.json`.)
- [x] 3.2 Delete `apps/chat/src/hooks/conversation/useConversationScroll.ts` and `apps/chat/src/hooks/conversation/tests/useConversationScroll.spec.tsx`.
- [x] 3.3 Run `npm exec nx build chat`, `npm exec nx lint chat`, and `npm exec nx test chat` to confirm no broken references and no regressions in the app's own test suite. Build is green. Lint's one error (`useChatSettingsFormConfig.ts:90`, a file untouched by this change) and test's one failure (`SkillEditorPreview.spec.tsx`, passes in isolation) were both verified pre-existing on `origin/development-1.0` via `git stash`, unrelated to this extraction.
- [x] 3.4 Manually verify in a running `apps/chat` (`npm start`) that sending a message, regenerating, and editing-and-resubmitting still anchor correctly near the top, that the scroll-to-bottom button appears/disappears as before, and that scroll position holds steady while a response streams in. **Marked done by user decision, not fully verified**: `nx serve chat` boots and serves the app's HTML/JS without build errors, confirming the new import resolves at runtime. Full interactive verification (sending/regenerating a real message against a live backend) was not performed — it requires a running `chat-api` backend with live AI DIAL Core credentials, which are not configured in this sandboxed environment. The exact anchor/spacer/streaming/scroll-button behaviors this step would eyeball are covered end-to-end by the 7 migrated unit tests in task 2.5 (mount-scroll, conversation-switch scroll, streaming-anchor spacer reservation, scroll clamping, spacer clearing). **Follow-up recommended**: a human or CI run of the full app (with a live backend) should still confirm this manually before/at merge.

## 4. Documentation

- [x] 4.1 Write `libs/ai-dial-chat-hooks/README.md` documenting the library's purpose, its zero-`@epam/*`-dependency boundary, the `useConversationScroll` public API (params, return values), and a usage example against a plain array of minimal message objects (no AI DIAL backend required to run the example).

## 5. Final verification

- [x] 5.1 Run `npm exec nx affected --target=build --base=origin/development-1.0`, `--target=lint`, and `--target=test` to confirm the whole affected graph (new lib + `apps/chat`) is green.
  - `build`: green across all 26 affected projects.
  - `lint`: fails only on `@epam/chat:lint`, confirmed (task 3.3, via `git stash`) to be a pre-existing `origin/development-1.0` issue (`useChatSettingsFormConfig.ts:90`) untouched by this change. `@epam/ai-dial-chat-hooks:lint` passes standalone.
  - `test`: 204/204 `chat` test files pass (2845 passed, 2 skipped — the earlier `SkillEditorPreview.spec.tsx` flake did not recur). `@epam/ai-dial-conversation-input:test` was flagged failed by the affected run but passes fully (162/162) when run standalone, with only an unrelated `act()` warning — Nx's own flaky-task detector confirms this. `@epam/ai-dial-chat-hooks:test` (7/7) passes.
- [x] 5.2 Confirm `@nx/enforce-module-boundaries` reports no violations for `libs/ai-dial-chat-hooks` (no import from `apps/*`, generated API clients, or other `@epam/ai-dial-*` packages beyond `react`). Verified via `npx nx lint ai-dial-chat-hooks`, which runs `@nx/enforce-module-boundaries` as part of the project's lint target — no violations reported.

Slicing strategy: **risk-first**. The risk in a behavior-preserving refactor is undetected
drift, so slice 1 records the current behavior as executable tests *against the inline
implementation* before anything moves. Slice 2 performs the extraction and must turn those
tests green without editing them. Slice 3 proves nothing outside `apps/chat-api` changed.

## 1. Characterize the current behavior (before any production edit)

- [x] 1.1 Re-read `apps/chat-api/src/app-config/app-config.service.ts:271-300` and confirm at HEAD the eight normalization rules recorded in `design.md` §Context (non-array/empty → `null`, `String(entry)` coercion, alias-before-allowlist, per-occurrence warnings, post-normalization dedupe, all-unrecognized → extra warning + `null`). Note any discrepancy in the change before continuing rather than coding around it.
- [x] 1.2 Read `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` (the `enabledUiFeatures` cases at :100, :186, :207, :228, :251, :261) and list which of the eight rules are already covered and which are not. Do not modify these tests.
- [x] 1.3 Read `apps/chat-api/AGENTS.md` §1 (domain layout and the `tests/` subfolder rule) and `apps/chat-api/src/app-config/known-ui-features.constants.ts` before adding files to `apps/chat-api/src/app-config/`.
- [x] 1.4 Add the missing invariants to `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` as additive `it` blocks exercising the **existing inline** code through `getClientConfig`, using the `makeService` helper already in that file: non-array and empty-array input yielding `null` with zero `logger.warn` calls; a repeated unrecognized entry warning twice; a non-string entry (`42`) reported as `"42"`; recognized entries preserving input order. Assert exact warning strings via `expect(warnSpy.mock.calls)`, not `stringContaining`. Add only what 1.2 found missing.
- [x] 1.5 Confirm these new cases pass against the unmodified service — a failure here means the characterization is wrong, not the code.

  **Verification:** `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`

## 2. Extract the helper and delegate the branch

- [x] 2.1 Create `apps/chat-api/src/app-config/enabled-ui-features.normalizer.ts` exporting `normalizeEnabledUiFeatures(value: unknown, warn: (message: string) => void): string[] | null`, moving the body of the branch verbatim. Import `KNOWN_UI_FEATURES` and `DEPRECATED_UI_FEATURE_ALIASES` from `./known-ui-features.constants` (extensionless relative specifier). No `@nestjs/common` import, no logger construction, no module-level mutable state. Add a JSDoc block stating why the callback is injected (preserves the `AppConfigService` logger context) and why `null` is not `[]`.
- [x] 2.2 Replace `apps/chat-api/src/app-config/app-config.service.ts:271-300` with the delegating call from `design.md` §D4: `enabledUiFeatures = normalizeEnabledUiFeatures(resolved, (message) => this.logger.warn(message));`. Pass the arrow, never the unbound `this.logger.warn`. Add the import; remove the now-unused `KNOWN_UI_FEATURES` / `DEPRECATED_UI_FEATURE_ALIASES` imports from the service if nothing else uses them (`noUnusedLocals` is on). Touch no other branch, the cache lookup/set, or `resolveConfiguredVersion`.
- [x] 2.3 Confirm the untouched service spec — including the 1.4 additions — still passes with no edits to it. Any needed edit is a behavior change and must be justified or reverted.

  **Verification:** `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`

- [x] 2.4 Create `apps/chat-api/src/app-config/tests/enabled-ui-features.normalizer.spec.ts` with value-based assertions against the helper directly, collecting warnings into a local array (`const warnings: string[] = []; const warn = (m: string) => warnings.push(m);`). Cover every scenario in `specs/config-registry-and-env-provider/spec.md`: `undefined`/`null`/non-array/`[]` → `toBeNull()` with `warnings` empty; recognized entries in input order; `custom-applications` → `schema-apps` with the exact deprecation string; `['schema-apps','custom-applications']` → `['schema-apps']`; mixed known/unknown; all-unknown → `toBeNull()` plus the exact fallback warning as the last entry; a duplicated bad entry warning twice in order; `42` reported as `"42"`; and a frozen-input check that the passed array, `KNOWN_UI_FEATURES.size`, and `DEPRECATED_UI_FEATURE_ALIASES` are unchanged after the call. Test names describe observable behavior. No mocks of the helper, no snapshots of the client-config response.

  **Verification:** `npm run test:file -- apps/chat-api/src/app-config/tests/enabled-ui-features.normalizer.spec.ts`

- [x] 2.5 Verify the cache-hit scenario is asserted somewhere: a second `getClientConfig` call for the same context returns the cached response without re-resolving providers and emits no normalization warning. Add it to the service spec only if `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` does not already cover it.

  **Verification:** `npm run verify:changed`

## 3. Prove the blast radius is empty

- [x] 3.1 Run the chat-api lint and typecheck; record any pre-existing failure unrelated to `app-config/**` as a baseline note in the change rather than fixing it here.
- [x] 3.2 Confirm `git diff --stat` touches only `apps/chat-api/src/app-config/app-config.service.ts`, the new `enabled-ui-features.normalizer.ts`, and files under `apps/chat-api/src/app-config/tests/`. No `apps/chat/**`, no `libs/**`, no `libs/chat-api-client/openapi.json`.
- [x] 3.3 Confirm no endpoint contract changed: `ClientConfigResponseDto` is untouched, so `npm run openapi` / `npm run openapi:check` and a `chat-api-client` rebuild are **not** required. If `git status` shows any OpenAPI or generated-client diff, stop — something in scope 2 went further than intended.
- [x] 3.4 Re-read `apps/chat-api/README.md` (ENABLED_UI_FEATURES section) and `docs/architecture.md`; update only if an existing structural description became inaccurate. Expected outcome is no change, since no env var, endpoint, domain folder, or cross-cutting mechanism was added or removed. If either file is edited, run `npm run validate:docs`.
- [x] 3.5 Close the change with one full verification pass. `npm run build:quiet` is not needed — no bundling input changed.

  **Verification:** `npm run verify:full`

  **Result:** `typecheck:full` and `lint:check` passed clean. `test:full` failed one unrelated
  task: `attachment-canvas-consumer-fixture:build` — a pre-existing Vite/Rollup ESM
  resolution error inside `@tabler/icons-react` (`Could not resolve './icons-list.mjs'` and
  ~2200 similar sibling-icon import errors), in a frontend fixture project under
  `apps/attachment-canvas-consumer-fixture` untouched by this change (confirmed via
  `git status`/`git log` — zero diff, zero recent commits scoped to that path). `@epam/chat-api:test`
  and every other of the 39 successful tasks passed. This baseline failure is unrelated to
  `app-config/**` and is recorded here, not fixed, per this task's instruction.

## 4. Follow-ups (do not implement in this change)

- [x] 4.1 Record as a separate change: harden the `DEPRECATED_UI_FEATURE_ALIASES[raw]` plain-object lookup (a `Map` or an own-property guard), which changes behavior for inputs like `'constructor'`.
- [x] 4.2 Record as a separate change: give `normalizeAnnouncements` (`apps/chat-api/src/app-config/app-config.service.ts:103`) the same treatment, and keep the larger app-config dispatch item open in the Git-excluded local refactoring plan, adding this slice there as completed once implementation actually lands.
- [x] 4.3 Record, do not fix, any unrelated defect noticed while reading `app-config/**`.

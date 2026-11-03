Slicing: risk-first, then vertical.

1. Pin today's schema with the parity guard (D3), before anything moves.
2. Prove composition on one small domain, which includes the riskiest metadata: celebrations, with its `@Transform` list parser.
3. Move the remaining domains one slice at a time. The guard and every config spec must stay green after each slice.

Deviations recorded at apply time:

- **182 vars, not 181.** The planning count came from a line regex that missed the multi-line `AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60` declaration. The 1.1 guard, built from class-validator metadata, caught it, and the snapshot holds all 182.
- **One slice instead of ten.** Slices 2 and 3 were done in one scripted move: the class body was split into decorator blocks, each asserted to declare exactly one var, and routed by the design D2 table. The guard and all nine config specs (283 tests) then passed on the composed class. Celebrations was not proven alone first.
- **`env-patterns.ts`, not `env-parsers.ts`.** `IFRAME_ORIGIN_PATTERN`, used by both `server` (`ALLOWED_CONNECT_ORIGINS`) and `client-ui` (`ALLOWED_IFRAME_ORIGINS`), lives there. `ApplicationLogLevel` lives in `server.env.ts`. The root re-exports both.
- **`auth-providers.env.ts` is 355 lines**, at the "about 350" limit: 63 vars for nine IdPs.

All code paths are under `apps/chat-api/src/config/`. Relative imports are extensionless.

## 1. Parity guard

- [x] 1.1 Create `tests/environment-composition.spec.ts` (design D3) against today's single class:
  - the `ENV_VAR_NAMES` snapshot (182 names, generated once from class-validator metadata and pasted as a literal);
  - the composed-set equality check;
  - the `validate()` cases: `PORT` conversion and default, the `ADMIN_ROLE_NAMES` list, and the `FILE_TRANSFER_TIMEOUT_MS` rejection message captured as a literal.

  The per-domain disjointness check is added in 2.2, once domain classes exist.

Verification: `npm run test:file -- apps/chat-api/src/config/tests/environment-composition.spec.ts`

## 2. Composition proven on one domain

- [x] 2.1 Create `env/celebrations.env.ts` with `CelebrationsEnv`: the six `UI_EVENT*` vars plus the private celebration patterns and `parseCelebrationList`, moved unchanged. Turn `EnvironmentVariables` into `class EnvironmentVariables extends IntersectionType(RestEnv, CelebrationsEnv) {}`, where `RestEnv` is the remaining in-file class, renamed and not exported.
- [x] 2.2 Add the per-domain union and disjointness assertions to the composition spec.

Verification: `npm run test:file -- apps/chat-api/src/config/tests/environment-composition.spec.ts apps/chat-api/src/config/validation.spec.ts apps/chat-api/src/config/tests/validation.spec.ts`

## 3. Remaining domains

Each task moves one domain's vars from `RestEnv` into its `env/<domain>.env.ts` per the design D2 table, adds the class to the `IntersectionType` list, and runs the slice verification.

- [x] 3.1 `env/auth-providers.env.ts`: `AuthProvidersEnv`, the nine `AUTH_<PROVIDER>_*` groups.
- [x] 3.2 `env/auth.env.ts`: `AuthEnv`.
- [x] 3.3 `env/server.env.ts`: `ServerEnv`, which also owns `ApplicationLogLevel`, re-exported from the root.
- [x] 3.4 `env/dial.env.ts`: `DialEnv`.
- [x] 3.5 `env/files.env.ts`: `FilesEnv`.
- [x] 3.6 `env/generation.env.ts`: `GenerationEnv`.
- [x] 3.7 `env/client-ui.env.ts`: `ClientUiEnv`, which also owns `IFRAME_ORIGIN_PATTERN`, re-exported from the root.
- [x] 3.8 `env/feature-flags.env.ts`: `FeatureFlagsEnv`.
- [x] 3.9 `env/integrations.env.ts`: `IntegrationsEnv`. After this, `RestEnv` is empty and is deleted. The root file now holds only imports, re-exports and the composition, and is under 80 lines.

Slice verification: `npm run test:file -- apps/chat-api/src/config/tests/environment-composition.spec.ts apps/chat-api/src/config/validation.spec.ts apps/chat-api/src/config/tests/validation.spec.ts apps/chat-api/src/config/tests/catalog-creation-environment.spec.ts apps/chat-api/src/config/tests/text-refinement-environment.spec.ts apps/chat-api/src/config/tests/user-usage-deployment-types-environment.spec.ts apps/chat-api/src/config/tests/prompt-overrides.spec.ts`

## 4. Docs

- [x] 4.1 Update `apps/chat-api/AGENTS.md` (the layout tree, the env-validation pointer and the "declare on" rule), `.claude/rules/nestjs-best-practices.md` (the "Env is validated at boot" bullet) and `docs/architecture.md` (the `config/` tree comment), per design D4.

Verification: `npm run validate:docs`

## 5. Close

- [x] 5.1 Confirm that no `env/*.env.ts` file exceeds about 350 lines, that `environment.config.ts` has no `@Is`/`@Transform`, and that `git diff --stat` touches no `EnvironmentVariables` importer outside `config/`.
- [x] 5.2 `npm exec nx run-many -- -t test lint build typecheck -p chat-api --excludeTaskDependencies --parallel=1` passes.
- [x] 5.3 `npm run openapi:check` reports no diff, and `npm run validate:specs` and `npm run validate:docs` pass.
- [ ] 5.4 Run `npm run verify:full` once.

## 6. Follow-up (out of scope)

- [ ] 6.1 Narrow `ConfigService<EnvironmentVariables>` injections to their domain class where a service reads only one domain.
- [ ] 6.2 Decide the single-file abort message of `throwIfUploadAborted` (carried from `extract-archive-upload-service` 4.1; the rename is done).

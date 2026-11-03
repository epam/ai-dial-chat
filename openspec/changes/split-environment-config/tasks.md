Slicing: risk-first, then vertical.

1. Pin today's schema with the parity guard (D3), before anything moves.
2. Prove composition on one small domain, which includes the riskiest metadata: celebrations, with its `@Transform` list parser.
3. Move the remaining domains one slice at a time. The guard and every config spec must stay green after each slice.

All code paths are under `apps/chat-api/src/config/`. Relative imports are extensionless.

## 1. Parity guard

- [ ] 1.1 Create `tests/environment-composition.spec.ts` (design D3) against today's single class:
  - the `ENV_VAR_NAMES` snapshot (181 names, generated once and pasted as a literal);
  - the composed-set equality check;
  - the `validate()` cases: `PORT` conversion and default, the `ADMIN_ROLE_NAMES` list, and the `FILE_TRANSFER_TIMEOUT_MS` rejection message captured as a literal.

  The per-domain disjointness check is added in 2.2, once domain classes exist.

Verification: `npm run test:file -- apps/chat-api/src/config/tests/environment-composition.spec.ts`

## 2. Composition proven on one domain

- [ ] 2.1 Create `env/celebrations.env.ts` with `CelebrationsEnv`: the six `UI_EVENT*` vars plus the private celebration patterns and `parseCelebrationList`, moved unchanged. Turn `EnvironmentVariables` into `class EnvironmentVariables extends IntersectionType(RestEnv, CelebrationsEnv) {}`, where `RestEnv` is the remaining in-file class, renamed and not exported.
- [ ] 2.2 Add the per-domain union and disjointness assertions to the composition spec.

Verification: `npm run test:file -- apps/chat-api/src/config/tests/environment-composition.spec.ts apps/chat-api/src/config/validation.spec.ts apps/chat-api/src/config/tests/validation.spec.ts`

## 3. Remaining domains

Each task moves one domain's vars from `RestEnv` into its `env/<domain>.env.ts` per the design D2 table, adds the class to the `IntersectionType` list, and runs the slice verification.

- [ ] 3.1 `env/auth-providers.env.ts`: `AuthProvidersEnv`, the nine `AUTH_<PROVIDER>_*` groups.
- [ ] 3.2 `env/auth.env.ts`: `AuthEnv`.
- [ ] 3.3 `env/server.env.ts`: `ServerEnv`, which also owns `ApplicationLogLevel`, re-exported from the root.
- [ ] 3.4 `env/dial.env.ts`: `DialEnv`.
- [ ] 3.5 `env/files.env.ts`: `FilesEnv`.
- [ ] 3.6 `env/generation.env.ts`: `GenerationEnv`.
- [ ] 3.7 `env/client-ui.env.ts`: `ClientUiEnv`, which also owns `IFRAME_ORIGIN_PATTERN`, re-exported from the root.
- [ ] 3.8 `env/feature-flags.env.ts`: `FeatureFlagsEnv`.
- [ ] 3.9 `env/integrations.env.ts`: `IntegrationsEnv`. After this, `RestEnv` is empty and is deleted. The root file now holds only imports, re-exports and the composition, and is under 80 lines.

Slice verification: `npm run test:file -- apps/chat-api/src/config/tests/environment-composition.spec.ts apps/chat-api/src/config/validation.spec.ts apps/chat-api/src/config/tests/validation.spec.ts apps/chat-api/src/config/tests/catalog-creation-environment.spec.ts apps/chat-api/src/config/tests/text-refinement-environment.spec.ts apps/chat-api/src/config/tests/user-usage-deployment-types-environment.spec.ts apps/chat-api/src/config/tests/prompt-overrides.spec.ts`

## 4. Docs

- [ ] 4.1 Update `apps/chat-api/AGENTS.md` (the layout tree, the env-validation pointer and the "declare on" rule), `.claude/rules/nestjs-best-practices.md` (the "Env is validated at boot" bullet) and `docs/architecture.md` (the `config/` tree comment), per design D4.

Verification: `npm run validate:docs`

## 5. Close

- [ ] 5.1 Confirm that no `env/*.env.ts` file exceeds about 350 lines, that `environment.config.ts` has no `@Is`/`@Transform`, and that `git diff --stat` touches no `EnvironmentVariables` importer outside `config/`.
- [ ] 5.2 `npm exec nx run-many -- -t test lint build typecheck -p chat-api --excludeTaskDependencies --parallel=1` passes.
- [ ] 5.3 `npm run openapi:check` reports no diff, and `npm run validate:specs` and `npm run validate:docs` pass.
- [ ] 5.4 Run `npm run verify:full` once.

## 6. Follow-up (out of scope)

- [ ] 6.1 Narrow `ConfigService<EnvironmentVariables>` injections to their domain class where a service reads only one domain.
- [ ] 6.2 Rename `throwIfArchiveUploadAborted` (carried from `extract-archive-upload-service` 4.1).

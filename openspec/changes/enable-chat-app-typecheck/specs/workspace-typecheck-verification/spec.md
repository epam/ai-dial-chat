## ADDED Requirements

### Requirement: No project's typecheck target is disabled by configuration

Every project whose Nx project graph contains a `typecheck` target SHALL have that target run the TypeScript compiler. A target that Nx disables, for example the inferred target replaced by an echo because a project tsconfig sets `noEmit: true`, SHALL NOT exist. In particular, no `tsconfig*.json` of a project with a `typecheck` target SHALL set `"noEmit": true`, and `apps/chat/tsconfig.spec.json` SHALL NOT set it.

The repository SHALL guard this with `tools/typecheck-targets.spec.mjs`, run by `npm run typecheck:targets:test` and by the `typecheck` job of `.github/workflows/pr.yml` before the workspace typecheck. The guard builds the Nx project graph and fails, naming the project, when any `typecheck` target's command is the disabled-target echo.

#### Scenario: The application is actually type-checked

- **WHEN** `nx run @epam/chat:typecheck` runs
- **THEN** it runs `tsc --build` over `apps/chat`'s app and spec tsconfigs and reports their diagnostics, and it does not print that the target is disabled

#### Scenario: Re-adding noEmit is caught

- **WHEN** `"noEmit": true` is added back to `apps/chat/tsconfig.spec.json` and `npm run typecheck:targets:test` runs
- **THEN** the guard fails and names `@epam/chat`

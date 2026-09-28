# Tasks

Slicing strategy: vertical, single slice. The type additions, mapping, and row
rendering for models and applications all live in the same two files and are only
meaningfully testable together (a `hasSkills` flag with no row push is inert; a row
push with no flag makes tests uncompilable), so they are done and verified as one
group rather than split across artificial boundaries.

## 1. Add `hasSkills` capability flag and render it in model/agent Capabilities

- [x] 1.1 In `libs/chat-hooks/src/catalog/entity-details.ts`, add `hasSkills?: boolean`
      to `ModelCapabilities` and to `AgentCapabilities`. Update the existing
      "deliberately not rendered" comment blocks above each interface only if needed
      so they still accurately describe which flags are hidden vs. rendered (they
      should NOT list `hasSkills`, since it is rendered). Do not touch
      `ToolsetCapabilities`. Verify with `npm exec nx typecheck chat-hooks`.
- [x] 1.2 In `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`, add
      `hasSkills?: boolean` to the `DeploymentCapabilities` interface (~line 405-419)
      and one line `hasSkills: features.skillsSupported,` in `mapFeaturesToCapabilities`
      (~line 427-447), reading from `DeploymentFeaturesDetailsDto.skillsSupported`
      (already generated in `@epam/ai-dial-chat-api-client`, no client changes needed).
      Verify with `npm exec nx typecheck chat-hooks`.
- [x] 1.3 In the same file, in `mapModelDetails` (~line 62-81), after the existing
      `reasoningEfforts` push, add:
      `if (c.hasSkills != null) specs.push({ label: 'Skills', value: c.hasSkills });`
      In `mapAgentDetails` (~line 200-247), after the existing `hasConfiguration` push
      (`'Configuration schema'`), add the same `hasSkills` → `'Skills'` push. Verify
      by running the existing suite once both mappers compile:
      `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts`
      (should still pass unchanged, confirming no regression before new tests are added).
- [x] 1.4 Add unit tests to
      `libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts`
      covering: a model with `features.skillsSupported: true` renders a `Skills` row
      (value `true`) as the last entry in the model's `Capabilities` section; an
      application with `features.skillsSupported: true` renders the same `Skills` row
      as the last entry in the application's `Capabilities` section; a model/application
      whose `features` omits `skillsSupported` renders no `Skills` row; a toolset with
      `features.skillsSupported: true` still produces no `Capabilities` section at all
      (unchanged behavior, guards against accidentally wiring `hasSkills` into
      `ToolsetCapabilities`). Verify with
      `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts`.
- [x] 1.5 Run `npm run verify:changed` to confirm lint/typecheck/test pass for the
      affected `chat-hooks` project as a whole.

## 2. Close out the change

- [x] 2.1 Run `npm run verify:full` once, confirming the full non-mutating
      verification suite passes with no regressions outside `chat-hooks`.
      (`format:check` failed on a pre-existing, untouched-by-this-change
      formatting drift in `apps/chat-api/README.md`, which blocked the
      chained `test:full` step; ran `npm run test:full:quiet` directly to
      confirm — one pre-existing, unrelated failure in
      `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`
      (`aiTextRefinementAvailable`), outside `apps/chat-api` which this
      change never touches. No regressions from this change; both issues
      are flagged for separate follow-up, not fixed here.)

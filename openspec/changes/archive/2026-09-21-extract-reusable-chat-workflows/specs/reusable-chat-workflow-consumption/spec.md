## ADDED Requirements

### Requirement: Public artifacts are sufficient for an independent host

All three new workflows SHALL be exported through their documented owning-package entries with resolvable JavaScript, declarations and required CSS. Every public reachable type SHALL be exported. An isolated consumer SHALL install locally packed artifacts and their declared dependency closure outside the monorepo's own dependency graph, without source aliases, `@epam/source` resolution, parent contexts or accidental workspace node_modules fallback. Existing exports SHALL remain compatible and other packages SHALL NOT add forwarding exports for these additions.

Package consumption (install, resolve, typecheck, bundle, required CSS) and workflow behavior are proven by two separate, proportionate mechanisms rather than one combined runtime fixture: behavior is proven by each workflow's own library Vitest/Testing Library suite (injected host callbacks and structural data, no parent providers — see the three sibling `reusable-*-workflow` specs); package consumption is proven by minimal packed-artifact consumer fixtures. Neither mechanism renders or drives a mounted component tree against an installed tarball, and no fixture installs a test runner into an isolated consumer — that gap is intentional and is documented in `docs/reusable-chat-workflows.md`, not silently absorbed.

#### Scenario: Packed consumer typecheck and bundle
- **WHEN** a consumer imports the documented workflow APIs from locally packed packages — `chat-hooks/skill-editor` and `chat-hooks/file-manager` via the existing `libs/chat-hooks/e2e-fixtures` subpath fixtures, and `@epam/ai-dial-skills`/`@epam/ai-dial-prompts` via a new `tools/reusable-workflows-consumer-fixture` that reuses that same harness's `createFixtureDependencyResolver`/`createFixtureDir` to install both packages' full dependency and peer closure — every workspace-sibling dependency packed, every required peer (including peers-of-peers) pinned to this workspace's exact lockfile version — outside the repo checkout, with no `--legacy-peer-deps` escape hatch
- **THEN** a real `tsc --noEmit` and a production Vite build both succeed against the installed artifacts

#### Scenario: Owning-package assets
- **WHEN** the consumer imports documented styles and names public option/label/result types
- **THEN** all imports resolve from installed artifacts without private deep paths or copies of parent source, and each owning package's `./styles.css` is present in the built output

### Requirement: Parent adoption proves meaningful reuse

Parent app adapters SHALL call the public workflows and retain only host-owned configuration, labels, routing/catalog rendering, request setup and side effects. A library export that leaves the original workflow active in the app SHALL NOT satisfy this change. Existing behavioral tests SHALL cover both library behavior and host wiring.

#### Scenario: Parent workflow ownership
- **WHEN** the parent executes any of the three scenarios
- **THEN** workflow state transitions run through the library implementation and the app has no parallel copy of that state machine

### Requirement: Feature loading boundaries are preserved

Skill import and file picker controllers SHALL be reachable through existing `chat-hooks/skill-editor` and `chat-hooks/file-manager` entries. The prompt workflow SHALL not introduce eager file-manager, editor or canvas-engine imports and SHALL preserve lazy host catalog rendering.

#### Scenario: Prompt-only consumer
- **WHEN** the `@epam/ai-dial-prompts` packed fixture typechecks and bundles a minimal entry importing `usePromptSelectorOverlay`
- **THEN** neither its manifest's dependency/peer closure nor its built bundle names or contains `@epam/ai-dial-react-file-manager`, an editor engine, or a canvas-rendering engine

### Requirement: Client application adoption is documented and bounded

`docs/reusable-chat-workflows.md` SHALL map each existing client application adapter/component to its new public import, removable workflow logic and retained host configuration, labels, side effects and styles. It SHALL identify the tested artifact set, required aligned release and automated verification. This parent change SHALL neither modify the client application nor publish packages, and SHALL not claim the client application has migrated based only on a fixture.

#### Scenario: Maintainer prepares the client application migration
- **WHEN** a maintainer follows the adoption map after an aligned package release exists
- **THEN** each of the three flows has a concrete replacement and integration checklist without requiring copied parent workflow source

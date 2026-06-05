<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `npm exec nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## Architecture context

Full tech stack, path aliases, commands, and architecture layout live in `openspec/config.yaml` — read it before designing or implementing features. The `opsx:*` skills use it as their primary context.

## Library isolation

Libraries under `libs/*` must stay maximally isolated from host applications and external interfaces. A lib must not know host-owned integration details such as REST paths, `/api` routes, generated API clients, `apps/chat/src/server-api`, app contexts, auth/session/cookies, environment variables, feature flags, routing/navigation, analytics/telemetry, logging transports, persistence/storage keys and schemas, deployment/tenant/provider details, third-party SDK setup, platform bridges, or app-specific URL schemes.

Put application, backend, platform, and external-system knowledge at the application edge (`apps/chat/src/server-api`, app-level containers, providers, route handlers, or other app adapters). Pass data, resolved values, and behavior into libs through props, typed callbacks, or narrow interfaces. For example, a lib may accept `iconUrl`, `resolveIconUrl`, or `onDownloadFile`; it must not construct `/api/v1/files/download?...`, read app storage keys, initialize analytics, or decide navigation targets itself.

Exception: `libs/chat-api-client` is a generated OpenAPI client package. It may contain generated endpoint paths, DTOs, runtime transport code, and OpenAPI artifacts because that is its only purpose. Do not hand-edit generated client files or add app-specific behavior there; update the backend Swagger/OpenAPI source and regenerate with the repository OpenAPI scripts. Other hand-authored libs still must not import or wrap `@epam/chat-api-client`; apps consume it through app-level adapters such as `apps/chat/src/server-api`.

## Cross-agent feature research

For broad "global feature" research (best practices, architecture alternatives, trade-offs), use `./.claude/skills/feature-research/SKILL.md` as the default workflow before implementation.

Expected output:

- Context and constraints
- 2-4 options with trade-offs
- Recommended approach
- Risks and rollback notes
- Thin-slice implementation draft with Nx verification steps

## Skill routing

Use these local skills directly:

- `./.claude/skills/incremental-implementation/SKILL.md` for multi-file implementation and refactors
- `./.claude/skills/code-review-and-quality/SKILL.md` for review before merge or any quality pass
- `./.claude/skills/feature-research/SKILL.md` for broad feature research and trade-off analysis
- `./.claude/skills/figma/SKILL.md` for translating Figma designs into React components
- `./.claude/skills/responsive-design/SKILL.md` for any UI work that must support both mobile and desktop, or any review of mobile parity

Default behavior:

- Implementation work should follow incremental slices with per-slice verification.
- Before merge (or on explicit review requests), run the five-axis quality review.
- Before changing anything under `libs/*`, explicitly check the library isolation rule: host/external contracts are adapted by apps, not embedded in libs.
- UI work is mobile-first by default. The project's named Tailwind breakpoints (`mobile`, `small_tablet`, `large_tablet`, `desktop`, `large_desktop`) live in `tailwind.config.js`; do not introduce `sm:`/`md:`/`lg:`/`xl:` defaults. When a component must branch in JS, use `useBreakpoint` / `useIsMobile` from `apps/chat/src/hooks/breakpoint/useBreakpoint.ts` rather than reading `window.innerWidth`.

## @epam/ai-dial-ui-kit MCP tools

Use these two tools for all UI kit discovery and documentation needs: `searchEntity(entity, query?)` and `getEntityDetails(entity, name?)`. If you need to look up **ANYTHING** about the ui kit, use the MCP server. **Never** use `grep`, `glob`, `find`, or similar file system tools to discover components — they miss type information and examples.

### UI Kit Breaking Changes & Migration

When you encounter errors after a ui kit package upgrade, or when a prop no longer exists on a component:

1. Determine the **target release version**: check the installed version in `package.json` (`@epam/ai-dial-ui-kit`). Dev versions (`x.y.z-dev.N`) map to the next release — e.g. `0.11.0-dev.17` → look up `0.11.0`.
2. Read `node_modules/@epam/ai-dial-ui-kit/dist/CHANGELOG.md` for `### Breaking Changes` entries at or between the previous release and the target release.
3. Follow the linked migration guides found at `node_modules/@epam/ai-dial-ui-kit/dist/migration-guides/<version>/`.
4. Use `getEntityDetails("component", "DialXxx")` to confirm the current prop signature before applying the fix.

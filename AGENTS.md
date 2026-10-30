# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `npm exec nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure
- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools
- Use nx_docs for advanced config options, unfamiliar flags, migration guides and plugin configuration — not for basic generator syntax or standard commands

## Architecture context

Full tech stack, path aliases, commands, and architecture layout live in `openspec/config.yaml` — read it before designing or implementing features. The `opsx:*` skills use it as their primary context.

Spec work follows the OpenSpec lifecycle: **explore → propose → apply → archive** (`opsx:explore`, `opsx:propose`, `opsx:apply`, `opsx:archive`). `npm run validate:specs` (PR gate) checks that repo paths and translation keys cited in `openspec/specs/**` exist, and `npm run spec:impact` (advisory) lists specs whose referenced files changed without the spec — see `.claude/rules/docs.md` "Spec references".

Internal `@epam/*` libs resolve via `tsconfig.base.json` paths + the Nx project graph — fix `@epam/*` resolution errors (`cannot find module`, `TS2307`) there and in the lib's own `package.json`, not by hand-editing `node_modules` symlinks or running `npm install --workspace`. Use the `nx-workspace` skill to diagnose.

## Library isolation

Libraries under `libs/*` must stay maximally isolated from host applications and external interfaces. A lib must not know host-owned integration details such as REST paths, `/api` routes, generated API clients, `apps/chat/src/server-api`, app contexts, auth/session/cookies, environment variables, feature flags, routing/navigation, analytics/telemetry, logging transports, persistence/storage keys and schemas, deployment/tenant/provider details, third-party SDK setup, platform bridges, or app-specific URL schemes.

Put application, backend, platform, and external-system knowledge at the application edge (`apps/chat/src/server-api`, app-level containers, providers, route handlers, or other app adapters). Pass data, resolved values, and behavior into libs through props, typed callbacks, or narrow interfaces. For example, a lib may accept `iconUrl`, `resolveIconUrl`, or `onDownloadFile`; it must not construct `/api/v1/files/download?...`, read app storage keys, initialize analytics, or decide navigation targets itself.

Exception: `libs/chat-api-client` is a generated OpenAPI client package. It may contain generated endpoint paths, DTOs, runtime transport code, and OpenAPI artifacts because that is its only purpose. Do not hand-edit generated client files or add app-specific behavior there; update the backend Swagger/OpenAPI source and regenerate with the repository OpenAPI scripts. Other hand-authored libs still must not import or wrap `@epam/ai-dial-chat-api-client`; apps consume it through app-level adapters such as `apps/chat/src/server-api`.

Second, narrower exception: `libs/chat-hooks` may depend on `@epam/ai-dial-chat-api-client`'s types and operation signatures, and may contain the thin request/response logic that calling those operations requires (equivalent in shape to today's `apps/chat/src/server-api/*.api.ts` wrappers), because every DIAL-Core-backed chat application this library serves calls the same generated client against the same API. It may also depend on already-published, host-agnostic packages that describe DIAL Core's data shapes (`@epam/ai-dial-chat-shared`, `@epam/ai-dial-share`, `@epam/ai-dial-quotations`, `@epam/ai-dial-source-panel`, `@epam/ai-dial-attachment-canvas`). This exception does not extend further: `libs/chat-hooks` must still never construct or configure a client instance (base URL, auth headers, CSRF token) — every hook that calls DIAL Core accepts an already-configured client instance as a parameter — and must still never import app contexts, routing, auth/session/cookies, environment variables, feature flags, i18n, or UI-kit component rendering.

`libs/chat-hooks` holds non-rendering code only — hooks, functions, types and enums, never a component (it has no `.tsx` outside its tests). Two edges between `chat-hooks` and the feature libs are allowed on purpose, each with a limit that lint enforces:

- **`chat-hooks` → feature libs.** `chat-hooks` adapts DIAL Core data into the props feature libs render, so beyond the packages named above it may import a feature lib's types, enums and pure functions (today from `@epam/ai-dial-catalog`, `@epam/ai-dial-skill-editor`, `@epam/ai-dial-scheduled-tasks`, `@epam/ai-dial-conversation-input`, `@epam/ai-dial-attachment-input`, `@epam/ai-dial-mcp-apps`, `@epam/ai-dial-publish-panel`, `@epam/ai-dial-usage-dashboard`, `@epam/ai-dial-projects` and `@epam/ai-dial-chat-overlay`). It never imports a feature lib's hook (`use*`) or component.
- **`toolset-editor` → `chat-hooks`.** Among feature libs only `libs/toolset-editor` imports `@epam/ai-dial-chat-hooks` (`getApiErrorDetails` and the toolset-auth enums). Every other feature lib takes behaviour through props and callbacks.

Two narrower exceptions — leaked third-party grid types (`useGridEditingScroll`) and DIAL-Core response-to-display adapters in `chat-hooks` (the usage mappers) — are defined in `.claude/rules/libs.md` "Narrow isolation exceptions"; they apply only there and only with a justification recorded in that change's design doc.

The boundaries lint enforces — one `type:*` tag per project, which kinds may import which, that only `apps/chat` and `libs/chat-hooks` import `@epam/ai-dial-chat-api-client`, and the two limits above — are configured in `eslint.config.mjs`, listed in `docs/architecture.md` "Module boundary rules", and proven by `tools/module-boundaries.spec.mjs`.

## Working defaults

- Implementation work follows incremental slices with per-slice verification.
- Before merge (or on explicit review requests), run the five-axis quality review (`code-review-and-quality` skill).
- `address-current-branch-review`: fix requests do not authorize inline replies; reply only after the user explicitly asks and the pushed fix is visible in the PR.
- `celebration-scene-ideas`: include scene-specific performance budgets and use OpenSpec propose/apply when implementation is requested.
- Before changing anything under `libs/*`, check the library isolation rule above. Libs are also governed by `.claude/rules/libs.md` (manifest metadata, `dependencies` vs `peerDependencies`, the `exports`/`styles.css` contract, README shape, JSDoc, `buildCssVars` theming) and `.claude/rules/lib-styling.md` — read `libs.md` before touching a lib manifest. A host must install one package and render without a peer laundry list or a bundler alias.
- UI work is mobile-first. The named Tailwind breakpoints (`mobile`, `desktop`) live in `tools/tailwind/theme.css`; do not introduce `small_tablet:`/`large_tablet:`/`large_desktop:` or `sm:`/`md:`/`lg:`/`xl:` prefixes. When a component must branch in JS, use `useBreakpoint` / `useIsMobile` from `apps/chat/src/hooks/breakpoint/useBreakpoint.ts`, never `window.innerWidth`.

## Docs

Ground-truth design docs live in `docs/`; every app and lib owns a `README.md` that documents its public API. Use the `dial-docs` skill to find the one authoritative doc before changing or explaining documented behavior. When a change alters documented behavior, update that doc, any affected diagram, and `docs/architecture.md` when structure changes — in the **same commit** — then run `npm run validate:docs`. `.claude/rules/docs.md` has the full rule set and update matrix.

## Cross-cutting UI rules

Details live in path-scoped rules; the short version applies everywhere:

- **RTL** (`.claude/rules/rtl.md`): every app and lib supports Arabic and other RTL locales. Use logical Tailwind classes (`ms-*`, `ps-*`, `inset-s-*`, `text-start`, `border-s-*`, `rounded-s-*`) and CSS logical properties instead of physical ones; mirror directional icons with `rtl:scale-x-[-1]`; libs never read the language to decide direction.
- **Accessibility** (`.claude/rules/a11y.md`): target WCAG 2.1 AAA on all interactive UI by default; dynamic feedback goes through the kit `LiveRegion`, mounted before its text.
- **Lib strings** (`i18n-strings` skill): in `libs/*` every user-visible string comes from a `*Labels` prop with an English default; `apps/chat` fills each one with `t()` and an enum key.
- **Lib colors and typography** (`lib-theming` skill): in `libs/*` every color comes from a `*Colors` prop as `var(--<prefix>-x, fallback)` in the component's `.module.scss`, and every `dial-*-text` class from a `*ClassName` prop default — never hardcoded in lib JSX.
- **Search results** (`.claude/rules/search-results-highlight.md`): render matched text with `Highlight` from `@epam/ai-dial-ui-kit`, threading the query down as `searchQuery`.
- **UI kit** (`.claude/rules/all-tsx.md`): discover kit components only through the `@epam/ai-dial-ui-kit` MCP tools (`searchEntity`, `getEntityDetails`), never by grepping the package; always use 2.0 components over legacy `Dial*`; pass `stroke={DIAL_KIT_ICON_STROKE}` on every Tabler outline icon. The upgrade/breaking-change workflow is in the same file.
- **TypeScript** (`.claude/rules/all-ts.md`): no `.js`/`.ts` extensions in relative specifiers, string enums over literal unions, `/* */` for multi-line comments.

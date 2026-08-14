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

Spec work follows the OpenSpec lifecycle: **explore → propose → apply → archive** (`opsx:explore` to think through an idea, `opsx:propose` to create a change with design/specs/tasks, `opsx:apply` to implement the tasks, `opsx:archive` to finalize once done).

Internal `@epam/*` libs resolve via `tsconfig.base.json` paths + the Nx project graph — fix `@epam/*` resolution errors (`cannot find module`, `TS2307`) there and in the lib's own `package.json`, not by hand-editing `node_modules` symlinks or running `npm install --workspace`. Use the `nx-workspace` skill to diagnose.

## Library isolation

Libraries under `libs/*` must stay maximally isolated from host applications and external interfaces. A lib must not know host-owned integration details such as REST paths, `/api` routes, generated API clients, `apps/chat/src/server-api`, app contexts, auth/session/cookies, environment variables, feature flags, routing/navigation, analytics/telemetry, logging transports, persistence/storage keys and schemas, deployment/tenant/provider details, third-party SDK setup, platform bridges, or app-specific URL schemes.

Put application, backend, platform, and external-system knowledge at the application edge (`apps/chat/src/server-api`, app-level containers, providers, route handlers, or other app adapters). Pass data, resolved values, and behavior into libs through props, typed callbacks, or narrow interfaces. For example, a lib may accept `iconUrl`, `resolveIconUrl`, or `onDownloadFile`; it must not construct `/api/v1/files/download?...`, read app storage keys, initialize analytics, or decide navigation targets itself.

Exception: `libs/chat-api-client` is a generated OpenAPI client package. It may contain generated endpoint paths, DTOs, runtime transport code, and OpenAPI artifacts because that is its only purpose. Do not hand-edit generated client files or add app-specific behavior there; update the backend Swagger/OpenAPI source and regenerate with the repository OpenAPI scripts. Other hand-authored libs still must not import or wrap `@epam/chat-api-client`; apps consume it through app-level adapters such as `apps/chat/src/server-api`.

## Skill routing

Use these local skills directly:

- `./.agents/skills/address-current-branch-review/SKILL.md` for processing unresolved GitHub review threads on the current branch. Fix requests do not authorize inline replies; reply only after the user explicitly asks and the pushed fix is visible in the PR.
- `./.claude/skills/code-review-and-quality/SKILL.md` for review before merge or any quality pass
- `./.claude/skills/refactoring-audit/SKILL.md` for deep refactoring/tech-debt audits and local planning docs (`refactoring-backend.md`, `refactoring-frontend.md`)
- `./.claude/skills/figma/SKILL.md` for translating Figma designs into React components
- `./.claude/skills/responsive-design/SKILL.md` for any UI work that must support both mobile and desktop, or any review of mobile parity

Default behavior:

- Implementation work should follow incremental slices with per-slice verification.
- Before merge (or on explicit review requests), run the five-axis quality review.
- Before changing anything under `libs/*`, explicitly check the library isolation rule: host/external contracts are adapted by apps, not embedded in libs.
- UI work is mobile-first by default. The project's named Tailwind breakpoints (`mobile`, `desktop`) live in `tailwind.config.js`; do not introduce `small_tablet:`/`large_tablet:`/`large_desktop:` or `sm:`/`md:`/`lg:`/`xl:` prefixes. When a component must branch in JS, use `useBreakpoint` / `useIsMobile` from `apps/chat/src/hooks/breakpoint/useBreakpoint.ts` rather than reading `window.innerWidth`.

## Docs

Ground-truth design docs live in `docs/` — app architecture, technical/product requirements, and the auth subsystem (OIDC login/logout, session cookies, token refresh, BFF flow, SessionGuard). Every app and lib additionally owns a `README.md` that documents its public API.

- **Reading:** Before changing or explaining documented behavior, use the `dial-docs` skill to find the one authoritative doc. Don't guess from memory and don't read all docs — the skill is an index that routes you to the right one.
- **Writing:** When a change alters behavior a doc describes, update that doc and any affected diagram in the **same commit**.
- **Verifying:** Run `npm run validate:docs` after touching any README, `docs/**`, a lib's public API, or a project's `package.json`. It checks README coverage and H1/package identity, lib `package.json` metadata, that every relative link resolves, and that every name a lib README imports is actually exported. Nothing in `lint`/`test`/`build` covers this.

READMEs are part of the public contract: a documented prop that a component never had is worse than no README, because callers copy it. Treat every code fence as if it were type-checked — names, required props, value types, and owning packages must all match the source. `.claude/rules/docs.md` has the full rule set, the same-change update matrix, and the drift classes that have actually reached the main line here.

### `docs/architecture.md` is structural — keep it current

`docs/architecture.md` is the map of what exists. It goes stale silently, because nothing fails when a new library or backend domain is missing from it. Update it in the **same change**, not later, whenever you:

- add, rename, or remove a library under `libs/` or an app under `apps/`
- add, rename, or remove a backend domain folder under `apps/chat-api/src/` or a controller base path
- add or remove a React context in `apps/chat/src/context/`, a route folder under `pages/`, or an entry in the `ApiEndpoints` enum
- change a cross-cutting mechanism the document describes — auth/session/CSRF, SSE streaming, theming token flow, the overlay protocol, styling tiers, or module boundaries
- change a tooling major version listed in the Monorepo & Tooling table

Two rules for the content: state what the code does today, and when intent and code disagree, say so explicitly rather than documenting the intent (see the `Open` rows in the Decision Log). Deep detail belongs in the specialized doc — `docs/theme-customization.md`, `docs/chat-overlay-migration-guide.md`, `docs/auth/` — with `architecture.md` carrying a summary and a link, so the same fact is not maintained twice.

## TypeScript module imports

- In `.ts` and `.tsx` source files, omit `.js`, `.jsx`, `.ts`, and `.tsx` from relative module specifiers. Write `./Component` or `../models/Message`, not `./Component.js`.
- Keep extensions that identify non-code resources such as `.css`, `.scss`, `.json`, and image files, and preserve package subpaths whose published API explicitly includes an extension.
- Vite-built apps and libraries must use `moduleResolution: "bundler"` with an ES module mode such as `module: "esnext"`. Do not switch frontend code to `node16`/`nodenext` resolution to make `.js` source specifiers compile.
- Native Node ESM packages that are executed without a bundler are a separate case: use a Node-compatible build strategy instead of introducing `.js` specifiers into shared frontend source.

## TypeScript enums

- Use string enums for named finite sets of statuses, modes, variants, or lifecycle states instead of string-literal union types. Prefer `enum UploadStatus { Idle = 'idle' }` over `type UploadStatus = 'idle' | ...` when the values are reused across a module, exported, or compared in component logic/tests.

## Code comments

- Use block comments (`/* ... */`) for explanatory comments that span multiple lines. Keep `//` comments for short, single-line notes only.

## RTL and Arabic language support

All apps and libs must support Arabic (`ar`) and any other right-to-left locale. Arabic changes the visual direction of the entire UI.

### Direction attribute

The `<html>` element's `dir` attribute must be set dynamically at runtime. When the active language is RTL (Arabic `ar`, Hebrew `he`, Persian `fa`, Urdu `ur`), set `dir="rtl"`; otherwise `dir="ltr"`. Never hardcode `dir` or `lang` in static HTML. The i18n config (`apps/chat/src/i18n/config.ts`) must call `document.documentElement.dir` and `document.documentElement.lang` on every language change.

### Tailwind: use logical properties, not physical ones

Replace every physical-direction Tailwind class with its logical equivalent so that layout flips automatically when `dir="rtl"` is on an ancestor:

| Physical (forbidden for directional use) | Logical (required)                            |
| ---------------------------------------- | --------------------------------------------- |
| `ml-*` / `mr-*`                          | `ms-*` / `me-*`                               |
| `pl-*` / `pr-*`                          | `ps-*` / `pe-*`                               |
| `text-left` / `text-right`               | `text-start` / `text-end`                     |
| `left-*` / `right-*`                     | `start-*` / `end-*`                           |
| `border-l-*` / `border-r-*`              | `border-s-*` / `border-e-*`                   |
| `rounded-l-*` / `rounded-r-*`            | `rounded-s-*` / `rounded-e-*`                 |
| `inset-x-*` one-sided                    | `inset-inline-start-*` / `inset-inline-end-*` |

In CSS/SCSS files use CSS logical properties: `margin-inline-start/end`, `padding-inline-start/end`, `inset-inline-start/end`, `border-inline-start/end`.

**Exception — physical classes are allowed** only for elements that must NOT flip: decorative/symmetric elements, fixed-position UI chrome that is intentionally pinned to a physical screen edge, or when an explicit `rtl:` counterpart class is placed alongside (e.g. `left-0 rtl:left-auto rtl:right-0`).

### Directional icons

Icons with inherent left/right meaning (back/forward arrows, chevrons, send button, indent/dedent) must be mirrored in RTL. Use `rtl:scale-x-[-1]` on the icon element, or wrap with `[dir='rtl']:scale-x-[-1]` in CSS. Icons that are symmetric or represent a concept (close ×, add +, settings ⚙) must NOT be flipped.

### `rtl:` Tailwind variant

Tailwind's `rtl:` variant (e.g. `rtl:rotate-180`, `rtl:scale-x-[-1]`, `rtl:flex-row-reverse`) works when a `dir="rtl"` ancestor is present. Use it when a logical property equivalent does not cover the needed layout change.

### Libs and direction context

Libs (`libs/*`) must NOT import i18n or read the current language to determine direction. Direction is inherited through the CSS cascade from the `dir` attribute on `<html>`. Libs rely on CSS logical properties for automatic RTL behaviour. If a lib component needs an explicit direction prop (rare), it accepts `dir?: 'ltr' | 'rtl'` and passes it to the root element.

### Adding a new locale

1. Create `apps/chat/src/i18n/locales/<lang>.json` with all keys from `en.json`.
2. Register the locale in `apps/chat/src/i18n/config.ts`.
3. Add the locale to the language selector UI.
4. If the locale is RTL, add its language code to the RTL language list in the dir-switching logic.

## Accessibility (a11y)

All apps and libs target WCAG 2.1 **AAA**. Apply this by default on any interactive UI work, not only when explicitly asked for an accessibility pass — decorative icons inside already-labeled controls need `aria-hidden`; toggle buttons (like/dislike, expand/collapse) need `aria-pressed`/`aria-expanded`; closed/hidden panels with focusable descendants use `inert`, not `aria-hidden`, to avoid a keyboard focus trap; dynamic feedback (copy confirmation, no-results, streaming text) needs an `aria-live` status region; text-color fallbacks in `var(--token, #hex)` chains must resolve to at least 7:1 contrast. See `.claude/rules/a11y.md` for the full pattern list and code examples.

## Search result highlighting

Whenever implementing or modifying a search feature (search bars, filterable dropdowns, model/deployment pickers, conversation search, file/attachment search, sources panels, catalog/app search, etc.), render each result's matched text with the shared `Highlight` component (exported as `Highlight` from `@epam/ai-dial-ui-kit`) instead of plain text or a bespoke highlighter. Thread the search query down through intermediate props (e.g. `searchQuery`) to whichever component renders the result label. See `.claude/rules/search-results-highlight.md` for details.

## @epam/ai-dial-ui-kit MCP tools

Use these two tools for all UI kit discovery and documentation needs: `searchEntity(entity, query?)` and `getEntityDetails(entity, name?)`. If you need to look up **ANYTHING** about the ui kit, use the MCP server. **Never** use `grep`, `glob`, `find`, or similar file system tools to discover components — they miss type information and examples.

### Component generations — always use 2.0

The kit ships two generations: **2.0** (current design system, exported without the `Dial` prefix — `Button`, `Input`, `Select`, `Popup`, `Tabs`) and **1.0** (legacy `Dial*`). Always use the 2.0 component; fall back to a `Dial*` one only when the MCP lookup shows no 2.0 replacement exists. `searchEntity` ranks 2.0 first and flags superseded 1.0 entries with "Use instead". See `.claude/rules/all-tsx.md` for details.

### UI Kit Breaking Changes & Migration

When you encounter errors after a ui kit package upgrade, or when a prop no longer exists on a component:

1. Determine the **target release version**: check the installed version in `package.json` (`@epam/ai-dial-ui-kit`). Dev versions (`x.y.z-dev.N`) map to the next release — e.g. `0.11.0.18` → look up `0.11.0`.
2. Read `node_modules/@epam/ai-dial-ui-kit/dist/CHANGELOG.md` for `### Breaking Changes` entries at or between the previous release and the target release.
3. Follow the linked migration guides found at `node_modules/@epam/ai-dial-ui-kit/dist/migration-guides/<version>/`.
4. Use `getEntityDetails("component", "DialXxx")` to confirm the current prop signature before applying the fix.

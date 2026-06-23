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

- `./.agents/skills/address-current-branch-review/SKILL.md` for processing unresolved GitHub review threads on the current branch. Fix requests do not authorize inline replies; reply only after the user explicitly asks and the pushed fix is visible in the PR.
- `./.claude/skills/incremental-implementation/SKILL.md` for multi-file implementation and refactors
- `./.claude/skills/code-review-and-quality/SKILL.md` for review before merge or any quality pass
- `./.claude/skills/feature-research/SKILL.md` for broad feature research and trade-off analysis
- `./.claude/skills/figma/SKILL.md` for translating Figma designs into React components
- `./.claude/skills/responsive-design/SKILL.md` for any UI work that must support both mobile and desktop, or any review of mobile parity
- `./.claude/skills/dial-docs/SKILL.md` to find the right design doc in `docs/` on demand — app architecture, technical/product requirements, or the auth subsystem (read before changing documented behavior; update the doc in the same commit)

Default behavior:

- Implementation work should follow incremental slices with per-slice verification.
- Before merge (or on explicit review requests), run the five-axis quality review.
- Before changing anything under `libs/*`, explicitly check the library isolation rule: host/external contracts are adapted by apps, not embedded in libs.
- UI work is mobile-first by default. The project's named Tailwind breakpoints (`mobile`, `desktop`) live in `tailwind.config.js`; do not introduce `small_tablet:`/`large_tablet:`/`large_desktop:` or `sm:`/`md:`/`lg:`/`xl:` prefixes. When a component must branch in JS, use `useBreakpoint` / `useIsMobile` from `apps/chat/src/hooks/breakpoint/useBreakpoint.ts` rather than reading `window.innerWidth`.

## TypeScript module imports

- In `.ts` and `.tsx` source files, omit `.js`, `.jsx`, `.ts`, and `.tsx` from relative module specifiers. Write `./Component` or `../models/Message`, not `./Component.js`.
- Keep extensions that identify non-code resources such as `.css`, `.scss`, `.json`, and image files, and preserve package subpaths whose published API explicitly includes an extension.
- Vite-built apps and libraries must use `moduleResolution: "bundler"` with an ES module mode such as `module: "esnext"`. Do not switch frontend code to `node16`/`nodenext` resolution to make `.js` source specifiers compile.
- Native Node ESM packages that are executed without a bundler are a separate case: use a Node-compatible build strategy instead of introducing `.js` specifiers into shared frontend source.

## TypeScript enums

- Use string enums for named finite sets of statuses, modes, variants, or lifecycle states instead of string-literal union types. Prefer `enum UploadStatus { Idle = 'idle' }` over `type UploadStatus = 'idle' | ...` when the values are reused across a module, exported, or compared in component logic/tests.

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

## @epam/ai-dial-ui-kit MCP tools

Use these two tools for all UI kit discovery and documentation needs: `searchEntity(entity, query?)` and `getEntityDetails(entity, name?)`. If you need to look up **ANYTHING** about the ui kit, use the MCP server. **Never** use `grep`, `glob`, `find`, or similar file system tools to discover components — they miss type information and examples.

### UI Kit Breaking Changes & Migration

When you encounter errors after a ui kit package upgrade, or when a prop no longer exists on a component:

1. Determine the **target release version**: check the installed version in `package.json` (`@epam/ai-dial-ui-kit`). Dev versions (`x.y.z-dev.N`) map to the next release — e.g. `0.11.0.18` → look up `0.11.0`.
2. Read `node_modules/@epam/ai-dial-ui-kit/dist/CHANGELOG.md` for `### Breaking Changes` entries at or between the previous release and the target release.
3. Follow the linked migration guides found at `node_modules/@epam/ai-dial-ui-kit/dist/migration-guides/<version>/`.
4. Use `getEntityDetails("component", "DialXxx")` to confirm the current prop signature before applying the fix.

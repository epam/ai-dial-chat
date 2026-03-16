# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**DIAL Chat** is a Next.js-based chat UI for the [DIAL](https://dialx.ai) platform. It is managed as an **NX monorepo** using NX 22.

### Workspace Layout

- `apps/chat` — The main Next.js chat application (serves on port 3000)
- `apps/chat-e2e` — Playwright end-to-end tests (for both chat and overlay)
- `apps/overlay-sandbox` — Sandbox app for the overlay library
- `apps/custom-viewer-test` — Test app for custom viewers
- `libs/shared` — Shared types, constants, and utilities used across apps
- `libs/overlay` — DIAL Overlay library (embeds chat as an iframe widget)
- `libs/chat-visualizer-connector` — Library for connecting chat to visualizers
- `libs/visualizer-connector` — Base visualizer connector library
- `libs/modulify-ui` — JSS-based UI module wrapper

## Commands

### Setup

```bash
npm i
```

Create `apps/chat/.env.local` with at minimum:
```
DIAL_API_HOST="<your-dial-api-host>"
DIAL_API_KEY="<your-api-key>"
NEXTAUTH_SECRET="<any-random-string>"
```

### Development

```bash
npm run nx serve chat            # Start dev server at http://localhost:3000
npm run nx serve chat --configuration=production  # Production server
```

### Build

```bash
npm run build                    # Build all production-tagged projects (chat, overlay-sandbox)
npm run nx build chat --configuration=production  # Build a single project
```

### Testing

```bash
npm run test                     # Run all unit tests (Vitest)
npm run nx test chat             # Run unit tests for a single project
npm run nx test:watch chat       # Watch mode for a single project
npm run nx test:coverage chat    # With coverage

npm run nx e2e chat-e2e          # Run all e2e tests (Playwright)
npm run nx e2e:chat chat-e2e     # Run chat e2e only
npm run nx e2e:overlay chat-e2e  # Run overlay e2e only
```

E2e tests run against a local dev server by default (auto-started if `E2E_HOST` is not set). Configure test credentials via env variables in `apps/chat/.env.local`.

### Linting & Formatting

```bash
npm run lint                     # Lint all projects (ESLint)
npm run lint:fix                 # Auto-fix lint issues
npm run format                   # Check formatting (Prettier)
npm run format:fix               # Auto-fix formatting

npm run nx lint chat             # Lint a single project
npm run nx format:fix chat       # Format a single project
```

### NX Utilities

```bash
npm run affected:test            # Test only projects affected by changes vs development branch
npm run affected:lint            # Lint only affected projects
npm run graph                    # Visualize project dependency graph
npm run unused-exports           # Find unused TypeScript exports
```

## Architecture

### State Management (Redux + RxJS Epics)

The app uses **Redux Toolkit** for state and **redux-observable** (RxJS epics) for side effects. Each domain has its own slice directory under `apps/chat/src/store/`:

- Each slice has: `*.reducers.ts`, `*.epics.ts`, `*.selectors.ts`, `*.types.ts`
- All selectors are re-exported from `apps/chat/src/store/selectors.ts` — import from there
- All epics are combined in `apps/chat/src/store/rootEpic.ts`
- Store domains: `models`, `conversations`, `prompts`, `files`, `folders`, `settings`, `ui`, `auth`, `overlay`, `chat`, `share`, `importExport`, `migration`, `publication`, `application`, `marketplace`, `codeEditor`, `applicationTypesSchemas`, `toolset`, `service`

### Next.js API Routes (Server-Side Proxy)

`apps/chat/src/pages/api/` contains Next.js API routes that proxy requests to the DIAL Core backend. All routes validate the session via `next-auth` before forwarding. Key routes:
- `api/chat.ts` — streams chat completions
- `api/models.ts` — fetches available models/applications
- `api/listing/[...listing].ts` — proxies DIAL storage listing
- `api/files/`, `api/share/`, `api/publication/` etc. — domain-specific DIAL API proxies

### Path Aliases

In `apps/chat`, `@/` resolves to the `apps/chat/` root (configured in `tsconfig.json` and `vite.config.ts`). Use `@/src/...` for all internal imports.

### Styling

- **Tailwind CSS** for most component styling. Config at `apps/chat/tailwind.config.js`.
- **JSS** via `@epam/ai-dial-modulify-ui` for theme-aware dynamic styles.
- SVG files are imported as React components by default (via `@svgr/webpack`); use `?url` suffix to import as a URL.

### Import Order (Prettier enforced)

1. Third-party modules
2. Local/relative imports (`./`, `../`)

Single quotes, trailing commas. Run `npm run format:fix` before committing.

### Shared Library (`libs/shared`)

Contains shared types (`types/`), constants (`constants/`), and utilities (`utils/`) consumed across apps and libs. The `Feature` enum (from `@epam/ai-dial-shared`) governs feature-flag-gated functionality controlled by the `ENABLED_FEATURES` env variable.

### E2E Tests Structure

Tests in `apps/chat-e2e/src/tests/`. The pattern uses:
- `core/` — reusable page objects and fixtures
- `ui/` — UI element wrappers
- `testData/` — shared test data and constants
- `assertions/` — custom assertion helpers

### Key Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DIAL_API_HOST` | Yes | DIAL Core backend URL |
| `DIAL_API_KEY` | Optional | API key (use if JWT auth not configured) |
| `NEXTAUTH_SECRET` | Yes | next-auth session secret |
| `ENABLED_FEATURES` | No | Comma-separated list of enabled feature flags |
| `THEMES_CONFIG_HOST` | No | URL for custom theme configuration |
| `STORAGE_TYPE` | No | `api` (default) or `browserStorage` |

Full env variable reference: `apps/chat/README.md`.

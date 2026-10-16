## MODIFIED Requirements

### Requirement: Library package exists at libs/attachment-input
The `@epam/ai-dial-attachment-input` package SHALL exist as a standalone library under `libs/attachment-input/` with its own `package.json` (name `@epam/ai-dial-attachment-input`), `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, and `vite.config.mts`. Its Tailwind utilities SHALL be built from the shared workspace theme by `tools/vite-lib-tailwind-utilities.mjs`; the library SHALL NOT carry its own `tailwind.config.js` or `postcss.config.js`. The library SHALL be of type `type:ui` in the Nx workspace and MUST NOT import from `apps/*`, `server-api`, generated API clients, app contexts, auth/session, or routing.

#### Scenario: Library can be built independently
- **WHEN** `npm exec nx build attachment-input` is executed
- **THEN** the build succeeds and outputs compiled JS + type declarations under `libs/attachment-input/dist/`

#### Scenario: Library passes lint and typecheck
- **WHEN** `npm exec nx lint attachment-input` and `npm exec nx typecheck attachment-input` are executed
- **THEN** both targets complete with zero errors

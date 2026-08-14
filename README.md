# AI DIAL Chat

A modern full-stack chat application built with Nx monorepo, featuring a React frontend and NestJS backend with DIAL Core integration.

## 📚 Table of Contents

- [Overview](#overview)
- [Migrating from the Legacy DIAL Chat](#migrating-from-the-legacy-dial-chat)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Available Scripts](#available-scripts)
- [Applications](#applications)
- [Libraries](#libraries)
- [Documentation](#documentation)
- [Code Quality](#code-quality)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

AI DIAL Chat is a comprehensive chat application platform featuring:

- **Frontend**: Modern React application with TypeScript, Vite, and Tailwind CSS
- **Backend**: NestJS REST API with Swagger documentation
- **Internationalization**: Multi-language ready — English by default, RTL supported
- **Integration**: EPAM AI DIAL Core connectivity
- **Monorepo**: Nx-powered workspace for efficient development

## Migrating from the Legacy DIAL Chat

Start with the [Legacy Chat Migration Guide](docs/legacy-chat-migration-guide.md):
what changed, an ordered checklist, the legacy → new environment-variable
mapping, what happens to existing user data, and the capabilities with no
successor yet. The areas below have their own detailed guides.

### Overlay (embedded chat)

The chat is embedded into a host page as an iframe driven over a `postMessage`
protocol. The host-side library lives in
[`libs/chat-overlay`](libs/chat-overlay) and is published as
`@epam/ai-dial-chat-overlay`, replacing the legacy `@epam/ai-dial-overlay`
package. The integration model is the same, but the new package is **not** a
drop-in replacement: deployment configuration, authentication options,
feature-flag names, data shapes, and parts of the API changed.

Follow the [Chat Overlay Migration Guide](docs/chat-overlay-migration-guide.md),
which covers:

- Deployment config: `IS_IFRAME` → `OVERLAY_ENABLED`, the origin allowlist, and
  the cookie settings a cross-site iframe needs
- Authentication: removed `signInOptions`, and the per-provider
  `auth.providerUiModes` map that opts a provider into same-window login
- The `INIT_READY` → `READY` → `READY_TO_INTERACT` handshake, request queuing,
  and the four `OverlayRequestErrorCode` values
- Changed method signatures, response payloads, and the narrowed
  `OverlayChatMessage` / `OverlayConversation` shapes
- All 39 `OverlayFeature` flags: legacy → new names, flags that became
  unconditional, flags with no successor yet, and the default-on baseline
- `ChatOverlayManager` options and the widget chrome it now owns

Before touching the host application, try the migrated API against a real
deployment in the [Chat Overlay Sandbox](apps/chat-overlay-sandbox/README.md) —
it has a ready-made page for each integration case (direct overlay, manager,
conversation list, feature flags, per-provider auth UI modes).

### Themes

Themes are still served by a standalone themes host and applied as CSS custom
properties, but `THEMES_CONFIG_HOST` became `THEMES_CONFIG_URL`, the palette was
redesigned, and the default theme flipped from dark to light. A legacy
`config.json` loads without an error and applies almost nothing, so the token
names have to be ported deliberately.

[Theme Customization](docs/theme-customization.md) documents the configuration
format and the full token list, and carries a legacy → new mapping table plus
the features with no replacement (`additional_css`, the `custom-logo` flag).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   AI DIAL Chat                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────┐      ┌─────────────────┐   │
│  │   React App     │◄────►│   NestJS API    │   │
│  │   (Port 4207)   │      │   (Port 5000)   │   │
│  │                 │      │                 │   │
│  │  - Vite         │      │  - REST API     │   │
│  │  - Tailwind     │      │  - Swagger      │   │
│  │  - i18next      │      │  - Static Files │   │
│  │  - React Router │      │  - DIAL Core    │   │
│  └─────────────────┘      └─────────────────┘   │
│         │                         │             │
│         └─────────┬───────────────┘             │
│                   │                             │
│          ┌────────▼────────┐                    │
│          │  Shared Libs    │                    │
│          │  - UI Components│                    │
│          │  - Utilities    │                    │
│          └─────────────────┘                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Prerequisites

- **Node.js**: 24 or higher (production images build on `node:24.17-alpine`)
- **npm**: 11 or higher (bundled with Node 24)
- **Git**: Latest version

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd ai-dial-chat
npm install
```

### 2. Configure Environment

Set up the API environment variables:

```bash
cp apps/chat-api/.env.template .env.local
```

Edit `.env.local` with your configuration. At least one identity provider must
be configured — a provider is registered only when its `CLIENT_ID` variable is
set. The template ships nine providers (Auth0, Azure AD, Azure B2C, GitLab,
Google, Keycloak, PingID, Cognito, Okta); Keycloak is shown here:

```bash
PORT=5000
API_PREFIX=api
CORS_ORIGIN=http://localhost:4207
AUTH_SESSION_SECRET=<64-character-hex-secret>
AUTH_CALLBACK_BASE_URL=http://localhost:5000
AUTH_POST_LOGOUT_REDIRECT_URI=http://localhost:4207
AUTH_KEYCLOAK_CLIENT_ID=your-client-id
AUTH_KEYCLOAK_SECRET=<client-secret>
AUTH_KEYCLOAK_HOST=keycloak.example.com/realms/dial
# DIAL_CORE_URL=https://your-dial-core-url.example.com
# DIAL_API_VERSION=2024-10-21
# DIAL_API_KEY=your-dial-api-key
# THEMES_CONFIG_URL=https://your-themes-config-url.example.com
```

`apps/chat-api/.env.template` is the authoritative list — it documents every
supported variable, including the per-provider auth fields, announcement banner
and footer content, file-transfer and skill upload limits, voice/ASR, the
utility model, catalog filtering, CSP/overlay origins, and feature toggles.
[`apps/chat-api/README.md`](apps/chat-api/README.md) explains each group.

### 3. Start Development

**Option 1: Start both apps together**

```bash
npm run start:all
```

**Option 2: Start individually**

```bash
# Terminal 1 - Frontend
npm run start

# Terminal 2 - Backend
npm run start:api
```

### 4. Access the Applications

- **React App**: http://localhost:4207
- **API Server**: http://localhost:5000/api
- **Swagger Docs**: http://localhost:5000/api/docs

## Project Structure

```
ai-dial-chat/
├── apps/
│   ├── chat/                    # React frontend application
│   │   ├── src/
│   │   │   ├── app/             # Root app component and routing shell
│   │   │   ├── components/      # React components
│   │   │   ├── context/         # React context providers
│   │   │   ├── hooks/           # Shared hooks
│   │   │   ├── i18n/            # Internationalization
│   │   │   ├── pages/           # Route-level pages
│   │   │   ├── server-api/      # Backend adapters (the only REST-aware layer)
│   │   │   ├── main.tsx         # Entry point
│   │   │   └── styles.scss      # Global styles
│   │   ├── public/              # Static assets
│   │   ├── vite.config.mts      # Vite configuration
│   │   ├── tailwind.config.js   # Tailwind config
│   │   └── README.md            # Frontend docs
│   │
│   ├── chat-api/                # NestJS backend application
│   │   ├── src/
│   │   │   ├── app/             # Root module and DIAL Core service
│   │   │   ├── auth/            # OIDC login/logout, session cookies, refresh
│   │   │   ├── config/          # Validated environment configuration
│   │   │   ├── <domain>/        # One folder per backend domain
│   │   │   └── main.ts          # API entry point
│   │   ├── .env.template        # Environment template
│   │   ├── .env.local           # Local environment (gitignored)
│   │   ├── webpack.config.js    # Webpack configuration
│   │   └── README.md            # Backend docs
│   │
│   └── chat-overlay-sandbox/    # Host page for testing the chat overlay
│       ├── src/cases/           # One page per overlay integration case
│       ├── vite.config.mts      # Vite configuration
│       └── README.md            # Sandbox docs
│
├── libs/                        # 22 @epam/* workspace libraries (see Libraries)
├── docs/                        # Architecture, requirements, migration guides
├── openspec/                    # Spec-driven change workflow and config
├── tools/                       # OpenAPI, Postman, and publishing scripts
├── scripts/                     # Repository maintenance scripts
├── postman/                     # Generated Postman collection
├── agents/                      # Shared agent instructions
├── .claude/                     # Claude Code configuration
├── nx.json                      # Nx configuration
├── package.json                 # Root dependencies
├── tsconfig.base.json           # Base TypeScript config
├── eslint.config.mjs            # ESLint configuration
└── tailwind.config.js           # Root Tailwind config
```

## Development

### Technology Stack

**Frontend**

- React 19.2
- TypeScript 6.0
- Vite 8.0
- Tailwind CSS 3.4
- React Router 8.3
- i18next 26.2 / react-i18next 17
- EPAM AI DIAL UI Kit 0.13

**Backend**

- NestJS 11.0
- TypeScript 6.0
- Swagger/OpenAPI 11.4
- Express 5.2
- Webpack 5

**Development Tools**

- Nx 22.7
- ESLint 9.39
- Prettier 3.8
- Vitest 4.1

### Nx Commands

Nx provides powerful commands for managing the monorepo:

```bash
# Serve a specific app
nx serve <app-name>

# Build a specific app
nx build <app-name>

# Test a specific app
nx test <app-name>

# Lint a specific app
nx lint <app-name>

# Run a target for multiple projects
nx run-many --target=<target> --projects=<projects>

# Run affected commands (only changed projects)
nx affected --target=<target>

# Visualize project dependencies
nx graph
```

## Available Scripts

### Root Level Scripts

| Command                 | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `npm run start`         | Start React app (port 4207)                            |
| `npm run start:api`     | Start NestJS API (port 5000)                           |
| `npm run start:api:dev` | Start the API in webpack HMR watch mode                |
| `npm run start:all`     | Start both apps in parallel                            |
| `npm run build`         | Build React app                                        |
| `npm run build:api`     | Build NestJS API                                       |
| `npm run build:all`     | Build all projects                                     |
| `npm run test`          | Run all tests                                          |
| `npm run lint`          | Lint all projects with `--fix`, then format            |
| `npm run lint:check`    | Lint and check formatting without writing (CI mode)    |
| `npm run lint:fix`      | Fix linting issues only                                |
| `npm run lint:affected` | Lint only affected projects                            |
| `npm run format`        | Format code with Prettier                              |
| `npm run format:check`  | Check code formatting                                  |
| `npm run graph`         | Visualize project dependencies                         |

### OpenAPI & Postman

The generated API client in `libs/chat-api-client` is part of the endpoint
contract — run these after any change to a `chat-api` controller or DTO.

| Command                  | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `npm run openapi`        | Regenerate the OpenAPI spec and the typed client             |
| `npm run openapi:check`  | Verify the committed client matches the current spec         |
| `npm run openapi:spec`   | Emit only the OpenAPI document                               |
| `npm run openapi:sdk`    | Emit only the generated SDK                                  |
| `npm run postman`        | Generate the Postman collection from the current spec        |
| `npm run postman:refresh`| Regenerate the spec and then the Postman collection          |

### Publishing & docs validation

| Command                        | Description                                            |
| ------------------------------ | ------------------------------------------------------ |
| `npm run build:publishable`    | Build every project tagged `publishable`               |
| `npm run publish`              | Publish every project tagged `publishable`             |
| `npm run publish:dry`          | Dry-run the publish pipeline with a preview version    |
| `npm run validate:agent-docs`  | Validate the agent instruction documents               |

## Applications

### Chat (React Frontend)

The main user interface for the chat application.

**Key Features:**

- Modern React 19 with hooks
- Responsive design with Tailwind CSS
- Real-time chat interface
- Multi-language ready, English by default
- Language switcher component
- Integration with DIAL UI Kit

**Documentation**: [`apps/chat/README.md`](apps/chat/README.md)

**Port**: 4207

### Chat API (NestJS Backend)

RESTful API server with OpenAPI documentation.

**Key Features:**

- NestJS framework
- Swagger/OpenAPI documentation
- CORS configuration
- Bearer authentication support
- Static file serving for React app
- Environment-based configuration
- DIAL Core integration

**Documentation**: [`apps/chat-api/README.md`](apps/chat-api/README.md)

**Port**: 5000

### Chat Overlay Sandbox

A host page that embeds a deployed chat through
`@epam/ai-dial-chat-overlay`, with one case per integration scenario — direct
overlay, overlay manager, conversation list, feature flags, and per-provider
auth UI modes. Use it to exercise the overlay API against a real deployment
without wiring it into your own application first.

**Key Features:**

- One page per overlay integration case
- Live `enabledFeatures` and `setOverlayOptions()` experimentation
- Served by `chat-api` at `/overlay-sandbox/` when
  `OVERLAY_SANDBOX_ENABLED=true`, or run locally against any chat host via
  `VITE_CHAT_OVERLAY_HOST`

**Documentation**: [`apps/chat-overlay-sandbox/README.md`](apps/chat-overlay-sandbox/README.md)

**Port**: 4300

## Libraries

All libraries live in `libs/*` and resolve through `tsconfig.base.json` paths
plus the Nx project graph. `apps/chat` consumes them as workspace packages —
every `package.json` under `libs/` is still `private: true`, so nothing is
published to npm today. Each library has its own README with its public API.

| Package                                  | Path                                                                 | Purpose                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `@epam/ai-dial-chat-shared`              | [`libs/chat-shared`](libs/chat-shared)                               | Shared domain models, utilities, and UI primitives consumed by every lib     |
| `@epam/ai-dial-chat-api-client`          | [`libs/chat-api-client`](libs/chat-api-client)                       | Generated OpenAPI client for the chat API (consumed only by app adapters)    |
| `@epam/ai-dial-chat-overlay`             | [`libs/chat-overlay`](libs/chat-overlay)                             | Embeddable `ChatOverlay` / `ChatOverlayManager` and the postMessage protocol |
| `@epam/ai-dial-catalog`                  | [`libs/catalog`](libs/catalog)                                       | Catalog for browsing models, applications, tools, prompts, and skills        |
| `@epam/ai-dial-conversation-input`       | [`libs/conversation-input`](libs/conversation-input)                 | Message composer — model selection, attachments, voice input, edit mode      |
| `@epam/ai-dial-conversation-messages`    | [`libs/conversation-messages`](libs/conversation-messages)           | Message bubbles with actions and source citations                            |
| `@epam/ai-dial-conversation-panel`       | [`libs/conversation-panel`](libs/conversation-panel)                 | Virtualized conversation-history sidebar with grouping, tabs, and search     |
| `@epam/ai-dial-conversation-stages`      | [`libs/conversation-stages`](libs/conversation-stages)               | Agent processing stages shown during response streaming                      |
| `@epam/ai-dial-sidebar`                  | [`libs/sidebar`](libs/sidebar)                                       | Resizable sidebar shell — header, search, empty state                        |
| `@epam/ai-dial-source-panel`             | [`libs/source-panel`](libs/source-panel)                             | Conversation sources — uploaded files and generated citations                |
| `@epam/ai-dial-quotations`               | [`libs/quotations`](libs/quotations)                                 | Citation and annotation components, hooks, and utilities                     |
| `@epam/ai-dial-attachment-canvas`        | [`libs/attachment-canvas`](libs/attachment-canvas)                   | Viewer for attachment content — images, PDFs, JSON, markdown, code, text     |
| `@epam/ai-dial-attachment-input`         | [`libs/attachment-input`](libs/attachment-input)                     | File input with upload validation, drag-and-drop, progress                   |
| `@epam/ai-dial-starter-buttons`          | [`libs/starter-buttons`](libs/starter-buttons)                       | Starter prompts that overflow into a dropdown when space runs out            |
| `@epam/ai-dial-share`                    | [`libs/share`](libs/share)                                           | Share popover UI and share-link types                                        |
| `@epam/ai-dial-publish-panel`            | [`libs/publish-panel`](libs/publish-panel)                           | Publish-to-folder UI and state flow                                          |
| `@epam/ai-dial-prompt-editor`            | [`libs/prompt-editor`](libs/prompt-editor)                           | Host-agnostic prompt authoring form with an inline folder picker             |
| `@epam/ai-dial-prompts`                  | [`libs/prompts`](libs/prompts)                                       | Favorite-prompts panel and the prompt-parameters popup for the composer      |
| `@epam/ai-dial-skill-editor`             | [`libs/skill-editor`](libs/skill-editor)                             | Skill authoring form with a file tree and conflict handling                  |
| `@epam/ai-dial-builder-form`             | [`libs/builder-form`](libs/builder-form)                             | Presentational builder form shell for composing and editing DIAL entities    |
| `@epam/ai-dial-deployment-creation-form` | [`libs/deployment-creation-form`](libs/deployment-creation-form)     | Form for creating and editing a deployment, with locale fields               |
| `@epam/ai-dial-scheduled-tasks`          | [`libs/scheduled-tasks`](libs/scheduled-tasks)                       | Scheduled Tasks surfaces — cards, create form, detail view, run history      |

> `libs/ai-dial-kit/` is a leftover build-output directory from a removed
> library — it has no `package.json`, no sources, and no importers. Do not add
> to it.

### Library isolation

Libraries must stay free of host and external-system knowledge: no REST paths,
generated clients, app contexts, auth/session/cookies, environment variables,
feature flags, routing, analytics, storage keys, or third-party SDK setup.
Applications adapt those concerns and pass data, resolved values, and behaviour
into libs through props, typed callbacks, or narrow interfaces.
`@epam/ai-dial-chat-api-client` is the single exception — it is generated from
the backend's OpenAPI document, and apps consume it through
`apps/chat/src/server-api`.

## Documentation

### In this repository

- [Architecture](docs/architecture.md) - The structural map: apps, libraries, backend domains, contexts, routes, and cross-cutting mechanisms
- [Technical Requirements](docs/technical-requirements.md) - Product and technical requirements
- [Chat App Documentation](apps/chat/README.md) - Frontend details
- [Chat API Documentation](apps/chat-api/README.md) - Backend details
- [Chat Overlay Sandbox](apps/chat-overlay-sandbox/README.md) - Host page for exercising the overlay API
- [Theme Customization](docs/theme-customization.md) - Configuring a theme and porting one from the legacy chat
- [Responses API Integration](docs/responses-api-integration.md) - How the app consumes the DIAL Responses API
- [Authentication (BFF, encrypted cookie)](docs/auth/auth-bff-encrypted-cookie.md) - OIDC login/logout, session cookies, transparent token refresh
- [Auth Diagrams](docs/auth/auth-diagrams/README.md) - Rendered Mermaid diagrams for every auth flow
- [Testing the Auth Implementation](docs/auth/testing-current-auth-implementation.md) - Manual and automated auth verification

### Migration guides

- [Legacy Chat Migration Guide](docs/legacy-chat-migration-guide.md) - Moving a deployment from the legacy DIAL Chat to 1.0
- [Chat Overlay Migration Guide](docs/chat-overlay-migration-guide.md) - Migrating an embedded overlay from the legacy chat
- [Environment Variables Migration Guide](docs/environment-variables-migration-guide.md) - Legacy → new environment-variable mapping

### External

- [Swagger API Docs](http://localhost:5000/api/docs) - Interactive API documentation (running locally)
- [Nx Documentation](https://nx.dev) - Nx workspace guide

## Code Quality

### Linting

The project uses ESLint with TypeScript support:

```bash
# Lint all projects
npm run lint

# Fix linting issues
npm run lint:fix

# Lint only changed files
npm run lint:affected
```

### Formatting

Code formatting is handled by Prettier:

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

### Testing

Tests are run with Vitest:

```bash
# Run all tests
npm run test

# Test specific app
nx test chat
nx test chat-api

# Test with coverage
nx test chat --coverage
```

## Deployment

### Building for Production

```bash
# Build all projects
npm run build:all

# Or build individually
npm run build        # Frontend
npm run build:api    # Backend
```

### Build Outputs

- **Frontend**: `dist/apps/chat/`
- **Backend**: `dist/apps/chat-api/`

### Production Deployment

The NestJS API serves both the API endpoints and the built React application:

1. Build both applications
2. Deploy the API server with the built frontend
3. The API serves static files from `dist/apps/chat/`
4. All routes except `/api/*` serve the React app

### Environment Variables in Production

Ensure these environment variables are set in production:

```bash
PORT=5000
API_PREFIX=api
CORS_ORIGIN=https://your-frontend-domain.com
AUTH_SESSION_SECRET=<64-character-hex-secret>
AUTH_CALLBACK_BASE_URL=https://your-api-domain.com
AUTH_POST_LOGOUT_REDIRECT_URI=https://your-frontend-domain.com
AUTH_KEYCLOAK_CLIENT_ID=your-client-id
AUTH_KEYCLOAK_SECRET=<client-secret>
AUTH_KEYCLOAK_HOST=keycloak.example.com/realms/dial
DIAL_CORE_URL=https://your-dial-core-url
DIAL_API_VERSION=2024-10-21
DIAL_API_KEY=your-production-api-key
THEMES_CONFIG_URL=https://your-themes-url
CHAT_VERSION=<ci-build-identifier>
```

Every variable is validated at boot by
`apps/chat-api/src/config/environment.config.ts`, so a missing or malformed
value fails the container fast rather than at first request.

## Troubleshooting

### Port Conflicts

If you see "Port already in use" errors:

**React App (4207):**

- Change port in `apps/chat/vite.config.mts`

**NestJS API (5000):**

- Change `PORT` in `.env.local`

### CORS Issues

Ensure the `CORS_ORIGIN` in the API matches the frontend URL.

### Nx Cache Issues

Clear Nx cache if you experience build issues:

```bash
nx reset
```

### Installation Issues

Clear dependencies and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

Sync Nx project references:

```bash
nx sync
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the project-level contribution
policy, and [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

### Development Workflow

1. Create a feature branch
2. Make your changes
3. Run linting and tests (`npm run lint:check`, `npm run test`)
4. Regenerate the API client if you touched an endpoint contract (`npm run openapi`)
5. Update the affected docs — including [`docs/architecture.md`](docs/architecture.md) when the structure changes — in the same commit
6. Commit and push
7. Create a pull request

### Commit Message Format

Follow conventional commits:

```
feat: add new feature
fix: fix bug
docs: update documentation
style: formatting changes
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

### Code Style

- Follow the ESLint configuration
- Use Prettier for formatting
- Write meaningful comments
- Add tests for new features

## Learn More

### Nx

- [Nx Documentation](https://nx.dev)
- [Nx Cloud](https://cloud.nx.app)
- [Nx Console](https://nx.dev/getting-started/editor-setup) - VSCode extension

### React

- [React Documentation](https://react.dev)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### NestJS

- [NestJS Documentation](https://docs.nestjs.com)
- [Swagger Documentation](https://swagger.io/docs/)

### i18next

- [i18next Documentation](https://www.i18next.com/)
- [react-i18next](https://react.i18next.com/)

## License

[Apache License 2.0](LICENSE)

## Support

For issues and questions:

- Check existing documentation
- Review troubleshooting section
- Contact the development team

---

Built with ❤️ using Nx, React, and NestJS

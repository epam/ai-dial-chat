# AI DIAL Chat

A modern full-stack chat application built with Nx monorepo, featuring a React frontend and NestJS backend with DIAL Core integration.

## 📚 Table of Contents

- [Overview](#overview)
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
- **Internationalization**: Multi-language support (English & Ukrainian)
- **Integration**: EPAM AI DIAL Core connectivity
- **Monorepo**: Nx-powered workspace for efficient development

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

- **Node.js**: 24 or higher
- **npm**: v9 or higher
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

Edit `.env.local` with your configuration:

```bash
PORT=5000
API_PREFIX=api
CORS_ORIGIN=http://localhost:4207
AUTH_SESSION_SECRET=<64-character-hex-secret>
AUTH_CALLBACK_BASE_URL=http://localhost:5000
AUTH_POST_LOGOUT_REDIRECT_URI=http://localhost:4207
AUTH_KEYCLOAK_CLIENT_ID=your-client-id
AUTH_KEYCLOAK_SECRET=<client-secret>
AUTH_KEYCLOAK_HOST=your-issuer.example.com
AUTH_KEYCLOAK_ADMIN_ROLE_NAMES=admin
# DIAL_CORE_URL=https://your-dial-core-url.example.com
# DIAL_API_VERSION=2024-10-21
# DIAL_API_KEY=your-api-key
# THEMES_CONFIG_URL=https://your-themes-url.example.com
```

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
│   │   │   ├── app/             # Main app component
│   │   │   ├── components/      # React components
│   │   │   ├── i18n/            # Internationalization
│   │   │   ├── main.tsx         # Entry point
│   │   │   └── styles.scss      # Global styles
│   │   ├── public/              # Static assets
│   │   ├── vite.config.mts      # Vite configuration
│   │   ├── tailwind.config.js   # Tailwind config
│   │   └── README.md            # Frontend docs
│   │
│   └── chat-api/                # NestJS backend application
│       ├── src/
│       │   ├── app/             # App module & controllers
│       │   └── main.ts          # API entry point
│       ├── .env.template        # Environment template
│       ├── .env.local           # Local environment (gitignored)
│       ├── webpack.config.js    # Webpack configuration
│       └── README.md            # Backend docs
│
├── libs/
│   └── conversation-input/      # Chat input component library
│
├── .claude/                     # Claude Code configuration
├── nx.json                      # Nx configuration
├── package.json                 # Root dependencies
├── tsconfig.base.json           # Base TypeScript config
├── eslint.config.mjs            # ESLint configuration
├── prettier.config.js           # Prettier configuration
└── tailwind.config.js           # Root Tailwind config
```

## Development

### Technology Stack

**Frontend**

- React 19
- TypeScript 5.9
- Vite 8.0
- Tailwind CSS 3.4
- React Router 6.30
- i18next 26.0
- EPAM AI DIAL UI Kit

**Backend**

- NestJS 11.0
- TypeScript 5.9
- Swagger/OpenAPI 11.4
- Express
- Webpack 5

**Development Tools**

- Nx 22.6
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

| Command                 | Description                    |
| ----------------------- | ------------------------------ |
| `npm run start`         | Start React app (port 4207)    |
| `npm run start:api`     | Start NestJS API (port 5000)   |
| `npm run start:all`     | Start both apps in parallel    |
| `npm run build`         | Build React app                |
| `npm run build:api`     | Build NestJS API               |
| `npm run build:all`     | Build all projects             |
| `npm run test`          | Run all tests                  |
| `npm run lint`          | Lint all projects              |
| `npm run lint:fix`      | Fix linting issues             |
| `npm run lint:affected` | Lint only affected projects    |
| `npm run format`        | Format code with Prettier      |
| `npm run format:check`  | Check code formatting          |
| `npm run graph`         | Visualize project dependencies |

## Applications

### Chat (React Frontend)

The main user interface for the chat application.

**Key Features:**

- Modern React 19 with hooks
- Responsive design with Tailwind CSS
- Real-time chat interface
- Multi-language support (EN/UK)
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

## Libraries

### conversation-input

Reusable chat input component.

### conversation-panel

Reusable chat panel component.

## Documentation

- [Chat App Documentation](apps/chat/README.md) - Frontend details
- [Chat API Documentation](apps/chat-api/README.md) - Backend details
- [Swagger API Docs](http://localhost:5000/api/docs) - Interactive API documentation
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
AUTH_KEYCLOAK_HOST=your-issuer.example.com
DIAL_CORE_URL=https://your-dial-core-url
DIAL_API_VERSION=2024-10-21
DIAL_API_KEY=your-production-api-key
THEMES_CONFIG_URL=https://your-themes-url
```

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

### Development Workflow

1. Create a feature branch
2. Make your changes
3. Run linting and tests
4. Format your code
5. Commit and push
6. Create a pull request

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

MIT

## Support

For issues and questions:

- Check existing documentation
- Review troubleshooting section
- Contact the development team

---

Built with ❤️ using Nx, React, and NestJS

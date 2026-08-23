# Chat Application

The AI DIAL Chat frontend — a React 19 single-page application served by
`apps/chat-api`. It is the user-facing surface for conversations, the entity
catalog, prompts, skills, scheduled tasks, publishing, sharing, and file
management, all backed by DIAL Core through the chat API.

For the structural map of the whole workspace — module boundaries, context
inventory, backend domains, SSE streaming, theming token flow — see
[`docs/architecture.md`](../../docs/architecture.md). This file covers what is
specific to running and developing `apps/chat`.

## Features

### Conversations

- Streaming assistant responses over SSE, with agent processing stages shown live
- Message editing, regeneration, copy, like/dislike, and per-message actions
- Attachments — upload, drag-and-drop, clipboard paste, and an inline viewer for
  images, PDFs, code, JSON, markdown, and plain text
- Citations and source panels for retrieval-grounded answers
- Conversation history sidebar with search, grouping, tabs, and renaming
- Import/export queue for moving conversations in and out
- LLM-assisted conversation naming when the backend enables a utility model

### Entities and authoring

- Catalog of models, applications, tools, prompts, and skills, with favorites,
  topic filtering, and grid/list views
- Editors for applications, toolsets, custom apps, prompts, and skills
- Prompt selection and parameter substitution directly in the composer
- Scheduled tasks — create, edit, inspect run history (feature-gated)
- Publishing to shared folders and share-by-link with recipient management
- DIAL file manager for browsing personal, shared, and organization files

### Platform

- OIDC login through the backend BFF, with a session cookie and transparent
  token refresh; interactive toolset sign-in during a completion
- Overlay mode — the whole app can run embedded in a host page over the
  `postMessage` protocol from `@epam/ai-dial-chat-overlay`
- Runtime theming from `/api/themes`, applied as CSS custom properties
- Server-driven UI feature toggles, announcement banner, and footer message
- Mobile-first responsive layout with bottom sheets and a mobile nav bar
- Internationalization through `react-i18next`, with RTL direction switching

## Prerequisites

- Node.js 24 or higher
- npm 11 or higher
- A running `apps/chat-api` instance (the frontend has no direct DIAL Core access)

## Getting Started

### 1. Install Dependencies

From the root of the monorepo:

```bash
npm install
```

### 2. Development Mode

The frontend calls the API through a relative `/api` prefix, so start both:

```bash
npm run start:all
```

Or serve the frontend alone against an already-running API:

```bash
npm exec nx serve chat
```

The application will be available at `http://localhost:4207`.

### 3. Production Build

```bash
npm exec nx build chat
```

The built files are output to `apps/chat/dist/` and served by `chat-api` in
production — every route except `/api/*` falls through to the SPA.

## Project Structure

```
apps/chat/
├── src/
│   ├── app/                     # Root component, routing, layout shell
│   ├── components/              # Feature components (see below)
│   ├── constants/               # Route helpers, translation keys, feature keys
│   ├── context/                 # React context providers (see below)
│   ├── hooks/                   # Shared hooks, incl. breakpoint/useBreakpoint
│   ├── i18n/                    # i18n configuration and locale JSON
│   ├── models/                  # App-level domain models
│   ├── pages/                   # Route-level pages
│   ├── server-api/              # Backend adapters — the only REST-aware layer
│   ├── types/                   # Enums and shared types (incl. ROUTES)
│   ├── utils/                   # App-level utilities
│   ├── main.tsx                 # Entry point
│   └── styles.scss              # Global styles
└── README.md                    # This file
```

Most UI is composed from the workspace libraries in `libs/*` — this app supplies
the data, translated strings, and callbacks they need. See the
[Libraries table](../../README.md#libraries) for what each one owns.

### Routes

Route paths are declared once in the `ROUTES` enum
(`src/types/routes.ts`); build parameterized paths with the helpers in
`src/constants/routes.ts` rather than by string concatenation.

| Route                                 | Page                                           |
| ------------------------------------- | ---------------------------------------------- |
| `/`                                   | Active conversation (or the new-chat composer) |
| `/conversations/:id`                  | A specific conversation                        |
| `/conversations/shared/:invitationId` | Accept a shared-conversation invitation        |
| `/catalog`                            | Entity catalog                                 |
| `/catalog/shared/:invitationId`       | Accept a shared-entity invitation              |
| `/apps-editor`                        | Application editor                             |
| `/toolset-editor`                     | Toolset editor                                 |
| `/toolset-editor/callback`            | Registered OAuth redirect for toolset IdPs     |
| `/custom-app-editor`                  | Custom application editor                      |
| `/prompt-editor`                      | Prompt editor                                  |
| `/skill-editor`                       | Skill editor                                   |
| `/auth/toolset-signin`                | Interactive toolset sign-in                    |
| `/files`                              | DIAL file manager                              |
| `/scheduled-tasks`                    | Scheduled tasks list (feature-gated)           |
| `/scheduled-tasks/new`                | Create a scheduled task                        |
| `/scheduled-tasks/:scheduleId`        | Scheduled task detail and run history          |
| `/scheduled-tasks/:scheduleId/edit`   | Edit a scheduled task                          |
| `/login`                              | Login entry point                              |

Pages are lazy-loaded behind `Suspense` and wrapped in a `RouteErrorBoundary`,
so a failure in one route does not take the shell down.

### Contexts

State that spans routes lives in providers under `src/context/`:

| Context                       | Owns                                                    |
| ----------------------------- | ------------------------------------------------------- |
| `AppConfigContext`            | Server-resolved app configuration                       |
| `UiFeaturesContext`           | Enabled UI feature flags                                |
| `UserConfigContext`           | Per-user persisted preferences                          |
| `ThemeContext`                | Active theme and its CSS custom properties              |
| `ConversationsContext`        | Conversation list, selection, and mutations             |
| `ConversationPanelContext`    | Sidebar panel state                                     |
| `GenerationContext`           | In-flight generation and streaming state                |
| `DeploymentsContext`          | Models, applications, and their capabilities            |
| `PromptsContext`              | Prompts and favorites                                   |
| `SkillsContext`               | Skills                                                  |
| `FavoriteApplicationsContext` | Favorited applications                                  |
| `SourcesSidebarContext`       | Conversation sources panel                              |
| `ActiveScheduledTaskContext`  | The scheduled task being viewed or edited               |
| `ClientChannelContext`        | Server-initiated interactions (toolset sign-in prompts) |
| `NotificationContext`         | Toast notifications                                     |
| `SheetNavigationContext`      | Mobile bottom-sheet navigation stack                    |
| `context/auth`                | Session state, `SessionGuard`, and sign-in/out          |
| `context/overlay`             | Overlay-mode bridges for the postMessage protocol       |

## Configuration

The frontend reads no environment variables of its own at runtime — everything
is resolved by `chat-api` and delivered through `/api/v1/client-config`,
`/api/v1/user-config`, and `/api/themes`. Configure behaviour in the API's
environment instead;
see [`apps/chat-api/README.md`](../chat-api/README.md) and
`apps/chat-api/.env.template`.

Values that most visibly change this app:

- `THEMES_CONFIG_URL` — theme configuration source; see
  [`docs/theme-customization.md`](../../docs/theme-customization.md)
- `ENABLED_UI_FEATURES` — the complete list of enabled UI features
- `DEFAULT_DEPLOYMENT` — the deployment preselected for a new conversation
- `ANNOUNCEMENT_*` / `ANNOUNCEMENTS` / `FOOTER_HTML_MESSAGE` — banner and footer copy
- `OVERLAY_ENABLED` / `ALLOWED_IFRAME_ORIGINS` — overlay embedding
- `SCHEDULED_TASKS_ENABLED` — the scheduled tasks route and its nav entry

## Styling

### Tiers

1. **Tailwind utilities** for layout and spacing — the default.
2. **SCSS modules** (`*.module.scss`) when a component needs CSS custom
   properties, pseudo-element styling, or state selectors Tailwind cannot reach.
3. **Global styles** in `src/styles.scss`, which imports Tailwind's layers.

The styling contract shared with `libs/*` — CSS variable naming, what belongs in
a module versus a utility class, and the `styles={{ colors, typography }}` prop
shape — is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

### Breakpoints

`tailwind.config.js` defines exactly two named screens:

| Screen    | Query              |
| --------- | ------------------ |
| `mobile`  | `max-width: 768px` |
| `desktop` | `min-width: 769px` |

Do not introduce `sm:`/`md:`/`lg:`/`xl:` or tablet variants. When a component
must branch in JavaScript, use `useBreakpoint` / `useIsMobile` from
`src/hooks/breakpoint/useBreakpoint.ts` instead of reading `window.innerWidth`.

### RTL

The UI must work in right-to-left locales. Use logical Tailwind utilities
(`ms-*`, `pe-*`, `text-start`, `start-*`, `border-s-*`) rather than physical
ones, and mirror directional icons with `rtl:scale-x-[-1]`. The full rule set is
in [`.claude/rules/rtl.md`](../../.claude/rules/rtl.md).

## Internationalization (i18n)

### Supported languages

- English (`en`) — the default, and the only locale shipped today

Adding one is a code change, not deployment configuration: create
`src/i18n/locales/<lang>.json` with every key from `en.json`, register it in
`src/i18n/config.ts`, add it to the language selector, and — for a right-to-left
language — add its code to `RTL_LANGUAGES` so `document.documentElement.dir`
flips. `ar`, `he`, `fa`, and `ur` are already listed there.

### Language detection

The app resolves the active language from, in order:

1. `localStorage` (saved preference)
2. Browser navigator settings

### Adding translations

1. Add the key to `src/i18n/locales/en.json` **and** declare it in the matching
   string enum in `src/constants/translation-keys.ts`.
2. Reference it through the enum — never pass a raw string literal to `t()`:

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent: FC<Props> = () => {
  const { t } = useTranslation();
  return <div>{t(ChatI18nKeys.WelcomeScreen)}</div>;
};
```

Before adding a key, grep `en.json` for the English string — generic action
labels ("Copy", "Cancel", "Save") already live under `ButtonsI18nKeys` and
should be reused rather than re-declared per feature.

Every `aria-label` must be translated too: libraries expose label props with
English defaults, and this app passes `t(...)` values in.

## Testing

```bash
# Run all tests
npm exec nx test chat

# Watch mode
npm exec nx test chat -- --watch

# With coverage
npm exec nx test chat -- --coverage
```

Test configuration:

- Environment: `jsdom`
- Coverage provider: `v8`
- Coverage output: `./test-output/vitest/coverage`

Tests query by role, label, and semantic text — this repository does not use
`data-testid`.

## Linting

```bash
# Run linter
npm exec nx lint chat

# Auto-fix linting issues
npm exec nx lint chat -- --fix
```

## Accessibility

The app targets WCAG 2.1 AAA. In practice that means decorative icons inside
labeled controls are `aria-hidden`, toggles expose `aria-pressed` /
`aria-expanded`, hidden panels with focusable children use `inert` rather than
`aria-hidden`, dynamic feedback is announced through an `aria-live` status
region, and text colors resolve to at least 7:1 contrast. The full pattern list
is in [`.claude/rules/a11y.md`](../../.claude/rules/a11y.md).

## TypeScript

- Strict mode enabled, `moduleResolution: "bundler"`
- Relative imports omit source extensions (`./Component`, not `./Component.tsx`)
- Custom type definitions in `src/i18n/i18next.d.ts`
- String enums, not string-literal unions, for finite value sets

## Browser Support

Modern evergreen browsers: Chrome, Firefox, Safari, and Edge (latest).

## Related Documentation

- [Architecture](../../docs/architecture.md)
- [Technical Requirements](../../docs/technical-requirements.md)
- [Chat API](../chat-api/README.md)
- [Theme Customization](../../docs/theme-customization.md)
- [Responses API Integration](../../docs/responses-api-integration.md)
- [Authentication](../../docs/auth/auth-bff-encrypted-cookie.md)
- [Chat Overlay Migration Guide](../../docs/chat-overlay-migration-guide.md)

## Contributing

1. Create a feature branch from `development`
2. Make your changes with tests
3. Ensure all tests pass: `npm exec nx test chat`
4. Ensure linting passes: `npm exec nx lint chat`
5. Update the docs a change affects — including `docs/architecture.md` when the
   structure changes — in the same commit
6. Create a pull request to `development`

## License

Copyright © EPAM Systems. Released under the
[Apache License 2.0](../../LICENSE).

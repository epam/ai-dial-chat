# Engineering Style Guide

**Version:** 1.0
**Owner:** Engineering
**Last Updated:** 2026-05-09
**Stack:** Nx 22 · React 19 · NestJS 11 · TypeScript 5.9 · Vite 8 · Vitest 4
**Audience:** Middle / Senior Engineers

> This guide is derived from actual patterns in this codebase. Examples are taken from or modelled on real files. When in doubt, read the existing code first.

---

## Table of Contents

1. [General Engineering Principles](#1-general-engineering-principles)
2. [Nx Monorepo Architecture](#2-nx-monorepo-architecture)
3. [TypeScript Standards](#3-typescript-standards)
4. [React Frontend Standards](#4-react-frontend-standards)
5. [NestJS Backend Standards](#5-nestjs-backend-standards)
6. [API Design Standards](#6-api-design-standards)
7. [Testing Standards](#7-testing-standards)
8. [Git & Collaboration Standards](#8-git--collaboration-standards)
9. [Code Review Checklist](#9-code-review-checklist)
10. [Security Standards](#10-security-standards)
11. [Performance Standards](#11-performance-standards)
12. [Observability](#12-observability)
13. [CI/CD Standards](#13-cicd-standards)
14. [Tooling & Configuration Reference](#14-tooling--configuration-reference)

---

## 1. General Engineering Principles

### Readability First

Code is read far more than it is written. Optimize for the reader, not the author.

```typescript
// Bad — saves keystrokes, costs comprehension
const r = msgs.filter((m) => m.r === 'user').map((m) => m.c);

// Good — self-documenting
const userMessageContents = messages
  .filter((message) => message.role === 'user')
  .map((message) => message.content);
```

---

### Explicitness Over Inference

Make intent visible. Do not rely on defaults that are easy to miss.

```typescript
// Bad — what is the default role? What happens if omitted?
function createMessage(content: string, role = 'user') { ... }

// Good — callers are explicit; contract is clear
function createMessage(content: string, role: MessageRole): Message { ... }
```

---

### Simplicity Over Cleverness

The simplest solution that correctly solves the problem is the right solution. Complexity must justify itself.

```typescript
// Bad — premature, over-engineered
class MessageTransformerFactory<T extends BaseMessage> {
  create(strategy: TransformStrategy<T>): MessageTransformer<T> { ... }
}

// Good — solve the actual problem
function toDisplayMessage(message: Message): DisplayMessage {
  return { id: message.id, content: message.content, sentAt: formatTime(message.timestamp) };
}
```

---

### SOLID in Practice

| Principle                 | What it means here                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Single Responsibility** | One class/hook/module = one reason to change. `ThemeService` handles themes. `MetricsInterceptor` handles metrics. They do not cross.            |
| **Open/Closed**           | Extend via composition. Add a new guard rather than modify `AppModule`.                                                                          |
| **Dependency Inversion**  | NestJS services receive dependencies via constructor injection, never `new`. React hooks receive their dependencies as arguments or via context. |

```typescript
// Bad — hardwired dependency, untestable
@Injectable()
export class ThemeService {
  async getThemes() {
    const response = await fetch(
      process.env.THEMES_CONFIG_URL + '/config.json',
    );
    // ...
  }
}

// Good — injected config, injected cache (as in this codebase)
@Injectable()
export class ThemeService {
  constructor(
    private configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
}
```

---

### DRY / KISS / YAGNI

- **DRY:** Extract when the same logic appears in three or more places with the same intent. Two similar lines are not duplication.
- **KISS:** The simpler the solution, the fewer the failure modes.
- **YAGNI:** Do not build for requirements that do not exist. The `conversation-input` lib is a focused, minimal component — not a general-purpose chat framework.

---

### Composition Over Inheritance

This codebase uses composition throughout. Hooks compose other hooks. NestJS modules compose services. Follow this pattern.

```typescript
// Bad — inheritance chain creates tight coupling
class BaseHook { ... }
class DataHook extends BaseHook { ... }
class ThemeHook extends DataHook { ... }

// Good — compose focused hooks
function useApp() {
  const { currentTheme, isLoading } = useTheme();
  const favicon = useFavicon(currentTheme.faviconUrl);
  return { currentTheme, isLoading };
}
```

---

### Domain-Driven Folder Organization

Organize by domain, not by technical layer.

```
// Bad — organized by layer
src/
  hooks/
    useFavicon.ts
    useTheme.ts
    useMessages.ts
  components/
    ThemeSelector.tsx
    ConversationView.tsx

// Good — organized by domain (already done in this codebase)
apps/chat/src/
  context/
    ThemeContext.tsx      ← theme domain
  hooks/
    useFavicon.ts         ← co-located with theme domain
  components/
    ConversationView/     ← conversation domain
```

---

## 2. Nx Monorepo Architecture

### Current Structure

```
ai-dial-chat/
├── apps/
│   ├── chat/                     # React 19 frontend (Vite, port 4207)
│   └── chat-api/                 # NestJS 11 backend (port 3005)
├── libs/
│   ├── chat-shared/              # Shared TypeScript types and models
│   ├── conversation-input/       # Reusable React input component lib
│   ├── conversation-panel/       # Reusable panel component lib
├── nx.json
├── tsconfig.base.json            # Path aliases defined here
├── eslint.config.mjs             # Flat ESLint config
└── .prettierrc
```

---

### Path Aliases

Defined in `tsconfig.base.json`. Always use aliases — never use `../../../` to cross library boundaries.

```json
{
  "paths": {
    "@/*": ["apps/chat/*"],
    "@epam/conversation-input/*": ["libs/conversation-input/*"],
    "@epam/chat-shared/*": ["libs/chat-shared/*"]
  }
}
```

```typescript
// Bad — brittle relative path crossing library boundary
import { Message } from '../../../libs/chat-shared/src/models/message';

// Good — alias import
import type { Message } from '@epam/chat-shared/models/message';
```

---

### Library Types and Dependency Rules

| Library                   | Type tag      | May import from | May not import from |
| ------------------------- | ------------- | --------------- | ------------------- |
| `apps/chat`               | `type:app`    | any lib         | `apps/chat-api`     |
| `apps/chat-api`           | `type:app`    | any lib         | `apps/chat`         |
| `libs/conversation-input` | `type:ui`     | `chat-shared`   | `apps/*`            |
| `libs/chat-shared`        | `type:shared` | nothing         | everything          |

Boundaries are enforced by `@nx/enforce-module-boundaries` in `eslint.config.mjs`. A PR that disables or widens this rule requires a Staff Engineer sign-off.

---

### Naming Conventions

| Artefact     | Convention         | Example                             |
| ------------ | ------------------ | ----------------------------------- |
| App name     | `kebab-case`       | `chat`, `chat-api`                  |
| Lib name     | `kebab-case`       | `conversation-input`, `chat-shared` |
| Import alias | `@epam/{lib-name}` | `@epam/conversation-input`          |
| Nx target    | `camelCase`        | `build`, `serve`, `typecheck`       |

---

### Adding a New Library

```bash
# UI component library
pnpm nx g @nx/react:library libs/my-component --bundler=vite --unitTestRunner=vitest

# Shared types library
pnpm nx g @nx/js:library libs/my-shared --bundler=tsc --unitTestRunner=vitest
```

After generating, add tags to the library's `project.json` immediately:

```json
{
  "tags": ["type:ui", "scope:shared"]
}
```

---

### Anti-Patterns

- **Cross-app imports.** `chat` must not import from `chat-api` source code and vice versa. Shared contracts belong in `chat-shared`.
- **Putting business logic in `chat-shared`.** That library is for types, interfaces, and constants only.
- **Relative imports across library boundaries.** Always use the alias.
- **Circular dependencies.** Run `pnpm nx graph` to visualise dependencies before merging significant structural changes.

---

## 3. TypeScript Standards

### Strict Mode

All projects inherit from `tsconfig.base.json` which enables full strict mode. These settings are non-negotiable:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

If a compiler error is blocking you, fix the type — do not add `// @ts-ignore` or widen to `any`.

---

### Never Use `any`

`any` disables the type system entirely. Use `unknown` for genuinely unknown data and narrow it before use.

```typescript
// Bad
function parseApiResponse(data: any): any {
  return data.themes;
}

// Good — as used in apps/chat/src/server-api/base.ts
const parseResponse = async <TResponse>(
  response: Response,
): Promise<TResponse> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<TResponse>;
  }
  return response.text() as unknown as Promise<TResponse>;
};
```

---

### `type` vs `interface`

| Use `interface`                              | Use `type`                    |
| -------------------------------------------- | ----------------------------- |
| Object shapes that represent a domain entity | Union types, intersections    |
| Props types for components                   | Computed/mapped/derived types |
| Public API contracts for libraries           | Tuple types                   |
| Shapes that may be extended                  | Aliases for primitives        |

```typescript
// interface — domain entity (from libs/chat-shared)
export interface Theme {
  id: string;
  displayName: string;
  colors: Record<string, string>;
  'app-logo': string;
}

// type — union, no extension needed
type MessageRole = 'user' | 'assistant';

// type — computed shape
type ThemeColors = Theme['colors'];
```

---

### Discriminated Unions with Exhaustive Checks

Use discriminated unions for states that are mutually exclusive. Add an exhaustive check in every switch.

```typescript
type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function renderState<T>(state: FetchState<T>): ReactNode {
  switch (state.status) {
    case 'idle':    return null;
    case 'loading': return <LoadingSpinner />;
    case 'success': return <DataView data={state.data} />;
    case 'error':   return <ErrorMessage error={state.error} />;
    default: {
      // Compile error if a case is ever added without handling it here
      const _exhaustive: never = state;
      throw new Error(`Unhandled state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
```

---

### Readonly and Immutability

Mark function return types and data structures `Readonly` when consumers must not mutate them.

```typescript
// Signals intent: callers should not mutate the returned config
function getConfig(): Readonly<AppConfig> { ... }

// For arrays
function getThemes(): ReadonlyArray<Theme> { ... }
```

---

### Generics

Use generics to preserve type safety across boundaries — as the API layer in this project does.

```typescript
// From apps/chat/src/server-api/base.ts — the pattern to follow
export const get = <TResponse>(
  url: string,
  options?: Omit<RequestOptions, 'body'>,
): Promise<TResponse> => request<TResponse>(url, 'GET', options);

// Usage — type is inferred at call site
const config = await get<ThemeConfiguration>(ApiEndpoints.THEMES);
// config is ThemeConfiguration, not unknown or any
```

Constrain generics with `extends` when the generic must satisfy a contract:

```typescript
export const hasRequiredProperties = <T extends Record<string, unknown>>(
  data: unknown,
  properties: Array<keyof T>,
): data is T => {
  if (typeof data !== 'object' || data === null) return false;
  return properties.every((prop) => prop in data);
};
```

---

### Enums vs Union Types

Prefer string union types. Enums produce a runtime object and interact unexpectedly with structural typing.

```typescript
// Bad — numeric enum, runtime artifact
enum MessageRole {
  User,
  Assistant,
}

// Bad — const enum with isolatedModules is problematic
const enum Status {
  Active,
  Inactive,
}

// Good — zero runtime cost, fully type-safe
type MessageRole = 'user' | 'assistant';

// Good — when you need runtime iteration
const MESSAGE_ROLES = ['user', 'assistant'] as const;
type MessageRole = (typeof MESSAGE_ROLES)[number];
```

---

### Anti-Patterns

```typescript
// Non-null assertion without a proven invariant
const el = document.querySelector('.root')!; // crashes silently if null

// Type casting instead of narrowing
const data = response as ThemeConfiguration; // bypasses safety

// Widening to satisfy the compiler
const handler = onClick as unknown as EventHandler; // masks a real type mismatch
```

---

## 4. React Frontend Standards

### Component File Structure

Every component lives in its own folder. Follow this layout consistently:

```
components/ConversationView/
├── ConversationView.tsx        # Component implementation
├── ConversationView.test.tsx   # Tests co-located with the component
└── index.ts                    # Re-export — public API of the component
```

`index.ts` content:

```typescript
export { ConversationView } from './ConversationView';
export type { ConversationViewProps } from './ConversationView';
```

---

### Component Structure Order

Follow this order within every component file:

```tsx
// 1. Imports — external, then internal, then relative
import { memo, useCallback, useRef, useState } from 'react';
import type { FC, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import type { Message } from '@epam/chat-shared/models';

// 2. Props interface
interface ConversationViewProps {
  messages: Message[];
  onSend: (content: string) => void;
  isAssistantTyping?: boolean;
}

// 3. Component implementation (named, not default export)
const ConversationViewComponent: FC<ConversationViewProps> = ({
  messages,
  onSend,
  isAssistantTyping = false,
}) => {
  // 3a. Hooks
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // 3b. Derived values
  const isEmpty = messages.length === 0;

  // 3c. Handlers
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  // 3d. Early returns (guards)
  if (isEmpty) return <WelcomeScreen />;

  // 3e. JSX
  return (
    <div
      ref={listRef}
      role="log"
      aria-label={t('conversation.ariaLabel')}
      aria-live="polite"
      onScroll={handleScroll}
    >
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
      {isAssistantTyping && <TypingIndicator />}
    </div>
  );
};

// 4. Export — memoized for performance
export const ConversationView = memo(ConversationViewComponent);
```

---

### Props Typing

```typescript
// Always define props as a named interface, never inline
// Bad
function Button({ label, onClick }: { label: string; onClick: () => void }) {}

// Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

// Use FC<Props> as used in this codebase
const Button: FC<ButtonProps> = ({
  label,
  onClick,
  variant = 'primary',
  disabled = false,
}) => {
  // ...
};
```

Do not use `React.FC` without importing `FC` from `'react'`. Import the named type directly.

---

### Custom Hooks

Every custom hook in this project follows the same pattern. Match it.

```typescript
// From apps/chat/src/hooks/useFavicon.ts — the pattern to follow:

/**
 * Custom hook to manage dynamic favicon based on URL.
 * Explain the WHY here — not just "sets the favicon".
 * Include edge cases handled (preloading, error fallback, cache-busting).
 *
 * @param faviconUrl - URL to the favicon image
 */
export const useFavicon = (faviconUrl?: string): void => {
  useEffect(() => {
    if (!faviconUrl) return;

    // DOM manipulation: find existing link tag or create one
    let link = document.querySelector(
      "link[rel~='icon']",
    ) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    const img = new Image();
    img.onload = () => {
      link!.href = faviconUrl;
    };
    img.onerror = () => {
      console.warn(`Failed to load favicon: ${faviconUrl}`);
    };
    img.src = faviconUrl;

    // Always return cleanup when the effect creates a side effect
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [faviconUrl]);
};
```

**Rules for custom hooks:**

- Name always starts with `use`
- One hook = one concern
- JSDoc required — explain WHY, not WHAT
- Return a stable object, tuple, or `void` — not a class instance
- Never call hooks conditionally inside the hook body
- Always return cleanup from `useEffect` when the effect creates a subscription or side effect

---

### Context + Custom Hook Pattern

This is the state management pattern used in this codebase. Follow it for all shared state.

```typescript
// 1. Define the context shape
interface ThemeContextValue {
  currentTheme: string;
  themes?: Theme[];
  setTheme: (themeId: string) => void;
  isLoading: boolean;
}

// 2. Create context with undefined default — enforces provider usage
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// 3. Provider component owns state
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<ThemeConfiguration | null>(null);
  const [currentThemeId, setCurrentThemeId] = useState(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);

  // Stable context value — prevents unnecessary consumer re-renders
  const contextValue = useMemo(
    () => ({ currentTheme: currentThemeId, themes: config?.themes, setTheme: setCurrentThemeId, isLoading }),
    [currentThemeId, config, isLoading],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

// 4. Consumer hook — throws with a clear message if used outside provider
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
```

---

### Data Fetching

This project uses the native `fetch` API wrapped in typed helpers (see `apps/chat/src/server-api/base.ts`). Do not introduce TanStack Query or SWR without a team decision.

```typescript
// Use the existing typed request helpers
import { get, post } from '../server-api/base';
import type { ThemeConfiguration } from '@epam/chat-shared/models';

// In a hook — fetch inside useEffect with proper cleanup
export const useThemeConfig = () => {
  const [config, setConfig] = useState<ThemeConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    get<ThemeConfiguration>(ApiEndpoints.THEMES)
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { config, isLoading, error };
};
```

The `cancelled` flag prevents state updates on unmounted components.

---

### Lazy Loading

All routes and heavy components must be code-split. Use `React.lazy` + `Suspense`.

```typescript
// From apps/chat/src/app/app.tsx — follow this pattern
const ConversationView = lazy(
  () => import('../components/ConversationView/ConversationView'),
);

// For named exports from libraries
const ConversationInput = lazy(() =>
  import('@epam/conversation-input').then((module) => ({
    default: module.ConversationInput,
  })),
);

// Wrap lazy components in Suspense — always provide a meaningful fallback
<Suspense fallback={<ConversationSkeleton />}>
  <ConversationView messages={messages} onSend={handleSend} />
</Suspense>
```

---

### Memoization Rules

Memoize only when you have evidence of a performance problem, not as a default.

```typescript
// memo — wrap after profiling shows unnecessary re-renders
// This codebase uses it on ConversationView — a large component with many children
export const ConversationView = memo(ConversationViewComponent);

// useMemo — for expensive derivations
const sortedMessages = useMemo(
  () => [...messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  [messages],
);

// useCallback — for handlers passed to memoized children
const handleSend = useCallback(
  (content: string) => {
    dispatch({ type: 'SEND', content });
  },
  [dispatch],
);
```

Wrapping every function in `useCallback` and every value in `useMemo` adds overhead without benefit. Profile first.

---

### Accessibility

Non-negotiable. The conversation view already implements these patterns — extend them to all new components.

```tsx
// Semantic role + live region for chat messages (from ConversationView)
<div role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions">

// Button with explicit aria-label when no visible text
<button type="button" aria-label="Scroll to bottom of conversation">
  <ArrowDownIcon />
</button>

// Form field must have a label
<textarea
  aria-label={placeholder}
  aria-describedby={error ? 'input-error' : undefined}
/>
{error && <span id="input-error" role="alert">{error}</span>}
```

Rules:

- Every interactive element is keyboard-navigable
- Every image has `alt` (empty string for decorative)
- Every form input has a visible label or `aria-label`
- Error messages use `role="alert"` or `aria-live="polite"`
- No `onClick` on non-interactive elements (`div`, `span`) without a keyboard equivalent

---

### Internationalisation

All user-visible strings go through `i18next`. No hardcoded English strings in JSX.

```typescript
// Bad
<h1>Welcome to Chat</h1>
<button>Send</button>

// Good
const { t } = useTranslation();
<h1>{t('chat.welcomeText')}</h1>
<button>{t('chat.send')}</button>
```

Translation keys live in `apps/chat/src/i18n/locales/en.json`. Keys are namespaced: `{domain}.{element}`.

---

### Styling

This project uses **Tailwind CSS** as the primary styling mechanism, with `prettier-plugin-tailwindcss` for class ordering. Follow this convention:

```tsx
// Bad — custom CSS for what Tailwind handles
<div className="message-container" style={{ display: 'flex', flexDirection: 'column' }}>

// Good — Tailwind utility classes
<div className="flex flex-col gap-2 p-4">

// Dark mode
<div className="bg-white dark:bg-[#2f2f2f]">

// Responsive
<div className="w-full max-w-2xl mx-auto px-4 md:px-6">
```

For complex, dynamic class composition use `clsx` or `tailwind-merge` — not template literals.

```typescript
// Bad — fragile string concatenation
className={`btn ${isActive ? 'btn-active' : ''} ${disabled ? 'btn-disabled' : ''}`}

// Good
import { clsx } from 'clsx';
className={clsx('btn', { 'btn-active': isActive, 'btn-disabled': disabled })}
```

---

### Anti-Patterns

```tsx
// Prop drilling through 3+ levels — extract to Context
<Page messages={messages}>
  <Layout messages={messages}>
    <List messages={messages} />
  </Layout>
</Page>;

// useEffect for derived state — use useMemo
useEffect(() => {
  setFilteredItems(items.filter((x) => x.active));
}, [items]);

// Fetching without a cancellation flag — causes setState-on-unmount warnings
useEffect(() => {
  fetch('/api/data')
    .then((r) => r.json())
    .then(setData); // no cleanup
}, []);

// Spreading all props without typing
const MyComponent = (props: any) => <div {...props} />;
```

---

## 5. NestJS Backend Standards

### Module Structure

```
apps/chat-api/src/
├── main.ts                          # Bootstrap: Helmet, CORS, ValidationPipe, Swagger
├── app/
│   ├── app.module.ts                # Root module: global config, cache, throttler
│   ├── app.controller.ts
│   └── app.service.ts
├── themes/
│   ├── theme.module.ts
│   ├── theme.controller.ts
│   ├── theme.service.ts
│   └── dto/
│       └── get-theme-icon.dto.ts
├── health/
│   └── health.controller.ts
├── config/
│   └── environment.config.ts       # Class-validator env validation
└── common/
    └── interceptors/
        └── metrics.interceptor.ts
```

Each domain (themes, health, auth, etc.) is a self-contained module. New domains get their own folder with this same shape.

---

### Bootstrap Configuration

`main.ts` is the single place where global middleware and pipes are registered. Do not register global concerns in feature modules.

```typescript
// apps/chat-api/src/main.ts — extend this, do not duplicate it
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }),
  );

  // 2. Input validation — whitelist strips undeclared fields (mass-assignment protection)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 3. API prefix and CORS
  app.setGlobalPrefix(process.env.API_PREFIX ?? 'api');
  app.enableCors({ origin: process.env.CORS_ORIGIN, credentials: true });

  // 4. Swagger
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3005);
}
```

---

### Thin Controllers

Controllers are HTTP adapters. They validate input, delegate to services, and map output. No business logic.

```typescript
// Bad — business logic in controller
@Get()
async getThemes() {
  const cached = await this.cache.get('themes');
  if (cached) return cached;
  const response = await fetch(this.config.get('THEMES_CONFIG_URL'));
  const data = await response.json();
  await this.cache.set('themes', data);
  return data;
}

// Good — controller delegates entirely to service (as in this codebase)
@Get()
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Header('Cache-Control', 'public, max-age=300')
@ApiOperation({ summary: 'Get themes configuration' })
@ApiResponse({ status: 200, description: 'Successfully retrieved theme configuration' })
@ApiResponse({ status: 404, description: 'Theme configuration not found' })
@ApiResponse({ status: 502, description: 'Upstream theme service error' })
@ApiResponse({ status: 503, description: 'Theme service unavailable' })
getThemes() {
  return this.themeService.getThemes();
}
```

---

### Services

Services own business logic. They use `Logger`, injected config, and injected dependencies — never instantiated directly.

```typescript
// Pattern from apps/chat-api/src/themes/theme.service.ts
@Injectable()
export class ThemeService {
  // Logger is scoped to the class — use this.logger.log / .error / .debug / .warn
  private readonly logger = new Logger(ThemeService.name);
  private readonly THEMES_CACHE_KEY = 'themes:config';

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getThemes(): Promise<ThemeConfiguration> {
    // 1. Check cache first
    const cached = await this.cacheManager.get<ThemeConfiguration>(
      this.THEMES_CACHE_KEY,
    );
    if (cached) {
      this.logger.debug('Returning cached theme configuration');
      return cached;
    }

    // 2. Fetch with timeout
    const controller = new AbortController();
    const timeout =
      this.configService.get('THEMES_SERVICE_TIMEOUT_MS', { infer: true }) ??
      5000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = this.configService.get('THEMES_CONFIG_URL', { infer: true });
      const response = await fetch(`${url}/config.json`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        // 3. Map upstream errors to appropriate NestJS exceptions
        if (response.status === 404)
          throw new NotFoundException('Theme configuration not found');
        throw new BadGatewayException('Failed to fetch theme configuration');
      }

      const data: ThemeConfiguration = await response.json();
      await this.cacheManager.set(this.THEMES_CACHE_KEY, data);
      return data;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new ServiceUnavailableException(
          'Theme service request timed out',
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

---

### DTOs

Request DTOs validate and document input. Every field has a `class-validator` decorator and an `@ApiProperty` decorator.

```typescript
// From apps/chat-api/src/themes/dto/get-theme-icon.dto.ts — follow this pattern
export class GetThemeIconDto {
  @ApiProperty({
    description: 'Icon filename — alphanumeric, dash, underscore, and dot only',
    example: 'icon-light.svg',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'Icon name must contain only alphanumeric characters, dash, underscore, and dot',
  })
  iconName: string | undefined;
}
```

The `@Matches` regex above prevents path traversal (`../etc/passwd`). Every DTO that accepts a filename or path must include a similar constraint.

---

### Environment Configuration

Validate all environment variables at startup using class-validator. The app must fail fast with a clear error if required config is missing.

```typescript
// From apps/chat-api/src/config/environment.config.ts
export class EnvironmentVariables {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  PORT?: number = 3005;

  @IsOptional()
  @IsString()
  API_PREFIX?: string = 'api';

  @IsOptional()
  @IsUrl({ require_tld: false })
  DIAL_CORE_URL?: string;

  @IsOptional()
  @IsNumber()
  THEMES_SERVICE_TIMEOUT_MS?: number = 5000;
}

// In AppModule
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: ['.env.local', '.env'],
  validate, // validate is the class-validator based validation function
});
```

---

### Interceptors

Use interceptors for cross-cutting concerns: metrics, logging, response transformation. The `MetricsInterceptor` in this codebase is the reference pattern.

```typescript
// From apps/chat-api/src/common/interceptors/metrics.interceptor.ts
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Metrics');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const { method, url } = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const status = context
            .switchToHttp()
            .getResponse<Response>().statusCode;
          this.logger.log(
            `${method} ${url} ${status} - ${Date.now() - startTime}ms`,
          );
        },
        error: (error: { status?: number; message: string }) => {
          const status = error.status ?? 500;
          this.logger.error(
            `${method} ${url} ${status} - ${Date.now() - startTime}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
```

Register interceptors in `AppModule` as global providers — do not register them in individual feature modules unless scoping is intentional.

---

### Error Handling

Use NestJS built-in HTTP exceptions. Map upstream/domain errors to the correct exception type in the service layer.

| Situation                                | Exception                           |
| ---------------------------------------- | ----------------------------------- |
| Resource not found                       | `NotFoundException` (404)           |
| Caller not authorized                    | `ForbiddenException` (403)          |
| Invalid input that passed DTO validation | `BadRequestException` (400)         |
| Upstream service returned an error       | `BadGatewayException` (502)         |
| Upstream service timed out               | `ServiceUnavailableException` (503) |
| Unexpected server error                  | Let NestJS handle (500)             |

Never throw plain `Error` objects from a service. Always use typed NestJS exceptions so the HTTP response is predictable.

---

### Rate Limiting

`ThrottlerGuard` is registered globally in `AppModule`. Override per-endpoint using `@Throttle`.

```typescript
// Default: 100 requests per 60 seconds (set in AppModule)
// Override for sensitive endpoints:
@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10/min for auth endpoints
@Throttle({ default: { limit: 50, ttl: 60000 } }) // 50/min for icon endpoint
```

---

### Anti-Patterns

```typescript
// Business logic in controller
@Get()
async getThemes() {
  const data = await fetch(url); // ← belongs in service
  return data.json();
}

// Raw entity returned from controller — exposes internals
return await this.db.theme.findMany(); // ← always map to a response DTO

// Config accessed via process.env directly in a service
const url = process.env.THEMES_CONFIG_URL; // ← use ConfigService

// Logger not scoped
console.log('Theme fetched'); // ← use this.logger = new Logger(ThemeService.name)
```

---

## 6. API Design Standards

### REST Conventions

```
GET    /api/themes              → list all themes
GET    /api/themes/icon?iconName=logo.svg  → get icon (query param because it's a filter, not an id)
GET    /api/health              → health check
```

Rules:

- Resources are plural nouns: `/themes`, `/conversations`, `/messages`
- HTTP method is the verb — no `/getThemes` or `/fetchIcon`
- Query params for filtering, pagination, and options
- Path params for resource identity: `/themes/:id`

---

### Versioning

Version in the URL path once breaking changes are introduced:

```
/api/v1/themes   ← next major version
/api/themes      ← current (unversioned = v1 implicit)
```

A change is **breaking** if it removes a field, renames a field, changes a type, or removes an endpoint. Non-breaking additions (new optional fields, new endpoints) do not require a version bump.

---

### Swagger Documentation

Every endpoint must have Swagger decorators. The Swagger UI at `/api/docs` is the API contract for consumers.

```typescript
@ApiTags('themes')
@Controller('themes')
export class ThemeController {

  @Get()
  @ApiOperation({
    summary: 'Get themes configuration',
    description: 'Fetches the complete theme configuration including theme list, colors, and images.',
  })
  @ApiResponse({ status: 200, description: 'Successfully retrieved theme configuration' })
  @ApiResponse({ status: 404, description: 'Theme configuration not found' })
  @ApiResponse({ status: 502, description: 'Upstream theme service returned an error' })
  @ApiResponse({ status: 503, description: 'Theme service timed out' })
  getThemes() { ... }
}
```

---

### Error Response Format

All errors use this envelope. Do not deviate.

```json
{
  "statusCode": 404,
  "message": "Theme configuration not found",
  "error": "Not Found"
}
```

NestJS produces this format by default. Do not override it with a custom format unless the product requires it — and if you do, do it in a global exception filter, not per-controller.

---

### HTTP Status Codes

| Status | When                                      |
| ------ | ----------------------------------------- |
| `200`  | Successful GET                            |
| `201`  | Successful POST (resource created)        |
| `204`  | Successful DELETE (no body)               |
| `400`  | Validation error, malformed input         |
| `401`  | Not authenticated                         |
| `403`  | Authenticated but not permitted           |
| `404`  | Resource does not exist                   |
| `429`  | Rate limited                              |
| `502`  | Upstream service returned an error        |
| `503`  | Upstream service unavailable or timed out |
| `500`  | Unexpected server error                   |

Never return `200` with a body that contains an error. Never return `500` for a caller error.

---

### Health Check Format

The `/api/health` endpoint returns this shape. Keep it minimal.

```json
{
  "status": "ok",
  "timestamp": "2026-05-09T12:00:00.000Z",
  "version": "1.0.0"
}
```

---

## 7. Testing Standards

### Stack

| Tool                        | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| Vitest 4                    | Test runner for all unit and integration tests |
| @testing-library/react      | Component testing                              |
| @testing-library/user-event | User interaction simulation                    |
| supertest                   | HTTP integration tests for NestJS controllers  |
| `vi.mock` / `vi.fn`         | Mocking                                        |

---

### Test File Placement

Co-locate tests with the code they test:

```
components/ConversationView/
├── ConversationView.tsx
├── ConversationView.test.tsx    ← co-located
└── index.ts

themes/
├── theme.controller.ts
├── theme.controller.spec.ts     ← co-located (NestJS convention uses .spec.ts)
├── theme.service.ts
└── theme.service.spec.ts
```

---

### Test Structure (AAA)

Every test follows Arrange → Act → Assert with a blank line between each phase.

```typescript
// From apps/chat/src/app/app.spec.tsx — the pattern to follow
describe('App', () => {
  const mockUseTheme = vi.mocked(ThemeContext.useTheme);

  beforeEach(() => {
    vi.clearAllMocks();
    // Arrange — default mock state
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      themes: [],
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  it('renders welcome screen when no messages exist', async () => {
    // Arrange
    // (default mock from beforeEach is sufficient)

    // Act
    render(<App />);

    // Assert
    expect(await screen.findByText('Welcome to Chat')).toBeTruthy();
  });

  it('shows the sent message after user submits', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<App />);
    const sendButton = await screen.findByRole('button', { name: /send/i });

    // Act
    await user.click(sendButton);

    // Assert
    expect(await screen.findByTestId('conversation-view')).toBeTruthy();
  });
});
```

---

### Mocking Strategy

```typescript
// Module-level mock — applied before imports resolve
vi.mock('../context/ThemeContext');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Per-test mock value
const mockUseTheme = vi.mocked(ThemeContext.useTheme);
mockUseTheme.mockReturnValue({ currentTheme: 'light', ... });

// Spy on a method without replacing the module
vi.spyOn(console, 'warn').mockImplementation(() => {});
```

**Never mock the module under test.** Mock its dependencies.

---

### NestJS Controller Integration Tests

```typescript
// From apps/chat-api/src/themes/tests/theme.controller.spec.ts — follow this pattern
describe('ThemeController', () => {
  let app: INestApplication;
  const mockThemeService = { getThemes: vi.fn(), getThemeIcon: vi.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ThemeController],
      providers: [{ provide: ThemeService, useValue: mockThemeService }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('GET /themes returns 200 with theme configuration', async () => {
    // Arrange
    const mockConfig = { themes: [{ id: 'light' }, { id: 'dark' }] };
    mockThemeService.getThemes.mockResolvedValue(mockConfig);

    // Act & Assert
    const response = await request(app.getHttpServer())
      .get('/themes')
      .expect(200);
    expect(response.body).toEqual(mockConfig);
  });

  it('GET /themes/icon rejects path traversal with 400', async () => {
    // Security test — DTO validation must block this
    await request(app.getHttpServer())
      .get('/themes/icon?iconName=../etc/passwd')
      .expect(400);

    expect(mockThemeService.getThemeIcon).not.toHaveBeenCalled();
  });
});
```

---

### Test Naming

Test names describe observable behavior from the user's or caller's perspective.

```typescript
// Bad — describes implementation
it('calls setConfig with fetched data');
it('returns cached value');

// Good — describes behavior
it('shows the theme configuration after loading');
it('returns the cached configuration without fetching again');
it('throws ServiceUnavailableException when the upstream request times out');
```

---

### Forbidden Testing Patterns

- `it('works')` — meaningless
- Snapshot tests on large trees — they break constantly, provide no useful signal
- Testing implementation details (internal state, private methods)
- `expect(true).toBe(true)` — counts toward coverage, tests nothing
- `setTimeout` / `sleep` in tests — use `waitFor`, `findBy*`, or `vi.useFakeTimers`
- Leaving `console.log` in test files

---

### Coverage Expectations

| Layer                     | Minimum |
| ------------------------- | ------- |
| Services (business logic) | 85%     |
| Utility functions         | 95%     |
| React hooks               | 80%     |
| Controllers               | 75%     |
| UI components             | 70%     |

Coverage is a floor, not a target. 100% coverage with meaningless assertions is actively harmful — it creates false confidence.

---

## 8. Git & Collaboration Standards

### Commit Conventions

Format: `type(scope): subject`

This project uses conventional commits. The `scope` is optional but encouraged for multi-app repos.

```
feat(themes): add favicon cache-busting on theme change
fix(chat-api): handle AbortError from timed-out upstream requests
chore(deps): upgrade @nestjs/core to 11.1.0
test(themes): add integration tests for path traversal prevention
refactor(conversation-view): extract scroll logic into useScrollToBottom hook
docs(api): add Swagger docs for health endpoint
```

| Type       | When                                 |
| ---------- | ------------------------------------ |
| `feat`     | New feature or behaviour             |
| `fix`      | Bug fix                              |
| `chore`    | Build, dependencies, config          |
| `refactor` | Code change with no behaviour change |
| `test`     | Adding or fixing tests               |
| `docs`     | Documentation only                   |
| `perf`     | Performance improvement              |

Rules:

- Subject: imperative, lowercase, no period, ≤72 characters
- No `fix lint`, `fix test`, `fix fix` — describe what was actually wrong
- Body (optional): explain WHY, not what. Reference ticket in body: `Closes #42`

---

### Branch Naming

```
feat/CHAT-42-favicon-cache-busting
fix/CHAT-38-abort-error-handling
chore/upgrade-nestjs-11
refactor/extract-scroll-hook
```

Format: `{type}/{ticket}-{short-description}`
All lowercase, kebab-case. Ticket is required for `feat` and `fix` branches.

---

### PR Requirements

Before opening a PR:

- [ ] `pnpm nx affected --target=lint --base=origin/main` passes
- [ ] `pnpm nx affected --target=typecheck --base=origin/main` passes
- [ ] `pnpm nx affected --target=test --base=origin/main` passes
- [ ] No `console.log` left in production code
- [ ] No new `any` types introduced
- [ ] Swagger decorators added/updated for any changed endpoints
- [ ] Translation keys added for any new user-visible strings

**PR size:** One logical change. If you need to scroll more than a few screens to read the diff, split it.

---

### PR Description Template

```markdown
## What

[One paragraph. What changed and why. Not a list of filenames.]

## Why

[The motivation. Link to the ticket, user report, or finding that drove this.]

## How (optional)

[Only if the approach is non-obvious.]

## Testing

- [ ] Unit tests added/updated
- [ ] Manual testing performed (describe what)

## Related

Closes #42
```

---

### Merge Strategy

- Merge via **squash merge** — one clean commit per PR on `main`
- Squash message must follow conventional commit format
- `main` is always deployable — never merge a failing branch
- No direct pushes to `main`

---

## 9. Code Review Checklist

### Architecture

- [ ] Change is in the correct layer (controller / service / hook / component)?
- [ ] No cross-app imports or cross-feature boundary violations?
- [ ] No new `any` types?
- [ ] Shared types added to `chat-shared`, not duplicated in apps?

### Readability

- [ ] Can someone unfamiliar with this PR understand the code in 5 minutes?
- [ ] Names are self-describing — no single-letter variables outside trivial loops?
- [ ] No dead code or commented-out blocks?
- [ ] Comments explain WHY, not WHAT?

### Security

- [ ] All user input validated via DTO + `ValidationPipe`?
- [ ] No path traversal risk in filename/path inputs? (`@Matches(/^[a-zA-Z0-9_.-]+$/)`)?
- [ ] No secrets in code or committed `.env` files?
- [ ] `whitelist: true` on `ValidationPipe` prevents mass assignment?

### Performance

- [ ] No unnecessary re-renders in React (unstable references in Context value, missing deps)?
- [ ] Data fetching has a cancellation mechanism (`cancelled` flag or `AbortController`)?
- [ ] Expensive computations are memoized?
- [ ] Lazy-loaded routes for new pages?

### Accessibility

- [ ] New interactive elements are keyboard-navigable?
- [ ] Form inputs have labels or `aria-label`?
- [ ] Dynamic content uses `aria-live` or `role="alert"` where appropriate?
- [ ] No `onClick` on non-interactive elements?

### Testing

- [ ] New behaviour is covered by tests?
- [ ] Tests describe observable behaviour, not implementation details?
- [ ] Security-relevant paths have negative tests (e.g. path traversal blocked)?

### Observability

- [ ] Errors are logged with `this.logger.error()`?
- [ ] Successful significant operations use `this.logger.log()` or `.debug()`?
- [ ] No `console.log` in production code?

### API

- [ ] New endpoints have Swagger decorators (`@ApiOperation`, `@ApiResponse`)?
- [ ] All possible error status codes documented?
- [ ] `@Throttle` applied to new endpoints?

---

## 10. Security Standards

### Input Validation

Validate at every system boundary. In NestJS: every controller input goes through a typed DTO with `class-validator`. The global `ValidationPipe` with `whitelist: true` strips undeclared fields.

```typescript
// This is already configured in main.ts — do not bypass it
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // strips unknown fields — prevents mass assignment
    forbidNonWhitelisted: true, // throws 400 on unknown fields instead of silently stripping
    transform: true,
  }),
);
```

---

### Path Traversal Prevention

Any DTO that accepts a filename or path must validate the format:

```typescript
// From GetThemeIconDto — copy this pattern for any filename input
@Matches(/^[a-zA-Z0-9_.-]+$/, {
  message: 'Filename must contain only alphanumeric characters, dash, underscore, and dot',
})
iconName: string;
```

This blocks `../etc/passwd`, `../../secrets.env`, and similar. Test this explicitly.

---

### Secrets and Environment Variables

```
// Never — hardcoded values
const secret = 'my-secret-key';

// Never — .env files with real secrets committed
.env.production  ← must not exist in the repo

// Always — class-validated at startup
// apps/chat-api/src/config/environment.config.ts
```

The `.env.example` file is committed with placeholder values. Real values are sourced from the deployment environment. Validate required vars at startup — fail fast.

---

### Security Headers

`helmet` is already configured in `main.ts`. When adding new content types or external sources, update the CSP directives there — do not bypass them per-route.

---

### Rate Limiting

`ThrottlerGuard` is applied globally. Adjust per-endpoint as needed:

```typescript
// Sensitive endpoints (auth, config reads)
@Throttle({ default: { limit: 10, ttl: 60000 } })

// Asset/file endpoints
@Throttle({ default: { limit: 50, ttl: 60000 } })
```

---

### CORS

CORS origin is configured in `main.ts` from `process.env.CORS_ORIGIN`. Do not hardcode origins. Do not use `origin: '*'` in production.

---

## 11. Performance Standards

### Frontend

**Code splitting:** Every route must be lazy-loaded. Do not import page-level components at the top of `app.tsx`.

**Bundle size:** Before adding a new dependency, check its size on [Bundlephobia](https://bundlephobia.com). Prefer tree-shakeable packages.

```typescript
// Bad — imports entire library
import _ from 'lodash';

// Good — named import, tree-shakeable
import { debounce } from 'lodash-es';
```

**Preventing unnecessary re-renders:**

```tsx
// Unstable Context value causes all consumers to re-render on every parent render
// Bad
<ThemeContext.Provider value={{ currentTheme, setTheme, isLoading }}>

// Good — memoized value (as used in ThemeContext.tsx)
const contextValue = useMemo(
  () => ({ currentTheme, themes: config?.themes, setTheme, isLoading }),
  [currentTheme, config, isLoading],
);
<ThemeContext.Provider value={contextValue}>
```

**Large lists:** Virtualise any list that can exceed 50 items. Use `@tanstack/react-virtual`.

---

### Backend

**Caching:** Use the injected `CacheManager`. Cache at the service layer with an explicit TTL. Document the TTL and invalidation strategy in a comment.

```typescript
// 5-minute TTL — appropriate for theme config which changes rarely
await this.cacheManager.set(this.THEMES_CACHE_KEY, data);
// CacheModule is configured with ttl: 5 * 60 * 1000 in AppModule
```

**Request timeout:** Every outbound HTTP request must have a timeout via `AbortController`, as in `ThemeService`. A hung upstream request must not hang the entire Node.js process.

**Concurrent operations:** Use `Promise.all` for independent async calls.

```typescript
// Bad — 3× slower than necessary
const themes = await this.fetchThemes();
const icons = await this.fetchIcons();
const meta = await this.fetchMeta();

// Good
const [themes, icons, meta] = await Promise.all([
  this.fetchThemes(),
  this.fetchIcons(),
  this.fetchMeta(),
]);
```

---

## 12. Observability

### Logger Usage (NestJS)

Use `Logger` scoped to the class. Never use `console.log` in production code.

```typescript
@Injectable()
export class ThemeService {
  // Scoped logger — log output includes the class name
  private readonly logger = new Logger(ThemeService.name);

  async getThemes() {
    this.logger.debug('Returning cached theme configuration');
    this.logger.log(`Fetched theme config from upstream`);
    this.logger.warn(`Upstream returned unexpected status: ${response.status}`);
    this.logger.error(
      `Theme service timed out after ${timeout}ms`,
      error.stack,
    );
  }
}
```

| Level   | When to use                                                |
| ------- | ---------------------------------------------------------- |
| `debug` | Cache hits, internal state changes — development only      |
| `log`   | Significant operations (fetched config, processed request) |
| `warn`  | Unexpected but recoverable conditions                      |
| `error` | Exceptions and failures. Always include `error.stack`.     |

---

### MetricsInterceptor

The `MetricsInterceptor` in `common/interceptors/` logs every request with method, URL, status code, and duration. It is registered globally in `AppModule`. Do not add per-controller request logging — it duplicates this.

---

### Frontend Logging

Use `console.debug` for development-only tracing and `console.warn` / `console.error` for real issues. Follow the pattern in `useFavicon`:

```typescript
// Development trace — acceptable in hooks with a meaningful message
console.debug('No favicon URL provided, using default');

// Real issue — user-visible behaviour was affected
console.warn(`Failed to load favicon from ${faviconUrl}`);

// Context error — always include what failed and why
console.error('Failed to fetch theme configuration:', err);
```

Do not leave `console.log` in committed code. The ESLint `no-console` rule is set to `error`.

---

## 13. CI/CD Standards

### Nx Affected Commands

All CI steps run `nx affected` to avoid rebuilding unchanged projects. This is the primary mechanism for keeping CI fast in a monorepo.

```bash
# Check what is affected before running tasks
pnpm nx show projects --affected --base=origin/main

# Lint only affected
pnpm nx affected --target=lint --base=origin/main

# Typecheck only affected
pnpm nx affected --target=typecheck --base=origin/main

# Test only affected
pnpm nx affected --target=test --base=origin/main --ci

# Build only affected
pnpm nx affected --target=build --base=origin/main
```

---

### Pipeline Stages

Every PR must pass all stages before merge:

```
lint → typecheck → test → build
```

Each stage runs only affected projects. Failures block the merge.

---

### Key Scripts

```bash
pnpm start          # nx serve chat (frontend, port 4207)
pnpm start:api      # nx serve chat-api (backend, port 3005)
pnpm start:all      # both in parallel

pnpm test           # nx run-many -t test --all
pnpm lint           # nx run-many --target=lint --all
pnpm lint:fix       # nx run-many --target=lint --all --fix
pnpm format         # prettier --write "**/*.{ts,tsx,json,css,md}"
pnpm graph          # nx graph (open dependency graph in browser)
```

---

## 14. Tooling & Configuration Reference

### Prettier (`.prettierrc`)

```json
{
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "semi": true,
  "printWidth": 80,
  "arrowParens": "always",
  "bracketSpacing": true,
  "jsxSingleQuote": false,
  "endOfLine": "auto",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

Prettier is the single source of truth for formatting. Do not configure per-file formatting overrides. If a file looks wrong after `pnpm format`, the file needs to change — not the Prettier config.

---

### ESLint (key rules)

```javascript
// eslint.config.mjs — key rules in effect
'no-console': 'error',                          // use Logger in NestJS, console.warn/error in React
'@nx/enforce-module-boundaries': 'error',       // library boundary violations block the build
'import/order': 'error',                        // import grouping: external → internal → relative
'import/no-duplicates': 'error',
'jsx-a11y/*': 'warn',                           // accessibility — treat as errors in PR review
```

---

### Production Dependencies (Summary)

| Package               | Version | Purpose            |
| --------------------- | ------- | ------------------ |
| React                 | 19      | UI framework       |
| react-router-dom      | 6.30    | Client routing     |
| react-i18next         | 17      | i18n               |
| @epam/ai-dial-ui-kit  | 0.9     | DIAL design system |
| @tabler/icons-react   | 3       | Icon set           |
| NestJS                | 11      | Backend framework  |
| @nestjs/swagger       | 11      | OpenAPI            |
| @nestjs/throttler     | 6       | Rate limiting      |
| @nestjs/cache-manager | 3       | In-memory cache    |
| helmet                | 8       | Security headers   |
| class-validator       | latest  | DTO validation     |

---

### Dev Dependencies (Summary)

| Package                     | Version | Purpose                  |
| --------------------------- | ------- | ------------------------ |
| Nx                          | 22      | Monorepo tooling         |
| Vite                        | 8       | Frontend build           |
| Vitest                      | 4       | Test runner              |
| @testing-library/react      | 16      | Component testing        |
| @testing-library/user-event | 14      | Interaction simulation   |
| supertest                   | 7       | HTTP integration testing |
| TypeScript                  | 5.9     | Type system              |
| Tailwind CSS                | 3       | Utility CSS              |
| Prettier                    | 3       | Formatting               |
| ESLint                      | 9       | Linting                  |

---

_Questions or updates: open a PR against this file. Large structural changes require a Staff Engineer review._

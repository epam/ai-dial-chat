# React App Best Practices — `apps/chat`

> Source of truth for React/Vite conventions in this app. Prefer existing local
> patterns over introducing new structure.

## 1. Project Layout

```
apps/chat/src/
├── app/                         # top-level app shell and app-level tests
├── components/                  # UI components grouped by concern/domain
│   └── auth/                    # auth-only UI widgets and route guards
├── context/                     # React context grouped by concern/domain
│   └── auth/                    # auth React context providers and hooks
├── hooks/                       # reusable hooks grouped by concern/domain
│   └── auth/                    # auth-only hooks
├── pages/                       # route pages grouped by concern/domain
│   └── auth/                    # auth routes such as Login
├── server-api/                  # API client primitives and endpoint constants
└── utils/                       # framework-agnostic utilities
```

Rules:

- Keep the top-level React concern folders (`components/`, `context/`,
  `hooks/`, `pages/`, `utils/`) and create domain subfolders inside them when a
  feature needs ownership, e.g. `pages/auth/`, `context/auth/`, `hooks/auth/`,
  and `components/User/`.
- Keep cross-domain shared code directly in the top-level folders only when it
  is not owned by a single feature domain.
- Tests are co-located with the source folder they cover. When a folder has a
  single spec, keep it next to the source file; when a folder would contain
  more than one spec, put those specs under that folder's `tests/` subfolder.
  Example: `components/RequireAuth/tests/UserMenu.spec.tsx` and
  `components/RequireAuth/tests/RequireAuth.spec.tsx`.
- Shared test mocks belong in `src/test-setup.ts` and are wired through
  `vite.config.mts` `test.setupFiles`. Do not duplicate global framework mocks
  such as `react-i18next` in individual specs.
- Auth UI and logic live in auth subfolders inside the relevant concern folder:
  `components/RequireAuth/`, `context/auth/`, `hooks/auth/`, and `pages/auth/`.
- Header may render auth-owned widgets by importing from
  `src/components/RequireAuth/`; the widget implementation still belongs to the auth
  concern.

## 2. Routing and API Boundaries

- `main.tsx` owns top-level routing and providers.
- Auth routes should import pages from `src/pages/auth/`.
- Static `/api/v1/auth/*` endpoints belong in `server-api/base.ts` via
  `ApiEndpoints`. Dynamic login URLs may be built at the auth call site because
  they include runtime provider ids and callback URLs.
- Use `async`/`await` with `try`/`catch`/`finally` for frontend async flows
  instead of Promise chains with `.then()`/`.catch()`. For `React.lazy` named
  exports, use an async loader that awaits the import and returns `{ default }`.
- Use `void` before Promise-returning calls only for intentional fire-and-forget
  work where errors are handled. Do not add it as a routine prefix for local
  async helpers in `useEffect`.

## 3. Testing

- Use Testing Library role/label/text queries for user-observable behavior.
- Run tasks through Nx, e.g. `npm exec nx run @epam/chat:test-ci--<path>` or
  `npm exec nx run @epam/chat:lint`.

# file-manager-standalone-page Specification

## Purpose

Specifies the standalone `/files` route: its registration (`apps/chat/src/types/routes.ts`, `apps/chat/src/app/app.tsx`), its navigation entry, and `DialFileManagerPage` (`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`) — a thin host that reuses `DialFileManagerShell` and `useDialFileManager`'s `standalone`/`browse` variant (from the `file-manager-shell` capability) to browse and manage files outside the conversation attach flow, with no page chrome of its own.

## Requirements
### Requirement: File Manager route registration

`apps/chat/src/types/routes.ts` SHALL define `ROUTES.FileManager = '/files'`. `apps/chat/src/app/app.tsx` SHALL register a lazy-loaded route at `ROUTES.FileManager` rendering `DialFileManagerPage`, wrapped in `RouteErrorBoundary` and `Suspense` with `fallback={<RouteFallback />}`, following the same pattern as the existing `ROUTES.Catalog` route registration.

#### Scenario: Navigating to /files renders the page

- **WHEN** an authenticated user navigates to `/files`
- **THEN** `DialFileManagerPage` renders inside the app shell, with a `RouteFallback` shown while the lazy chunk loads

### Requirement: File Manager navigation entry

`apps/chat/src/constants/navigation.ts` SHALL add a `NavigationItem` to `NAVIGATION_CONFIG` with `path: ROUTES.FileManager`, a Tabler folder/files icon, and a new `NavigationI18nKeys` member (e.g. `FileManager`) resolving to a `dialFileManager.page.navLabel` i18n key, following the same shape as the existing Catalog entry.

#### Scenario: File Manager link appears in main navigation

- **WHEN** the app shell renders its navigation list
- **THEN** a File Manager item is visible alongside Home and Catalog, linking to `/files`

#### Scenario: File Manager nav item highlights when active

- **WHEN** the current route is `/files`
- **THEN** the File Manager navigation item is rendered in its active/selected state

### Requirement: DialFileManagerPage component

`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx` SHALL be a top-level `FC` that: resolves `bucket` via `useUser()` from `apps/chat/src/context/auth/UserContext.tsx` (`user?.bucket ?? ''`, matching the attach modal's existing pattern); calls `useDialFileManager({ bucket, variant: 'standalone', actionProfile: 'browse' })`; wires notifications via `useNotification()`; and renders `DialFileManagerShell` fed by the hook's result, filling the full page with no additional chrome. It SHALL NOT render `DialPopup`, any attach footer, or a page title/header, and SHALL NOT pass `allowedTypes`, `maximumAttachmentsAmount`, `canAttachFolders`, or `onAttach`.

#### Scenario: Root listing loads without user interaction

- **WHEN** `DialFileManagerPage` mounts
- **THEN** the root folder listing for the user's bucket is fetched and rendered without requiring the user to navigate or click anything (relies on `useDialFileManager`'s existing standalone mount-load behavior)

#### Scenario: No attach affordances are rendered

- **WHEN** `DialFileManagerPage` is rendered
- **THEN** there is no "Attach" button, no attach footer, and no attach-selection-limit messaging anywhere on the page

#### Scenario: Tabs and CRUD match the attach modal

- **WHEN** a user switches between My files, Shared with me, and Organization tabs on the standalone page
- **THEN** the same columns, dates, and per-tab actions (upload, delete, rename, download) appear as they do in the attach modal for the same tab

### Requirement: Standalone page responsive layout

`DialFileManagerPage` SHALL be authored mobile-first per `.claude/skills/responsive-design/SKILL.md`: base classes target ≤768px, with `desktop:` overrides for ≥769px (no `sm:`/`md:`/`lg:`/`xl:` or non-project breakpoint prefixes). The page's root container SHALL use `min-h-0` plus flex-grow so `DialFileManagerShell` fills available height under the app's global header on desktop. Any directional Tailwind classes SHALL use logical properties (`text-start`, `ps-*`/`pe-*`, `ms-*`/`me-*`) — no new physical-direction (`ml-*`/`mr-*`/`text-left`/`text-right`) classes.

#### Scenario: Page fits at 360px width with no horizontal scroll

- **WHEN** the page is rendered at 360px viewport width
- **THEN** no element overflows horizontally and the toolbar/tabs remain reachable

#### Scenario: Page renders correctly under Arabic (RTL)

- **WHEN** the active language is Arabic
- **THEN** the page flips direction correctly via inherited `dir="rtl"` and logical-property classes, with no visually mirrored physical-class artifacts


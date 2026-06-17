# Prompt: Create `libs/catalog` from a large catalog component

You are working in the ai-dial-chat Nx monorepo.

## Context

Tech stack:
- React 19, TypeScript 5.9 (strict), Vite 8, Tailwind CSS 3
- Module resolution: `moduleResolution: "bundler"`, `module: "esnext"` — omit .ts/.tsx extensions from relative imports
- UI kit: `@epam/ai-dial-ui-kit` (always prefer Dial* components over raw HTML; use MCP tools to discover them)
- Icons: `@tabler/icons-react` only — no inline SVGs
- Class merging: `mergeClasses` from `@epam/ai-dial-chat-shared`
- Testing: Vitest 4 + @testing-library/react 16

Styling split (required):
- Layout/spacing/sizing/positioning/interaction states: Tailwind classes in TSX
- Theme colors and semantic text colors: CSS variables in `.module.scss` only (with 3-tier fallback: user override var -> app token var -> hex)
- Dynamic style values: inline `style` only when no Tailwind utility can express the value
- Build CSS vars in TSX using `buildCssVars` from `@epam/ai-dial-chat-shared`

Props API for text/styles (required):
- Do not expose many flat style props when concern is shared (e.g. `titleClassName`, `descriptionClassName`, etc.)
- Use grouped props for consistency:
  - `titles?: { ... }` for text copies/labels
  - `styles?: { colors?: { ... }, typography?: { ... } }` for visual overrides
- Defaults must keep typography class only (for example `dial-h3-text`), while semantic color must come from CSS module via CSS vars

## Task

Decompose the large CatalogView component (provided below) into a new Nx library `libs/catalog` with small, focused components.

## Library root

`libs/catalog/` — always include `project.json`, `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `vite.config.ts`, and `src/index.ts`.

## Library internal structure

Analyze the source component and decide the structure yourself:

- Split into as many focused single-responsibility components as the source warrants. Each component gets its own `src/components/{ComponentName}/{ComponentName}.tsx` folder with a `tests/` subfolder.
- Place shared interfaces and types in `src/models/`.
- Place string enums in `src/types/`.
- Place pure helper functions in `src/utils/` (kebab-case filenames, e.g. `catalog-filter.ts`).
- Re-export everything public from `src/index.ts`.

Do not invent components that are not needed by the source. Do not merge unrelated concerns into one file.

## Hard rules for ALL lib code

### No i18n inside libs
Never import `useTranslation` or call `t()`. Pass every user-visible string as a prop with an English default.

### Props interface naming
In `libs/*`, name props `{ComponentName}Props` (not bare `Props`).

### Component syntax
```tsx
export const MyComponent: FC<MyComponentProps> = ({ ... }) => { ... };
```
No `memo()` wrap — libs export plain components; consumers memo if needed.

### JSDoc on all exported symbols
Every exported interface, enum, type, and function needs a JSDoc comment. Every interface property needs an inline `/** ... */` doc.

### Typography and color classes as props
Never hardcode `text-primary`, `text-secondary`, `dial-body-*`, `font-bold`, `text-sm`, etc.
Accept optional `xxxClassName?: string` props with English defaults.

```tsx
interface CatalogItemProps {
  /** CSS class for the item title. Defaults to 'dial-body-semi-text'. */
  titleClassName?: string;
}
```

### Tailwind: logical properties, not physical
Use `ms-*`/`me-*` not `ml-*`/`mr-*`, `ps-*`/`pe-*` not `pl-*`/`pr-*`, `start-*`/`end-*` not `left-*`/`right-*`, `text-start`/`text-end` not `text-left`/`text-right`.

### Directional icons
Icons with left/right meaning (arrows, chevrons) must have `rtl:scale-x-[-1]`.

### No app-specific knowledge
Libs must not import from `apps/*`, use `/api/*` paths, read env vars, use React Router, or reference auth/session.
Accept data and callbacks through typed props.

### String enums, not union types
```ts
// Correct
enum CatalogItemType { Model = 'model', Application = 'application' }
// Wrong
type CatalogItemType = 'model' | 'application';
```

### Arrow functions for helpers
```ts
// Correct
export const filterByType = (items: CatalogItem[], type: CatalogItemType): CatalogItem[] => ...
// Wrong
export function filterByType(...) { ... }
```

### Boolean props/vars prefix
`isLoading`, `hasError`, `isEmpty` — never bare `loading`, `error`, `empty`.

### No data-testid
Never add `data-testid` attributes. Use semantic queries in tests.

### No nested ternaries
Use `if`/`else` or early returns instead of `condition ? a ? b : c : d`.

### Component-first development
Before using `<div>` or `<button>`, check if a `Dial*` component from `@epam/ai-dial-ui-kit` covers the use case.

## What already exists in apps/chat — reuse, do not recreate

### Route
`/catalog` is already registered in `apps/chat/src/app/app.tsx`:
```tsx
const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'));
<Route path={ROUTES.CATALOG} element={<Suspense fallback={<RouteFallback />}><CatalogView /></Suspense>} />
```
After creating the lib, update `apps/chat/src/components/CatalogView/CatalogView.tsx` to import and render the root lib component.

### i18n keys (already defined)
`apps/chat/src/constants/translation-keys.ts`:
```ts
export enum CatalogI18nKeys {
  AriaLabel = 'catalog.ariaLabel',
  ComingSoon = 'catalog.comingSoon',
}
```
`apps/chat/src/i18n/locales/en.json` already contains:
```json
"catalog": {
  "ariaLabel": "Catalog",
  "comingSoon": "Catalog coming soon",
  "loading": "Loading catalog…",
  "error": "Failed to load catalog. Please try again."
}
```
Add any new keys to `CatalogI18nKeys` and `en.json`; pass translated values as props to lib components.

### Data context
`apps/chat/src/context/DeploymentsContext.tsx` exposes `useDeployments()` which provides:
- `items: DeploymentItemDto[]`
- `selectedItemId: string | null`
- `setSelectedItemId: (id: string) => void`
- `isLoading: boolean`
- `error: Error | null`

The updated `CatalogView` in `apps/chat` should call `useDeployments()` and pass data down as props to the lib component. The lib must not import `useDeployments` directly.

### Navigation (commented out, restore if needed)
`apps/chat/src/constants/navigation.ts` has a TODO comment where the catalog nav item was removed. Uncomment and restore it when the lib is ready.

## Source component to decompose

Read the file at the path below and use it as the source to decompose:

`[INSERT FILE PATH HERE]`

## Expected output

For each file: output the full file path and complete file content.
Start with `libs/catalog/src/models/Catalog.ts` (interfaces + enums), then components from smallest to largest, then `index.ts`.

Do not create README or documentation files.
Do not add comments that describe WHAT the code does — only add WHY comments for non-obvious constraints.

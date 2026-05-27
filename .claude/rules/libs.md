---
paths:
  - 'libs/**/*.ts'
  - 'libs/**/*.tsx'
---

# Libs coding conventions

## No i18n inside libs

**Never** use `useTranslation` or `t()` from `react-i18next` in `libs/`. Pass all user-visible strings as props with English default values instead. i18n is the responsibility of the consuming app, not the lib.

## Component syntax

Always use `FC<Props>` syntax:

```tsx
export const MyComponent: FC<MyComponentProps> = ({ ... }) => { ... };
```

## Component folder structure

Component folders under `src/components/` must use PascalCase and match the component name (e.g., `RequireAuth/RequireAuth.tsx`). Tests go in a `tests/` subfolder inside the component folder.

## JSDoc on all exported symbols

Every exported symbol (interfaces, enums, types, functions) must have a JSDoc comment. Each interface/type property must also have an inline `/** ... */` doc. Keep comments factual — describe what the value represents, not how it is used.

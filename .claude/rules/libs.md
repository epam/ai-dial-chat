---
paths:
  - 'libs/**/*.ts'
  - 'libs/**/*.tsx'
globs: 'libs/**/*.ts,libs/**/*.tsx'
applyTo: 'libs/**/*.ts,libs/**/*.tsx'
alwaysApply: false
---

# Libs coding conventions

## No i18n inside libs

**Never** use `useTranslation` or `t()` from `react-i18next` in `libs/`. Pass all user-visible strings as props with English default values instead. i18n is the responsibility of the consuming app, not the lib.

## Component syntax

Name the component props interface `{ComponentName}Props` (not bare `Props`), and use `FC<{ComponentName}Props>` syntax:

```tsx
export const MyComponent: FC<MyComponentProps> = ({ ... }) => { ... };
```

## Component folder structure

Component folders under `src/components/` must use PascalCase and match the component name (e.g., `RequireAuth/RequireAuth.tsx`). Tests go in a `tests/` subfolder inside the component folder.

## JSDoc on all exported symbols

Every exported symbol (interfaces, enums, types, functions) must have a JSDoc comment. Each interface/type property must also have an inline `/** ... */` doc. Keep comments factual — describe what the value represents, not how it is used.

## Typography and color utility classes as props

**Never hardcode typography or color utility classes** (e.g. `dial-body-semi-text`, `dial-small-text`, `text-sm`, `font-bold`, `text-primary`, `text-secondary`, `text-accent`) directly in lib component JSX. The consuming app decides which type scale and color tokens to use. Instead, accept an optional prop and use a sensible default:

```tsx
// Correct — configurable with a sensible default
interface MyProps {
  /** Typography class applied to the title. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** Color class applied to the placeholder icon. Defaults to `'text-secondary'`. */
  placeholderIconClassName?: string;
}
export const MyComponent: FC<MyProps> = ({
  titleClassName = 'dial-body-semi-text',
  placeholderIconClassName = 'text-secondary',
}) => (
  <>
    <span className={mergeClasses(styles.title, titleClassName)}>…</span>
    <Icon className={placeholderIconClassName} />
  </>
);

// Wrong — hardcoded in JSX
<span className={mergeClasses(styles.title, 'dial-body-semi-text')}>…</span>
<Icon className="text-secondary" />
```

Name the prop `<element>ClassName` (e.g. `titleClassName`, `labelClassName`, `placeholderIconClassName`). Layout helpers (`truncate`, `min-w-0`, `flex-1`) and structural color-independent utilities that do not vary by theme may remain hardcoded.

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

## Typography utility classes as props

**Never hardcode typography utility classes** (e.g. `dial-body-semi-bold-text`, `dial-small-text`, `text-sm`, `font-bold`) directly in lib component JSX. The consuming app decides which type scale to use. Instead, accept an optional prop and use a sensible default:

```tsx
// ✅ correct — configurable with a sensible default
interface MyProps {
  /** Typography class applied to the title. Defaults to `'dial-body-semi-bold-text'`. */
  titleClassName?: string;
}
export const MyComponent: FC<MyProps> = ({
  titleClassName = 'dial-body-semi-bold-text',
}) => <span className={mergeClasses(styles.title, titleClassName)}>…</span>;

// ❌ wrong — hardcoded in JSX
<span className={mergeClasses(styles.title, 'dial-body-semi-bold-text')}>
  …
</span>;
```

Name the prop `<element>ClassName` (e.g. `titleClassName`, `labelClassName`, `itemLabelClassName`). Layout helpers (`truncate`, `min-w-0`, `flex-1`) that are structural rather than typographic may remain hardcoded.

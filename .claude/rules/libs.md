---
paths:
  - 'libs/**/*.ts'
  - 'libs/**/*.tsx'
  - 'libs/*/package.json'
  - 'libs/*/README.md'
globs: 'libs/**/*.ts,libs/**/*.tsx,libs/*/package.json,libs/*/README.md'
applyTo: 'libs/**/*.ts,libs/**/*.tsx,libs/*/package.json,libs/*/README.md'
alwaysApply: false
---

# Libs coding conventions

## package.json requirements

Every lib under `libs/` must have these three fields in its `package.json`:

- **`"license"`** — must be `"Apache-2.0"`.
- **`"description"`** — a short, plain-English sentence (no period at the end) describing what the lib does. Do not use the lib's package name as the description.
- These fields must appear directly after `"name"` and `"version"`.

```json
{
  "name": "@epam/ai-dial-example",
  "description": "Short description of what this lib provides",
  "version": "0.0.1",
  "license": "Apache-2.0"
}
```

## README.md requirements

Every lib under `libs/` must have a `README.md` at its root. The README must include:

1. **H1 heading** — the npm package name (e.g. `# @epam/ai-dial-example`).
2. **Overview** — a detailed paragraph explaining the lib's purpose, what problems it solves, and when to use it.
3. **Installation** — a `package.json` snippet showing how to add the dependency.
4. **Peer Dependencies** — a list of required peer deps.
5. **Components / Hooks / Utilities** — one subsection per major export with a minimal usage example.

Do not copy Nx scaffold content (`This library was generated with Nx`) into the README — replace it entirely.

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

This applies to exported components too: every exported component (`export const MyComponent: FC<MyComponentProps> = ...`) must have a one-line summary JSDoc directly above its declaration, even when its props interface is already fully documented — a documented `Props` interface does not substitute for a doc on the component itself.

```tsx
// Correct
/** Row of starter-prompt buttons that collapses overflowing items into a dropdown menu. */
export const StarterButtons: FC<StarterButtonsProps> = ({ ... }) => { ... };

// Wrong — no doc on the component declaration
export const StarterButtons: FC<StarterButtonsProps> = ({ ... }) => { ... };
```

When a prop has a default value (via destructuring default or `defaultProps`), its doc comment must state the default, e.g. `/** CSS class applied to the title. Defaults to \`'dial-h1-text'\`. \*/`. A doc that describes the prop's purpose but omits its default is incomplete.

## Typography and color utility classes as props

**Never hardcode typography or color utility classes** (e.g. `dial-body-semi-text`, `dial-small-text`, `text-sm`, `font-bold`, `text-primary`, `text-secondary`, `text-accent`) directly in lib component JSX. The consuming app decides which type scale and color tokens to use. Instead, accept an optional prop and use a sensible default:

```tsx
// Correct — configurable with a sensible default
interface MyProps {
  /** CSS class applied to the title. Defaults to `'dial-body-semi-bold-text'`. */
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

---
paths:
  - '**/*.tsx'
globs: '**/*.tsx'
applyTo: '**/*.tsx'
alwaysApply: false
---

# JSX / TSX conventions

## Tailwind over inline style

Always prefer Tailwind utility classes over inline `style` props. Use the `style` prop only for dynamic computed values (e.g., pixel values from JS measurements, CSS custom properties set by user overrides) that cannot be expressed as static Tailwind classes.

## Conditional class composition

Compose conditional classes with `mergeClasses` — not template-literal concatenation, string interpolation, or array `.join(' ')`.

```tsx
// Wrong
className={[nameClassName, styles.nameText].join(' ')}

// Correct
className={mergeClasses(nameClassName, styles.nameText)}
```

## Component-First Development

**Always prefer UI kit components over raw HTML elements.** Before reaching for native `<button>`, `<input>`, `<select>`, or other HTML elements:

1. **Look for a UI kit component** — check if a suitable `Dial*` component exists for your use case using the MCP tools below.
2. **Use raw elements only as last resort** — if and only if no UI kit component meets the requirements, use native HTML (and document why).

### Buttons

**Never** import button components directly from `@epam/ai-dial-ui-kit`. Always use the app-level wrappers from `libs/ai-dial-kit/src/components/Button/Buttons.tsx`:

| Use case                   | Component       |
| -------------------------- | --------------- |
| Primary action             | `PrimaryButton` |
| Neutral / secondary action | `NeutralButton` |
| Ghost / tertiary action    | `GhostButton`   |

```tsx
// Correct
import { PrimaryButton, NeutralButton, GhostButton } from '@epam/ai-dial-kit';

// Wrong — do not import directly from ui-kit
import { DialPrimaryButton, DialGhostButton } from '@epam/ai-dial-ui-kit';
```

### Search bar

**Never** use `DialSearch` from `@epam/ai-dial-ui-kit`. Use `SearchBar` from `@epam/ai-dial-kit` instead.

```tsx
// Correct
import { SearchBar } from '@epam/ai-dial-kit';

// Wrong
import { DialSearch } from '@epam/ai-dial-ui-kit';
```

### Spinner / loader

**Never** use `DialLoader`. Use `DialSpinner` from `@epam/ai-dial-ui-kit` instead.

```tsx
// Correct
import { DialSpinner } from '@epam/ai-dial-ui-kit';

// Wrong
import { DialLoader } from '@epam/ai-dial-ui-kit';
```

### Tab row

**Never** use `DialTab` from `@epam/ai-dial-ui-kit`. Use `TabRow` from `@epam/ai-dial-kit` instead.

```tsx
// Correct
import { TabRow } from '@epam/ai-dial-kit';

// Wrong
import { DialTab } from '@epam/ai-dial-ui-kit';
```

## Semantic HTML

Use semantic HTML elements (`button`, `nav`, `main`, `section`) before reaching for `div`/`span`.

## Prop passthrough with rest spread

When a wrapper component passes most of its props unchanged to an inner component, destructure only the props the wrapper itself uses and spread the rest:

```tsx
// Correct — wrapper-specific props destructured, the rest spread
const Outer: FC<OuterProps> = ({
  wrapperOnly,
  styles: stylesProp,
  defaultedProp = 'default value',
  ...innerProps
}) => (
  <Inner
    defaultedProp={defaultedProp}
    {...innerProps}
    derivedProp={derived(stylesProp)}
  />
);

// Wrong — every prop listed explicitly
const Outer: FC<OuterProps> = ({
  wrapperOnly,
  styles: stylesProp,
  foo,
  bar,
  baz,
}) => <Inner foo={foo} bar={bar} baz={baz} derivedProp={derived(stylesProp)} />;
```

Props with non-trivial defaults that are also needed locally must still be destructured with their defaults; pass them explicitly to the inner component before `{...innerProps}` so that caller-supplied values in the spread override the defaults correctly. Derived or locally-managed props (e.g. state, computed values) go after `{...innerProps}` so they always take precedence.

## aria-label values go through i18n

All `aria-label` values must go through i18n: in apps use `t()` with a key from `translation-keys.ts`; in libs expose an `ariaLabel`/`ariaLabels` prop with an English default string. Never hardcode English `aria-label` text in apps, and never use `useTranslation` in libs.

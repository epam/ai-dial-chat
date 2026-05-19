# Lib Styling Guide

Reference implementation: `libs/conversation-input`

## Core principle

Libs must work in any project — with or without this app's theme. The styling split is:

| What                           | Where                                           |
| ------------------------------ | ----------------------------------------------- |
| Layout, spacing, border-radius | Tailwind classes in JSX                         |
| Colors, typography (themed)    | CSS custom properties in `.module.scss`         |
| User overrides                 | `colors` / `typography` props → inline CSS vars |

---

## CSS Variables pattern

### Three-tier fallback

Every themeable value uses a three-tier fallback chain defined **once** in the SCSS module:

```scss
// 1. User override via prop  → --ci-bg (set inline by component)
// 2. App theme variable      → --bg-layer-2
// 3. Hard fallback hex       → #161B2D
background: var(--ci-bg, var(--bg-layer-2, #161b2d));
```

Hex fallbacks live **only** in `.module.scss`. Never duplicate them in TypeScript.

### Variable naming convention

Prefix all lib-scoped CSS variables with `--<lib-prefix>-`:

```
conversation-input → --ci-*
conversation-messages → --cm-*
```

---

## SCSS module rules

`.module.scss` contains **only** CSS custom property references — no layout, no spacing, no border-radius.

Allowed in SCSS:

- Color and typography via `var()`
- Pseudo-elements: `::placeholder`, `::selection`
- State selectors that change colors: `&:focus-within`, `&:disabled`

Not allowed in SCSS (use Tailwind instead):

- `display`, `flex`, `gap`, `padding`, `margin`
- `border-radius`, `width`, `height`
- `cursor`, `opacity`, `resize`, `outline`

### Example

```scss
// ✅ correct — only CSS vars
.wrapper {
  background: var(--ci-bg, var(--bg-layer-2, #161b2d));
  border-color: var(--ci-border, var(--stroke-primary, #696e7c));

  &:focus-within {
    border-color: var(--ci-border-focus, var(--stroke-focus, #eef1f7));
  }
}

.textarea {
  color: var(--ci-text, var(--text-primary, #eef1f7));

  &::placeholder {
    color: var(--ci-placeholder, var(--text-secondary, #9fa6bd));
  }
}

// ❌ wrong — layout in SCSS
.wrapper {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
}
```

---

## Props API

Every lib component exposes two optional customization props:

```ts
export interface <Name>Colors {
  background?: string;
  text?: string;
  border?: string;
  // ... only what the component actually uses
}

export interface <Name>Typography {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  lineHeight?: string;
  // optionally: className for passing a single font utility class
  fontClassName?: string;
}
```

### Interfaces live in `src/models/`

```
src/
  models/
    Input.ts              ← InputProps, InputColors, InputTypography
    ConversationInput.ts  ← ConversationInputProps, ...Colors, ...Typography
  components/
    Input/
      Input.tsx
      Input.module.scss
```

### Component applies props as inline CSS vars

In the component, **only set a variable if the user passed a value**. No hex values in TypeScript:

```tsx
const cssVars = {
  ...(colors?.background && { '--ci-bg': colors.background }),
  ...(colors?.text &&       { '--ci-text': colors.text }),
  // font class takes priority — skip individual vars
  ...(!typography?.fontClassName && typography?.fontSize && {
    '--ci-font-size': typography.fontSize,
  }),
} as React.CSSProperties;

return <div style={cssVars} className={mergeClasses(styles.wrapper, 'flex w-full ...', className)}>
```

### When `fontClassName` is provided

Apply it alongside the SCSS class. The SCSS class handles color; the font class handles typography:

```tsx
<h1 className={mergeClasses(styles.welcome, 'text-center', typography?.fontClassName)}>
```

---

## Class merging

Use `mergeClasses` from `@epam/chat-shared` (wraps `classnames`):

```tsx
import { mergeClasses } from '@epam/chat-shared';

className={mergeClasses(styles.wrapper, 'flex w-full gap-2', className)}
```

---

## Consuming in another project

### With this app's theme (CSS vars already defined)

```tsx
import { ConversationInput } from '@epam/conversation-input';
import '@epam/conversation-input/styles.css';

// Theme CSS vars resolve automatically — no extra config needed
<ConversationInput onSend={handleSend} />;
```

### Without this app's theme (external project)

```tsx
// Hex fallbacks in styles.css kick in automatically
// Optionally override via props:
<ConversationInput
  colors={{ background: '#fff', text: '#000', border: '#ccc' }}
  typography={{ fontSize: '16px', fontFamily: 'Inter' }}
  onSend={handleSend}
/>
```

---

## Component type convention

All lib components use `FC<Props>` syntax:

```tsx
export const MyComponent: FC<MyComponentProps> = ({ ... }) => { ... };
```

Props interfaces are named `<ComponentName>Props` and live in `src/models/`.

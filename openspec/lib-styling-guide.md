# Lib Styling Guide

Reference implementation: `libs/conversation-input`

## Core principle

Libs must work in any project — with or without this app's theme. The styling split is:

| What                           | Where                                           |
| ------------------------------ | ----------------------------------------------- |
| Layout, spacing, border-radius | Tailwind classes in JSX                         |
| Colors, typography (themed)    | CSS custom properties in `.module.scss`         |
| User overrides                 | `colors` / `typography` props → inline CSS vars |
| Dynamic computed values        | Inline `style` prop (only when no Tailwind class exists for the value) |

---

## CSS Variables pattern

### Three-tier fallback

Every themeable value uses a three-tier fallback chain defined **once** in the SCSS module:

```scss
// 1. User override via prop  → --ci-bg (set inline by component)
// 2. App theme variable      → --bg-layer-sunken
// 3. Hard fallback hex       → #EEF1F7
background: var(--ci-bg, var(--bg-layer-sunken, #EEF1F7));
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
  background: var(--ci-bg, var(--bg-layer-sunken, #EEF1F7));
  border-color: var(--ci-border, var(--stroke-primary, #696e7c));

  &:focus-within {
    border-color: var(--ci-border-focus, var(--stroke-focus, #eef1f7));
  }
}

.textarea {
  color: var(--ci-text, var(--text-primary, #161B2D));

  &::placeholder {
    color: var(--ci-placeholder, var(--text-secondary, #6B7280));
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

Every lib component exposes a single optional `styles` prop that groups colors and typography:

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
  lineHeight?: string | number;
  letterSpacing?: string;
  // pass a single CSS utility class instead of explicit fields
  fontClassName?: string;
}

export interface <Name>Styles {
  colors?: <Name>Colors;
  typography?: <Name>Typography;
  /**
   * Extra class name(s) merged onto a named inner element (e.g. the scrollable
   * body `<div>`). Add one `<element>ClassName` field per inner element that
   * consumers may need to style independently.
   */
  bodyClassName?: string;
  /**
   * Arbitrary CSS custom properties applied inline to the component's root
   * element. Use as a last-resort escape hatch when the typed `colors` /
   * `typography` fields do not expose a needed variable. Values are merged
   * after the `buildCssVars` output, so they can override typed fields.
   */
  cssVars?: CSSProperties;
}
```

### Interfaces live in `src/models/`

```
src/
  models/
    Input.ts              ← InputProps, InputColors, InputTypography, InputStyles
    ConversationInput.ts  ← ConversationInputProps, ...Colors, ...Typography, ...Styles
  components/
    Input/
      Input.tsx
      Input.module.scss
```

### Component applies props as inline CSS vars

In the component, use `buildCssVars` from `@epam/ai-dial-chat-shared` to convert the props to a `CSSProperties` object. It omits entries whose value is `undefined` or `''`, so pass `undefined` explicitly when a var should be skipped. No hex values in TypeScript:

```tsx
import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';

const noCustomClass = !typography?.fontClassName;
const cssVars = buildCssVars({
  '--ci-bg': colors?.background,
  '--ci-text': colors?.text,
});

return <div style={cssVars} className={mergeClasses(styles.wrapper, 'flex w-full ...', className)}>
```

### When `fontClassName` is provided

Apply it alongside the SCSS class. The SCSS class handles color; the font class handles typography:

```tsx
<h1 className={mergeClasses(styles.welcome, 'text-center', typography?.fontClassName)}>
```

### SCSS wiring for typography CSS vars

Wire the typography vars in `.module.scss` on the element(s) where font styles apply. Omit fallbacks — an unset var on an inherited property resolves to `inherit`, so the font class on the parent still applies:

```scss
// ✅ correct — no fallback needed; unset var inherits from parent
.content {
  color: var(--ci-text, var(--text-primary, #161B2D));
  font-size: var(--ci-font-size);
  font-weight: var(--ci-font-weight);
  line-height: var(--ci-line-height);
  letter-spacing: var(--ci-letter-spacing);
  font-family: var(--ci-font-family);
}
```

Typography var naming follows the same `--<lib-prefix>-` convention as color vars:

```
conversation-input   → --ci-font-size, --ci-font-weight, …
conversation-stages  → --cs-font-size, --cs-font-weight, …
```

---

## Class merging

Use `mergeClasses` from `@epam/ai-dial-chat-shared` (wraps `classnames`):

```tsx
import { mergeClasses } from '@epam/ai-dial-chat-shared';

className={mergeClasses(styles.wrapper, 'flex w-full gap-2', className)}
```

---

## Consuming in another project

### With this app's theme (CSS vars already defined)

```tsx
import { ConversationInput } from '@epam/ai-dial-conversation-input';
import '@epam/ai-dial-conversation-input/styles.css';

// Theme CSS vars resolve automatically — no extra config needed
<ConversationInput onSend={handleSend} />;
```

### Without this app's theme (external project)

```tsx
// Hex fallbacks in styles.css kick in automatically
// Optionally override via props:
<ConversationInput
  styles={{
    colors: { background: '#fff', text: '#000', border: '#ccc' },
    typography: { fontSize: '16px', fontFamily: 'Inter' },
  }}
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

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

1. **Look for a UI kit component** — check if a suitable component exists for your use case using the `@epam/ai-dial-ui-kit` MCP tools (`searchEntity` / `getEntityDetails`).
2. **Use raw elements only as last resort** — if and only if no UI kit component meets the requirements, use native HTML (and document why).

### Always use generation 2.0 kit components

`@epam/ai-dial-ui-kit` ships two component generations:

| Generation      | Naming                                  | Status                            |
| --------------- | --------------------------------------- | --------------------------------- |
| **2.0** (use)   | no prefix — `Button`, `Input`, `Select` | current design system             |
| **1.0** (avoid) | `Dial*` — `DialButton`, `DialInput`     | legacy, kept for back-compat only |

**Always import the 2.0 component.** Reach for a `Dial*` component only when the MCP lookup shows it has no 2.0 replacement (e.g. `DialPagination`, `DialSlider`, `DialGrid`, `DialNoDataContent`, `DialFileManager` currently have none). `DialTooltip`, `DialEllipsisTooltip`, `DialCheckbox`, `DialRadioButton`, `DialRadioGroup` and `DialSegmentedControl` gained 2.0 counterparts in ui-kit 0.14 — use `Tooltip`, `EllipsisTooltip`, `Checkbox`, `Radio`, `RadioGroup`, `SegmentedControl`. `DialFormPopup` is likewise superseded: `Popup` builds the Cancel/Submit footer from `mainButtons`/`additionalButtons`.

```tsx
// Correct — generation 2.0
import { Button, Input, Popup, Select, Tabs } from '@epam/ai-dial-ui-kit';

// Wrong — legacy 1.0 with a 2.0 replacement available
import {
  DialButton,
  DialInput,
  DialPopup,
  DialSelect,
  DialTabs,
} from '@epam/ai-dial-ui-kit';
```

`searchEntity` ranks 2.0 results first, and a 1.0 result carries an explicit "Use instead" pointer — follow it. When migrating an existing `Dial*` call site, confirm the 2.0 prop signature with `getEntityDetails("component", "<Name>")` first; props are not always identical between generations.

````

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
````

Props with non-trivial defaults that are also needed locally must still be destructured with their defaults; pass them explicitly to the inner component before `{...innerProps}` so that caller-supplied values in the spread override the defaults correctly. Derived or locally-managed props (e.g. state, computed values) go after `{...innerProps}` so they always take precedence.

## Tabler icon stroke

Tabler renders every outline icon at `stroke={2}`, and the 2.0 design scale
puts icons at 1.5, so the weight has to be passed on **every** icon — an
omitted prop is a visibly heavier glyph sitting next to its neighbours.
Pass the kit token, never the literal, so the scale has one owner.

```tsx
import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconPlus } from '@tabler/icons-react';

// Correct
<IconPlus size={DIAL_ICON_SIZE.MD} stroke={DIAL_KIT_ICON_STROKE} aria-hidden />;

// Wrong — falls back to Tabler's 2px default
<IconPlus size={DIAL_ICON_SIZE.MD} aria-hidden />;

// Wrong — restates the scale at the call site
<IconPlus size={DIAL_ICON_SIZE.MD} stroke={1.5} aria-hidden />;
```

When size, stroke and `aria-hidden` are all an icon needs, spread
`BASE_MD_ICON_PROPS` / `BASE_LG_ICON_PROPS` from `@epam/ai-dial-chat-shared`
— they already carry the token.

Two exceptions, and only these two:

- **Filled glyphs** (`Icon*Filled`) — Tabler drops the `stroke` prop for the
  filled set, so passing it is dead code. Leave it off.
- **Empty-state illustrations** — a 48px+ icon inside `PanelEmptyState` stays at
  `stroke={1}`; 1.5 reads as a fence at that size. The kit makes the same
  exception for its own `NoDataContent`.

The border half of the same scale is plain Tailwind: `border` (1px) for
controls, standalone dividers and table frames, `border-2` for active/selected
highlighting, and `0.5px solid` in a stylesheet for dividers **inside** a table.
A named `borderWidth` token cannot work — `borderColor` already owns `warning`,
`error` and friends, so `border-warning` would set a width and a colour at once.

## aria-label values go through i18n

All `aria-label` values must go through i18n: in apps use `t()` with a key from `translation-keys.ts`; in libs expose an `ariaLabel`/`ariaLabels` prop with an English default string. Never hardcode English `aria-label` text in apps, and never use `useTranslation` in libs.

# RTL and Arabic language support

All apps and libs must support Arabic (`ar`) and any other right-to-left locale. The active language drives `document.documentElement.dir` — `rtl` or `ltr` — which Tailwind's `rtl:` / `ltr:` variants and CSS logical properties key off.

## Tailwind: logical over physical

Use **logical** direction utilities everywhere text or element direction should follow the writing direction. Never use physical-direction utilities for this purpose.

| Physical (forbidden for directional use) | Logical (required) |
|---|---|
| `ml-*` / `mr-*` | `ms-*` / `me-*` |
| `pl-*` / `pr-*` | `ps-*` / `pe-*` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `left-*` / `right-*` | `start-*` / `end-*` |
| `border-l-*` / `border-r-*` | `border-s-*` / `border-e-*` |
| `rounded-l-*` / `rounded-r-*` | `rounded-s-*` / `rounded-e-*` |

In `.scss` / `.css` use CSS logical properties: `margin-inline-start/end`, `padding-inline-start/end`, `inset-inline-start/end`, `inset-inline`, `border-inline-start/end`.

**Physical classes are allowed** only for elements that must NOT flip: symmetric overlays that span the full width (`inset-x-0`), decorative elements, or anything explicitly pinned to a physical screen edge with an `rtl:` counterpart alongside.

## Directional icons

Icons with inherent left/right meaning (back/forward arrows, chevrons used for navigation or expand/collapse) must be mirrored in RTL:

```tsx
<IconChevronRight className="rtl:scale-x-[-1]" />
```

Symmetric icons (×, +, ⚙, ↑, ↓) must NOT be flipped.

## Slide-in drawers and panels

A drawer anchored to the start edge must use `start-0` and a direction-aware hide transform:

```tsx
className={mergeClasses(
  'fixed inset-y-0 start-0',
  isOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full',
)}
```

## Centering tricks

`left-1/2 -translate-x-1/2` centers an absolutely-positioned element and is direction-agnostic — leave it as-is.

## Libs and direction context

Libs (`libs/*`) must **not** import i18n or read the language to determine direction. Libs rely on CSS logical properties and the inherited `dir` attribute from `<html>`. If a lib needs an explicit direction override, it accepts `dir?: 'ltr' | 'rtl'` as a prop and passes it to its root element.

## Adding a new locale

1. Create `apps/chat/src/i18n/locales/<lang>.json` with all keys from `en.json`.
2. Register the locale in `apps/chat/src/i18n/config.ts` (`resources` object).
3. Add the locale to the language selector UI.
4. If the locale is RTL, add its language code to `RTL_LANGUAGES` in `apps/chat/src/i18n/config.ts`.

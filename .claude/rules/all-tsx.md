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

Compose conditional classes with `mergeClasses` — not template-literal concatenation or string interpolation.

## Component-First Development

**Always prefer UI kit components over raw HTML elements.** Before reaching for native `<button>`, `<input>`, `<select>`, or other HTML elements:

1. **Look for a UI kit component** — check if a suitable `Dial*` component exists for your use case using the MCP tools below.
2. **Use raw elements only as last resort** — if and only if no UI kit component meets the requirements, use native HTML (and document why).

## Semantic HTML

Use semantic HTML elements (`button`, `nav`, `main`, `section`) before reaching for `div`/`span`.

## aria-label values go through i18n

All `aria-label` values must go through i18n: in apps use `t()` with a key from `translation-keys.ts`; in libs expose an `ariaLabel`/`ariaLabels` prop with an English default string. Never hardcode English `aria-label` text in apps, and never use `useTranslation` in libs.

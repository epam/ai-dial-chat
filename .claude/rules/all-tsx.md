---
paths:
  - '**/*.tsx'
---

# JSX / TSX conventions

## Tailwind over inline style

Always prefer Tailwind utility classes over inline `style` props. Use the `style` prop only for dynamic computed values (e.g., pixel values from JS measurements, CSS custom properties set by user overrides) that cannot be expressed as static Tailwind classes.

## Component-First Development

**Always prefer UI kit components over raw HTML elements.** Before reaching for native `<button>`, `<input>`, `<select>`, or other HTML elements:

1. **Look for a UI kit component** — check if a suitable `Dial*` component exists for your use case using the MCP tools below.
2. **Use raw elements only as last resort** — if and only if no UI kit component meets the requirements, use native HTML (and document why).

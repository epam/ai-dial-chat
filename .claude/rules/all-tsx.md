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

## @epam/ai-dial-ui-kit MCP tools

When implementing or modifying components, forms, or UI built with `@epam/ai-dial-ui-kit`, use the MCP server tools — not `grep`, `glob`, or file system searches:

- `searchEntity(entity, query?)` — discover components and utilities
- `getEntityDetails(entity, name?)` — read exact prop signatures, code examples, and design tokens

The MCP tools provide accurate, structured metadata. File system searches miss type information and examples.

## Component-First Development

**Always prefer UI kit components over raw HTML elements.** Before reaching for native `<button>`, `<input>`, `<select>`, or other HTML elements:

1. **Look for a UI kit component** — Check if a suitable `Dial*` component exists for your use case
2. **Use raw elements only as last resort** — If and only if no UI kit component meets the requirements, use native HTML (and document why)

## MCP Tools

Use these two tools for all UI kit discovery and documentation needs: `searchEntity(entity, query?)` and `getEntityDetails(entity, name?)`. If you need to look up **ANYTHING** about the ui kit, use the MCP server. **Never** use rg/ls commands for the ui kit module inspection.

> **Note:** Do not use `grep`, `glob`, `find`, or similar file system tools to discover components. The MCP tools provide accurate, structured metadata. File system searches miss examples, miss type information, and are slower.

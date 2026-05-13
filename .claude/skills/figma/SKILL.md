---
name: figma
description: Design-to-code workflow for Figma designs. Use when the user shares a Figma URL or asks to implement a design into the codebase.
---

# Figma Design-to-Code

## Overview

Translate Figma designs into production-ready React components that match project conventions: React 19, Tailwind CSS, TypeScript, and `@epam/ai-dial-ui-kit`.

## When to Use

- User shares a `figma.com` URL
- User says "implement this design" or "build this screen"
- User asks to match a Figma component or layout

## Workflow

### Step 1 — Fetch the design

Call `get_design_context` with the `fileKey` and `nodeId` extracted from the URL.

URL parsing rules:
- `figma.com/design/:fileKey/...?node-id=:nodeId` → replace `-` with `:` in nodeId
- `figma.com/board/:fileKey/...` → FigJam file, use `get_figjam` instead

If the design context includes **Code Connect** snippets, prefer those — they map directly to codebase components.

### Step 2 — Map to project components

Before writing any new code, check whether ui-kit or existing project components cover the need:

| Design need | Check first |
|---|---|
| Buttons, inputs, modals, icons | `@epam/ai-dial-ui-kit` |
| Generic icons | `@tabler/icons-react` |
| Layout, spacing, color | Tailwind CSS classes |
| Project-specific patterns | `libs/` and `apps/` in this monorepo |

Grep the codebase before building from scratch:
```
Grep("ComponentName", path="libs/")
```

### Step 3 — Implement

- Write TypeScript + JSX; no plain JS
- Use Tailwind for all styling — no inline styles, no CSS modules unless they already exist in the target file
- Do not copy raw hex colors from Figma; map to Tailwind tokens or CSS variables already in the project
- Match the naming conventions of surrounding files (PascalCase components, kebab-case files)
- Keep components small and focused — split at logical boundaries, not at line count

### Step 4 — Verify

After implementation:
1. Run `pnpm nx lint <project>` — fix any lint errors before reporting done
2. If the component has logic, add a unit test in the same lib
3. If the dev server is running, open the component in the browser and compare with the Figma screenshot

## Constraints

- Never use absolute positioning unless the Figma design explicitly requires it and no flex/grid alternative exists
- Do not add new dependencies without asking — check if the need is already met
- Pixel-perfect fidelity matters less than semantic correctness and accessibility
- If the design is ambiguous or missing states (hover, disabled, error), flag them explicitly rather than guessing

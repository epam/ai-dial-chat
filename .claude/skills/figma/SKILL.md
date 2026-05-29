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

**Responsive variants.** Before fetching, scan the file for sibling frames at mobile vs. desktop sizes (typically `375`/`390` and `1280`/`1440`/`1920`). When both exist, fetch both node IDs and reconcile the divergences (layout swaps, hidden sections, drawer vs. sidebar) **before** writing code. When only desktop is provided, ask the user before deriving a mobile version rather than guessing. See `.claude/skills/responsive-design/SKILL.md` for the breakpoint mapping and decision rubric.

### Step 2 — Map to project components

Before writing any new code, check whether ui-kit or existing project components cover the need:

| Design need                    | Check first                          |
| ------------------------------ | ------------------------------------ |
| Buttons, inputs, modals, icons | `@epam/ai-dial-ui-kit`               |
| Generic icons                  | `@tabler/icons-react`                |
| Layout, spacing, color         | Tailwind CSS classes                 |
| Project-specific patterns      | `libs/` and `apps/` in this monorepo |

Grep the codebase before building from scratch:

```
Grep("ComponentName", path="libs/")
```

### Step 3 — Implement

- Write TypeScript + JSX; no plain JS
- Use `async`/`await` with `try`/`catch`/`finally` for frontend async flows; avoid Promise chains with `.then()`/`.catch()`
- Use Tailwind for all styling — no inline styles, no CSS modules unless they already exist in the target file
- Do not copy raw hex colors from Figma; map to Tailwind tokens or CSS variables already in the project
- Match the naming conventions of surrounding files (PascalCase components, kebab-case files)
- Name React event callback props `onEvent` and component-local handlers `handleEvent`
- Keep components small and focused — split at logical boundaries, not at line count
- When implementing under `libs/*`, keep the component host-agnostic: no host-owned integration
  details such as `/api` URLs, generated clients, server-api imports, app contexts,
  auth/session/cookie/env access, feature flags, route/navigation knowledge, analytics/telemetry,
  SDK setup, platform bridges, app-specific URL schemes, or storage keys/schemas. Expose
  props/callbacks/resolved values for app behavior instead.

### Step 4 — Verify

After implementation:

1. Run `npm exec nx lint <project>` — fix any lint errors before reporting done
2. If the component has logic, add a unit test in the same lib
3. If the dev server is running, open the component in the browser and compare with the Figma screenshot at each breakpoint the design covers (360 / 768 / 1024 / 1280 / 2560 as applicable)

## Constraints

- Never use absolute positioning unless the Figma design explicitly requires it and no flex/grid alternative exists
- Do not add new dependencies without asking — check if the need is already met
- Pixel-perfect fidelity matters less than semantic correctness and accessibility
- If the design is ambiguous or missing states (hover, disabled, error), flag them explicitly rather than guessing

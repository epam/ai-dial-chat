## Why

`@epam/ai-dial-ui-kit` (0.16.0-dev, kit commit `0b2fbe0`, Issue #936) and `@epam/ai-dial-react-file-manager` (commit `255d169`) already build their stylesheets with Tailwind CSS v4, and `tailwind-merge` 3 (used by the chat too) targets v4 class names. The chat still compiles Tailwind 3.4 from 27 JavaScript configs, and they also scan both packages' `dist`. So the chat regenerates the kit's own utilities with v3 semantics on top of the kit's v4 stylesheet, and merges classes for a different Tailwind version than the one it builds with. Moving to the kit's dev line forces the question now: staying on v3 means two engines styling the same elements.

## What Changes

- **BREAKING (tooling)**: replace `tailwindcss@^3.4` + `autoprefixer` with `tailwindcss@^4` + `@tailwindcss/postcss` (the same major line as the kit, `^4.3.3`) and bump `eslint-plugin-tailwindcss` to the v4-capable line the kit uses (`4.4.1-beta.1`).
- Move the design tokens from the root `tailwind.config.js` into a CSS-first theme (`@theme inline reference`) in a new shared stylesheet. The token names, CSS-variable fallbacks and generated class names (`bg-layer-base`, `text-primary`, `border-*`, `shadow-*`, `rounded`, `outline`, `fill-*`, `stroke-*`) stay the same.
- Keep the `mobile` / `desktop` variants with the exact same media queries (`max-width: 1279px` / `min-width: 1280px`), declared as `@custom-variant` (v4 `--breakpoint-*` only supports min-width screens).
- Delete the root `tailwind.config.js`, the 26 per-project `tailwind.config.js` files and every `postcss.config.js` that only wires Tailwind. Content scanning becomes `@source` in each project's Tailwind entry.
- **Stop scanning `@epam/ai-dial-ui-kit` and `@epam/ai-dial-react-file-manager` `dist`**: both ship their own v4 `styles.css`, which `apps/chat/src/main.tsx` already imports.
- Port `tools/vite-lib-tailwind-utilities.mjs` (the per-lib published-utilities builder) to the v4 compiler API, keeping its contract: utilities only, no preflight, unlayered, appended to `dist/index.css`.
- Rewrite `apps/chat/src/styles.scss` and `apps/chat-overlay-sandbox/src/tailwind.css` entries (`@tailwind` / `@use 'tailwindcss/*'`) as v4 `@import` entries.
- Replace the utilities v4 renamed or redefined (`outline-none`, bare `ring`, the default `border` colour, `shadow-sm` / `rounded-sm` where they mean the v4 scale) only where the rendered result would change.
- Bump `@epam/ai-dial-ui-kit` to the 0.16.0 line (and the file manager to its v4 release) and apply the kit's migration guide `migration-guides/0.16.0/tailwind-v4-stylesheet.md` (cascade layer `ui`, preflight differences, `hover:` limited to `(hover: hover)`).
- Update `docs/architecture.md`, `docs/theme-customization.md`, the root `README.md`, `apps/chat/README.md`, `AGENTS.md`, `openspec/config.yaml`, `openspec/lib-styling-guide.md` and the Overview prose of `openspec/specs/theme-selection/spec.md` (it names `tailwind.config.js` as where the light fallbacks are compiled; no requirement changes) to describe the new token source.

## Capabilities

### New Capabilities

- `tailwind-css-first-config`: one shared CSS-first theme that every app and lib builds from. It covers the token parity contract, how projects declare scanned sources, the published-lib utility contract under v4, and keeping kit/file-manager utilities out of the chat's build.

### Modified Capabilities

- `responsive-breakpoints`: the named `mobile` / `desktop` variants move from `tailwind.config.js` screens to `@custom-variant` declarations in the shared theme stylesheet; the 1279/1280px boundary and the sync check stay.
- `attachment-input-lib`: the package-structure requirement no longer lists `postcss.config.js` / `tailwind.config.js` among the lib's files.

## Impact

- **Code**: the root `tailwind.config.js`, `postcss.config.js`; `apps/chat`, `apps/chat-overlay-sandbox` and 24 `libs/*` configs; `apps/chat/src/styles.scss`, `apps/chat-overlay-sandbox/src/tailwind.css`, `libs/celebrations/.storybook/preview.css`; `tools/vite-lib-tailwind-utilities.mjs`; `eslint.config.mjs`; `apps/chat/src/hooks/breakpoint/breakpoint-sync.spec.ts`; component class names that use v4-redefined utilities (roughly 70 candidate matches across `apps/chat/src` and `libs/*/src`, each checked one by one).
- **Dependencies**: `tailwindcss` 3 → 4, add `@tailwindcss/postcss`, drop `autoprefixer`, `eslint-plugin-tailwindcss` 3 → 4 beta, `@epam/ai-dial-ui-kit` 0.15.4 → 0.16.x, `@epam/ai-dial-react-file-manager` to its v4 release. `prettier-plugin-tailwindcss` 0.8 already supports v4 (it needs `tailwindStylesheet`).
- **Published libs**: each lib's `./styles.css` keeps the same class set. Consumers that run their own Tailwind v3 over our `dist` are unaffected because the utilities are precompiled. `npm run docs:install-matrix` changes only if lib manifests change (they do not list Tailwind).
- **Browser baseline**: Tailwind v4 output needs Safari 16.4+, Chrome 111+ and Firefox 128+, the same baseline the kit already imposes from 0.16.0.
- **No** backend, API, i18n, feature-flag or RTL behaviour changes.

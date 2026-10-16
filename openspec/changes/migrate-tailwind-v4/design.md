## Context

The chat compiles Tailwind CSS 3.4 from a root preset (`tailwind.config.js`, 206 lines: colour, border, text, fill, stroke and gradient token maps that read `var(--token, #fallback)`, plus `screens`, `boxShadow`, `borderRadius`, `outlineWidth` and one keyframe), which 26 per-project `tailwind.config.js` files extend. Each of them only adds `content` globs. There are three build paths:

1. **`apps/chat`**: Vite runs PostCSS (`apps/chat/postcss.config.js` → `tailwindcss` + `autoprefixer`) over `apps/chat/src/styles.scss`, which pulls in `tailwindcss/base|components|utilities` via `@use`. Content covers app source, workspace dependencies (`createGlobPatternsForDependencies`), **and the `dist` of `@epam/ai-dial-ui-kit` and `@epam/ai-dial-react-file-manager`**.
2. **Publishable libs**: `tools/vite-lib-tailwind-utilities.mjs` runs Tailwind v3 programmatically in `closeBundle` (root preset, `preflight: false`, the lib's own `src` without specs or stories) and appends the unlayered, minified utilities to `dist/index.css`. The file's header comment explains why the output must stay unlayered.
3. **`apps/chat-overlay-sandbox`** and the celebrations Storybook: plain `@tailwind base/components/utilities` CSS entries.

The kit (0.16.0-dev) and file manager now ship v4 stylesheets: Tailwind in `@layer ui`, tokens through `@theme inline reference` (nothing declared on `:root`), and the kit's v3 preflight extras kept. The kit's migration guide (`node_modules/@epam/ai-dial-ui-kit/dist/migration-guides/0.16.0/tailwind-v4-stylesheet.md` once bumped) lists what hosts must check.

Constraints: the chat's class names are a public contract for published libs (`npm run validate:docs` checks `dial-*` classes, not utilities, but hosts render our utilities); the breakpoint boundary is pinned by `apps/chat/src/hooks/breakpoint/breakpoint-sync.spec.ts`; and libs must not reset the host document.

## Goals / Non-Goals

**Goals:**

- One Tailwind major (v4) across chat, kit and file manager.
- One CSS-first token source that every app and lib imports. Same class names, same resolved values.
- Rendering stays identical for chat screens, apart from the behaviour changes the kit already imposes from 0.16.0.
- The published-lib stylesheet contract is unchanged: utilities only, unlayered, no preflight.

**Non-Goals:**

- Adopting v4 canonical spellings (`shrink-0`, `x!`, rem steps for `w-[420px]`) or new v4 features. The kit disables `enforces-canonical-classname` / `no-unnecessary-arbitrary-value` for the same reason.
- Redesigning tokens, renaming tokens or changing theme JSON from DIAL Core.
- Moving SCSS component overrides into Tailwind, or SCSS into plain CSS.
- Any visual change to the kit's or file manager's own components.

## Decisions

### D1. CSS-first theme over the `@config` compatibility bridge

The tokens move to `tools/tailwind/theme.css` (a workspace-level file, not a lib, so no lib owns another's styling) as `@theme inline reference { … }`, mirroring the kit's `src/styles/theme.scss`. Variants go in the same file. Every entry does `@import '<rel>/tools/tailwind/theme.css';`.

- *Alternative: v4 + `@config '../../tailwind.config.js'`.* Fewer edits, but `@config` is a legacy bridge that does not support every v3 key (`blocklist`, `corePlugins`). It also leaves two token formats in the workspace, one in the chat and one in the kit. We would keep paying the cost.
- *Why `inline reference`*: values are written into utilities, so nothing lands on `:root`. Several tokens share a v4 theme name and read a same-named host variable (`--shadow-sm: … var(--shadow-sm, …)`); declaring them on `:root` would make that self-referential. This also means a published lib's CSS cannot override a host's v4 theme. The kit made the same choice.
- Theme keys map v3 → v4 one-to-one, for example `backgroundColor.layer-base` → `--background-color-layer-base`, `textColor.primary` → `--text-color-primary`, `borderColor.*` → `--border-color-*` (also used by `divide-*` / `outline-*` / `stroke-*` through `@utility` where v4 has no namespace), `boxShadow.sm` → `--shadow-sm`, `borderRadius.DEFAULT` → `--radius` (v4: `rounded` reads `--radius`), `outlineWidth.DEFAULT` → handled by `@utility outline`.
- Replacing the colour scales (v3 `theme.backgroundColor = …`, not `extend`): `--color-*: initial` is **not** used, because v3 kept the default `colors` palette for `ring-*`, `from-*` and so on. Only the per-utility namespaces are set, and a parity check (D6) proves the class set is unchanged.

### D2. `mobile` / `desktop` as `@custom-variant`

```css
@custom-variant mobile (@media (max-width: 1279px));
@custom-variant desktop (@media (min-width: 1280px));
```

v4 `--breakpoint-*` only generates min-width variants (plus `max-*`), so `mobile: { max: '1279px' }` has no direct equivalent. Variant names and media queries stay byte-identical. `breakpoint-sync.spec.ts` reads the new file and asserts both literals. The `blocklist: ['[-:=]']` from v3 is dropped: v4 does not emit that stray candidate.

### D3. Stop compiling the kit's and file manager's classes

The `node_modules/@epam/ai-dial-ui-kit/**` and `…/ai-dial-react-file-manager/**` content globs are not carried over as `@source`. Both packages ship complete v4 stylesheets (`apps/chat/src/main.tsx` imports them first). Recompiling their classes with the chat's theme would produce a second copy of each utility. In the chat's layer order that copy would beat the kit's `@layer ui` copy and could swap kit token values for chat ones. Default v4 auto-detection already ignores `node_modules` and `.gitignore`d paths, so this needs no extra exclusion.

**Interim exception, file manager.** The latest published file manager (`0.4.0-dev.7`) still ships a Tailwind v3 stylesheet. Its v4 build exists only on the sibling repo's `feat/tailwind-v4` branch. Until a v4 release is out, the `apps/chat` entry keeps an explicit `@source '../../../node_modules/@epam/ai-dial-react-file-manager/dist'` (and `libs/chat-shared` the same), as the v3 config did. Only the kit's dist scanning goes away now.

- *Risk*: a class that a lib passes to a kit component (`className="…"`) lives in our source and is scanned there. Only classes that exist solely inside the kit's `dist` are dropped, and the kit's stylesheet covers those.

### D4. App entry and cascade layers

`apps/chat/src/styles.scss` becomes:

```scss
@layer theme, base, components, utilities;
@import 'tailwindcss/theme.css' layer(theme);
@import '../../../tools/tailwind/theme.css';
@import 'tailwindcss/preflight.css' layer(base);
@import 'tailwindcss/utilities.css' layer(utilities);
@source '.';
@source '../../../libs/*/src';
```

Sass's `@use 'tailwindcss/*'` does not work with v4 (it would inline v3-style CSS). The file stays `.scss` only if it still needs Sass features; otherwise it is renamed to `styles.css`. Vite then switches to `@tailwindcss/vite` (D5), so Sass never processes Tailwind directives. The existing `@layer base { html, body, #root { @apply … } }` block moves into `@layer base` after the preflight import.

Layer interaction: the kit puts its utilities in `@layer ui`, and the chat's go in `utilities`. Layer order is fixed where a layer first appears, and `main.tsx` imports the kit's sheet first, so the final order is `ui.*` → `theme, base, components, utilities` and unlayered SCSS modules beat both. That is the same relative order as today (v3 chat utilities were unlayered and came after the kit's sheet). One difference: the chat's own variant utilities (`hover:`, `mobile:`) are now layered, so an **unlayered** chat SCSS rule on the same property now beats them. Task 5.3 audits that case. It is the host-side half of the kit guide's step 1.

### D5. `@tailwindcss/vite` for apps, `@tailwindcss/postcss` nowhere else

`apps/chat` and `apps/chat-overlay-sandbox` add `tailwindcss()` from `@tailwindcss/vite` to their Vite plugins and delete `postcss.config.js` (autoprefixer is built into v4 through Lightning CSS). Libs never ran Tailwind through PostCSS during their Vite build (only `closeBundle` did), so their `postcss.config.js` and `tailwind.config.js` files are deleted. The celebrations Storybook adds the same Vite plugin.

- *Alternative: keep PostCSS with `@tailwindcss/postcss`.* It works, but the Vite plugin is the recommended v4 path, is faster, and needs no per-project config file.

### D6. Port `vite-lib-tailwind-utilities.mjs` to `@tailwindcss/node`

The v4 programmatic path is `compile(css, { base, onDependency })` + `Scanner` from `@tailwindcss/oxide`, then `.build(candidates)`, then Lightning CSS minify. The input CSS is:

```css
@import 'tailwindcss/theme.css' theme(reference);
@import '<root>/tools/tailwind/theme.css';
@import 'tailwindcss/utilities.css' source(none);
@source '<lib>/src';
@source not '<lib>/src/**/*.{spec,test}.{ts,tsx}';
@source not '<lib>/src/**/tests/**';
@source not '<lib>/src/**/*.stories.{ts,tsx}';
@source not '<lib>/src/stories/**';
```

The utilities import is **not** given a `layer()`, so the output stays unlayered, as the tool's header comment requires. There is no preflight import, so libs still never reset the host document. v4 output also carries `@property --tw-*` registrations and a `@layer properties` fallback block. These are identical to what a v4 host and the kit already emit, so they are harmless duplicates. The rationale goes into the header comment.

Parity gate: before deleting the v3 path, a one-off script (scratch, not committed) builds every lib's `dist/index.css` with both engines. It diffs the **selector sets**, and diffs the declarations for token classes. Any selector missing under v4 is a blocker. Declaration diffs are acceptable only for the documented v4 defaults (D7).

### D7. v4 default changes: fix where the render changes, not by rename sweep

| Utility (as written in source)     | v3 result                     | v4 result                     | Action                                                                                                           |
| ---------------------------------- | ----------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `border` with no colour class      | `border-color: #e5e7eb` (v3 preflight) | `currentColor`                | Add the base rule `*, ::before, ::after { border-color: var(--border-primary, …) }` matching the old effective default, as the v4 upgrade guide suggests, instead of touching every element |
| `ring` (bare)                      | 3px                           | 1px                           | Replace with `ring-3` at each of the ~13 call sites                                                              |
| `outline-none`                     | `outline: 2px solid transparent` | `outline-style: none`       | Replace with `outline-hidden` (same v3 behaviour), 5 sites                                                       |
| `shadow-*`, `rounded` (token keys) | project tokens                | project tokens                | None: the theme redefines `--shadow-xs/sm/md/lg` and `--radius`, so v4's renamed default scale never applies    |
| `rounded-sm`, `drop-shadow-sm`     | v3 default scale              | v4 default scale (one step smaller) | Check the 2 sites; switch to the v3-equivalent step if the value changed                                  |
| `hover:`                           | every device                  | `(hover: hover)` only         | Keep (matches the kit). Where a tap state matters, add `active:`, found during the 5.3 audit                     |
| `space-x/y-*`, `divide-*`          | `> * + *`                     | `> :not(:last-child)`         | Visual result is the same for flow layouts; spot-check RTL screens                                               |

The official `@tailwindcss/upgrade` codemod is **not** run across the tree. It rewrites class spellings wholesale, which the kit deliberately avoided (Non-Goals). It may be run in dry-run mode to list candidates.

### D8. Linting and formatting

`eslint-plugin-tailwindcss@4.4.1-beta.1` with `settings.tailwindcss.cssConfigPath` set to an absolute `tools/tailwind/theme.css` entry (an `index.css` there that imports Tailwind + theme, because the plugin needs a full entry). Same rule overrides as the kit: `no-unnecessary-arbitrary-value`, `enforces-canonical-classname` and `important-modifier-suffix` off. `prettier-plugin-tailwindcss` gets `tailwindStylesheet` pointing at the same entry.

## Risks / Trade-offs

- [The kit 0.16 bump and the Tailwind v4 bump land together, so a visual regression could come from either] → Slice 1 bumps the kit and file manager alone (still on chat v3, with dist scanning removed per D3) and is verified on its own. Tailwind moves only in later slices.
- [Layered chat variants lose to unlayered SCSS rules (D4)] → grep audit of `apps/chat/src/**/*.scss` and `libs/*/src/**/*.scss` for properties also set by a `hover:`/`focus-visible:`/`mobile:` utility on the same element. Fix by moving the SCSS rule into `@layer components`.
- [Published lib CSS gains `@property` / `@layer properties`] → identical to what the kit emits; documented in the tool header and the lib-styling guide.
- [Browser baseline rises to Safari 16.4 / Chrome 111 / Firefox 128] → already imposed by kit 0.16.0; noted in `docs/architecture.md`.
- [`eslint-plugin-tailwindcss` v4 is a beta] → pinned exact (`4.4.1-beta.1`), same as the kit; rules that misfire are switched off with a comment, never left warning.
- [Storybook / Vitest pick up CSS differently] → Vitest does not process CSS (`css: false` is default for jsdom); Storybook gets the Vite plugin in the same slice as its lib.

## Migration Plan

Risk-first slicing, each slice merged green on its own:

1. Bump the kit and file manager, drop dist scanning (chat still on v3). Verify.
2. Add `tools/tailwind/theme.css` and the parity script; prove v3 vs v4 class parity on the root preset.
3. Switch `apps/chat` (Vite plugin, entry, D7 fixes, breakpoint spec).
4. Switch `tools/vite-lib-tailwind-utilities.mjs`, run per-lib parity, delete lib configs.
5. Switch the sandbox, Storybook, lint and prettier; delete the root config; update docs.

Rollback: each slice is one revertable commit. Slices 3–5 depend on 2 only, and slice 1 is independent.

## Open Questions

- ~~Does the file manager have a published v4 release?~~ Resolved during slice 1: no. The chat moved to `0.4.0-dev.7` (required by kit 0.16's peer range) and keeps scanning its dist (D3 interim exception).
- Kit 0.16 exists only as `0.16.0-dev.11`. `@epam/ai-dial-react-pdf-highlighter`'s `>=0.14.2` peer rejects that prerelease, so the root `package.json` carries an `overrides` entry until kit 0.16.0 is released.
- Should `apps/chat/src/styles.scss` become `styles.css`? That depends on whether `@use './styles/mcp-app-ui-vars'` still needs Sass. Decided in task 3.2.

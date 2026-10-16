Slicing strategy: **risk-first**. The kit bump (slice 1) and token parity (slice 2) are proven before any project switches engine. After that, each consumer path (app → libs → tooling) is its own slice. Every slice is one commit that leaves `development` green. Slices 3–5 depend on 2. Slice 1 is independent.

Architecture guard (applies to every task touching `libs/*`): the move changes only build config. No lib gains imports from `apps/*`, `server-api`, the generated client, app contexts, env, routing or storage keys. The shared theme lives in `tools/tailwind/`, not in a lib, so no lib depends on another's styling.

## 1. Kit and file-manager bump on Tailwind v3 (independent)

- [x] 1.1 Bump `@epam/ai-dial-ui-kit` to the latest `0.16.0-dev.*` (dist-tag `development`) in the root `package.json`, and `@epam/ai-dial-react-file-manager` to its first release built with Tailwind v4 (resolve the design's Open Question; if none is published, bump the kit alone and keep 1.2's file-manager line for a follow-up). Read `node_modules/@epam/ai-dial-ui-kit/dist/CHANGELOG.md` `### Breaking Changes` for 0.16.0 and every guide under `dist/migration-guides/0.16.0/`; fix any compile errors per those guides.
  - Outcome: kit `0.16.0-dev.11` and file manager `0.4.0-dev.7` (the latest dev; it is still built with Tailwind v3, and its v4 build exists only on the sibling repo's `feat/tailwind-v4` branch) in the root and every `libs/*` manifest and README version citation, with `docs/host-install-matrix.md` regenerated. `@epam/ai-dial-react-pdf-highlighter` (0.2.0 and 0.3.0-dev.1) peers the kit at `>=0.14.2`, which a `0.16.0-dev.*` prerelease does not satisfy, so the root `package.json` `overrides` maps that peer to the root kit spec (`$@epam/ai-dial-ui-kit`). This is a workspace-only fix: a host installing `@epam/ai-dial-attachment-canvas` against a kit prerelease hits the same ERESOLVE until kit 0.16.0 is released. Remove the override then (follow-up 7.3). No source used the removed `DialFileManager` exports.
- [x] 1.2 Remove the `node_modules/@epam/ai-dial-ui-kit/**` globs (the file-manager globs stay until it ships a v4 stylesheet, see 7.4) from the root `tailwind.config.js`, `apps/chat/tailwind.config.js`, `libs/chat-shared/tailwind.config.js`, `libs/share/tailwind.config.js` and every other lib config that lists them (design D3).
- [x] 1.3 Apply the kit guide's host steps: grep `apps/chat/src` and `libs/*/src` for unlayered `.dial-` / `.ag-` overrides that set colour/background/border/outline, and move each into `@layer app` (declare `@layer app, ui;` once in `apps/chat/src/styles.scss` before the kit import takes effect). Restore form-control or `td` defaults only where a chat-owned element relied on them.
  - Outcome: no change needed. All 25 matches across 10 SCSS modules target the kit's own `dial-*` classes or AG Grid's `ag-*` classes, which are unlayered under both v3 and v4, so their cascade does not move. Raw `input`/`textarea` elements are all `sr-only` or carry explicit `bg-transparent border-0`, and no raw `select` exists.
- [x] 1.4 Verification: `npm run test:file -- apps/chat/src/hooks/breakpoint/breakpoint-sync.spec.ts`, then `npm run verify:changed` and `npm run build:quiet`.
  - Outcome: every target passed (typecheck 34 projects, lint 37, test 35, build 36). Each Nx run then exits 1 with `os error 32` while writing its own workspace data, a Windows file lock unrelated to the change. `apps/chat` was also rebuilt with `--skip-nx-cache` to rule out a cached result.

## 2. Shared v4 theme and parity proof

- [ ] 2.1 Add `tailwindcss@^4.3.3`, `@tailwindcss/vite`, `@tailwindcss/node` and `@tailwindcss/oxide` (same major/minor line as the kit) to root `devDependencies`, keeping v3 temporarily aliased as `tailwindcss-v3` (`npm:tailwindcss@3.4.19`) so slices 2–4 can compare the two. Update `tools/vite-lib-tailwind-utilities.mjs` and every `postcss.config.js` to require `tailwindcss-v3` in the same commit, so nothing changes engine yet.
- [ ] 2.2 Create `tools/tailwind/theme.css`: one `@theme inline reference` block that carries every token map from the root `tailwind.config.js` (`backgroundsColors`, `controlsBgColors`, `visualBgColors`, `borderColors`, `textColors`, `controlsTextColors`, `visualTextColors`, `placeholderColor`, `shadowColors`-based `boxShadow`, `borderRadius.DEFAULT`, `fadeIn` keyframe/animation) under the v4 namespaces in design D1, and keep each original `// grey-150` comment as a `/* */` comment. Add `@custom-variant mobile` / `desktop` (D2) and `@utility` declarations for scales v4 has no namespace for (`outline` default width 1px, `outline-*` / `divide-*` / `stroke-*` / `placeholder-*` colours, `fill-*`).
- [ ] 2.3 Create `tools/tailwind/index.css` (`@import 'tailwindcss';` + `@import './theme.css';`) as the single entry that lint, Prettier and the parity script read.
- [ ] 2.4 Write a scratch parity script (scratchpad, not committed) that compiles the class candidates found in `apps/chat/src` + `libs/*/src` with both `tailwindcss-v3` (root preset) and v4 (`tools/tailwind/index.css`, utilities only). It diffs selector sets and, for token classes, declarations. Iterate on 2.2 until the only differences are the D7 defaults; paste the summary into the slice's PR description.
- [ ] 2.5 Update `apps/chat/src/hooks/breakpoint/breakpoint-sync.spec.ts` to read `tools/tailwind/theme.css` and assert `@custom-variant mobile (@media (max-width: ${MOBILE_MAX_WIDTH_PX}px));` and the `desktop` counterpart. Keep the old `tailwind.config.js` assertion until slice 5 deletes the file.
- [ ] 2.6 Verification: `npm run test:file -- apps/chat/src/hooks/breakpoint/breakpoint-sync.spec.ts`, then `npm run verify:changed`.

## 3. Switch `apps/chat` to v4

- [ ] 3.1 Add `tailwindcss()` from `@tailwindcss/vite` to `apps/chat/vite.config.mts` plugins; delete `apps/chat/postcss.config.js` and `apps/chat/tailwind.config.js`; remove `postcssConfig` from `apps/chat/project.json` if set.
- [ ] 3.2 Rewrite `apps/chat/src/styles.scss` per design D4: the layer order, `tailwindcss/theme.css`, `tools/tailwind/theme.css`, preflight, utilities, `@source '.'` and `@source '../../../libs/*/src'`, and the `html, body, #root` base block. Decide `.scss` vs `.css` by whether `apps/chat/src/styles/mcp-app-ui-vars.scss` still needs Sass, and update the import in `apps/chat/src/main.tsx` if renamed. Add the v3-equivalent default `border-color` base rule (D7).
- [ ] 3.3 Fix the v4-redefined utilities in `apps/chat/src`: bare `ring` → `ring-3`, `outline-none` → `outline-hidden`, and check each `rounded-sm` / `drop-shadow-sm` site against the parity output. Touch no other class.
- [ ] 3.4 Audit `apps/chat/src/**/*.scss` for unlayered rules that set a property also set by a `hover:` / `focus-visible:` / `mobile:` / `desktop:` utility on the same element (D4). Wrap each in `@layer components`.
- [ ] 3.5 Update the `mcp-app-ui-vars.scss` comment that cites `tailwind.config.js`'s `outlineWidth.DEFAULT` so it names `tools/tailwind/theme.css`.
- [ ] 3.6 Verification: `npm run test:file -- apps/chat/src/hooks/breakpoint/breakpoint-sync.spec.ts`, `npm exec nx run chat:typecheck`, then `npm run verify:changed` and `npm run build:quiet`. Diff the built `apps/chat/dist/assets/*.css` selector set against the slice-2 parity output.

## 4. Switch published libs to v4

- [ ] 4.1 Port `tools/vite-lib-tailwind-utilities.mjs` to `@tailwindcss/node` `compile` + `@tailwindcss/oxide` `Scanner` + Lightning CSS minify, using the input CSS in design D6 (shared theme, utilities with `source(none)`, the lib's `src` with the same spec/test/stories exclusions, no `layer()`, no preflight). Keep `createLibTailwindUtilities`'s signature (`{ root, cssFileName }`) and plugin name. Extend the header comment with the `@property` / `@layer properties` note. Drop `autoprefixer`, `cssnano` and `postcss` imports if nothing else in the file needs them.
- [ ] 4.2 Add a co-located unit test `tools/vite-lib-tailwind-utilities.spec.mjs`. It covers: utilities for a fixture `src` are emitted; spec/stories classes are excluded; output has no rule outside `@layer properties` wrapped in `@layer`; output has no preflight selector; `mobile:` emits `@media (max-width: 1279px)`.
- [ ] 4.3 Run the parity script against every lib's `dist/index.css` (v3 build from slice 2 vs v4 build). Every missing selector is a blocker.
- [ ] 4.4 Fix v4-redefined utilities in `libs/*/src` exactly as 3.3 does, and run the 3.4 SCSS audit over `libs/*/src/**/*.scss`.
- [ ] 4.5 Delete `tailwind.config.js` and `postcss.config.js` from all 24 libs (`attachment-input`, `builder-form`, `catalog`, `celebrations`, `chat-shared`, `conversation-input`, `conversation-messages`, `conversation-panel`, `conversation-stages`, `navigation-panel`, `prompt-editor`, `prompts`, `publish-panel`, `quotations`, `scheduled-tasks`, `settings-panel`, `share`, `sidebar`, `skill-editor`, `skills`, `source-panel`, `starter-buttons`, `toolset-editor`, `usage-dashboard`). Remove any `postcssConfig` option from their `project.json`.
- [ ] 4.6 Verification: `npm run test:file -- tools/vite-lib-tailwind-utilities.spec.mjs`, `npm run test:file -- libs/attachment-canvas/tests/package-boundary/pdf-vendor-style-containment.spec.ts`, then `npm run verify:changed`, `npm run build:quiet` and `npm run validate:docs` (the `./styles.css` export check reads the rebuilt `dist`).

## 5. Sandbox, Storybook, tooling and removal of v3

- [ ] 5.1 `apps/chat-overlay-sandbox`: add `@tailwindcss/vite`, rewrite `apps/chat-overlay-sandbox/src/tailwind.css` as `@import 'tailwindcss';` + `@import '../../../tools/tailwind/theme.css';` + `@source` for its `src`, and delete its `tailwind.config.js` and `postcss.config.js`.
- [ ] 5.2 `libs/celebrations/.storybook`: add the Vite plugin to its Storybook config and rewrite `libs/celebrations/.storybook/preview.css` the same way.
- [ ] 5.3 `eslint.config.mjs`: bump `eslint-plugin-tailwindcss` to `4.4.1-beta.1` (exact), set `settings.tailwindcss.cssConfigPath` to the absolute path of `tools/tailwind/index.css`, and switch off `no-unnecessary-arbitrary-value`, `enforces-canonical-classname` and `important-modifier-suffix` with a `//` reason each (design D8). Set Prettier's `tailwindStylesheet` to the same file.
- [ ] 5.4 Delete the root `tailwind.config.js` and `postcss.config.js`. Remove `tailwindcss-v3` and `autoprefixer` (and `cssnano` if unused) from root `package.json`. Drop the old assertion from `breakpoint-sync.spec.ts`. Confirm the "No legacy config remains" scenario with a repo grep.
- [ ] 5.5 Verification: `npm run test:file -- apps/chat/src/hooks/breakpoint/breakpoint-sync.spec.ts`, `npm run lint:check`, then `npm run verify:changed` and `npm run build:quiet`.

## 6. Docs and specs

- [ ] 6.1 `docs/architecture.md`: Monorepo & Tooling table (Tailwind 3 → 4, browser baseline), the styling-tiers and theming-token-flow sections (token source is now `tools/tailwind/theme.css`; kit/file-manager utilities are no longer recompiled; cascade-layer order from design D4).
- [ ] 6.2 `docs/theme-customization.md`: replace every `tailwind.config.js` reference with `tools/tailwind/theme.css` and the v4 namespace names.
- [ ] 6.3 Root `README.md` tech-stack list, `apps/chat/README.md`, `AGENTS.md` (the "named Tailwind breakpoints live in `tailwind.config.js`" line), `openspec/config.yaml` (`Styling: Tailwind CSS 3`), `openspec/lib-styling-guide.md`, and the Overview prose of `openspec/specs/theme-selection/spec.md`.
- [ ] 6.4 Verification: `npm run validate:docs`, `npm run validate:specs`, `npm run spec:impact`.

## 7. Close

- [ ] 7.1 Run `npm run verify:full` once.
- [ ] 7.3 Follow-up (record as an issue only): once `@epam/ai-dial-ui-kit` 0.16.0 is released, move every manifest to it and drop the root `overrides` entry for `@epam/ai-dial-react-pdf-highlighter`.
- [ ] 7.4 Follow-up (record as an issue only): once `@epam/ai-dial-react-file-manager` publishes its Tailwind v4 build, bump it and drop the file-manager `@source` from the `apps/chat` entry and `libs/chat-shared`.
- [ ] 7.2 Follow-up (out of scope, record as an issue only): adopt v4 canonical class spellings and re-enable `enforces-canonical-classname`.

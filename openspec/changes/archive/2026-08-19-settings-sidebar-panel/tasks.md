## 1. Scaffold the lib

- [x] 1.1 Invoke the `nx-generate` skill to scaffold a new publishable React lib
      `libs/settings-panel` (npm name `@epam/ai-dial-settings-panel`) — do not hand-write Nx
      project config from scratch.
      → `nx-generate` isn't registered as a Claude Code skill in this repo (only under
      `.cursor/skills`, `.agents/skills`, `.github/skills`); followed its `SKILL.md` instructions
      manually: `nx g @nx/react:library libs/settings-panel --bundler=vite --linter=eslint
      --unitTestRunner=vitest --style=scss --component=false --importPath=@epam/ai-dial-settings-panel
      --tags=type:ui --useProjectJson=false`, dry-run first, then adjusted output to match
      `libs/share`'s conventions (removed generated `.babelrc`, added `postcss.config.js`/
      `tailwind.config.js`, `declaration`/`sourceMap`/`lib: ["dom"]` in tsconfig).
- [x] 1.2 Set `package.json`: `"tags": ["type:ui"]`, `license: "Apache-2.0"`, a plain-English
      `description`, `peerDependencies` limited to `react`, `@epam/ai-dial-chat-shared`,
      `@epam/ai-dial-ui-kit`, `@tabler/icons-react` (no other lib dependency).
- [x] 1.3 Add the `@epam/ai-dial-settings-panel/*` → `./libs/settings-panel/*` path alias to
      `tsconfig.base.json`, alongside the existing `libs/*` entries.
- [x] 1.4 Write `README.md` per `.claude/rules/libs.md`: H1 package name, overview, installation
      snippet, peer-dependency list, and a compiling usage example for the component added below.

## 2. Build the panel component

- [x] 2.1 Define `SettingsPanelItem` (`id`, `label`, `icon?`, `disabled?`) and `SettingsPanelProps`
      (`items`, `activeId`, `onSelect`, `sectionLabel?`, `styles?`, `className?`) in a `models/`
      file, exported from `index.ts` per the public-API-surface rule. Added `SettingsPanelStyles`/
      `SettingsPanelColors`/`SettingsPanelTypography` (not in the original task wording) after
      finding `libs/conversation-panel/src/components/PillTabs/PillTabs.tsx` as the closest
      precedent — hardcoded active/hover color utility classes would have violated
      `.claude/rules/libs.md`'s "no hardcoded color utility classes" rule.
- [x] 2.2 Implement `SettingsPanel` (`components/SettingsPanel/SettingsPanel.tsx`): renders
      `sectionLabel` (default class `dial-tiny-lead-semi-text`, sentence-case input — the class
      handles uppercasing) above the item list, one row per item with `icon` + `label`, active-row
      highlight (via `buildCssVars` + `SettingsPanel.module.scss`, `PillTabs` pattern), and
      disabled-row dimmed/unclickable styling. JSDoc on the component and every exported prop.
- [x] 2.3 Implement the vertical ARIA tablist behavior: `role="tablist" aria-orientation="vertical"`
      on the container, `role="tab" aria-selected` per row, roving `tabIndex` (0 on active, -1
      elsewhere), `ArrowUp`/`ArrowDown` move focus+selection between enabled rows only (wrap at
      ends), `Home`/`End` jump to first/last enabled row, disabled rows are `aria-disabled` and
      excluded from arrow navigation.
- [x] 2.4 Use only CSS logical properties in the component's `.module.scss` / Tailwind classes (no
      `left-*`/`right-*`/`ml-*`/`mr-*` for directional layout). Verified: `text-start`, `gap-*`,
      `px-2`/`py-1.5` used throughout, no physical-direction utilities.
- [x] 2.5 Add `components/SettingsPanel/tests/SettingsPanel.spec.tsx` covering: renders all items,
      highlights the active row, `onSelect` fires for enabled rows and not for disabled rows, arrow
      key navigation skips disabled rows (both directions, with wraparound), Home/End jump
      correctly, roving `tabIndex` is correct. 12/12 tests pass; lint, typecheck, and build clean.

## 3. Wire the lib into SettingsPage

- [x] 3.1 Add `General` and `Preferences` to `apps/chat/src/types/settings-tabs.ts`'s `SettingsTabs`
      enum.
- [x] 3.2 Extend `apps/chat/src/hooks/useSettingsTabConfig.ts` to emit `SettingsPanelItem[]`
      instead of `TabItem[]`: resolve `label` via `useTranslation`, `icon` via
      `IconLayoutGrid`/`IconUser`/`IconAdjustmentsHorizontal` (Usage/General/Preferences —
      re-verify against the live Figma file when access is available), and mark `General`/
      `Preferences` `disabled: true` with no `Component` entry. File renamed `.ts` → `.tsx` since
      it now returns JSX (icon elements).
- [x] 3.3 Replace the `Tabs` (2.0) usage in `apps/chat/src/pages/SettingsPage/SettingsPage.tsx`
      with `SettingsPanel` from `@epam/ai-dial-settings-panel`, passing
      `sectionLabel={t(BasicI18nKeys.Settings)}`. Kept an `sr-only` `<h1>` for the page title per
      the a11y heading-structure rule, since the visible panel header is a small caption, not a
      true page heading.
- [x] 3.4 Update `apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx` for the new panel
      (three rows rendered, General/Preferences disabled, Usage active by default, disabled-row
      click is a no-op).

## 4. i18n

- [x] 4.1 Added `General`/`Preferences` to `BasicI18nKeys` (`basic.general`/`basic.preferences`)
      rather than a feature-scoped key — matches the existing generic short-label pattern already
      used for `Settings`/`Usage`/`Organization` in the same enum. Found `editor.stepGeneral`
      already existed with the same English text but rejected reusing it — different domain
      (AppsEditor wizard step vs. a Settings nav row), not a true shared generic concept.

## 5. Verification

- [x] 5.1 `npm exec nx lint @epam/ai-dial-settings-panel` and `npm exec nx lint @epam/chat` — clean
      (one pre-existing, unrelated error in `AppsEditor/tests/GeneralForm.spec.tsx`, untouched by
      this change).
- [x] 5.2 `npm exec nx test @epam/ai-dial-settings-panel` (12/12) and `npm exec nx test @epam/chat`
      (209 files / 2960 tests, 2 pre-existing skips) — all pass.
- [x] 5.3 `npm exec nx build @epam/ai-dial-settings-panel` and `npm exec nx build @epam/chat` —
      both succeed.
- [ ] 5.4 Manual check via `npm start`: `/settings` shows the vertical panel with General/
      Preferences disabled and Usage active/selectable; compare visually against the Figma file
      once access is available. **Not run in this session** — no browser available; needs a
      manual pass.
- [ ] 5.5 Manual RTL check: Arabic locale mirrors the panel correctly (icons/labels flip to the
      logical start/end edge, no broken layout). **Not run in this session** — needs a manual
      pass.

## 6. Post-implementation revisions (from user feedback on screenshots)

- [x] 6.1 Removed `General` and `Preferences` entirely (enum members, config entries, icon
      imports, i18n keys) per explicit user request — only `Usage` ships. `SettingsPanel` itself
      still supports `disabled` items as a general capability (tested), just unused today.
- [x] 6.2 Fixed the active-row background token: `--bg-accent-primary-alpha` (used initially) is
      listed in `tailwind.config.js`'s `bgColorsToRemove` and deprecated. Replaced with
      `--bg-control-accent-alpha`, matching `PillTabs`'s active-tab default. Also fixed a CSS
      specificity bug where `:hover` (class+2 pseudo-classes) beat `.rowActive` (2 classes),
      causing the active highlight to disappear on hover; added `:not(.rowActive)` plus a
      dedicated `activeRowBackgroundHover` token.
- [x] 6.3 Fixed a root cause for "unstyled/black button": `apps/chat/vite.config.mts` resolves
      every internal `@epam/ai-dial-*` lib via a `resolve.alias` straight to `libs/*/src/index.ts`
      (not the built `dist`), which is how Vite picks up each lib's `.module.scss` without a
      separate CSS import. `@epam/ai-dial-settings-panel` was missing from that alias map, so it
      resolved through `node_modules` → `dist/index.js`, which never imports `dist/index.css` —
      meaning **zero** CSS (SCSS module rules and the lib's own Tailwind-compiled utilities) ever
      reached the page. Added the missing alias entry.

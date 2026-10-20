## ADDED Requirements

### Requirement: One CSS-first theme is the only Tailwind token source

The workspace SHALL declare its Tailwind design tokens and custom variants in exactly one stylesheet, `tools/tailwind/theme.css`, as a Tailwind v4 `@theme inline reference` block plus `@custom-variant` / `@utility` declarations. No `tailwind.config.js` and no `@config` directive SHALL remain in any app or lib. Every Tailwind entry in the workspace (`apps/chat/src/styles.scss` or its CSS successor, `apps/chat-overlay-sandbox/src/tailwind.css`, the Storybook preview entries, and the published-lib builder `tools/vite-lib-tailwind-utilities.mjs`) SHALL import that file. Each token SHALL keep its v3 class name and its `var(--token, #light-fallback)` value byte-for-byte, so a host theme applied by `ThemeProvider` keeps overriding the same CSS custom properties.

**State ownership**: none. This is build-time styling. `ThemeContext` keeps owning the runtime theme.
**RTL impact**: none. No class changes direction, and logical-property utilities (`ms-*`, `ps-*`, `start-*`) keep their v3 output.
**Feature gating, i18n, a11y, telemetry, caching, endpoints**: none.

#### Scenario: A token class renders the same value as under v3

- **WHEN** `apps/chat` is built and a component uses `bg-layer-base`, `text-primary`, `border-primary`, `shadow-sm` or `rounded`
- **THEN** the emitted declaration is the same as the Tailwind v3 build (`background-color: var(--bg-layer-base, #F5F7FA)` and so on), with the hex fallback case-insensitively equal

#### Scenario: Theme tokens are not declared on :root

- **WHEN** the built `apps/chat` CSS or any lib `dist/index.css` is inspected
- **THEN** none of the chat's theme keys (`--background-color-*`, `--text-color-*`, `--border-color-*`, `--shadow-*`, `--radius`) is declared as a custom property on `:root`; their values are written into the utilities

#### Scenario: No legacy config remains

- **WHEN** the repository is searched for `tailwind.config.js`, `@config`, `@tailwind ` directives, or `require('tailwindcss')`
- **THEN** there are no matches outside `node_modules`, `dist` and `openspec/changes/**`

### Requirement: The chat does not recompile the kit's or file manager's utilities

`apps/chat` SHALL NOT scan `node_modules/@epam/ai-dial-ui-kit` as a Tailwind source. The kit's styling SHALL come only from its own `styles.css`, imported by `apps/chat/src/main.tsx` before the app's stylesheet. `node_modules/@epam/ai-dial-react-file-manager/dist` SHALL stay an explicit `@source` only while the installed file manager ships a Tailwind v3 stylesheet. Once it ships a v4 one, the same rule as for the kit applies.

#### Scenario: A class used only inside the kit is not duplicated

- **WHEN** a utility appears only in the kit's `dist` (not in any `apps/*/src` or `libs/*/src` file)
- **THEN** the chat's built CSS does not contain that utility, and the kit component still renders it from the kit's own stylesheet

#### Scenario: A class the chat passes to a kit component is generated

- **WHEN** a file under `libs/*/src` passes `className="mobile:hidden"` to a kit component
- **THEN** the chat's built CSS contains the `mobile:hidden` rule

### Requirement: Published lib stylesheets keep the utilities-only contract under v4

`tools/vite-lib-tailwind-utilities.mjs` SHALL build each publishable lib's utilities with the Tailwind v4 compiler. The input is the shared theme plus the lib's own `src`, excluding `*.spec.*`, `*.test.*`, `tests/`, `*.stories.*` and `stories/`. It SHALL append the minified result to `dist/index.css` **unlayered** and **without preflight**. The set of utility selectors in each lib's `dist/index.css` SHALL equal the set the v3 build produced, apart from selectors that exist only because of v4 internals (`@property --tw-*`, `@layer properties`).

#### Scenario: Lib utilities stay unlayered

- **WHEN** `npm exec nx build share` completes
- **THEN** the Tailwind rules appended to `libs/share/dist/index.css` are not inside any `@layer` block except Tailwind's own `@layer properties` fallback

#### Scenario: Lib stylesheet never resets the host document

- **WHEN** any lib's `dist/index.css` is inspected
- **THEN** it contains no element-level preflight rule (no `*, ::before, ::after` box-sizing/margin reset, no `html`/`body`/`button` reset)

#### Scenario: Selector parity with the v3 build

- **WHEN** the parity check compares every lib's v3 and v4 `dist/index.css`
- **THEN** no utility selector present under v3 is missing under v4

### Requirement: v4 default changes do not alter rendered chat UI

Where Tailwind v4 changed a utility's default (the bare `ring` width, `outline-none`, the default `border` colour, the `rounded-sm` / `drop-shadow-sm` scale steps), source SHALL be adjusted so the rendered value equals the v3 value. A class SHALL NOT be renamed when its rendered value is unchanged. The one accepted behaviour change is `hover:` applying only under `(hover: hover)`, which matches `@epam/ai-dial-ui-kit` 0.16.0.

#### Scenario: A bordered element keeps its border colour

- **WHEN** an element has `border` and no `border-*` colour class
- **THEN** its computed `border-color` equals the v3 build's (not `currentColor`)

#### Scenario: A bare ring keeps its width

- **WHEN** a component previously used bare `ring`
- **THEN** its computed ring width is 3px

### Requirement: Tailwind linting and class ordering run against the v4 theme

`eslint.config.mjs` SHALL configure `eslint-plugin-tailwindcss` (v4 line) with an absolute `cssConfigPath` to the workspace Tailwind entry, and `prettier-plugin-tailwindcss` SHALL use `tailwindStylesheet` pointing at the same entry. `tailwindcss/no-contradicting-classname` SHALL stay an error. No other plugin rule is enabled, so `no-unnecessary-arbitrary-value` (which rewrites pixel values to rem steps) and `enforces-canonical-classname` SHALL stay off.

#### Scenario: A contradicting class pair is still reported

- **WHEN** a file contains `className="mobile:block mobile:hidden"`
- **THEN** `npm exec nx lint <project>` reports `tailwindcss/no-contradicting-classname`

#### Scenario: Pixel arbitrary values are not rewritten

- **WHEN** a file contains `w-[420px]`
- **THEN** lint reports nothing and Prettier leaves the class unchanged

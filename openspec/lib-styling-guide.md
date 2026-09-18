# Lib Styling Guide

Reference implementation: `libs/conversation-input`

## Core principle

Libs must work in any project — with or without this app's theme. The styling split is:

| What                           | Where                                           |
| ------------------------------ | ----------------------------------------------- |
| Layout, spacing, border-radius | Tailwind classes in JSX                         |
| Colors, typography (themed)    | CSS custom properties in `.module.scss`         |
| User overrides                 | `colors` / `typography` props → inline CSS vars |
| Dynamic computed values        | Inline `style` prop (only when no Tailwind class exists for the value) |

---

## CSS Variables pattern

### Three-tier fallback

Every themeable value uses a three-tier fallback chain defined **once** in the SCSS module:

```scss
// 1. User override via prop  → --ci-bg (set inline by component)
// 2. App theme variable      → --bg-layer-sunken
// 3. Hard fallback hex       → #EEF1F7
background: var(--ci-bg, var(--bg-layer-sunken, #EEF1F7));
```

Hex fallbacks live **only** in `.module.scss`. Never duplicate them in TypeScript.

### Variable naming convention

Prefix all lib-scoped CSS variables with `--<lib-prefix>-`:

```
conversation-input → --ci-*
conversation-messages → --cm-*
```

---

## SCSS module rules

`.module.scss` contains **only** CSS custom property references — no layout, no spacing, no border-radius.

Allowed in SCSS:

- Color and typography via `var()`
- Pseudo-elements: `::placeholder`, `::selection`
- State selectors that change colors: `&:focus-within`, `&:disabled`

Not allowed in SCSS (use Tailwind instead):

- `display`, `flex`, `gap`, `padding`, `margin`
- `border-radius`, `width`, `height`
- `cursor`, `opacity`, `resize`, `outline`

### Example

```scss
// ✅ correct — only CSS vars
.wrapper {
  background: var(--ci-bg, var(--bg-layer-sunken, #EEF1F7));
  border-color: var(--ci-border, var(--stroke-primary, #57647A));

  &:focus-within {
    border-color: var(--ci-border-focus, var(--stroke-focus-black, #161B2D));
  }
}

.textarea {
  color: var(--ci-text, var(--text-primary, #161B2D));

  &::placeholder {
    color: var(--ci-placeholder, var(--text-secondary, #57647A));
  }
}

// ❌ wrong — layout in SCSS
.wrapper {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
}
```

---

## Props API

Every lib component exposes a single optional `styles` prop that groups colors and typography:

```ts
export interface <Name>Colors {
  background?: string;
  text?: string;
  border?: string;
  // ... only what the component actually uses
}

export interface <Name>Typography {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  lineHeight?: string | number;
  letterSpacing?: string;
  // pass a single CSS utility class instead of explicit fields
  fontClassName?: string;
}

export interface <Name>Styles {
  colors?: <Name>Colors;
  typography?: <Name>Typography;
  /**
   * Extra class name(s) merged onto a named inner element (e.g. the scrollable
   * body `<div>`). Add one `<element>ClassName` field per inner element that
   * consumers may need to style independently.
   */
  bodyClassName?: string;
  /**
   * Arbitrary CSS custom properties applied inline to the component's root
   * element. Use as a last-resort escape hatch when the typed `colors` /
   * `typography` fields do not expose a needed variable. Values are merged
   * after the `buildCssVars` output, so they can override typed fields.
   */
  cssVars?: CSSProperties;
}
```

### Interfaces live in `src/models/`

```
src/
  models/
    Input.ts              ← InputProps, InputColors, InputTypography, InputStyles
    ConversationInput.ts  ← ConversationInputProps, ...Colors, ...Typography, ...Styles
  components/
    Input/
      Input.tsx
      Input.module.scss
```

### Component applies props as inline CSS vars

In the component, use `buildCssVars` from `@epam/ai-dial-chat-shared` to convert the props to a `CSSProperties` object. It omits entries whose value is `undefined` or `''`, so pass `undefined` explicitly when a var should be skipped. No hex values in TypeScript:

```tsx
import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';

const noCustomClass = !typography?.fontClassName;
const cssVars = buildCssVars({
  '--ci-bg': colors?.background,
  '--ci-text': colors?.text,
});

return <div style={cssVars} className={mergeClasses(styles.wrapper, 'flex w-full ...', className)}>
```

### When `fontClassName` is provided

Apply it alongside the SCSS class. The SCSS class handles color; the font class handles typography:

```tsx
<h1 className={mergeClasses(styles.welcome, 'text-center', typography?.fontClassName)}>
```

### SCSS wiring for typography CSS vars

Wire the typography vars in `.module.scss` on the element(s) where font styles apply. Omit fallbacks — an unset var on an inherited property resolves to `inherit`, so the font class on the parent still applies:

```scss
// ✅ correct — no fallback needed; unset var inherits from parent
.content {
  color: var(--ci-text, var(--text-primary, #161B2D));
  font-size: var(--ci-font-size);
  font-weight: var(--ci-font-weight);
  line-height: var(--ci-line-height);
  letter-spacing: var(--ci-letter-spacing);
  font-family: var(--ci-font-family);
}
```

Typography var naming follows the same `--<lib-prefix>-` convention as color vars:

```
conversation-input   → --ci-font-size, --ci-font-weight, …
conversation-stages  → --cs-font-size, --cs-font-weight, …
```

---

## Dead-style checks

Every one of these fails silently — the build passes, types pass, lint passes, and the styling simply does nothing. Check all four whenever you add or edit a `.module.scss` or a `buildCssVars` call.

### 1. Each var must be wired at both ends

A `buildCssVars` entry needs a stylesheet that reads it, and every `var(--<prefix>-*)` in the SCSS needs an entry. Grep the var name across the lib before you finish: two hits (one TS, one SCSS) is correct, one hit means the prop does nothing.

```tsx
// Wrong — nothing reads --ci-fill-bg, so `colors.fillBackground` is inert
const cssVars = buildCssVars({ '--ci-fill-bg': colors?.fillBackground });
```

When the var is missing because the *style* was never written (a documented `borderHover` with no `:hover` rule), prefer adding the rule with a fallback to the base value — the prop starts working and nothing changes visually by default:

```scss
// Correct — resolves to the base border until a host overrides it
&:hover {
  border-color: var(--ci-border-hover, var(--ci-border, var(--stroke-secondary, #D1DBEA)));
}
```

### 2. Each class must be applied

A class declared in a `.module.scss` that no TSX references via `styles.<name>` is dead. Deleting it is correct only when the element it targeted is gone; if the element exists and simply lost its class, apply the class instead — that is the case whenever the class is the sole consumer of a themeable var.

Exception: `:global(...)` selectors targeting third-party class names (e.g. `.pdf-container` from the PDF viewer) are referenced by the vendor's markup, not by `styles.*`.

### 3. Never apply a module class as a raw string

CSS-module class names are hashed at build time, so a string literal can never match. This is the worst of the four failure modes: it looks correct in review and in the DOM the class is simply absent from the stylesheet.

```tsx
// Wrong — `.hovered` in the module is hashed; the literal never matches it
className={mergeClasses(styles.tile, isPasted && 'hovered')}

// Correct
className={mergeClasses(styles.tile, isPasted && styles.hovered)}
```

Raw strings are only for Tailwind utilities and app-global classes that no `.module.scss` in the lib declares.

### 4. One prop, one var

Do not bind two var names to the same prop, and do not set a var both directly and through a nested component's `styles` prop — the duplicate is dead weight that reads as intentional.

```tsx
// Wrong — one prop, two vars
buildCssVars({
  '--sb-resize-handler': colors?.resizeHandler,
  '--sb-bg-resize-handler': colors?.resizeHandler,
});

// Wrong — `--sb-border` is already forwarded via <SidebarPanel styles={{ colors }} />
buildCssVars({ '--sb-border': colors?.border });
```

### Typography fields are subject to all four

The six-field `*Typography` shape above is a template, not a licence to declare fields the component ignores. A declared `fontFamily` / `fontSize` / `fontWeight` / `lineHeight` / `letterSpacing` must be wired as a CSS var on the element where font styles apply (see *SCSS wiring for typography CSS vars*). If the component only ever applies `fontClassName`, declare only `fontClassName`.

---

## Class merging

Use `mergeClasses` from `@epam/ai-dial-chat-shared` (wraps `classnames`):

```tsx
import { mergeClasses } from '@epam/ai-dial-chat-shared';

className={mergeClasses(styles.wrapper, 'flex w-full gap-2', className)}
```

---

## Public class names

CSS-module locals are hashed at build time, Tailwind utilities change whenever the
layout changes, and DOM order is not a contract. A host embedding these libs therefore
has nothing stable to target — so selected elements additionally carry a **public class
name** that exists purely as a styling hook.

### Grammar

```
dial-<lib-prefix>-<element>[-<state>]
```

- `<lib-prefix>` is the lib's **directory name** under `libs/`, except for the five
  libs listed as legacy below. Directory names are unique by construction, so a prefix
  can never be claimed twice and a new lib needs no decision — and a host reading
  `.dial-scheduled-tasks-row` in its own stylesheet can tell which package to install.

  The first version of this section derived the prefix from the lib's CSS-custom-property
  prefix, so that the class contract and the theming contract would read the same. That
  does not generalise past the five libs it was written for, for two measured reasons:

  - **Five var prefixes are claimed by two libs each** — `--ai-` (`attachment-input`,
    `catalog`), `--cm-` (`conversation-messages`, `chat-shared`), `--cc-`
    (`quotations`, `attachment-canvas`), `--pp-` (`prompts`, `publish-panel`) and
    `--sp-` (`settings-panel`, `source-panel`). Two of those collide with a contract
    that is already written down: `attachment-input` ships `dial-ai-*`, and the
    `dial-cm-code-block` that issue #8707 asks for belongs to `MarkdownCodeBlock`,
    which lives in `chat-shared` rather than in `conversation-messages`.
  - **Eleven of the twenty-two libs with stylesheets use more than one own prefix** —
    `publish-panel` alone uses seven (`--pare-`, `--par-`, `--pft-`, `--phl-`, `--pf-`,
    `--pp-`, `--spp-`). Their prefixes are per component, not per lib, so "the lib's var
    prefix" names nothing.

  The five short prefixes stay as they are: issue #8707 proposed them by name, and they
  are documented in five lib READMEs. They are a **closed list** — nothing new joins it.

  | Lib                     | Class prefix                | Source         |
  | ----------------------- | --------------------------- | -------------- |
  | `sidebar`               | `dial-sb-`                  | legacy (#8707) |
  | `conversation-panel`    | `dial-cp-`                  | legacy (#8707) |
  | `conversation-messages` | `dial-cm-`                  | legacy (#8707) |
  | `conversation-input`    | `dial-ci-`                  | legacy (#8707) |
  | `attachment-input`      | `dial-ai-`                  | legacy (#8707) |
  | `attachment-canvas`     | `dial-attachment-canvas-`   | directory name |
  | `builder-form`          | `dial-builder-form-`        | directory name |
  | `catalog`               | `dial-catalog-`             | directory name |
  | `chat-shared`           | `dial-chat-shared-`         | directory name |
  | `conversation-stages`   | `dial-conversation-stages-` | directory name |
  | `mcp-apps`              | `dial-mcp-apps-`            | directory name |
  | `navigation-panel`      | `dial-navigation-panel-`    | directory name |
  | `prompt-editor`         | `dial-prompt-editor-`       | directory name |
  | `prompts`               | `dial-prompts-`             | directory name |
  | `publish-panel`         | `dial-publish-panel-`       | directory name |
  | `quotations`            | `dial-quotations-`          | directory name |
  | `scheduled-tasks`       | `dial-scheduled-tasks-`     | directory name |
  | `settings-panel`        | `dial-settings-panel-`      | directory name |
  | `share`                 | `dial-share-`               | directory name |
  | `skill-editor`          | `dial-skill-editor-`        | directory name |
  | `skills`                | `dial-skills-`              | directory name |
  | `source-panel`          | `dial-source-panel-`        | directory name |
  | `starter-buttons`       | `dial-starter-buttons-`     | directory name |
  | `toolset-editor`        | `dial-toolset-editor-`      | directory name |
  | `usage-dashboard`       | `dial-usage-dashboard-`     | directory name |

  Libs with no UI of their own — `chat-hooks`, `ai-dial-chat-hooks`, `chat-api-client`,
  `chat-overlay`, `ai-dial-kit` — have no entry and need none: they render no element.

- `<element>` and `<state>` are lower-case kebab-case. **No BEM** — no `__`, no `--`.
- A state is an **additive** class applied alongside the base class, never a replacement:

  ```
  dial-ai-attachment-tile                    ← always
  dial-ai-attachment-tile dial-ai-attachment-tile-selected   ← when selected
  ```

Flat kebab-case matches `@epam/ai-dial-ui-kit`, whose public classes already spell state
as a suffix (`dial-kit-input`, `dial-kit-input-error`, `dial-kit-input-small`,
`dial-kit-grid-selection-visible`). A `--` segment also reads as a CSS custom property
at a glance, and these libs are dense with real ones.

### The names live in one constants file per lib

```ts
// libs/attachment-input/src/constants/public-class-names.ts
/*
 * Public, host-addressable class names — part of this package's public API.
 * Read the Public class names section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element.
 */
export const ATTACHMENT_INPUT_CLASS = {
  tray: 'dial-ai-attachment-tray',
  tile: 'dial-ai-attachment-tile',
  tileSelected: 'dial-ai-attachment-tile-selected',
} as const;
```

Re-export the record from the lib's `src/index.ts` so a host can import the names
instead of hardcoding them.

Use `as const`, not an enum. `AGENTS.md` asks for string enums for finite sets of
statuses, modes, variants, or lifecycle states — this is none of those. It is a keyed
lookup table that is never compared, never switched on, and never held in a variable,
and a host needs the literal type to interpolate into a selector.

Every component reads the name from the record. A public class name **must not** appear
as a string literal in a component file — that is the same silent failure as
[§3 Never apply a module class as a raw string](#3-never-apply-a-module-class-as-a-raw-string),
where a typo looks correct in review and in the DOM.

### Rules

1. **Emitted unconditionally.** No prop, flag, context value, or host configuration
   enables a public class. Append it inside the element's existing `mergeClasses` call,
   after the CSS-module class and Tailwind utilities, before any caller `className`:

   ```tsx
   className={mergeClasses(
     styles.tile,
     ATTACHMENT_TILE_BASE_CLASS,
     ATTACHMENT_INPUT_CLASS.tile,
     isSelected && ATTACHMENT_INPUT_CLASS.tileSelected,
     className,
   )}
   ```

2. **No declarations, ever.** Never write a rule for a `dial-<prefix>-*` class in a
   `.module.scss`. The published `styles.css` must contain no `.dial-*` selector — the
   class changes nothing by itself, which is what makes adding it safe. Specificity and
   `!important` are the host's problem, exactly as they already are for `dial-kit-*`.

3. **ARIA attributes are not styling hooks.** Never ask a host to select by `role` or
   `aria-label`, and never freeze label text so a host's selector keeps working. Labels
   are localisable — `AttachmentTray`'s `aria-label` defaults to `'Attached files'` but
   is overridable through `labels.ariaLabel`, so a host that selects by it breaks its
   own styling the moment the app translates. Where a host previously had only an ARIA
   selector, put a public class on that same element.

4. **Direction-agnostic.** No class name encodes a physical direction — no `-left`, no
   `-right` — and the emitted set is identical under `dir="ltr"` and `dir="rtl"`. The
   host is responsible for using CSS logical properties in its own overrides.

### Stability promise

Once published, a `dial-*` class is public API of its package:

- Renaming it, removing it, or **moving it to a different element** is a breaking
  change — a host's selector targets the element, not just the name.
- Announce any such change through the package's release notes and record it in the
  lib's `README.md` with its replacement, in the same change.
- Adding a class is non-breaking.

The element itself stays free: its Tailwind utilities, its CSS-module class, and its
position in the DOM can all change. That is the entire point.

Note on enforcement: every `libs/*/package.json` is pinned at `0.0.1` with
`private: true`, and the published version is stamped by the `epam/ai-dial-ci` release
pipeline, so no in-repo version bump can carry this promise. It rests on the guard tests
and the README instead.

### Guard tests are mandatory

A lost public class fails exactly like the four failure modes in
[Dead-style checks](#dead-style-checks): the build passes, types pass, lint passes, and
a host's stylesheet silently stops applying. So every public class needs at least one
co-located test in the lib's `tests/` folder.

Two rules for those tests:

- **Locate by role, label, or text — then assert the class.** Querying *by* the public
  class would pass even if the class landed on the wrong element.
- **Resolve the expected value from the exported record**, never from a duplicated
  literal, so the test cannot drift from the component.

```tsx
// ✅ correct — find the element by what it is, then assert the hook
expect(screen.getByRole('list', { name: 'Attached files' })).toHaveClass(
  ATTACHMENT_INPUT_CLASS.tray,
);

// ❌ wrong — passes even if the class is on the wrong node
expect(document.querySelector('.dial-ai-attachment-tray')).toBeInTheDocument();
```

Cover the non-happy states too, which is where a naive implementation breaks: error and
loading tiles, an empty list that renders nothing at all, and skeleton or
empty/error menu rows.

---

## Consuming in another project

### With this app's theme (CSS vars already defined)

```tsx
import { ConversationInput } from '@epam/ai-dial-conversation-input';
import '@epam/ai-dial-conversation-input/styles.css';

// Theme CSS vars resolve automatically — no extra config needed
<ConversationInput onSend={handleSend} />;
```

### Without this app's theme (external project)

```tsx
// Hex fallbacks in styles.css kick in automatically
// Optionally override via props:
<ConversationInput
  styles={{
    colors: { background: '#fff', text: '#000', border: '#ccc' },
    typography: { fontSize: '16px', fontFamily: 'Inter' },
  }}
  onSend={handleSend}
/>
```

---

## Component type convention

All lib components use `FC<Props>` syntax:

```tsx
export const MyComponent: FC<MyComponentProps> = ({ ... }) => { ... };
```

Props interfaces are named `<ComponentName>Props` and live in `src/models/`.

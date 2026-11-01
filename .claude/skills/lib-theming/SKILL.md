---
name: lib-theming
description: Audit and fix colors and typography in libs/* so the host controls both through props. Colors come from a `*Colors` prop as `var(--<prefix>-x, fallback)` in the component's .module.scss, set with `buildCssVars`; typography comes from a `*ClassName` prop (or `*Typography` field) whose default is a kit `dial-*-text` class. Finds Tailwind color utilities in lib JSX, literal colors in lib stylesheets, vars no prop sets, `dial-*-text` classes hardcoded in JSX or constants, raw Tailwind font utilities, and font CSS. Use to check all libs, one lib, or the current branch, or when converting a lib color or type style to a prop.
---

# Lib theming

Everything a lib paints — color and type — is the host's call. The lib ships a
sensible default and a prop that replaces it; it never decides in code.

## Colors

Every color comes from `styles.colors`. The one accepted shape is the one in
`libs/conversation-stages/src/components/StagesPanel/StagesPanel.module.scss`:

```scss
.collapseButton {
  background: var(--cs-button-bg, transparent);
}

.stageName {
  color: var(--cs-stage-text, var(--text-secondary, #57647a));
}
```

The outer var is the lib's own prop channel (`--<lib-prefix>-<role>`), set from
a `*Colors` field with `buildCssVars`. Its fallback is either a neutral value
(`transparent`, `inherit`, `currentColor`) or the app theme token with a hex
fallback. A `*ClassName` prop default carries typography only, never a color.

## Typography

Every text element takes its type step from a prop. The accepted shape is a
`*ClassName` prop (or a field on the component's `*Typography` interface)
whose default is a kit scale class, applied with `mergeClasses`:

```tsx
export const Card: FC<CardProps> = ({
  titleClassName = 'dial-small-semi-text',
}) => <h3 className={mergeClasses(styles.title, titleClassName)}>…</h3>;
```

- The default is a real `dial-*-text` class — confirm the name with the
  `@epam/ai-dial-ui-kit` MCP `getEntityDetails("typography")`, never from
  memory.
- No `dial-*-text` written straight into JSX, a module constant, or a
  `*ClassName` value passed to a child component: each needs its own prop.
- No raw Tailwind size/weight/leading/tracking utility (`text-sm`,
  `font-semibold`, `leading-5`), and no `font-size`/`font-weight`/
  `line-height`/`letter-spacing`/`font-family` in lib CSS — except the two
  narrow cases `libs.md` allows: `em`-relative pseudo-element glyphs with a
  comment, and a caller-driven var channel with no fallback (or `inherit`).
- Markdown/element maps (`MarkdownRendererClassNames` and similar) are one
  prop: the host passes the whole map or a partial override merged over the
  lib default.

Rules behind both: `.claude/rules/libs.md` ("CSS custom property theming with
`buildCssVars`", "Typography and color utility classes as props") and
`openspec/lib-styling-guide.md`.

## Inputs

| Mode        | Command                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- |
| All libs    | `node .claude/skills/lib-theming/scan.mjs` — the default                                    |
| Some libs   | `node .claude/skills/lib-theming/scan.mjs skill-editor catalog`                             |
| This branch | `node .claude/skills/lib-theming/scan.mjs --base origin/development` (branch + uncommitted) |
| Machine     | add `--json`                                                                                |

Lib names are the folder names under `libs/`. The scanner skips tests,
stories, `chat-api-client` and `celebrations`.

**Exception — `libs/celebrations`.** Its scenes are decorative artwork: the
hex fills, gradients and `--hw-*`/scene vars are part of the drawing, not
themable UI, so the rule does not apply there and the scanner skips the lib.
Passing its name explicitly does not scan it either.

## Signals

| Signal                   | Means                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tailwind-color-class`   | a line in a lib `.tsx` holds a color utility the kit CSS or the workspace Tailwind theme (`tools/tailwind/theme.css`) defines (`text-secondary`, `bg-layer-raised`, `focus-visible:outline-focus`), a Tailwind palette color, or an arbitrary color value           |
| `literal-color`          | a color property in a lib stylesheet uses a hex/`rgb()`/named color with no `var()` around it                                                                                                                                                                       |
| `var-not-set-from-props` | the outermost `var()` of a color declaration is never set by any `buildCssVars`/style object in that lib — either a bare theme token (`var(--text-primary, …)`) or a dead lib var                                                                                   |
| `hardcoded-typography`   | a `dial-*-text` class on a line that is not a `*ClassName` prop default (`titleClassName = '…'`), a `*ClassName:` styles key, or a `??`/`\|\|` fallback — so JSX `className="dial-…"`, a SCREAMING_CASE constant, or a hardcoded `*ClassName="…"` passed to a child |
| `raw-font-utility`       | `text-xs`…`text-9xl`, `text-[13px]`, `font-medium`/`semibold`/`bold`…, `leading-*`, `tracking-*` in a lib `.tsx`                                                                                                                                                    |
| `font-css`               | `font`, `font-size`, `font-weight`, `font-family`, `line-height` or `letter-spacing` in lib CSS, other than `var(--x)`, `var(--x, inherit)`, `inherit` or an `em` value                                                                                             |

`transparent`, `inherit`, `current` and `none` color utilities are never
reported.

## Workflow

1. **Scan.** Run the scanner in the requested mode. With no scope given, scan
   all libs and report the per-lib totals first.

2. **Verify each hit in context.** A hit is a candidate, not a finding. Drop it
   when:
   - a typography class sits in a `*ClassName` prop default the line-based
     check missed (a default split over several lines).
   - the string is not a class name (a label, a key, test text).
   - a `var-not-set-from-props` var is set by a parent component in another
     file through a computed key or a spread the regex missed. Search the lib
     for the var name before reporting it.
   - an `em` `font-size` is a pseudo-element glyph with its comment.
   - the color is part of a decorative illustration (SVG artwork) with no
     themable meaning in another lib. Report it as a group instead of line by
     line, and ask before converting it.

3. **Report.** Group by lib, then file. For each: `path:line`, the class or
   declaration, and the fix (which `*Colors` / `*ClassName` / `*Typography`
   field it becomes). Say which hits you dropped and why in one line.

4. **Fix (only when asked).**

   Per color:
   1. Pick the component's `*Colors` interface (or the wrapper's forwarded
      `panel`/inner colors field) and add a field with an inline JSDoc that
      names the default token: `/** Color of the upload icon. Defaults to \`--text-accent-primary\`. */`.
   2. Map it in the nearest `buildCssVars` call on an ancestor that actually
      wraps the element: `'--<prefix>-<role>': colors?.<field>`. Reuse an
      existing field and var when it already means the same thing, rather
      than adding a near-duplicate. A portalled element (Popup, Menu,
      Tooltip) needs the var set inside the portal — `overlayStyle` or the
      element's own `style`.
   3. Add a class to the component's `.module.scss` (create one if it has
      none) with `<property>: var(--<prefix>-<role>, var(--<theme-token>, #hex))`.
      Take the token and hex from the kit CSS so the default rendering does
      not change: `node_modules/@epam/ai-dial-ui-kit/dist/index.css`
      (`.text-secondary{color:var(--text-secondary,#57647a)}`). States go in
      the class (`&:hover`, `&:focus-visible`), and focus-visible matches
      hover (`.claude/rules/a11y.md`).
   4. Replace the Tailwind class with `styles.<class>` via `mergeClasses`.
   5. For `var-not-set-from-props` on a bare theme token, wrap it:
      `var(--text-primary, #161b2d)` → `var(--<prefix>-<role>, var(--text-primary, #161b2d))`
      and do steps 1–2. For a dead lib var, add the prop or delete the var.

   Per typography class:
   1. Add a `<element>ClassName` prop (or a field on the existing
      `*Typography` interface when the component groups them) with a JSDoc
      that quotes the default verbatim: `/** Typography class of the card title. Defaults to \`'dial-small-semi-text'\`. */`.
   2. Default it to the class that was hardcoded, so rendering does not
      change, and apply it with `mergeClasses` next to the layout classes.
   3. A hardcoded `*ClassName="dial-…"` passed to a child becomes a prop on
      the parent forwarded to the child. A constant map becomes a prop whose
      default is that map, merged with a partial host override.
   4. Thread the prop through every intermediate layer to where the host
      renders the lib (see `libs.md` "Every declared prop must be read").
   5. Replace a raw Tailwind font utility or font CSS with the nearest scale
      class — look it up with `getEntityDetails("typography")`.

   For both:
   - Export any new type reachable from a public prop from `src/index.ts`.
   - A lib that gets its first stylesheet needs the `./styles.css` export and
     README import line (`.claude/rules/libs.md`).
   - Update the lib README where it lists the `*Colors` fields or `*ClassName`
     defaults.

5. **Verify.** Rerun the scanner on the touched libs (expect the fixed hits
   gone), then `npm exec nx run-many -- -t typecheck lint test -p <@epam/pkg ...>`
   and `npm run validate:docs`. Nx project names are the package names
   (`@epam/ai-dial-skill-editor`), not the folder names.

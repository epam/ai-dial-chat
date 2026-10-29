---
name: lib-colors
description: Audit and fix colors in libs/* so every one comes from a `*Colors` prop through a CSS custom property — `var(--<prefix>-x, fallback)` in the component's .module.scss, set with `buildCssVars`. Finds Tailwind color utilities in lib JSX (text-secondary, bg-layer-*, border-tertiary, hover:bg-*, arbitrary [#hex]/[var(--x)]), literal colors in lib stylesheets, and vars the stylesheet reads that no prop ever sets. Use to check all libs, one lib, or the current branch for hardcoded colors, or when converting a lib color to a prop.
---

# Lib colors

Every color a lib paints must be overridable by the host through
`styles.colors`. The one accepted shape is the one in
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
fallback. Rules behind this: `.claude/rules/libs.md` "CSS custom property
theming with `buildCssVars`" and `openspec/lib-styling-guide.md`.

## Inputs

| Mode        | Command                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| All libs    | `node .claude/skills/lib-colors/scan-colors.mjs` — the default                                         |
| Some libs   | `node .claude/skills/lib-colors/scan-colors.mjs skill-editor catalog`                                  |
| This branch | `node .claude/skills/lib-colors/scan-colors.mjs --base origin/development` (branch diff + uncommitted) |
| Machine     | add `--json`                                                                                           |

Lib names are the folder names under `libs/`. The scanner skips tests,
stories and `chat-api-client`.

## Signals

| Signal                   | Means                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tailwind-color-class`   | a string literal in a lib `.tsx` holds a color utility the kit CSS or the workspace Tailwind theme (`tools/tailwind/theme.css`) defines (`text-secondary`, `bg-layer-raised`, `focus-visible:outline-focus`), a Tailwind palette color, or an arbitrary color value |
| `literal-color`          | a color property in a lib stylesheet uses a hex/`rgb()`/named color with no `var()` around it                                                                                                                                                                       |
| `var-not-set-from-props` | the outermost `var()` of a color declaration is never set by any `buildCssVars`/style object in that lib — either a bare theme token (`var(--text-primary, …)`) or a dead lib var                                                                                   |

`transparent`, `inherit`, `current` and `none` utilities are never reported.

## Workflow

1. **Scan.** Run the scanner in the requested mode. With no scope given, scan
   all libs and report the per-lib totals first.

2. **Verify each hit in context.** A hit is a candidate, not a finding. Drop it
   when:
   - the string is a **`*ClassName` prop default** that the host can replace
     (`menuIconClassName = 'text-secondary'`), which `libs.md` allows. Still
     mention it if the same element has no color prop at all.
   - the string is not a class name (a label, a key, test text).
   - a `var-not-set-from-props` var is set by a parent component in another
     file through a computed key or a spread the regex missed. Search the lib
     for the var name before reporting it.
   - the color is part of a decorative illustration (`libs/celebrations`
     scenes, SVG artwork) with no themable meaning. Report the lib as a group
     instead of line by line, and ask before converting it.

3. **Report.** Group by lib, then file. For each: `path:line`, the class or
   declaration, and the fix (which `*Colors` field and var it becomes). Say
   which hits you dropped and why in one line.

4. **Fix (only when asked).** Per color:
   1. Pick the component's `*Colors` interface (or the wrapper's forwarded
      `panel`/inner colors field) and add a field with an inline JSDoc that
      names the default token: `/** Color of the upload icon. Defaults to \`--text-accent-primary\`. */`.
   2. Map it in the nearest `buildCssVars` call on an ancestor that actually
      wraps the element: `'--<prefix>-<role>': colors?.<field>`. Reuse an
      existing field and var when it already means the same thing, rather
      than adding a near-duplicate.
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
   6. A lib that gets its first stylesheet needs the `./styles.css` export and
      README import line (`.claude/rules/libs.md`).
   7. Update the lib README where it lists the `*Colors` fields.

5. **Verify.** Rerun the scanner on the touched libs (expect the fixed hits
   gone), then `npm exec nx run-many -- -t typecheck lint test -p <@epam/pkg ...>`
   and `npm run validate:docs`. Nx project names are the package names
   (`@epam/ai-dial-skill-editor`), not the folder names.

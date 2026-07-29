---
paths:
  - 'libs/**/*.ts'
  - 'libs/**/*.tsx'
  - 'libs/*/package.json'
  - 'libs/*/README.md'
globs: 'libs/**/*.ts,libs/**/*.tsx,libs/*/package.json,libs/*/README.md'
applyTo: 'libs/**/*.ts,libs/**/*.tsx,libs/*/package.json,libs/*/README.md'
alwaysApply: false
---

# Libs coding conventions

## package.json requirements

Every lib under `libs/` must have these three fields in its `package.json`:

- **`"license"`** — must be `"Apache-2.0"`.
- **`"description"`** — a short, plain-English sentence (no period at the end) describing what the lib does. Do not use the lib's package name as the description.
- These fields must appear directly after `"name"` and `"version"`.

```json
{
  "name": "@epam/ai-dial-example",
  "description": "Short description of what this lib provides",
  "version": "0.0.1",
  "license": "Apache-2.0"
}
```

## README.md requirements

Every lib under `libs/` must have a `README.md` at its root. The README must include:

1. **H1 heading** — the npm package name (e.g. `# @epam/ai-dial-example`).
2. **Overview** — a detailed paragraph explaining the lib's purpose, what problems it solves, and when to use it.
3. **Installation** — a `package.json` snippet showing how to add the dependency.
4. **Peer Dependencies** — a list of required peer deps.
5. **Components / Hooks / Utilities** — one subsection per major export with a minimal usage example.

Do not copy Nx scaffold content (`This library was generated with Nx`) into the README — replace it entirely.

## No i18n inside libs

**Never** use `useTranslation` or `t()` from `react-i18next` in `libs/`. Pass all user-visible strings as props with English default values instead. i18n is the responsibility of the consuming app, not the lib.

## Component syntax

Name the component props interface `{ComponentName}Props` (not bare `Props`), and use `FC<{ComponentName}Props>` syntax:

```tsx
export const MyComponent: FC<MyComponentProps> = ({ ... }) => { ... };
```

## Component folder structure

Component folders under `src/components/` must use PascalCase and match the component name (e.g., `RequireAuth/RequireAuth.tsx`). Tests go in a `tests/` subfolder inside the component folder.

## JSDoc on all exported symbols

Every exported symbol (interfaces, enums, types, functions) must have a JSDoc comment. Each interface/type property must also have an inline `/** ... */` doc. Keep comments factual — describe what the value represents, not how it is used.

This applies to exported components too: every exported component (`export const MyComponent: FC<MyComponentProps> = ...`) must have a one-line summary JSDoc directly above its declaration, even when its props interface is already fully documented — a documented `Props` interface does not substitute for a doc on the component itself.

```tsx
// Correct
/** Row of starter-prompt buttons that collapses overflowing items into a dropdown menu. */
export const StarterButtons: FC<StarterButtonsProps> = ({ ... }) => { ... };

// Wrong — no doc on the component declaration
export const StarterButtons: FC<StarterButtonsProps> = ({ ... }) => { ... };
```

When a prop has a default value (via destructuring default or `defaultProps`), its doc comment must state the default, e.g. `/** CSS class applied to the title. Defaults to \`'dial-h1-text'\`. \*/`. A doc that describes the prop's purpose but omits its default is incomplete.

### JSDoc brevity rules

**Use inline `/** ... _/`, not multi-line blocks, for simple descriptions.** A multi-line `/\*\* ... _/` block is only warranted when the text genuinely needs multiple sentences.

```ts
// Correct — inline
/** Text color of each stage name. Defaults to `--text-secondary`. */
stageTextColor?: string;

// Wrong — multi-line for a one-liner
/**
 * Text color applied to each stage name row.
 */
stageTextColor?: string;
```

**No editorial or implementation commentary.** Phrases like "the one exception that keeps a saturated color", "Receives the count so callers can handle any plural rule", or algorithm internals ("Grouping is by cleaned name, not the raw backend string, so...") belong in code comments, not JSDoc. JSDoc describes _what_ — implementation details live in inline `//` comments inside the function body.

**Function docs describe the return value or net effect, not the algorithm.** One sentence is the target.

```ts
// Correct
/** Returns the last stage with `status: null` (the currently executing stage), or `undefined` if none exists. */
export const findLiveStage = (stages: Stage[]): Stage | undefined => ...

// Wrong — describes internal mechanics
/**
 * Finds the currently-executing stage while a run is streaming: the last
 * entry with `status: null`. Returns `undefined` once every stage has
 * settled (or the list is empty), even if the caller still reports
 * `isStreaming: true` — a transitional state between the last stage settling
 * and the stream closing.
 */
export const findLiveStage = (stages: Stage[]): Stage | undefined => ...
```

**Component docs: one-line summary only.** Full behavior is inferred from the props interface.

```tsx
// Correct
/** Wraps `StagesPanel` with a collapsible summary line that tracks run state. */
export const CollapsedGroup: FC<CollapsedGroupProps> = ...

// Wrong — narrates the entire lifecycle
/**
 * Wraps `StagesPanel` with a single summary line whose text and default
 * open/closed state track the run: expanded with a live progress line while
 * streaming, then collapsed to one line — finished or failed — the moment
 * it ends. A lone stage skips the summary line entirely...
 */
export const CollapsedGroup: FC<CollapsedGroupProps> = ...
```

## CSS custom property theming with `buildCssVars`

Lib components expose color overrides as CSS custom properties set via `buildCssVars` from `@epam/ai-dial-chat-shared`. The pattern has three parts.

### Colors interface

Define a `*Colors` interface whose properties map one-to-one to the CSS vars used in the component's `.module.scss`. Every `--var-name` in the SCSS must have a corresponding entry — no orphaned vars.

```ts
export interface StagesPanelColors {
  /** Text color of each stage name. Defaults to `--text-secondary`. */
  stageTextColor?: string;
  /** Border color of table cells and blockquotes. Defaults to `--stroke-secondary`. */
  borderColor?: string;
  // … one property per --var in .module.scss
}
```

### buildCssVars mapping

In the component, map every interface property to its CSS var name. The call must stay in sync with the SCSS — add an entry whenever a new `var(--cs-*)` appears in the stylesheet.

```ts
const cssVars = buildCssVars({
  '--cs-stage-text': colors?.stageTextColor,
  '--cs-border': colors?.borderColor,
});
```

### Wrapper components forwarding inner colors

When a wrapper component renders an inner lib component, the wrapper's `*Styles` interface includes a typed field for the inner component's colors (not a flat merge). The wrapper sets its own CSS vars on its root element **and** forwards the inner colors to the inner component's `styles` prop — both are required so the single-element early-return paths (no outer wrapper) are also covered.

```ts
// model
export interface CollapsedGroupStyles {
  colors?: CollapsedGroupColors; // wrapper's own --cs-cg-* vars
  typography?: CollapsedGroupTypography;
  panel?: StagesPanelColors; // forwarded to inner <StagesPanel>
}
```

```tsx
// component
const { colors, panel: panelColors } = groupStyles ?? {};

const cssVars = buildCssVars({
  '--cs-cg-label': colors?.labelColor,   // wrapper's own vars
  '--cs-text':     panelColors?.text,    // inner panel vars (cascade via wrapper div)
  // …
});

// single-stage path — no outer wrapper div, must pass explicitly
return <StagesPanel styles={{ colors: panelColors, typography: groupStyles?.typography }} … />;

// multi-stage path — outer div carries cssVars AND StagesPanel gets colors directly
return (
  <div style={cssVars}>
    …
    <StagesPanel styles={{ colors: panelColors, typography: groupStyles?.typography }} … />
  </div>
);
```

## Typography and color utility classes as props

**Never hardcode typography or color utility classes** (e.g. `dial-body-semi-text`, `dial-small-text`, `text-sm`, `font-bold`, `text-primary`, `text-secondary`, `text-accent`) directly in lib component JSX. The consuming app decides which type scale and color tokens to use. Instead, accept an optional prop and use a sensible default:

```tsx
// Correct — configurable with a sensible default
interface MyProps {
  /** CSS class applied to the title. Defaults to `'dial-body-semi-bold-text'`. */
  titleClassName?: string;
  /** Color class applied to the placeholder icon. Defaults to `'text-secondary'`. */
  placeholderIconClassName?: string;
}
export const MyComponent: FC<MyProps> = ({
  titleClassName = 'dial-body-semi-text',
  placeholderIconClassName = 'text-secondary',
}) => (
  <>
    <span className={mergeClasses(styles.title, titleClassName)}>…</span>
    <Icon className={placeholderIconClassName} />
  </>
);

// Wrong — hardcoded in JSX
<span className={mergeClasses(styles.title, 'dial-body-semi-text')}>…</span>
<Icon className="text-secondary" />
```

Name the prop `<element>ClassName` (e.g. `titleClassName`, `labelClassName`, `placeholderIconClassName`). Layout helpers (`truncate`, `min-w-0`, `flex-1`) and structural color-independent utilities that do not vary by theme may remain hardcoded.

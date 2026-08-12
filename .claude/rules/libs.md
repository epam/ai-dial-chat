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

**Usage examples must compile against the current API.** Every component name, prop name, and type name in a README example must exist with that exact spelling and shape. When a prop is renamed, removed, or a required prop is added, update the README in the same change. A README that documents a prop the component never had is worse than no README — treat it as part of the public contract, not prose.

```tsx
// Wrong — `buttons` and `StarterButtonsAriaLabels` do not exist; the real API is
// `starters` / `onSelect` / `StarterButtonsLabels`
<StarterButtons buttons={buttons} ariaLabels={ariaLabels} />
```

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

**The doc must match what the code does.** Read the implementation before writing or editing a doc — a stated default, target element, or behaviour that the code does not implement is a defect, not a wording nit, because callers act on it. When you change behaviour, update the doc in the same edit.

```ts
// Wrong — the class is applied to the panel root, not the title, and has no default
/** CSS class applied to the title element. Defaults to `'dial-body-semi-bold-text'`. */
fontClassName?: string;

// Wrong — nothing in the lib sorts; the host sorts and passes `items` pre-ordered
/** Sort by `sortValues.nextRunAt` ascending — earliest next run first. */
FirstToRun = 'firstToRun',

// Wrong — the individual fields are ignored *always*, not only when `fontClassName` is set
/** A single class applied instead of individual typography fields. When set, those fields are ignored. */
fontClassName?: string;
```

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

## Every declared prop must be read

A prop, label, or model field that nothing reads is a silent lie in the public API: hosts populate it, translators translate it, and it changes nothing. Before adding a field — and before finishing a change that renames one — confirm something consumes it. When a parent passes labels down to a child, thread the field through every intermediate layer; a label declared on the parent's `*Labels` but never forwarded leaves the child on its hardcoded English default, defeating the no-i18n-in-libs rule.

```tsx
// Wrong — declared, hosts must populate it, nothing ever reads it
export interface ScheduledTaskItem {
  /** Values used to sort this item. */
  sortValues: ScheduledTaskSortValues; // the lib never sorts
}

// Wrong — `copiedLabel` exists on the child but the parent never forwards it,
// so the child always announces its hardcoded English default
<SourcesSection copyLabel={labels.copySourceLabel} />

// Correct — the parent's labels reach the child
<SourcesSection
  copyLabel={labels.copySourceLabel}
  copiedLabel={labels.sourceCopiedLabel}
/>
```

The same applies to a `*Colors` field whose CSS variable no stylesheet reads, and to a `*Typography` field the component never applies — see the dead-style checks in `openspec/lib-styling-guide.md`.

## Public API surface

**Every type reachable through a public prop must itself be exported from `index.ts`.** If `FooProps.labels` is typed `FooLabels`, a consumer building that object needs to name the type. Exporting the props interface but not its nested `*Labels` / `*Colors` / `*Typography` / `*Styles` types forces callers into `Parameters<>` gymnastics or untyped literals.

```ts
// Wrong — SidebarPanelProps.labels is required, but its type cannot be named
export type {
  SidebarPanelProps,
  SidebarPanelStyles,
} from './models/panel-props';

// Correct
export type {
  SidebarPanelProps,
  SidebarPanelStyles,
  SidebarPanelLabels,
} from './models/panel-props';
```

**Do not `export` a symbol used only inside its own file.** An `export` that no other module imports and `index.ts` does not re-export widens the apparent API for nothing and hides genuinely dead code from review.

```tsx
// Wrong — only used by the three call sites in this same file
export const ActionButton: FC<ActionProps> = ({ ... }) => { ... };

// Correct
const ActionButton: FC<ActionProps> = ({ ... }) => { ... };
```

## CSS custom property theming with `buildCssVars`

Lib components expose color overrides as CSS custom properties set via `buildCssVars` from `@epam/ai-dial-chat-shared`. The pattern has three parts.

### Colors interface

Define a `*Colors` interface whose properties map one-to-one to the CSS vars used in the component's `.module.scss`. The mapping must hold in **both** directions: every `--var-name` read in the SCSS needs an interface entry, and every entry passed to `buildCssVars` needs a stylesheet that reads it. A var set from TypeScript that no SCSS consumes is a prop that silently does nothing — see the dead-style checks in `openspec/lib-styling-guide.md`.

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

**Never hardcode typography or color utility classes** directly in lib component JSX. The consuming app decides which type scale step and color tokens to use. Instead, accept an optional `<element>ClassName` prop (e.g. `titleClassName`, `labelClassName`, `placeholderIconClassName`) and give it a sensible default:

```tsx
// Correct — configurable with a sensible default
interface MyProps {
  /** CSS class applied to the title. Defaults to `'dial-body-semi-text'`. */
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

Layout helpers (`truncate`, `min-w-0`, `flex-1`) and structural color-independent utilities that do not vary by theme may remain hardcoded.

### The default must be a real class from the kit's type scale

Every typography default — and every value an app passes in — is a `dial-*-text` class from `@epam/ai-dial-ui-kit`. Nothing else is a valid font size in a lib:

- **Never** a raw Tailwind size utility (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-[13px]`) or weight utility (`font-bold`, `font-semibold`) — those carry no line-height from the scale.
- **Never** a `font-size` / `line-height` / `font-weight` declaration in the lib's `.module.scss`. Only `em`-relative sizing that genuinely cannot be a static class is exempt, and it needs a comment saying why.
- **Never** a locally defined or re-declared `.dial-*-text` rule in lib CSS — that shadows the kit and drifts on the next upgrade. If a step you need does not exist in the scale, that is a gap to raise in the kit, not to patch locally.

### Verify the class name before you write it

**Look the name up with the MCP server** — `getEntityDetails("typography")` returns the full scale and is the only source of truth. Do not write a `dial-*-text` name from memory.

This is not pedantry: a misspelled or removed class **compiles to nothing at all**. `typecheck` and `test` never see Tailwind class strings, so the build stays green and the text silently falls back to whatever size it inherits. `dial-body-semi-bold-text` does not exist and never did; `dial-caption-semi-text` was removed in kit 0.13.0. Both read as plausible and both render as unstyled text.

The same applies to renames and rescales in a kit upgrade — the heading scale shifted one step in 0.13.0 with no TypeScript signal. After bumping `@epam/ai-dial-ui-kit`, sweep `libs/*` for `dial-*-text` and check the classes still mean what the component intended (see the migration-guide workflow in `AGENTS.md`).

### `*-lead-*` classes uppercase themselves

`dial-tiny-lead-text`, `dial-tiny-lead-semi-text`, and `dial-caption-lead-semi-text` apply `text-transform: uppercase` and their own `letter-spacing`. Pass them the sentence-case string and drop any `uppercase` utility, `tracking-[…]` utility, or `.toUpperCase()` call at the same spot — the CSS transform keeps the accessible name readable, while a pre-uppercased string makes screen readers spell short labels out letter by letter.

```tsx
// Correct
badgeClassName = 'dial-caption-lead-semi-text',

// Wrong — redundant tracking and a class the kit no longer ships
badgeClassName = 'dial-caption-semi-text uppercase tracking-[0.6px]',
```

### Keep the doc comment and the default in sync

The doc comment must quote the default **verbatim** (see _JSDoc on all exported symbols_ above). A comment that names a different class than the destructuring default is worse than no comment: it is the string a caller copies into their own override, which is exactly how `dial-body-semi-bold-text` spread through `libs/conversation-input`.

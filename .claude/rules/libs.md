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

## `dependencies` vs `peerDependencies`

A lib is a normal npm package: if it imports something at runtime, it declares
it and npm installs it. A peer is the narrow exception — a package the **host
also names**, where a second copy would be a bug rather than a waste.

**No third-party package is a peer.** Icons, markdown, syntax highlighting,
PDF, MCP, editors, grids — every implementation library goes in
`dependencies` of the lib that imports it. A host installs one package and
renders; it does not assemble a laundry list of transitive peers. Adding a
third-party peer needs a written reason in the change's design doc.

These are the peers:

| Peer                               | Why                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `react` / `react-dom`              | one renderer per app, always                                                                    |
| `@epam/ai-dial-chat-shared`        | the shared types/utils/context layer every host imports directly                                |
| `@epam/ai-dial-ui-kit`             | the design-system singleton                                                                     |
| `@epam/ai-dial-react-file-manager` | an AG-Grid-backed component a host renders itself; two AG Grid copies break module registration |

**Everything else goes in `dependencies`** — third-party implementation
libraries, and sibling libs under `libs/` that a host never names (`sidebar`
inside `conversation-panel`, `attachment-input` inside `conversation-input`).
A host installs one package and renders.

### A sibling lib is a dependency, and the fixture has to pack it

Publishing resolves a sibling spec to the release version, which exists on the
registry, so a published package is fine either way. The catch is local: a
tarball packed from `dist/` names a version that was never published, so
`npm install` on it alone dies with `ETARGET`. While siblings were peers this
never showed, because `--legacy-peer-deps` skips peers entirely.

`tools/attachment-canvas-consumer-fixture` therefore packs the transitive
closure of a lib's workspace `dependencies` and hands every tarball to one
`npm install`, which lets npm satisfy each spec from the local tree. If you add
a workspace dependency to a lib the fixture covers, nothing extra is needed —
the closure is computed from the manifests. If you make the fixture cover
another lib, keep that behaviour.

### Every version spec needs an upper bound

A spec that does not cap the major accepts the next breaking release, so it
constrains nothing that matters — npm stays silent and the host finds out at
runtime. Declare the range the lib is actually built against, normally a caret.

`"*"` is the obvious form, and it sat on `@epam/ai-dial-ui-kit` in 11 libs —
enough for a kit major to reach a host unannounced. `">=0.0.14"` is the same
defect written longhand, which is how `chat-hooks` accepted any
`@epam/pdf-highlighter-kit` while every lib that actually used it wanted
`^0.0.18`. `"latest"` and `"x"` are the same thing again.

The one exception is a sibling under `libs/`: `tools/publish-lib.mjs` rewrites
workspace-lib specs to the release version, so a placeholder there never
reaches npm.

A README that annotates a peer with a version must quote the manifest's range
verbatim — that is the number a host copies. `npm run validate:docs` fails on
an unbounded spec.

### One package, one role

A package must never be a `dependency` of one lib and a required peer of
another. npm is then free to install two divergent copies beside the host's own,
and the host's only escape is a `resolutions` pin. This is the exact defect that
reached the main line: `conversation-panel` was the lone lib with
`@epam/ai-dial-ui-kit` in `dependencies` while 26 peered it, so every embedding
application carried

```json
"resolutions": { "@epam/ai-dial-ui-kit": "0.14.0-dev.41" }
```

`npm run validate:docs` fails on a split role, so a PR catches it.

### Optional peers are for scoping an install, not for hedging

`peerDependenciesMeta.optional` means _this entry point does not need the
package_. It is the right tool when a lib has real entry points whose
dependency sets differ — `chat-shared` (`.` / `./markdown` / `./file-manager`,
with an entry-point-to-peer matrix in its README) and `chat-hooks` (feature
packages a conversation-only host never installs) are the two reference cases.

It is the wrong tool for a package the lib imports unconditionally: `npm
install` then succeeds and the failure surfaces later, in the consumer's
bundler. If a lib always imports it, it is a `dependency` — optional-but-always-
needed is just a required peer with the warning suppressed.

A lazily imported package is still a `dependency`. Lazy loading governs which
chunk it lands in, not who installs it — `attachment-canvas` keeps its PDF and
syntax-highlighter engines in on-demand chunks while declaring both as
dependencies, and `tools/attachment-canvas-consumer-fixture` proves the boundary
holds.

## Every `exports` target must be a file the build emits

Nothing in this workspace resolves a lib through its own `exports` map. Every
in-repo consumer — `apps/chat`, the lib's own Vitest suite, a sibling lib —
resolves the bare specifier straight to `src/index.ts` through a
`resolve.alias` or the `@epam/source` condition. npm then publishes an
`exports` map without checking that any of it resolves. So a target naming a
file that does not exist is invisible from inside the repo, green in CI, and
broken for every downstream host — which is exactly what happened: nine libs
declared `"./styles.css": "./dist/style.css"` while Vite emits `index.css`,
and every embedding application had to add a bundler alias per package
([issue #8719](https://github.com/epam/ai-dial-chat/issues/8719)).

**Vite lib builds in this workspace emit `index.*`.** `build.lib.fileName` is
`'index'` in every `vite.config.mts`, so the outputs are `dist/index.js`,
`dist/index.d.ts`, and — when the lib has any stylesheet — `dist/index.css`.
There is no `style.css`. Write the manifest against those names.

### The stylesheet export

A lib with **any** `.scss` or `.css` under `src/` ships a stylesheet and must
export it as `./styles.css`, placed directly after `./package.json`:

```json
{
  "exports": {
    "./package.json": "./package.json",
    "./styles.css": "./dist/index.css",
    ".": {
      "@epam/source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

`import '@epam/<pkg>/styles.css'` must work with no bundler alias in the host.
A lib with no stylesheets must not declare the export at all — an export
pointing at a file the build never emits is the same defect in the other
direction.

Document the import in the README, directly under the Installation snippet:

````md
Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-example/styles.css';
```
````

### When you add the first stylesheet to a lib

A lib that had no CSS starts emitting `dist/index.css` the moment its first
`.module.scss` lands. Add the `./styles.css` export and the README line in the
**same change** — nothing else will tell you, since no in-repo consumer imports
it.

### What catches a mistake, and when

`tools/publish-lib.mjs` verifies that every `exports` target and every
`main`/`module`/`types` entry exists in `dist/` before it writes the
publish-ready manifest, and aborts the publish otherwise. That is a **release**
gate, not a PR gate — it stops a broken package from reaching npm, but it will
not tell you during review. Get the manifest right when you write it.

`tools/attachment-canvas-consumer-fixture` is the one project that installs a
packed tarball and builds against the real `exports` map. Reach for that
pattern when a lib's published boundary carries load beyond entry-point
existence — lazy chunk splitting, a stylesheet that must stay free of vendor
selectors — as `libs/attachment-canvas/tests/package-boundary/` does.

## README.md requirements

Every lib under `libs/` must have a `README.md` at its root. The README must include:

1. **H1 heading** — the npm package name (e.g. `# @epam/ai-dial-example`).
2. **Overview** — a detailed paragraph explaining the lib's purpose, what problems it solves, and when to use it.
3. **Installation** — a `package.json` snippet showing how to add the dependency, followed by the stylesheet import when the lib ships one (see above).
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
- **Never** `!important` on a `line-height` (or any other typography property) in lib CSS. It silently overrides whatever scale class the app passed, leaving the typography prop half-effective.

Two narrow exceptions, both requiring a comment that states the reason:

- **Pseudo-element glyphs** (`::before` / `::after` content) take no class, so their sizing has to live in CSS. Keep it `em`-relative so it tracks the class on the host element.
- **A caller-driven CSS-var channel** — a lib may accept raw `fontFamily` / `fontSize` / `lineHeight` / `letterSpacing` values and forward them through `buildCssVars`, as `AttachmentCanvas` does, when it renders into a surface that cannot take a class (a third-party viewer's inline style API, a canvas, an iframe). Declare the vars **without fallbacks** so an unset var resolves to `inherit` and a `fontClassName` on the same element still wins, and document that precedence on the props. This is a second channel, not a replacement: the lib must still expose the `<element>ClassName` prop and default it to a scale class.

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

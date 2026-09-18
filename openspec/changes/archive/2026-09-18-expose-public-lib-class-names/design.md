## Context

`libs/*` UI packages are consumed by host applications that own their own chrome. Today
those hosts have no supported way to restyle library internals, so they select by hashed
CSS-module locals, DOM order, and default `aria-label` text — all of which we change
freely. [epam/ai-dial-chat#8707](https://github.com/epam/ai-dial-chat/issues/8707)
inventories the selectors one host currently relies on.

The proposal sets the direction: emit `dial-<lib-prefix>-<element>` classes
unconditionally, export the names as constants, guard them with tests, ship the Tailwind
token preset, and document the host contract. This document records the technical
decisions behind that and the two places where discovery changed the plan.

### Constraints

- `AGENTS.md` §Library isolation — no library may learn host-owned integration details.
- `openspec/lib-styling-guide.md` — layout in Tailwind in JSX, `.module.scss` holds only
  CSS custom properties. Its §Dead-style checks is the direct precedent for why guard
  tests are mandatory: a class that silently does nothing passes build, types, and lint.
- `.claude/rules/docs.md` — READMEs are a public contract; a documented class that is
  not emitted is worse than no documentation.
- `@nx/enforce-module-boundaries` — `chat-shared` is `type:shared` and imports nothing.
- All `libs/*/package.json` are pinned at `0.0.1`; the published version is stamped by
  the `epam/ai-dial-ci` release pipeline, so no in-repo version bump can express the
  stability promise.

### Design system currently in effect

`@epam/ai-dial-ui-kit` already publishes public classes, and they are flat kebab-case:
`dial-kit-input`, `dial-kit-input-error`, `dial-kit-input-small`,
`dial-kit-grid-selection-visible`, `dial-kit-base-icon-button`. There is no BEM anywhere
in either repository. The typography layer is also already `dial-*`-prefixed
(`dial-h1-text`, `dial-body-paragraph-text`, `dial-caption-text`), and libraries already
default `titleClassName` to those. So the `dial-` namespace is established; this change
extends it rather than introducing it.

## Goals / Non-Goals

**Goals:**

- One documented, testable class per element in the issue's inventory.
- Zero new props and zero API surface on any component.
- No computed-style change for any existing consumer.
- A host Tailwind setup that is actually satisfiable, not merely documented.
- The contract fails loudly (a red test) rather than silently when it regresses.

**Non-Goals:**

- No `styles.classNames` prop API — rejected in the proposal's Alternatives.
- No changes in `epam/ai-dial-ui-kit`.
- No move of layout or dimensions from Tailwind into SCSS.
- No DOM restructuring of the composer, including the requested desktop `flex-nowrap`
  action row — that is a design decision, not a contract one.
- No `!important` and no specificity engineering. The classes are inert hooks; making
  host overrides win is the host's job, as it already is with `dial-kit-*`.

## Decisions

### D1 — Emit unconditionally, do not add a prop

**Chosen:** append the class inside the element's existing `mergeClasses` call.

**Why, beyond the proposal's reasoning:** three of the target elements are not reachable
by a prop without threading it through components we do not want to couple. The model
menu is portalled by Floating UI; the menu rows are built as a `DropdownItem[]` data
array inside a hook, not as JSX the caller can decorate; and the attachment tile is
rendered four levels below `ConversationInput` (`Input` → `AttachmentTray` →
`AttachmentCard` → `File`/`Image`). A prop-based contract would need a pass-through at
every level, and each new stylable element would need another one.

**Rejected:** `styles.classNames` per component. `styles` already means theming tokens
in every library (`styles.colors`, `styles.typography`); overloading the key with an
unrelated concept is the kind of thing `lib-styling-guide.md` exists to prevent.

### D2 — Flat kebab-case, state as an additive suffix class

**Chosen:** `dial-ai-attachment-tile` + `dial-ai-attachment-tile-selected`.

**Rejected:** the issue's BEM spelling, `dial-ai-attachment-tile__name` and
`dial-ai-attachment-tile--selected`. Reasons, in order of weight:

1. It would be the only BEM in either repository, against ~30 existing flat `dial-kit-*`
   classes that already express state as a suffix (`dial-kit-input-error`).
2. A `--` prefixed segment reads as a CSS custom property at a glance, and these
   libraries are dense with real ones (`--ai-tile-bg`, `--ci-border-focus`).
3. BEM's value is a generated, mechanically enforced element/modifier tree. These are
   ~20 hand-written hooks; the notation buys nothing and costs consistency.

State is **additive**, never a replacement, so a host can write one rule for all tiles
and a second for the selected case — the standard `dial-kit-input` /
`dial-kit-input-error` shape.

### D3 — A typed constants record per library, not an enum

**Chosen:** `libs/<lib>/src/constants/public-class-names.ts` exporting one `as const`
object, re-exported from `src/index.ts`:

```ts
/* Public, host-addressable class names. Part of this package's public API —
   see openspec/lib-styling-guide.md before renaming or moving one. */
export const ATTACHMENT_INPUT_CLASS = {
  tray: 'dial-ai-attachment-tray',
  trayItem: 'dial-ai-attachment-tray-item',
  tile: 'dial-ai-attachment-tile',
  tileSelected: 'dial-ai-attachment-tile-selected',
  tileName: 'dial-ai-attachment-tile-name',
  tileType: 'dial-ai-attachment-tile-type',
  tileAction: 'dial-ai-attachment-tile-action',
} as const;
```

**On the repo's string-enum preference:** `AGENTS.md` §TypeScript enums asks for string
enums for "named finite sets of statuses, modes, variants, or lifecycle states". This is
none of those — it is a keyed lookup table of unrelated names, never compared, never
switched on, never a value a variable holds. An enum would also be the wrong shape for
the consumer: a host wants the literal type `'dial-ai-attachment-tile'` to interpolate
into a selector string, which `as const` gives and an enum member does not. Recorded
here because a reviewer will reasonably ask.

**Why export it at all:** it makes the contract type-checked at the host, it gives the
guard tests a single source to assert against (so a test cannot drift from the
component), and it lets `validate:docs` check the README against real exports.

**Why a record and not a literal at the call site:** a literal in JSX is the failure mode
`lib-styling-guide.md` §3 already warns about for module classes — it looks correct in
review and in the DOM, and nothing catches a typo. The spec therefore forbids the
literal outside the constants file and tests.

### D4 — Where in `mergeClasses` the class goes

**Chosen:** immediately after the element's CSS-module class and Tailwind utilities, and
**before** any caller-supplied `className`.

Order has no effect on specificity here, because the public classes carry no
declarations at all — the spec requires the published `styles.css` to contain no
`.dial-*` rule. Keeping the caller's `className` last preserves the existing convention
in every component (`mergeClasses(styles.wrapper, '…', className)`) and keeps diffs
one-line. `prettier-plugin-tailwindcss` sorts only recognised Tailwind utilities, so it
will leave these alone.

### D5 — `ATTACHMENT_TILE_BASE_CLASS` stays pure

The tile class is stamped at both `File.tsx` and `Image.tsx` rather than folded into the
shared `ATTACHMENT_TILE_BASE_CLASS`.

Folding it in would be one line instead of two, but that constant is **already exported**
from `src/index.ts` and its JSDoc reads "Base Tailwind classes shared by every square
attachment tile (84 × 84 px)". Quietly changing what a published constant contains is a
worse trade than a second call site, and the name is still single-sourced from
`ATTACHMENT_INPUT_CLASS.tile`. The guard test covers both renderers.

### D6 — The model menu needs no ui-kit change, except the check mark

Discovery corrected the issue here, in both directions:

- **Better than the issue assumed:** `Dropdown` already exposes `listClassName` for the
  floating overlay and `DropdownItem.className` for each row, so `dial-ci-model-menu`
  and `dial-ci-model-menu-item[-selected]` need nothing from the kit. `listClassName` is
  passed at two sites in `ModelSelectorControl.tsx` (the `modelPickerOverlay` branch and
  the default desktop branch); the mobile branch uses our own `BottomSheetShell`, which
  accepts `className`, so all three menu presentations can carry the same class.
- **Worse than the issue assumed:** the issue states `useModelSelector` "already accepts
  `searchHeaderClassName` / `selectedItemClassName` / `selectedItemCheckClassName`".
  Only `searchHeaderClassName` exists. The selected row's check is drawn wholly by the
  kit from `mark: MenuItemMark.Check` plus `checked`, so **no element in this repository
  owns the check** and `dial-ci-model-menu-item-check` is dropped from scope. Hosts
  restyle the check by descending from `dial-ci-model-menu-item-selected`.

`menuItems` and `menuHeader` are both `useMemo`'d. The class names are module-level
constants, so no dependency array changes — this is asserted by a scenario rather than
left to review.

### D7 — Ship the token preset from `chat-shared`

**The finding that forced this:** library JSX uses ~130 semantic token utilities
(`text-secondary` 43×, `text-primary` 22×, `bg-layer-raised` 14×, `bg-layer-sunken` 11×,
plus `text-error`, `stroke-secondary`, `bg-control-accent-alpha`, …). Those names exist
only in the theme block of the repo-root `tailwind.config.js`, which no package exports.
A host that added the `content` glob and nothing else would scan our `dist`, find
`bg-layer-raised`, and emit nothing — a silent, confusing partial failure. Documenting
the glob alone would have described an unsatisfiable requirement.

**Chosen:** move the theme into `libs/chat-shared/tailwind-preset.js`, expose it as the
`./tailwind-preset` subpath export, and have the repo-root `tailwind.config.js`
re-export it.

- `chat-shared` is already a peer dependency of every affected UI library
  (`"@epam/ai-dial-chat-shared": "*"`), so a host that installs any of them already has
  it. A dedicated `@epam/ai-dial-tailwind-preset` package would add an install step and
  a release surface for one data file.
- The root config is self-contained — 215 lines, no `require` other than its own
  `module.exports` — so this is a move, not a rewrite.
- Re-exporting from the root keeps one source of truth. Every existing project config
  does `presets: [require('../../tailwind.config.js')]` and is untouched.
- The preset is plain data with no imports, so `chat-shared` gains no dependency and the
  `type:shared` boundary rule still holds. This is asserted by an `nx lint chat-shared`
  scenario.

**Rejected:** documenting "copy our theme into your config". It is the only option that
requires no code change, and it guarantees drift the first time a token is added.

### D8 — Guard tests locate by role, then assert the class

Tests must not find the element *by* the public class — that would pass even if the
class landed on the wrong node. So each test queries by role, label, or text (as
`AGENTS.md` and the no-`data-testid` convention require) and then asserts
`toHaveClass(RECORD.key)`, reading the expected value from the exported record.

The classes must also survive the non-happy states, which is where a naive
implementation breaks: the error tile, the loading tile (whose
`role="progressbar"` overlay covers the tile), the empty tray (which returns `null`
early and must therefore emit **nothing**), the loading model menu (skeleton rows), and
the empty/error model menu (a single disabled row). Scenarios cover these explicitly
rather than only the populated case.

## Risks / Trade-offs

| Risk                                                                                                                                       | Mitigation                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The preset move changes rendering across the whole monorepo** — it touches the config every app and lib inherits.                          | Move-and-re-export, so the root path and shape are unchanged; the preset is import-free data; sliced last so the class work lands independently; an acceptance criterion requires the emitted CSS to be unchanged. |
| **We publish a contract and then break it ourselves**, which is worse than publishing none.                                                 | Guard tests per class; the spec's stability requirement; a follow-up to make `validate:docs` cross-check README against asserted classes.                                                |
| **The inventory is incomplete** — it comes from one host's stylesheet, so a selector we never saw will still break.                         | Treat the issue's inventory as the requirement set and the spec as the extension point. Adding a class is non-breaking, so a gap is cheap to close.                                      |
| **Hosts keep their `[class*=…]` selectors** and get no benefit.                                                                             | Old selectors keep working, so nothing is forced; the README migration table gives the one-for-one replacement. Communicating this on the issue is a task.                               |
| **A class drifts to the wrong element** during a later refactor while its test still passes.                                                 | D8: tests locate by role/label/text first, never by the class.                                                                                                                          |
| **`dial-ci-model-menu` on three different presentations** (two dropdown variants and a bottom sheet) may surprise a host writing one rule.   | Documented explicitly in the README with the three presentations named, so a host can scope by an additional selector if it needs to.                                                    |
| **Scope**: five shared libraries plus the root Tailwind config in one change.                                                                | Vertical slices, one library at a time, each independently verifiable; the preset is its own final slice and separately revertable.                                                      |

### Accepted trade-offs

- **~20 hand-maintained names.** There is no generation step, so a new stylable element
  means a new constant, a README line, and a test. That is the cost of a contract that
  survives refactors, and it is bounded.
- **A slightly larger `class` attribute** on ~20 elements. No runtime cost worth
  measuring and no stylesheet growth, since the classes carry no rules.
- **Nothing stops a host styling something we never blessed.** We are not trying to
  prevent that; we are trying to make the supported path better than the alternative.

## Migration Plan

Additive throughout — no host coordination, no deprecation window, no data migration.

1. **Slices 1–5, one library at a time** (composer → attachments → model menu → panel →
   messages): constants file, stamps, guard tests, README. Each slice is independently
   verifiable and independently revertable.
2. **Slice 6 — the preset.** Move the theme to `chat-shared`, add the subpath export,
   re-export from the root config, verify `apps/chat` CSS is unchanged, then document the
   host contract in `lib-styling-guide.md`, the five READMEs, and
   `docs/architecture.md` §Styling.
3. **Close out.** `npm run validate:docs`, one `npm run verify:full`, and a comment on
   the issue listing the delivered classes, the two corrections (no
   `dial-ci-model-menu-item-check`; `selectedItemClassName` never existed), and the
   Tailwind setup hosts must adopt.

**Rollback:** plain revert. The preset slice shares no file with the class slices, so it
reverts alone if it causes a visual regression.

## Open Questions

1. **Does the reporting host use a selector outside the issue's inventory?** Only they
   can say. Asking on the issue is a task; it does not block implementation, since
   adding a class later is non-breaking.
2. **Should the composer get a desktop `flex-nowrap` action row?** The issue asks for it
   as the "ideal fix". Deliberately out of scope pending design sign-off — with
   `dial-ci-action-row` in place a host can do it itself, which is the point.
3. **Should `validate:docs` enforce the class/README correspondence?** Recorded as
   follow-up 4 in the proposal. Doing it in this change would mean writing a new
   validator alongside five library changes; doing it after means the first drift is
   caught by review rather than by CI.

## Out of scope for this design

Nothing in this change is a backend, endpoint, DTO, generated-client, cache, rate-limit,
authorization, i18n, feature-flag, telemetry, routing, or state-ownership concern; there
is no new context, hook, or fetch. The `apps/chat-api` conventions and the
`@epam/chat-api-client` rules in `openspec/config.yaml` therefore do not apply.

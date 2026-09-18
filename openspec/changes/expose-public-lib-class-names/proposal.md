# Expose stable public `dial-*` class names on chat libraries

Tracking: [epam/ai-dial-chat#8707](https://github.com/epam/ai-dial-chat/issues/8707)

## Why

### Problem

Hosts that embed the composable chat libraries need to restyle the chrome they own
(panel, composer, attachment tiles, model menu). Today the libraries expose no
styling hooks beyond a handful of `className` props, so hosts target our internals
by whatever survives a build:

- **Hashed CSS-module locals** via substring matching — `[class*='userBubble']`,
  `[class*='modelSelectorButton']`, `[class*='_tile_']`. The hash changes whenever
  the SCSS file changes, and the local name changes whenever anyone renames a class.
- **DOM structure** — `[role='complementary'] > div:nth-child(2) > div:first-child > button`,
  `> div:has(textarea)`, `div.ms-auto`. Verified fragile: the composer action row is
  a bare `<div className="flex flex-wrap items-center gap-2">`
  ([`Input.tsx:786`](../../../libs/conversation-input/src/components/Input/Input.tsx#L786))
  and the footer cluster is identified only by its Tailwind `ms-auto`
  ([`Input.tsx:802`](../../../libs/conversation-input/src/components/Input/Input.tsx#L802)).
  Reordering children — which we have already done — silently breaks the host.
- **`role` + default `aria-label` strings** — `[role='list'][aria-label='Attached files']`.
  This one is worse than it looks: that label is host-overridable through
  `labels.ariaLabel`
  ([`AttachmentTray.tsx:17-21`](../../../libs/attachment-input/src/components/AttachmentTray/AttachmentTray.tsx#L17-L21)),
  so a host that localises the label destroys its own selector. Encouraging a11y
  attributes as styling hooks also pressures us to freeze `aria-label` text, which
  conflicts with the i18n rule in `AGENTS.md`.

There is currently **no** `dial-*` public class emitted by any library in `libs/`
(grep confirms: only `dial-kit-*` from `@epam/ai-dial-ui-kit` and the `dial-*-text`
typography classes appear, and both come from outside these libs).

### Second, independent problem — Tailwind utilities never reach the published CSS

`libs/attachment-input/dist/index.css` contains **only** CSS-module output. Confirmed:
`grep -c '84px' libs/attachment-input/dist/index.css` → `0`, while
[`attachment-group.ts:4-5`](../../../libs/attachment-input/src/constants/attachment-group.ts#L4-L5)
sizes every tile with `size-[84px]`. The libs' own
`tailwind.config.js` scans only `src/**` and the ui-kit for **build-time dev**, and the
Vite library build emits no utility layer at all.

This is by design — [`lib-styling-guide.md`](../../lib-styling-guide.md) puts layout in
Tailwind classes in JSX and colors in SCSS — but the consequence is undocumented: a
consuming host **must** run Tailwind itself and **must** add
`./node_modules/@epam/ai-dial-*/dist/**/*.js` to its own `content` globs, or every
library renders unstyled. This is why the issue reports collapsed 84px tiles and
invisible remove buttons: the host is missing the `content` entry, not a class name.
Our own root [`tailwind.config.js:142-146`](../../../tailwind.config.js#L142-L146)
already does exactly this for `@epam/ai-dial-ui-kit` and
`@epam/ai-dial-react-file-manager` — we simply never told hosts they must do the same
for our libs. No lib README or `lib-styling-guide.md` mentions it.

### Why now

The issue reports breakage already observed on package upgrade (ConversationInput
action-row order, AttachmentCard sizing). Every release we ship without a public
contract is another release that can break a host silently, and every workaround a
host writes today becomes a de-facto contract we did not agree to.

## What Changes

### 1. Emit `dial-*` public class names unconditionally

Each affected component gains a stable, documented class emitted **alongside** its
existing CSS-module and Tailwind classes. No new props, no opt-in.

Naming: `dial-<lib-prefix>-<element>`, flat kebab-case, state as an additive suffix class.

The `<lib-prefix>` is the library's **existing CSS-custom-property prefix**, so the
class contract and the theming contract read the same:

| Library                 | CSS var prefix | Class prefix |
| ----------------------- | -------------- | ------------ |
| `sidebar`               | `--sb-*`       | `dial-sb-`   |
| `conversation-panel`    | `--cp-*`       | `dial-cp-`   |
| `conversation-messages` | `--cm-*`       | `dial-cm-`   |
| `conversation-input`    | `--ci-*`       | `dial-ci-`   |
| `attachment-input`      | `--ai-*`       | `dial-ai-`   |

Flat kebab-case (not BEM) matches `@epam/ai-dial-ui-kit`, whose public classes are
already `dial-kit-input`, `dial-kit-input-error`, `dial-kit-input-small`,
`dial-kit-grid-selection-visible` — no `__` or `--` anywhere. The issue's suggested
`dial-ai-attachment-tile__name` / `--selected` spelling is therefore **rejected** in
favour of `dial-ai-attachment-tile-name` / `dial-ai-attachment-tile-selected`.

The 22 classes, sliced by the issue's own priority:

**P0 — composer (`libs/conversation-input`)**

- `dial-ci-wrapper`, `dial-ci-action-row`, `dial-ci-textarea-wrap`,
  `dial-ci-add-cluster`, `dial-ci-footer-actions`, `dial-ci-model-selector-button`

**P0 — attachments (`libs/attachment-input`)**

- `dial-ai-attachment-tray`, `dial-ai-attachment-tray-item`,
  `dial-ai-attachment-tile`, `dial-ai-attachment-tile-selected`,
  `dial-ai-attachment-tile-name`, `dial-ai-attachment-tile-type`,
  `dial-ai-attachment-tile-action`

**P1 — model menu (`libs/conversation-input`)**

- `dial-ci-model-menu`, `dial-ci-model-menu-search`,
  `dial-ci-model-menu-item`, `dial-ci-model-menu-item-selected`

  The selected row's **check indicator** is dropped from scope: it is drawn entirely by
  `@epam/ai-dial-ui-kit` from `DropdownItem.mark`, so no element here owns it. The
  issue's claim that `useModelSelector` already accepts `selectedItemClassName` and
  `selectedItemCheckClassName` is incorrect — only `searchHeaderClassName` exists.

**P2 — panel and messages**

- `dial-sb-aside`, `dial-sb-header` (`libs/sidebar`)
- `dial-cp-new-chat-button`, `dial-cp-search` (`libs/conversation-panel`)
- `dial-cm-user-bubble`, `dial-cm-assistant-content` (`libs/conversation-messages`)

### 2. Export the names as typed constants

Each library gains `src/constants/public-class-names.ts` exporting a frozen record
(e.g. `ATTACHMENT_INPUT_CLASS`), re-exported from `src/index.ts`. Hosts can import the
names instead of hardcoding strings, and the guard tests assert against the same
source. Follows the existing constant-export precedent at
[`index.ts:59-60`](../../../libs/attachment-input/src/index.ts#L59-L60).

### 3. Guard tests

Every public class gets a co-located test asserting it is present on the intended
element. Without this the contract rots exactly as silently as the problems
`lib-styling-guide.md` §Dead-style checks already catalogues.

### 4. Ship the Tailwind preset and document the host contract

Documentation alone is **not** sufficient here, and discovery is what showed it. Library
JSX uses roughly 130 semantic design-token utilities — `text-secondary` (43×),
`text-primary` (22×), `bg-layer-raised` (14×), `bg-layer-sunken` (11×), `text-error`,
`stroke-secondary`, `bg-control-accent-alpha`, … — and those class names exist **only**
in the theme block of the repo-root [`tailwind.config.js`](../../../tailwind.config.js).
That file sits at the monorepo root and is exported by no package, so a host cannot
consume it. Telling hosts "add a `content` glob" would therefore document a requirement
they cannot satisfy: their Tailwind would scan our `dist`, find `bg-layer-raised`, and
emit nothing, because their theme has no such color.

So:

- **Export the preset.** `@epam/ai-dial-chat-shared` gains a `./tailwind-preset` subpath
  export carrying the token theme, following the existing `./file-manager`, `./markdown`,
  and `./styles.css` subpath precedent in its `package.json`. The root
  `tailwind.config.js` is self-contained (215 lines, no `require`s), which makes this a
  move-and-re-export rather than a rewrite. Hosts then write
  `presets: [require('@epam/ai-dial-chat-shared/tailwind-preset')]`.
- **Document the `content` globs** — `./node_modules/@epam/ai-dial-*/dist/**/*.js` — in a
  new `lib-styling-guide.md` section, plus the `styles.css` import and the explicit
  statement that a non-Tailwind host is unsupported.
- **Repeat the snippet** in the Installation section of each affected lib README.
- **New `lib-styling-guide.md` section** defining the public-class convention, its
  stability promise, and that a11y attributes are **not** styling hooks.
- **`docs/architecture.md` §Styling** gains the public-class tier and the host contract.

### Non-goals

- **No `styles.classNames` prop API.** Rejected — see Alternatives.
- **No changes in `epam/ai-dial-ui-kit`.** The issue also asks for
  `dial-kit-dropdown-icon`, `dial-kit-dropdown-icon-caret`, `dial-kit-dropdown-list`
  and `dial-kit-menuitem`. Those live in a different repository and are filed there.
  Discovery confirmed we do **not** need them for the classes in scope: `Dropdown`
  already accepts `listClassName` (floating overlay) and `DropdownItem.className`, so
  every model-menu class here is stamped from `libs/conversation-input` alone. The one
  genuine ui-kit dependency is the selected row's check mark, which the kit draws from
  `DropdownItem.mark` — that moves to the ui-kit follow-up.
- **Not moving layout out of Tailwind into SCSS.** The issue offers this as an
  alternative fix for the tile sizing. Rejected — see Alternatives.
- **No change to the DOM structure of the composer.** The issue also asks for a
  desktop `flex-nowrap` action row. That is a visual-design decision requiring design
  sign-off, not a styling-contract change; recorded as a follow-up.
- **No `!important`, no specificity engineering.** The public classes carry no
  declarations of their own; they exist purely as host-addressable hooks.
- **No new user-visible strings**, so no i18n keys. The change *reduces* pressure to
  freeze `aria-label` text.

### Acceptance criteria

1. Every class in the table above appears on the element named in `specs/` in a render
   test, and the test fails if the class is removed.
2. Every class is also exported as a typed constant from its library's public entry point.
3. `mergeClasses` ordering keeps the public class inert: adding it changes no computed
   style in any existing test.
4. Each affected lib README documents its public classes and the required host
   Tailwind `content` globs and preset.
5. `@epam/ai-dial-chat-shared/tailwind-preset` resolves and, used as a host's sole
   preset together with the `content` globs, produces a stylesheet containing the
   semantic token utilities the libs rely on (`bg-layer-raised`, `text-secondary`, …).
6. Moving the preset changes no rendered style in this repo: `apps/chat` builds with
   the re-exported root config and its snapshot/visual tests are unchanged.
7. `npm run validate:docs` passes.
8. `npm run verify:full` passes.
9. A host can restyle each surface in the issue's inventory using only `dial-*`
   selectors — no `[class*=…]`, no `:nth-child`, no `aria-label` matching.

## Capabilities

### New Capabilities

- `lib-public-class-names`: the stable `dial-<prefix>-<element>` class contract — which
  element carries which class, the naming rules, the exported constants, the stability
  and deprecation promise, and the rule that ARIA attributes are not styling hooks.
- `lib-host-tailwind-contract`: what a consuming host must configure for the libraries
  to render correctly — required Tailwind `content` globs covering `dist`, the required
  preset for design tokens, the `styles.css` import, and the explicit statement that a
  non-Tailwind host is unsupported.

### Modified Capabilities

None. The existing specs (`attachment-input-lib`, `conversation-input-*`) describe
exports and behaviour that this change does not alter; the new public classes and
constants are additive and are specified by the two new capabilities above.

## Alternatives considered

| Option                                                          | Correctness                                                                                                  | Complexity / delivery risk                                                                        | Migration / rollback                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **A. Do nothing (baseline)**                                     | Hosts keep breaking on every release; their workarounds harden into an unowned contract                       | Zero now, unbounded support cost later                                                             | n/a                                                                           |
| **B. `styles.classNames` prop per component** (issue's proposal) | Works, but cannot reach portalled or deeply nested nodes without threading props through 4–6 intermediate components | High. **Collides with the established meaning of `styles`**, which is theming tokens (`styles.colors` / `styles.typography`, `lib-styling-guide.md` §Props API) — two unrelated concepts under one key | Every new stylable element is a new breaking-ish prop addition and a new README entry |
| **C. Always emit `dial-*` classes (chosen)**                     | Works everywhere including portals; one source of truth; verifiable by test                                   | Low. One `mergeClasses` argument per element; zero API surface change; zero runtime cost           | Purely additive. Rollback = revert; hosts lose a hook they did not have before |
| **D. Move layout/dimensions from Tailwind into SCSS modules**     | Would make `dist/index.css` self-sufficient for the moved properties                                          | Very high. Contradicts `lib-styling-guide.md`, and fixing it only for AttachmentCard leaves every other lib equally unstyled in a host missing the `content` glob — the real defect | Large diff across all libs, high visual-regression risk                       |

**Chosen: C for the classes, plus documentation for the Tailwind gap.**

B is rejected primarily on the `styles` collision and on portal reachability, and
secondarily because a prop-based contract puts the burden on every host to opt in —
the hosts that most need this are the ones least likely to know the prop exists.

D is rejected because it misdiagnoses the packaging problem. The libraries already
*require* a Tailwind-based host for **all** their layout; moving one component's
dimensions into SCSS patches one symptom while leaving flex, gap and padding across
every other lib equally dependent on the host's `content` configuration. The honest
fix is to state the requirement. Recorded as a known limitation, not silently.

**"Best practice" basis.** The convention is taken from this repository's own
observed practice — `@epam/ai-dial-ui-kit`'s `dial-kit-*` classes and the existing
`--sb-`/`--cp-`/`--cm-`/`--ci-`/`--ai-` variable prefixes — rather than from an
external style guide. Stated as an internal-consistency argument, not as an industry
claim.

**Unknown, flagged:** the exact selectors the reporting host relies on today are known
only from the issue. If their stylesheet uses a selector not in the inventory, it will
still break. Mitigation: the issue's inventory is treated as the full requirement set,
and the `lib-public-class-names` spec is the place to extend.

## Impact

### Affected code

| Library                 | Files                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conversation-input`    | `components/Input/Input.tsx`, `components/Input/ModelSelectorControl.tsx`, `hooks/useModelSelector.tsx`, new `constants/public-class-names.ts`, `index.ts`, `README.md`                        |
| `attachment-input`      | `components/AttachmentTray/AttachmentTray.tsx`, `constants/attachment-group.ts` (single shared `ATTACHMENT_TILE_BASE_CLASS` covers both `File.tsx` and `Image.tsx`), `components/AttachmentCard/Attachments/{File,Image,Actions}.tsx`, new `constants/public-class-names.ts`, `index.ts`, `README.md` |
| `sidebar`               | `components/SidebarPanel/SidebarPanel.tsx`, `components/Header/Header.tsx`, new `constants/public-class-names.ts`, `index.ts`, `README.md`                                                     |
| `conversation-panel`    | `components/NewChatButton/NewChatButton.tsx`, `components/ConversationPanel/ConversationPanel.tsx`, new `constants/public-class-names.ts`, `index.ts`, `README.md`                             |
| `conversation-messages` | `components/MessageBubble/{UserMessageBubble,AssistantMessageBubble}.tsx`, new `constants/public-class-names.ts`, `index.ts`, `README.md`                                                      |
| `chat-shared`           | new `tailwind-preset.js` (moved from the repo-root config), `package.json` `./tailwind-preset` export, `README.md`                                                                             |
| Root                    | `tailwind.config.js` re-exports the preset so the monorepo and hosts share one source                                                                                                         |
| Docs                    | `openspec/lib-styling-guide.md`, `docs/architecture.md`                                                                                                                                       |

### Scope creep called out

This touches **five shared libraries** and adds a **new public API surface** (exported
constants) to each. The per-library diff is small (one `mergeClasses` argument per
element plus one new constants file), but the blast radius is every consumer of these
five packages — hence the guard tests and the per-lib README updates are not optional.

**The Tailwind preset move is the riskiest item in the change** and the only one that
can alter rendering. It touches the repo-root `tailwind.config.js` — which every app
and lib config inherits from — and `libs/chat-shared`, a `type:shared` library that
currently imports nothing. Mitigations: the preset is *moved and re-exported*, so the
root config keeps a single source of truth; the preset is plain data with no imports;
and it is sliced last so the class work lands independently of it. It does not touch
any React code, provider, context, or backend file.

### Library isolation

The public class names are the **libraries' own** public surface, not host knowledge, so
`AGENTS.md` §Library isolation is satisfied without an adapter:

- The classes are literal strings owned by and defined inside each lib. No lib learns
  a host selector, stylesheet, route, storage key, env var, feature flag or API path.
- Nothing is read from the environment. No lib inspects `document`, the host's
  stylesheet, or any host config to decide what to emit — the class is unconditional.
- The Tailwind `content` requirement is **host build configuration** and is therefore
  documented for the host, never encoded in a lib. No lib gains a dependency on the
  host's Tailwind setup.
- No new dependency in any `package.json`, so `docs/host-install-matrix.md` is unaffected.

### i18n

No new user-visible strings and no changes to existing ones. Indirect benefit: because
hosts stop using `aria-label` text as a selector, localising those labels is no longer
a breaking change for them.

### Rollback / backward compatibility

**Not breaking.** Every change is additive:

- New classes appear in `class` attributes. They carry no declarations, so computed
  styles are unchanged for every existing consumer.
- New exported constants are new names; nothing is renamed or removed.
- Existing CSS-module classes, Tailwind utilities, `className`/`inputClassName` props
  and ARIA attributes all stay exactly as they are. Hosts currently using
  `[class*=…]` selectors keep working until they choose to migrate.

The preset move is also non-breaking: the root `tailwind.config.js` keeps its current
path and shape and re-exports the moved theme, so every existing app and lib config that
does `presets: [require('../../tailwind.config.js')]` is unaffected.

**Rollback** is a plain revert of the change — no data migration, no host coordination,
no deprecation window. The only cost is that a host that had already adopted a `dial-*`
selector loses it; because the classes are published in the README and asserted by
tests, that is a deliberate, reviewable removal rather than an accident. The preset slice
can be reverted on its own, since it shares no file with the class slices.

**Forward promise** (defined in `lib-public-class-names`): once published, a `dial-*`
class is removed or renamed only in a major version of that package, and the README
records the replacement.

## Follow-ups (out of scope, recorded deliberately)

1. **`epam/ai-dial-ui-kit`**: `dial-kit-dropdown-icon`, `dial-kit-dropdown-icon-caret`,
   `dial-kit-dropdown-list`, `dial-kit-menuitem` — separate repository, separate issue.
2. **Composer desktop `flex-nowrap` action row** — needs design sign-off.
3. **`openspec/config.yaml` defect**: three `rules` list items contain an unquoted
   `": "`, so YAML parses them as maps and OpenSpec drops **all** `proposal` and
   `tasks` rules for every change in this repo (`Rules for 'proposal' must be an array
   of strings, ignoring this artifact's rules`). Offending entries: `proposal[8]`
   (`Include impact on i18n: …`), `tasks[4]` (`Follow the file location conventions: …`),
   `tasks[18]` (`For any new or changed business HTTP endpoint, include dedicated tasks to: …`).
   Unrelated to this change; fix is to quote the three strings.
4. **A `validate:docs` check** that every `dial-*` class asserted in a lib's tests is
   documented in that lib's README, and vice versa — would make the contract
   self-enforcing rather than test-enforced.

## ADDED Requirements

### Requirement: Tailwind is a hard requirement for consuming hosts

The `libs/*` UI packages SHALL document that a consuming host must build its CSS with
Tailwind CSS 3, and that a host which does not is unsupported.

The reason SHALL be stated rather than implied: per
`openspec/lib-styling-guide.md`, layout, spacing, sizing, and border radius live in
Tailwind utility classes in JSX, while `.module.scss` carries only CSS custom
properties. A library's published `./styles.css` therefore contains the CSS-module
output **only** — it contains no utility layer, so without the host's Tailwind pass
every library renders with colors but no layout.

#### Scenario: Published stylesheet carries no utility layer

- **WHEN** `libs/attachment-input/dist/index.css` is inspected after
  `npm exec nx build attachment-input`
- **THEN** it contains the hashed CSS-module selectors and their `var(--ai-*)`
  declarations, and contains no rule for `size-[84px]`, `p-1.5`, `end-1`, or
  `group-hover/attachment-tile`

#### Scenario: Requirement is stated, not implied

- **WHEN** `openspec/lib-styling-guide.md` is read
- **THEN** it states that Tailwind CSS 3 in the host is mandatory and explains that the
  published `styles.css` carries no utility layer

---

### Requirement: The design-token Tailwind preset is published to hosts

The token theme currently defined in the repo-root `tailwind.config.js` SHALL be
consumable by a host as `@epam/ai-dial-chat-shared/tailwind-preset`.

- The theme SHALL be moved to a single file in `libs/chat-shared` and exposed through a
  `./tailwind-preset` subpath export in its `package.json`, following that package's
  existing `./file-manager`, `./markdown`, and `./styles.css` subpath precedent.
- The repo-root `tailwind.config.js` SHALL re-export that file so the monorepo and
  consuming hosts share one source of truth and the theme is not maintained twice.
- The preset SHALL remain plain configuration data with no runtime imports, so that
  adding it does not give the `type:shared` `chat-shared` library a dependency and does
  not violate the `@nx/enforce-module-boundaries` rule that `chat-shared` imports
  nothing.

`chat-shared` is the required home because it is already a peer dependency of every
affected UI library, so a host that installs any of them already has it; a separate
preset package would add an install step for no benefit.

This requirement exists because the libraries' JSX uses roughly 130 semantic
design-token utilities — `text-secondary`, `text-primary`, `bg-layer-raised`,
`bg-layer-sunken`, `text-error`, `stroke-secondary`, `bg-control-accent-alpha` and
others — whose class names exist only in that theme. Documenting the `content` glob
without shipping the theme would describe a requirement a host cannot satisfy.

#### Scenario: Host can resolve the preset

- **WHEN** a host writes
  `presets: [require('@epam/ai-dial-chat-shared/tailwind-preset')]` in its
  `tailwind.config.js`
- **THEN** the module resolves and Tailwind accepts it as a preset

#### Scenario: Token utilities are generated in the host build

- **WHEN** a host builds with that preset and with the library `dist` globs in its
  `content`
- **THEN** its output stylesheet contains rules for `bg-layer-raised`,
  `text-secondary`, and `stroke-secondary`

#### Scenario: Moving the preset changes nothing in this repository

- **WHEN** `apps/chat` and every affected library are built after the move
- **THEN** their emitted CSS is unchanged, because the root `tailwind.config.js`
  re-exports the moved theme and every project config still inherits from that root
  config by the same path

#### Scenario: chat-shared gains no import

- **WHEN** `npm exec nx lint chat-shared` runs
- **THEN** `@nx/enforce-module-boundaries` reports no violation, because the preset file
  contains no `import` or `require` of another workspace project

---

### Requirement: The host content-glob requirement is documented

`openspec/lib-styling-guide.md` SHALL document the complete host Tailwind setup, and
each affected library's `README.md` Installation section SHALL carry the same snippet.
The documentation SHALL include:

1. The `content` globs covering the published library code —
   `./node_modules/@epam/ai-dial-<lib>/dist/**/*.js` for each consumed library — and
   the reason (Tailwind can only emit a utility it has seen in scanned source).
2. The preset line, `presets: [require('@epam/ai-dial-chat-shared/tailwind-preset')]`.
3. The `import '@epam/ai-dial-<lib>/styles.css';` line for each consumed library.
4. A statement that omitting the globs produces silently unstyled layout — collapsed
   attachment tiles and invisible hover-revealed action buttons being the observed
   symptoms — rather than a build error.

The documentation SHALL reference the repo's own root
`tailwind.config.js` as the worked example, since it already applies this pattern to
`@epam/ai-dial-ui-kit` and `@epam/ai-dial-react-file-manager`.

#### Scenario: A host following the documented setup renders correctly

- **WHEN** a host configures the documented preset, `content` globs, and `styles.css`
  imports
- **THEN** attachment tiles render at their intended 84 px square size and tile action
  buttons become visible on hover and on keyboard focus within the tile

#### Scenario: The failure mode is documented as silent

- **WHEN** `openspec/lib-styling-guide.md` is read
- **THEN** it states that a missing `content` glob causes no build error and no console
  warning, and names the collapsed-tile and invisible-action-button symptoms

#### Scenario: Every affected README carries the snippet

- **WHEN** the READMEs of `conversation-input`, `attachment-input`, `sidebar`,
  `conversation-panel`, and `conversation-messages` are read
- **THEN** each Installation section contains the preset line, its own `dist` content
  glob, and its `styles.css` import

---

### Requirement: Architecture documentation records the host contract

`docs/architecture.md` §Styling SHALL be updated in the same change to record, alongside
the existing three-tier CSS-variable description:

- that the host owns the Tailwind pass for library layout utilities,
- that the token preset is published as `@epam/ai-dial-chat-shared/tailwind-preset`,
- and the public-class tier introduced by the `lib-public-class-names` capability.

Per `AGENTS.md`, the deep detail stays in `openspec/lib-styling-guide.md`; the
architecture document carries a summary and a link so the same fact is not maintained
twice.

#### Scenario: Architecture document links rather than duplicates

- **WHEN** `docs/architecture.md` §Styling is read
- **THEN** it summarises the host Tailwind contract and links to
  `openspec/lib-styling-guide.md`, without restating the `content` globs in full

#### Scenario: Documentation validation passes

- **WHEN** `npm run validate:docs` runs
- **THEN** it reports no broken relative link and no README/package identity mismatch

---

### Requirement: No dependency, endpoint, i18n, or feature-flag impact

The preset export SHALL add no entry to any library's `dependencies` or
`peerDependencies`, so `docs/host-install-matrix.md` is unaffected and no regeneration
is required. This capability introduces no state, no user-visible string and therefore
no i18n key, no feature-flag gate, no telemetry, and no HTTP endpoint, DTO,
generated-client operation, cache entry, or rate limit.

Direction impact: none. The preset carries color and typography tokens only and no
directional utility; the documentation SHALL nonetheless keep the existing guidance
that hosts use CSS logical properties in their own overrides.

#### Scenario: Install matrix is unchanged

- **WHEN** `npm run docs:install-matrix` is run after the change
- **THEN** it produces no diff against the committed `docs/host-install-matrix.md`

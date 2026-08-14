# Documentation accuracy

Ground-truth docs live in `docs/`; every app and lib additionally owns a
`README.md`. All of it is part of the public contract — a README that documents
a prop a component never had is worse than no README, because a caller copies it.

Run the check before finishing any change that touches a README, `docs/**`, a
lib's public API, or a project's `package.json`:

```sh
npm run validate:docs
```

It verifies README coverage and H1/package identity, lib `package.json`
metadata, that every relative markdown link resolves, and that every name a lib
README imports from its own package is actually exported. `npm run lint:check`
and CI do not cover any of this.

## Update the doc in the same change

Docs go stale silently — nothing fails when a renamed component leaves its
README behind. So the obligation is same-change, not follow-up:

| When you                                                   | Update                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| Rename, remove, or add an export in a lib's `src/index.ts` | That lib's `README.md`                                          |
| Rename a prop, change its type, or make it required        | Every README example that passes it                             |
| Add, rename, or remove an enum member                      | Every README that lists the members                             |
| Add or remove a lib/app, backend domain, context, or route | `docs/architecture.md` (see the Docs section of `AGENTS.md`)    |
| Add or remove an environment variable                      | `apps/chat-api/README.md` and `apps/chat-api/.env.template`     |
| Change a build output path, port, or npm script            | The root `README.md` and the affected app README                |
| Bump a tooling major listed in a version table             | The root `README.md` tech-stack list and `docs/architecture.md` |
| Delete a doc                                               | Every link to it — `npm run validate:docs` finds them           |

## Examples must compile against the current API

Treat every code fence as if it were type-checked, because nothing else does.

- Every component, prop, type, enum member, and function name must exist with
  that exact spelling.
- Include the **required** props. An example missing a required prop teaches the
  wrong call shape.
- Import each name from the package that actually exports it. `CatalogEntityType`
  lives in `@epam/ai-dial-chat-shared`, not `@epam/ai-dial-catalog`, even though
  the catalog is what renders it.
- Match declared value types — `StarterOption.const` is a `number`, so
  `{ const: '1' }` is wrong.
- Verify a name in the source rather than inferring it from the concept. Real
  drift found in this repo: `EntityBadge` (never existed), `StageType` (the type
  is `Stage`), `QrPlaceholder` (replaced by `QrCode`), `mergeClass` (it is
  `mergeClasses`), `getInitials` (it is `extractInitials`), `CodeBlock` (it is
  `MarkdownCodeBlock`), `BubblePosition.Start` (members are `Bottom`/`Top`),
  `SendOnEnter.ShiftEnter` (it is `MetaEnter`).

```tsx
// Wrong — `buttons` and `StarterButtonsAriaLabels` do not exist; the real API is
// `starters` / `onSelect` / `StarterButtonsLabels`
<StarterButtons buttons={buttons} ariaLabels={ariaLabels} />
```

## Describe what the code does, not what it should do

A plausible-sounding capability that does not exist costs a reader more than
silence. Read the implementation before describing behaviour.

- Do not claim a feature the component lacks — `SidebarPanel` was documented as
  having an "integrated `SearchInput`"; it has no search field at all.
- Do not describe behaviour the lib leaves to the host — `ConversationPanel` was
  documented as grouping "by recency (Today, This Week…)"; it renders the order
  it is given and groups by `isPinned`/`source`.
- Do not document a type that is exported but unreachable — say so, or fix the
  export.
- When intent and code disagree, state the disagreement rather than documenting
  the intent.

## Every lib README has the same shape

1. **H1** — the npm package name, exactly as in `package.json`.
2. **Overview** — what problem it solves and when to reach for it.
3. **Installation** — a `package.json` dependency snippet.
4. **Peer Dependencies** — the required peers.
5. **Components / Hooks / Utilities / Enums / Types** — one subsection per major
   export with a minimal, correct usage example.

Never leave Nx scaffold text ("This library was generated with Nx") in place.

`package.json` must carry `description` (a plain sentence, not the package name)
and `license: "Apache-2.0"` directly after `name` and `version` — see
[`libs.md`](libs.md).

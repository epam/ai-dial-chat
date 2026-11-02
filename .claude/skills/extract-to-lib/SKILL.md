---
name: extract-to-lib
description: Move reusable code from apps/* into a lib (usually libs/chat-hooks) without changing any entry point's peer set, losing tests, or leaving docs and specs pointing at the old path. Finds app enums, types, constants and helpers that duplicate or should live in a lib, checks whether a design doc keeps them host-owned, picks the module and entry point, moves code and tests, rewires imports, and updates README, specs and docs. Use when asked to move, extract or share app code with another host, to deduplicate an app type against a lib, or when `npm run validate:lib-duplicates` fails.
---

# Extract to lib

An app keeps what only it knows — routes, i18n, storage keys, app contexts,
`server-api`, feature flags. Everything else that another host would need as-is
belongs in a lib, reached through a public export. This skill moves it there
without widening what a host must install.

## 1. Find candidates

- `npm run validate:lib-duplicates` lists app enums that re-declare a lib enum.
- For a folder (`apps/chat/src/utils`, `types`, `models`), tag each file by
  what it imports: `i18next`/`translation-keys`, `server-api`/`/api/`, routes,
  storage, app contexts. A file with none of these is a candidate.
- Grep each candidate's exported names under `libs/*/src`. A same-shaped type
  or same-valued enum already exported by a lib is a duplicate: delete the app
  copy and import the lib's — nothing moves.
- A comment saying a value "mirrors" or is "kept in sync" with a lib is a
  private lib value that should be exported.
- For `apps/chat/src/components`, the same import test finds presentational
  components: one that reads no app context, router, `t()` or `server-api` —
  often already taking every string as a prop — belongs in the feature lib it
  renders, or `libs/chat-shared`. `npm run validate:lib-duplicates` prints these
  as warnings.
- A block repeated verbatim in two app components is an app utility even when
  it uses `t()`; dedupe it inside the app.

## 2. Check it is not host policy

Before moving, search `docs/` and `openspec/specs/` for the function name and
its file path. A doc that records a rule as host-owned (an id parser, an
ownership or routing decision, notification copy) wins: leave it in the app,
even when two hosts' copies look alike — they may parse different id formats.
Only the parts the doc calls shared move.

## 3. Pick the module and the entry point

- Put the code next to its domain in the lib (`scheduled-task/`, `catalog/`,
  `conversation-sources/`, `shared/`), one file per concept, kebab-case.
- Export it from the root `index.ts` **and** the subpath entry in
  `src/entry-points/` whose peers already cover every package the code
  imports. Read the lib README's entry-point-to-peer matrix: a new import must
  not add a peer to any entry point. If no entry fits, keep the code out of
  that entry rather than widening it.
- Import other modules of the same lib by relative path (`../shared/string-utils`),
  never through the lib's own package name.
- `libs/chat-hooks` stays non-rendering and host-agnostic (see `AGENTS.md`
  "Library isolation"): pass translated labels, locale, URLs and id
  comparison in as parameters.
- A component goes to a feature lib or `libs/chat-shared`, never to
  `libs/chat-hooks`. It follows `.claude/rules/libs.md`: `*Labels` with English
  defaults copied from `en.json`, colours through `*Colors` and CSS variables,
  typography through `*ClassName` props. The app component that stays becomes a
  thin adapter passing translated copy and state.
- A component in a lib that `chat-hooks` cannot import (every lib except the
  ones `AGENTS.md` lists) cannot take a `chat-hooks` enum as a prop. Give it
  plain props (`isVisible`, `isLoggingIn`, `retryMessage`) and keep the
  enum-to-props mapping in the app adapter.

## 4. Move code and tests together

- `git mv` the file when it moves whole, so history follows; otherwise cut the
  block and keep the app file for what stays.
- Move the matching `describe` blocks into `tests/` beside the new module.
  Replace app-only test helpers with a small local stand-in.
- When the lib returns a lib enum, keep the app's own copy-mapping in the app
  (e.g. lib kind → app notification noun) instead of moving the app enum.
- Every exported symbol and every interface field gets a JSDoc (`.claude/rules/libs.md`).

## 5. Rewire the app

- Merge the new names into the file's existing import from the lib; do not
  add a second import from the same module.
- Drop casts that only bridged the old app type to the lib type.
- Delete the app file once nothing imports it; grep the old path.

## 6. Docs and specs, same change

- Add a README section per new export: what it returns, where it is
  available (root and subpath), a minimal example that compiles.
- Fix every `openspec/specs/**` and `docs/**` reference to the old path or name.
- Run `npm run validate:docs`, `npm run validate:specs`,
  `npm run validate:lib-duplicates`, then `nx run-many -t lint typecheck`
  for the lib and the app.

## 7. Traps

Each of these broke or nearly broke a move:

- **Object-literal test mocks.** An app spec that mocks a lib with
  `vi.mock('@epam/…', () => ({ … }))` hides every export it does not list —
  including the component or enum the app now imports from that lib, and
  anything another lib reads from it. Grep `apps/**/*.spec.tsx` for such mocks
  of the target lib and add the new export with `importOriginal`.
- **Module-level reads of another lib.** A lib module that reads another lib's
  enum at import time (a `Record` keyed by it, a `Set` of its members) crashes
  every test that mocks that lib without the enum. Keep such maps inside the
  function, or keep the enum in the same lib as the code that reads it.
- **Hidden peers.** A relative import can pull a module whose own imports add a
  peer to the entry point (`usage/usage-banner-source.ts` imports
  `@epam/ai-dial-conversation-input`). Move the shared piece to a
  dependency-free module and re-export it from the old one.
- **New runtime imports in a lib.** `createPortal` needs `react-dom` as a peer;
  check the lib's `package.json` before using a package it does not declare, add
  it in the same change, run `npm run docs:install-matrix`, and update the
  README peer list.
- **App tests of moved code.** Move or delete the app spec for the function, or
  `nx typecheck` fails on an import the app module no longer exports.
- **Docs that say "keep in the app".** A guide that keeps a callback in the host
  may still allow the callback to call a lib helper; update the guide to name
  it rather than moving the callback.

## 8. Report

List what moved (name, module, entry points), what was deleted as a
duplicate, and what stayed host-owned and why. Note any behaviour difference a
host gets by adopting the lib version instead of its own.

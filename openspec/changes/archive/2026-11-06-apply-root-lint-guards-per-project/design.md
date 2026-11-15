## Context

ESLint flat config matches each config object's `files` and `ignores` against paths relative to a base path. That base path is the directory of the config file ESLint loaded, not the file that declared the object.

Every project's `eslint.config.mjs` spreads `../../eslint.config.mjs`, and `nx lint` runs `eslint .` from the project folder. A root object's `libs/*/src/**` is therefore matched against paths like `src/foo.ts` and never applies.

## Decisions

### D1 — Absolute `basePath` on root-relative blocks

ESLint 9.30 added a per-object `basePath`, which may be absolute. The root config computes `workspaceRoot` with `fileURLToPath(new URL('.', import.meta.url))` and sets it on the four blocks. With that, the same glob means the same files from any working directory.

Rejected alternatives:

- **Rewrite the globs as `**/src/**`.** This only works for blocks that target every project. The `chat-hooks`-only block and the "every lib except two" importer guard cannot be expressed that way.
- **Copy the blocks into each project's config.** That makes about 30 copies that drift.

### D2 — Prove it from a project folder

`tools/module-boundaries.spec.mjs` keeps its root-`cwd` cases and adds two cases that build a second `ESLint` with `cwd` set to the project folder:

- the hooks guard, from `libs/chat-hooks`;
- the importer guard, from `libs/catalog`.

This is the exact path that let the guards go inert. Removing `basePath` makes both cases fail (verified).

### D3 — The hooks guard exempts the data-shape packages

Turning the guards on reports three `chat-hooks` imports of `useAttachmentCanvas` and `useHtmlTagAnnotationGroups`.

`AGENTS.md` "Library isolation" already lets `chat-hooks` depend on `chat-shared`, `share`, `quotations`, `source-panel` and `attachment-canvas` as host-agnostic packages that describe DIAL Core's data shapes. Their hooks belong to that data layer: the canvas context and annotation grouping.

So the guard filters those five names out of the `type:ui` list, rather than the hooks being re-plumbed through parameters. That alternative would break the public API of three `chat-hooks` hooks for no isolation gain. Hooks from every other `type:ui` lib stay forbidden, and the existing `useFavColumns` case proves it.

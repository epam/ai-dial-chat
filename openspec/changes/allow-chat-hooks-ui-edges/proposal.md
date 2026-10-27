## Why

`enforce-nx-module-boundaries` locked in today's graph and recorded two of its edges as debt, with follow-ups 4.1 and 4.2. An investigation settled both. The user decided to allow the two edges deliberately, and to guard them so they cannot grow.

- **`chat-hooks` → feature libs (`type:hooks` → `type:ui`).** `chat-hooks` turns DIAL Core data into the props that eight feature libs render. From them it imports only:
  - view-model types and enums, for example 26 from `catalog`, 11 from `skill-editor` and 9 from `usage-dashboard`;
  - pure utilities such as `getCatalogItemTabs`, `isMimeTypeAllowed`, `validateScheduledTaskFormValues` and the publish-panel folder-path helpers.

  It imports no hook and no component. It has no non-test `.tsx` file, so it cannot render anything. AGENTS.md's fourth exception (`mapUsageDataToDashboard`) is this same pattern.
- **`toolset-editor` → `chat-hooks` (`type:ui` → `type:hooks`).** `toolset-editor` is the only feature lib that imports `chat-hooks`, test files included. It takes two functions, `getApiErrorDetails` and `dialFileToAttachment`, and four toolset-auth enums. The enums move to `chat-shared` in `move-toolset-auth-enums-to-chat-shared`, and `dialFileToAttachment` is replaced by a host callback in `toolset-editor-host-avatar-resolver`.

The user also set the ownership rule: **`chat-hooks` owns functions (hooks and utilities); domain types and enums belong in `chat-shared`**. Today's docs do not state this.

## What Changes

- AGENTS.md "Library isolation":
  - replace the known-debt note with two allowed edges and their limits:
    - `chat-hooks` may import a feature lib's types, enums and pure functions, never a hook, a component, or anything that renders;
    - among feature libs, only `toolset-editor` may import `chat-hooks`, and only its functions;
  - state the ownership rule for new code.
- `docs/architecture.md` "Module boundary rules":
  - change the ⚠️ debt rows to "allowed, guarded";
  - add the ownership rule;
  - update Decision Log row 17.
- `.claude/rules/libs.md`: one line on the ownership rule.
- `eslint.config.mjs`: two guards, both as `no-restricted-imports` blocks that keep the shared relative-extension pattern.
  - **Hooks guard:** `libs/chat-hooks/src/**`, excluding spec and `tests/` files, may not import a name matching `^use[A-Z]` from any `type:ui` package.
  - **Importer guard:** `libs/*/src/**` may not import `@epam/ai-dial-chat-hooks`. The block excludes `libs/chat-hooks` and `libs/toolset-editor`.
- `tools/module-boundaries.spec.mjs`: cases for both guards, plus a check that `libs/chat-hooks/src` has no non-test `.tsx` file.
- `workspace-module-boundaries` spec: the two edges become allowed-and-guarded instead of debt.

The `depConstraints` table does not change.

Non-goals:

- moving any symbol (the two sibling changes do that);
- applying the ownership rule to the roughly 227 existing non-hook types and enums in `chat-hooks` (follow-up);
- per-symbol allowlists.

Acceptance criteria:

- `npm run lint:boundaries:test` covers four guard cases, which fail on the old config:
  - `chat-hooks` importing a `use*` name from `catalog`;
  - `catalog` importing `chat-hooks`;
  - a `.tsx` added to `chat-hooks`;
  - `toolset-editor` importing `chat-hooks`, which stays allowed.
- `nx run-many -t lint` passes.
- `validate:docs`, `validate:agent-docs` and `validate:specs` pass.

Alternatives considered:

- **Move every contract into `chat-shared` (4.1 option B).** Rejected: about 70 symbols, and `chat-shared` becomes every lib's model store.
- **Per-lib `./contract` subpaths.** Rejected: 8 export changes and a subpath lint rule.
- **Docs-only acceptance.** Rejected by the user: without guards the edges grow unnoticed.

Rollback: lint config, test and docs only; revert the commit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace-module-boundaries`:
  - "Dependency direction per type tag": the two edges are allowed and guarded, not debt;
  - "Docs describe the enforced rules and the known debt": renamed in substance to cover the ownership rule;
  - a new requirement for the two guards.

## Impact

`eslint.config.mjs`, `tools/module-boundaries.spec.mjs`, `AGENTS.md`, `docs/architecture.md`, `.claude/rules/libs.md`. No runtime code, manifest or public API changes.

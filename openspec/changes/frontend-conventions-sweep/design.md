## Decisions

### D1 — Keep `DialFilesApiUploadMode`, drop `UploadMode`

`DialFilesApiUploadMode` is already a string enum and is used by `useDialFileUploadBatch`. The union `UploadMode` is used only by `UploadFileWithProgressOptions`.

Keeping the enum removes the union without renaming anything that has more than one in-repo reference. The generated client's `UploadFileUploadModeEnum` and the backend's `UploadMode` belong to their own layers and stay unchanged.

### D2 — Same name, same entry point, same values

Every union-to-enum conversion keeps the type's exported name and entry point, and keeps every value byte-identical, so JSON, query strings and DIAL Core payloads do not change. Only literal call sites have to change.

The enums go where the lib keeps enums:

- a `types/` folder, as in `catalog`, `mcp-apps`, `scheduled-tasks` and `skills`;
- or the domain `types.ts` in `chat-hooks`.

### D3 — Lint guards nested ternaries, except celebrations

The rule is `no-nested-ternary: 'error'` for `apps/*/src/**` and `libs/*/src/**`.

- `libs/celebrations/**` is turned off, because refactors must not touch that code.
- Spec files are also exempt, because the convention targets production logic and the audit counted production code only.

Each rewrite is the smallest equivalent form:

- an early return;
- an `if`/`else` that assigns a `let`;
- a lookup;
- or a small local helper.

A JSX `cond ? <A/> : cond2 ? <B/> : <C/>` becomes a helper that returns the node, or a lookup keyed by an enum.

### D4 — Lookup tables only where a case is a pure mapping

In the adapter, a case moves into a `Record` only when it returns `{ variant, message: t(key) }` with no interpolation. Interpolating cases keep explicit branches. They can only be read inline, and forcing them into a table would hide the values each one passes.

## Risks / Trade-offs

- **[A host breaks on the enum change]** The libs are pre-1.0 (`0.0.1`) and are published from this repo. The change is listed as breaking in the proposal.
- **[A ternary rewrite changes behavior]** Each touched file's existing specs run per slice, and the full `apps/chat` and lib suites run at the end.

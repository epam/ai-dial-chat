---
paths:
  - 'apps/**/*.tsx'
  - 'apps/**/*.ts'
globs: 'apps/**/*.ts,apps/**/*.tsx'
applyTo: 'apps/**/*.ts,apps/**/*.tsx'
alwaysApply: false
---

@.claude/rules/rtl.md

# Apps component conventions

- Name the component props type/interface `Props` (not `<ComponentName>Props`).
- Declare React components in `apps/*` as `const ComponentName: FC<Props> = (props) => { ... };`.
- Do not use function declarations for React components in `apps/*` (for example, `function ComponentName(props: Props) { ... }`).
- For React components in `apps/*`, use memoized default export in this form: `export default memo(ComponentName);`.

## Reuse before you declare

Before adding an enum, interface, constant or helper under `apps/*`, look for it in the libs' public exports (`@epam/ai-dial-chat-hooks`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-catalog`, and the lib that renders the feature). A copy drifts on the lib's next change, and a copied string enum does not even type-check against the lib's own signatures.

- **Import the lib's enum, never a structurally identical one.** `RowAuthType` re-declared `ExternalServiceAuthType` value for value. `npm run validate:lib-duplicates` (PR gate) fails on an app enum whose value set equals a lib enum's; an intentional one goes in `scripts/lib-duplicates.allow.json` with a `reason`.
- **Use the lib's request and model types.** `ListScheduledTasksParams` copied `ScheduledTasksListRequest`; an app wrapper takes the lib type and passes it through.
- **No mirrors.** A comment like "mirrors `X` in `libs/…`, kept in sync" means the lib should export `X` — export it there and import it, as `CATALOG_TAB_ORDER` now is.
- **No raw DIAL Core status literals.** Compare against the enum (`ExternalServiceAuthStatus.SignedIn`, `ToolsetAuthStatus.SignedIn`), not `'SIGNED_IN'`.
- **Put host-agnostic logic in a lib.** Code that touches no routing, i18n, storage key, app context or `server-api`, and that a second host would need as-is, belongs in `libs/chat-hooks` (or the feature lib) behind injected values. Moving it follows the `extract-to-lib` skill.
- **Leave host policy in the app.** Rules a design doc records as host-owned — an id parser, a routing decision, a copy choice — stay in `apps/*` even when the code looks reusable.

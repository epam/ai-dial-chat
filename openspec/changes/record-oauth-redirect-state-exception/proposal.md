## Why

Refactoring item F10 flags `libs/chat-hooks/src/oauth/` because it owns a storage key: `TOOLSET_REDIRECT_STATE_KEY = 'toolset-redirect-state'`, written by `popup.ts` and read and cleared by `useOAuthCallbackCompletion`. `AGENTS.md` "Library isolation" forbids libs from knowing "persistence/storage keys and schemas".

The plan offered two fixes:

- inject a `redirectStateStore` port;
- record an explicit exception.

On inspection, the key is not host persistence. It is one internal step of the lib's own OAuth handshake:

- The writer and the reader are both in `chat-hooks`.
- The value is written into the popup's own `sessionStorage` while it is still same-origin `about:blank`, and read back by the callback route in that same popup.
- The host never reads, writes or chooses it. The only host-side uses are tests in `apps/chat` that seed the state through the exported constant.
- The state carries only flow-correlation values and paths, never an access or refresh token or an authorization code.

A port would add one thing a host could get wrong: a different key, or a different storage, for the writer than for the reader. That fails as "missing redirect state" at the end of a provider login. It would also add a parameter to the following, and to four call sites in `apps/chat`:

- `initiateOAuthLogin`
- `navigateToolsetOAuthPopup`
- `useToolsetLogin`
- `useExternalServiceLogin`
- `useOfflineCredentialsLogin`
- `useCatalogToolsetCredentials`
- `useOAuthCallbackCompletion`

None of that would let a host do anything it cannot do today.

## What Changes

- **Record a third narrow isolation exception.** `libs/chat-hooks` may own the `sessionStorage` key and stored format of its OAuth redirect-state handoff, because both ends of that handoff are inside the lib.
  - The exception covers only that key.
  - It does not cover any other storage, and the stored state must never carry an access or refresh token, a client secret or an authorization code.
  - It is recorded in `.claude/rules/libs.md` "Narrow isolation exceptions", and the `AGENTS.md` summary sentence names it.
  - `docs/architecture.md` "Library isolation" gets one paragraph on it.
- **Make the ownership a requirement** of `chat-hooks-oauth-popup-flow`, so a later change cannot widen it silently.
- **Close F10** in the local refactoring plan as resolved by exception. The `replaceState` URL scrub, a separate P3 row, is out of scope.

No code changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-hooks-oauth-popup-flow`: adds a requirement that the redirect-state storage key and format are owned by the module and never supplied by the host, and bounds what that state may carry.

## Impact

- **Docs:** `AGENTS.md`, `.claude/rules/libs.md` and `docs/architecture.md`.
- **Spec:** `openspec/specs/chat-hooks-oauth-popup-flow/spec.md`, at sync.
- **Not changed:** code, public API and tests.

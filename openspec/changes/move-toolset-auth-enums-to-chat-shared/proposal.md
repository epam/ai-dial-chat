## Why

The user set an ownership rule: `libs/chat-hooks` owns functions (hooks and pure utilities), and domain types and enums belong in `libs/chat-shared`. `allow-chat-hooks-ui-edges` records that rule in the docs.

Four toolset-auth domain enums break the rule today. `ToolsetAuthTypes`, `ToolsetAuthStatus`, `ToolsetCredentialsLevel` and `WithLogin` are declared in `libs/chat-hooks/src/oauth/types.ts`. `libs/toolset-editor` imports them from there, which is one reason for the `toolset-editor` → `chat-hooks` edge, follow-up 4.2 of `enforce-nx-module-boundaries`. After this change, `toolset-editor` takes only functions from `chat-hooks` (`getApiErrorDetails`, plus `dialFileToAttachment` until `toolset-editor-host-avatar-resolver` lands). That is the limit the importer guard documents.

## What Changes

- Move the four enums, unchanged and with their JSDoc, to a new `libs/chat-shared/src/types/toolset-auth.ts`, exported from the `chat-shared` root barrel.
- Remove them from `libs/chat-hooks/src/oauth/types.ts`. The OAuth-flow declarations stay: `OAuthResourceKind`, the `ToolsetOAuth*` enums and `TOOLSET_REDIRECT_STATE_KEY`.
- Rewrite every import to `@epam/ai-dial-chat-shared`, with no re-export shim (`remove-cross-package-reexports` precedent):
  - 18 files in `apps/chat/src`;
  - 15 in `libs/chat-hooks/src`;
  - 9 in `libs/toolset-editor/src`.
- Update the `chat-shared`, `chat-hooks` and `toolset-editor` READMEs, and the three specs that name the owner.

`ApiErrorDetails` stays in `chat-hooks`. It describes the result of the `getApiErrorDetails` function, and the rule keeps a function's own result type next to it.

**BREAKING** (public API of a publishable lib): `@epam/ai-dial-chat-hooks` and its `./oauth` subpath no longer export the four enums, so hosts import them from `@epam/ai-dial-chat-shared`. Every lib sits at `0.0.1`, and all in-repo consumers migrate in this change.

Non-goals:

- moving any other `chat-hooks` type (the follow-up inventory in `allow-chat-hooks-ui-edges`);
- changing enum members;
- the `apps/chat-api` enums of the same names, which are separate backend DTO enums.

Acceptance criteria:

- `rg "ToolsetAuthTypes|ToolsetAuthStatus|ToolsetCredentialsLevel|WithLogin"` finds declarations only in `libs/chat-shared/src/types/toolset-auth.ts` and `apps/chat-api`.
- No import of those names from `@epam/ai-dial-chat-hooks` remains.
- `typecheck`, `lint` and `test` pass for `chat`, `chat-hooks`, `chat-shared` and `toolset-editor`.
- `validate:docs` and `validate:specs` pass.

Alternatives considered:

- **Keep the enums in `chat-hooks`.** Rejected: it contradicts the ownership rule.
- **Keep a re-export from `chat-hooks`.** Rejected by repo precedent.

Rollback: revert the commit. The move is mechanical.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-hooks-oauth-popup-flow` ("Shared enum and model declarations"): the four toolset-auth enums are owned by `chat-shared`.
- `toolset-editor-library` ("No host, REST, or i18n dependency" and "Auth block operations through authActions"): the enums come from `@epam/ai-dial-chat-shared`.
- `chat-hooks-domain-utilities` ("Toolset-login broadcast events are generic over the credentials-level type"): names the enum's owner correctly.

## Impact

- **Code:** `libs/chat-shared` (new file plus barrel), `libs/chat-hooks`, `libs/toolset-editor`, `apps/chat`. 43 files in total, all import-only apart from the move itself.
- **Docs:** three READMEs. `docs/architecture.md` is not affected, since it does not list these enums.
- **Unaffected:** runtime behavior, i18n, the backend, and `package.json` dependencies. `chat-hooks` and `toolset-editor` already depend on `chat-shared`.

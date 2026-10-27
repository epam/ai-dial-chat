Slicing: contract-first. Slice 1 makes the new declaration available. Slice 2 migrates every consumer and removes the old one in the same step, because a second declaration would be a different nominal enum. Slice 3 fixes the docs. design.md is skipped: this is a mechanical move with no design choice left open after proposal.md. Lib architecture guard: `libs/chat-shared/src/types/toolset-auth.ts` holds only string enums with no host knowledge, and `chat-hooks` and `toolset-editor` gain no new dependency.

## 1. New home

- [ ] 1.1 Create `libs/chat-shared/src/types/toolset-auth.ts` with `ToolsetAuthTypes`, `ToolsetAuthStatus`, `ToolsetCredentialsLevel` and `WithLogin`, copied verbatim with their JSDoc. Add `export * from './types/toolset-auth';` to `libs/chat-shared/src/index.ts` next to the other `types/` exports.

Verification: `npm exec nx run @epam/ai-dial-chat-shared:typecheck`

## 2. Migrate and remove

- [ ] 2.1 Delete the four enums from `libs/chat-hooks/src/oauth/types.ts`. Keep the module-level JSDoc accurate for the remaining OAuth-flow declarations.
- [ ] 2.2 In `libs/chat-hooks/src`, rewrite every import of the four names, including relative `./types` and `../oauth/types` imports, to `@epam/ai-dial-chat-shared`.
- [ ] 2.3 In `libs/toolset-editor/src`, rewrite every import of the four names from `@epam/ai-dial-chat-hooks` to `@epam/ai-dial-chat-shared`. `getApiErrorDetails` and `dialFileToAttachment` keep coming from `@epam/ai-dial-chat-hooks`.
- [ ] 2.4 In `apps/chat/src`, rewrite every import of the four names from `@epam/ai-dial-chat-hooks` or `@epam/ai-dial-chat-hooks/oauth` to `@epam/ai-dial-chat-shared`. Merge into an existing `@epam/ai-dial-chat-shared` import where the file has one.
- [ ] 2.5 Confirm with `rg` that no import of the four names from `@epam/ai-dial-chat-hooks` remains, and that the only declarations are in `libs/chat-shared` and `apps/chat-api`.

Verification:

- `npm exec nx run-many -t typecheck lint -p @epam/chat @epam/ai-dial-chat-hooks @epam/ai-dial-chat-shared @epam/ai-dial-toolset-editor`
- `npm run test:file -- libs/chat-hooks/src/oauth/tests` for every spec file under that folder
- the `toolset-editor` spec files that reference the enums

## 3. Docs

- [ ] 3.1 `libs/chat-shared/README.md`: add the four enums to the Enums section.
- [ ] 3.2 `libs/chat-hooks/README.md`: remove the four enums from its enum list and from the `./oauth` subpath description. Change any example that imports them from `@epam/ai-dial-chat-hooks`.
- [ ] 3.3 `libs/toolset-editor/README.md`: change examples that import the enums to `@epam/ai-dial-chat-shared`.
- [ ] 3.4 Run `npm run validate:docs` and `npm run validate:specs`. Then run `npm run verify:full` once.

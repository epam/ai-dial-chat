## 1. Record the exception

- [x] 1.1 Add a third bullet to `.claude/rules/libs.md` "Narrow isolation exceptions" for the `chat-hooks` OAuth redirect-state key, bounded as in design D2.
- [x] 1.2 Update the `AGENTS.md` sentence that lists the narrow exceptions so it names the third one.
- [x] 1.3 Add one paragraph to `docs/architecture.md` "Library isolation".
- [x] 1.4 Verify the bound in the code: confirm that `ToolsetRedirectState` in `libs/chat-hooks/src/oauth/models.ts` has no token or code field. Result: its fields are `toolsetId`, `credentialsLevel`, `redirectUri`, `state`, `resourceKind` and `offlineUsageConsent`.

## 2. Close

- [x] 2.1 `npm run validate:docs`, `npm run validate:specs` and `openspec validate record-oauth-redirect-state-exception` pass.
- [x] 2.2 Mark F10 in the local `refactoring-frontend.md` as resolved by exception.

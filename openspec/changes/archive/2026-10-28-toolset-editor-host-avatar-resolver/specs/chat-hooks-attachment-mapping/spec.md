## MODIFIED Requirements

### Requirement: `apps/chat` supplies its bucket/icon-URL resolver as an injected callback

`apps/chat/src/components/ConversationView/ConversationView.tsx` and `apps/chat/src/hooks/files/useDialFileManagerState.ts` SHALL call the `@epam/ai-dial-chat-hooks` exports with `{ resolvePreviewUrl: resolveCatalogIconUrl }` (the other caller, `apps/chat/src/hooks/application-editor/useApplicationAvatarPicker.ts`, passes its own injected `resolveIconUrl`), where `resolveCatalogIconUrl` remains defined in `apps/chat/src/utils/icon-path.ts` and continues to construct the app's `/api/v1/files/download` and `/api/themes/icon` paths. `apps/chat/src/utils/dial-file-to-attachment.ts` and its test SHALL be removed once the migration is verified.

#### Scenario: App-owned URL construction never enters the library
- **WHEN** the repository is inspected
- **THEN** no non-test source file under `libs/chat-hooks/src/**` contains a reference to `ApiEndpoints`, `/api/v1/files/download`, or `/api/themes/icon` (spec fixtures under `tests/` may use such URLs as stub resolver return values), and `apps/chat/src/utils/icon-path.ts` still owns `resolveCatalogIconUrl`

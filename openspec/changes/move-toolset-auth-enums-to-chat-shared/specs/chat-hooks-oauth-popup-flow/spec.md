## MODIFIED Requirements

### Requirement: Shared enum and model declarations

The enums and models the flow's signatures use SHALL be declared once in the lib and imported
directly by every call site, never re-declared per host and never laundered through a host-side
re-export shim — TypeScript string enums are nominal, so a structurally identical copy would not
type-check against a lib signature.
`libs/chat-shared` SHALL own the toolset-auth domain enums `ToolsetAuthTypes`, `ToolsetAuthStatus`,
`ToolsetCredentialsLevel` and `WithLogin` (in `libs/chat-shared/src/types/toolset-auth.ts`), because
feature libs such as `@epam/ai-dial-toolset-editor` use them too and `chat-hooks` owns functions, not
domain types. `libs/chat-hooks` SHALL own the flow's own declarations: `OAuthResourceKind`, `ToolsetOAuthInitiationResultType`, `ToolsetOAuthResultType`,
`ToolsetOAuthFailureReason`, `ToolsetOAuthChannelControlType`, `ToolsetOAuthCallbackQuery`,
`TOOLSET_REDIRECT_STATE_KEY`, and the `ToolsetRedirectState`, `ToolsetOAuthInitiationResult`,
`ToolsetOAuthResult`, `ToolsetOAuthChannelMessage`, and `ToolsetOAuthResultAcknowledgement` shapes.

#### Scenario: Host enum member type-checks against the lib signature

- **WHEN** an application passes its imported `ToolsetCredentialsLevel.User` into a lib function
- **THEN** it type-checks, because the enum is the single shared declaration rather than a
  structurally identical copy

#### Scenario: App constants keep only their routing members

- **WHEN** `apps/chat/src/constants/toolsets.ts` is inspected
- **THEN** it retains exactly its routing-owned member — `ToolsetEditorQuery` — and re-exports none of the declarations owned elsewhere;
  `ToolsetTransportType` and the default-toolset constants live in
  `@epam/ai-dial-toolset-editor`

#### Scenario: Call sites import the moved declarations from the package

- **WHEN** an application module needs a moved enum, model, or function
- **THEN** it imports it directly from its owning package — `@epam/ai-dial-chat-shared` for the four
  toolset-auth enums, `@epam/ai-dial-chat-hooks` for everything else — so no host module and no
  re-export stands between the declaration and its consumers

#### Scenario: Icon mapping lives in the toolset-editor lib, labels arrive via props

- **WHEN** the toolset editor's authentication-type segment control is rendered
- **THEN** its icon mapping (`AUTH_TYPE_ICONS` in `@epam/ai-dial-toolset-editor`) maps
  `@epam/ai-dial-chat-shared` `ToolsetAuthTypes` members to `@tabler/icons-react` components, and the
  segment labels are host-supplied strings threaded through the lib's `labels` props —
  the lib maps icons only, never translation keys, keeping the chat-hooks lib free of
  both i18n and icon dependencies

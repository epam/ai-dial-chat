## MODIFIED Requirements

### Requirement: Toolset-login broadcast events are generic over the credentials-level type

`@epam/ai-dial-chat-hooks` SHALL export a generic `ToolsetLoginSuccessDetail<T>`, `emitToolsetLoginSuccess<T>`, and `subscribeToolsetLoginSuccess<T>`, from `libs/chat-hooks/src/shared/toolset-login-events.ts`, reproducing the original app module's `EventTarget`-based broadcast behavior exactly, with the `ToolsetCredentialsLevel` enum (owned by `@epam/ai-dial-chat-shared`) supplied by `apps/chat` as the type argument at its call sites instead of being imported by these helpers.

#### Scenario: Broadcast and subscription still round-trip the same detail shape
- **WHEN** `apps/chat` calls `emitToolsetLoginSuccess<ToolsetCredentialsLevel>(detail)` and a subscriber calls `subscribeToolsetLoginSuccess<ToolsetCredentialsLevel>(listener)`
- **THEN** the listener receives the exact `detail` object that was emitted, typed as `ToolsetCredentialsLevel`

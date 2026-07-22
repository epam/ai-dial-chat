# Prompt: OpenSpec for chat-overlay conversation-list methods

You are working in `C:\dial_projects\ai-dial-chat`.

Create the next OpenSpec change for the already-landed `chat-overlay` work. The previous change is archived under `openspec/changes/archive/2026-07-21-chat-overlay`, and the current live capabilities are under:

- `openspec/specs/chat-overlay-protocol/spec.md`
- `openspec/specs/chat-overlay-library/spec.md`
- `openspec/specs/chat-overlay-app-mode/spec.md`
- `openspec/specs/chat-overlay-sandbox/spec.md`

Important notice: there are links and mentions about old chat "C://ai-dial-chat". This is only to know what we need to implement an how,
but do not include in created openspec files links and mentions about this old chat repository.

## Goal

Prepare an OpenSpec proposal for adding the deferred Conversation-list mutation methods to `@epam/ai-dial-chat-overlay` and the embedded `apps/chat` overlay mode:

- `createConversation`
- `createLocalConversation`
- `deleteConversation`
- `renameConversation`
- `selectConversation`
- `getConversations`
- `getSelectedConversations`

Do not include playback conversation methods, import/export, custom message buttons, or old UI-section feature toggles in this change.

## Old implementation references

The old repository is available at `C:\ai-dial-chat`. Use it as behavioral reference, not as code to copy blindly.

Key files:

- Old library direct methods: `C:\ai-dial-chat\libs\overlay\src\lib\ChatOverlay.ts`
- Old manager forwarding methods: `C:\ai-dial-chat\libs\overlay\src\lib\ChatOverlayManager.ts`
- Old protocol request constants: `C:\ai-dial-chat\libs\shared\src\constants\overlay.ts`
- Old request payload types: `C:\ai-dial-chat\libs\shared\src\types\overlay\request.ts`
- Old response payload types: `C:\ai-dial-chat\libs\shared\src\types\overlay\response.ts`
- Old overlay conversation projection: `C:\ai-dial-chat\libs\shared\src\types\overlay\conversation.ts`
- Old app-side Redux handling: `C:\ai-dial-chat\apps\chat\src\store\overlay\overlay.epics.ts`
- Old sandbox index: `C:\ai-dial-chat\apps\overlay-sandbox\app\page.tsx`
- Old direct sandbox controls: `C:\ai-dial-chat\apps\overlay-sandbox\app\cases\components\chatOverlayWrapper.tsx`
- Old manager sandbox controls: `C:\ai-dial-chat\apps\overlay-sandbox\app\cases\components\chatOverlayManagerWrapper.tsx`

Important finding from the old sandbox: there was no separate dedicated route/page for the conversation-list mutation methods. The old `apps/overlay-sandbox/app/page.tsx` listed generic overlay feature cases, while conversation-list controls were embedded in the common direct and manager wrapper components. Since the current sandbox only has `Direct ChatOverlay case` and `ChatOverlayManager case`, this OpenSpec should add a new sandbox section/case for these methods so they can be tested explicitly.

## Current implementation references

Read these current files before proposing:

- Public shared protocol: `libs/chat-shared/src/types/overlay/overlay-protocol.ts`
- Overlay library: `libs/chat-overlay/src/lib/ChatOverlay.ts`
- Overlay manager: `libs/chat-overlay/src/lib/ChatOverlayManager.ts`
- Overlay package entrypoint: `libs/chat-overlay/src/index.ts`
- App overlay state owner: `apps/chat/src/context/overlay/OverlayContext.tsx`
- Active conversation bridge: `apps/chat/src/hooks/conversation/useActiveConversationBridge.ts`
- Conversation list state owner: `apps/chat/src/context/ConversationsContext.tsx`
- Existing frontend conversation API wrappers: `apps/chat/src/server-api/conversations.api.ts`
- No-conversation route/create flow: `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`
- Existing current sandbox app index: `apps/chat-overlay-sandbox/src/app/app.tsx`
- Existing direct sandbox case: `apps/chat-overlay-sandbox/src/cases/DirectOverlayCase/DirectOverlayCase.tsx`
- Existing manager sandbox case: `apps/chat-overlay-sandbox/src/cases/ManagerOverlayCase/ManagerOverlayCase.tsx`

Current backend note: `apps/chat-api/src/conversations/dto/create-conversation.dto.ts` requires `firstMessage` and `deploymentId`. The old overlay `createConversation(parentPath?, local?)` and `createLocalConversation()` created empty/default conversations, including local draft behavior. The new proposal must not assume the current `createConversation` endpoint already supports that behavior. Explicitly compare options:

- add a backend/server-api path for empty/default conversation creation,
- emulate the behavior at the app edge with existing APIs and navigation state,
- or intentionally narrow the overlay method semantics with a documented compatibility break.

If any new or changed backend business endpoint is proposed, follow the OpenSpec rules for endpoint shape, Swagger/OpenAPI generated-client impact, `npm run openapi`, `npm run openapi:check`, and generated client build/lint tasks.

## Old public API shape to preserve unless the design rejects it

Old direct `ChatOverlay` methods:

```ts
getConversations(): Promise<{ conversations: OverlayConversation[] }>;
getSelectedConversations(): Promise<{ conversations: OverlayConversation[] }>;
selectConversation(id: string): Promise<{ conversation: OverlayConversation }>;
deleteConversation(id: string): Promise<void>;
renameConversation(id: string, newName: string): Promise<{ conversation: OverlayConversation }>;
createConversation(parentPath?: string | null, local?: boolean | null): Promise<{ conversation: OverlayConversation }>;
createLocalConversation(): Promise<{ conversation: OverlayConversation }>;
```

Old `ChatOverlayManager` forwarded the same methods with `overlayId` as the first argument.

Old wire request names:

- `@DIAL_OVERLAY/GET_CONVERSATIONS`
- `@DIAL_OVERLAY/GET_SELECTED_CONVERSATIONS`
- `@DIAL_OVERLAY/SELECT_CONVERSATION`
- `@DIAL_OVERLAY/CREATE_CONVERSATION`
- `@DIAL_OVERLAY/CREATE_LOCAL_CONVERSATION`
- `@DIAL_OVERLAY/DELETE_CONVERSATION`
- `@DIAL_OVERLAY/RENAME_CONVERSATION`

Old request payloads:

```ts
interface CreateConversationRequest {
  parentPath?: string | null;
  local?: boolean | null;
}

interface SelectConversationRequest {
  id: string;
}

interface DeleteConversationRequest {
  id: string;
}

interface RenameConversationRequest {
  id: string;
  newName: string;
}
```

Old responses used an `OverlayConversation` projection and returned either `{ conversations: OverlayConversation[] }`, `{ conversation: OverlayConversation }`, or no payload for delete.

## Behavioral decisions the OpenSpec must make

The new app is React Context + hooks, not the old Redux/epics app. Do not copy old implementation mechanics. The proposal/design/spec must explicitly decide:

- What `OverlayConversation` shape is in the new protocol. Current list items are `ConversationListItemDto` with `id`, `title`, `updatedAt`, `sharedWithMe`, `publishedWithMe`, `isPinned`, `isReadonly`; the old projection had `name`, `bucket`, and `parentPath`. Preserve compatibility where possible, but do not import generated `@epam/chat-api-client` DTOs into hand-authored libs.
- Whether `getConversations()` returns the currently loaded `ConversationsContext.conversations` list, forces a refresh first, or supports pagination. Current `ConversationsContext` calls `listConversations()` with default `limit: 1000` and does not page through `nextToken`.
- What `getSelectedConversations()` means in the current single-route UI. Candidate: return the currently displayed conversation as a one-item list when a conversation route is active, otherwise `[]`. Document the chosen semantics.
- How `selectConversation(id)` maps to current routing. It likely should navigate using `getConversationRoute(id)`, wait until the route finishes loading, then respond with that conversation projection.
- How invalid IDs and invalid rename values respond. The old implementation often logged and sent no response, causing host-side timeout. The new protocol already has timeout semantics, but a more explicit rejection/error payload may be preferable. Choose and specify consistently.
- How read-only/shared/published conversations behave for `renameConversation` and `deleteConversation`. Use existing server behavior where possible and specify host-visible failure behavior.
- How `createConversation(parentPath?, local?)` and `createLocalConversation()` work with the current backend requirement for `firstMessage` and `deploymentId`.
- Whether `createConversation(..., local: true)` is equivalent to `createLocalConversation()` in the new implementation.
- How `CONVERSATIONS_UPDATED` and `SELECTED_CONVERSATION_LOADED` should fire after create/select/delete/rename.
- Whether these overlay methods are gated only by existing overlay runtime config/origin validation, or also by `ENABLED_FEATURES`/roles. If not feature-gated, state that.

## Expected OpenSpec scope

Modify existing capabilities rather than inventing an unrelated capability set:

- `chat-overlay-protocol`: add request enum members, payload/response interfaces, type guards, and scenarios for request/response behavior.
- `chat-overlay-library`: add public `ChatOverlay` methods, `ChatOverlayManager` forwarding methods, exports, README updates, and unit tests.
- `chat-overlay-app-mode`: add app-side handling through `OverlayContext` and app-level conversation list/navigation adapters.
- `chat-overlay-sandbox`: add an explicit sandbox section/case for these methods because the old sandbox had no dedicated page.

Add any backend/client-config capabilities only if the design truly needs backend endpoint changes.

## Sandbox requirements for the new section/case

The current sandbox is `apps/chat-overlay-sandbox` (React + Vite). Add a new section or case that is explicit enough to test all seven methods manually against a running overlay-enabled chat host.

Minimum UI:

- A `Get conversations` action that logs JSON response.
- A `Get selected conversations` action that logs JSON response.
- A `Create conversation` action with optional `parentPath` and `local` controls.
- A `Create local conversation` action.
- A conversation id input plus a select/dropdown populated from `getConversations`.
- `Select conversation by id`.
- `Rename conversation by id` with a new-name input.
- `Delete conversation by id`.
- A refresh action for the local sandbox-side list.
- Event/response log using the existing `EventLog` pattern.

Cover both direct `ChatOverlay` and `ChatOverlayManager` paths. This can be one new case with two sections, or additions to both existing cases, but the case index must make the conversation-list method surface easy to find. Keep sandbox imports from `@epam/ai-dial-chat-overlay`, not relative paths into `libs/chat-overlay/src`.

## Testing and verification expectations

The OpenSpec tasks should be thin vertical slices and include focused verification commands. Prefer Nx:

- `npm exec nx test @epam/ai-dial-chat-shared`
- `npm exec nx test @epam/ai-dial-chat-overlay`
- `npm exec nx test @epam/chat`
- `npm exec nx test chat-overlay-sandbox`
- corresponding `lint`/`build` targets for touched projects
- final affected build/lint/test against `origin/development-1.0`

If backend/OpenAPI changes are included, add:

- `npm exec nx test @epam/chat-api`
- `npm exec nx lint @epam/chat-api`
- `npm exec nx build @epam/chat-api`
- `npm run openapi`
- `npm run openapi:check`
- build/lint for `chat-api-client`

## Acceptance criteria for the proposal

The OpenSpec proposal/design/spec/tasks are ready when they:

- cite the closest current implementation files with `path:line` evidence from investigation,
- document old sandbox finding: no separate old page, controls were embedded in common wrappers,
- explicitly state the new sandbox section/case requirement,
- preserve or intentionally reject old public API signatures with rationale,
- define host-visible success and failure behavior for all seven methods,
- keep hand-authored libs free of host/backend/generated-client details,
- include i18n/RTL/a11y impact for the sandbox UI,
- include OpenAPI/generated-client tasks only if backend contracts change,
- exclude playback, import/export, custom buttons, and old UI feature toggles.

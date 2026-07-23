## Context

The prior `chat-overlay` change shipped `libs/chat-shared/src/types/overlay/overlay-protocol.ts` (pure protocol types), `libs/chat-overlay` (`ChatOverlay`/`ChatOverlayManager`), `apps/chat/src/context/overlay/OverlayContext.tsx` (handshake, origin validation, the single `registerActiveConversationBridge` slot), and `apps/chat/src/hooks/conversation/useActiveConversationBridge.ts` (registers `ConversationPage`'s local conversation as that bridge). It deliberately left conversation-list mutation out of scope.

Two existing app-side contexts already own everything these seven methods need, and neither is reachable from `OverlayContext` today because of provider nesting order (`OverlayProvider` sits where `RequireAuth` used to, **outside** `GenerationProvider` → `UserConfigProvider` → `DeploymentsProvider` → `ConversationsProvider`):

- `ConversationsContext` (`apps/chat/src/context/ConversationsContext.tsx`) owns the flat `conversations: ConversationListItemDto[]` list plus `deleteConversation`, `renameConversation`, `refreshConversations` — each already optimistic-update-then-revert-on-failure, and the list-changed effect already calls `overlay?.notifyConversationsUpdated()` (line 94-97), so `CONVERSATIONS_UPDATED` already fires automatically for any change routed through this context.
- `DeploymentsContext` owns `selectedItemId` (the resolved current/default deployment) and `restoreSelectedItemId`.
- `apps/chat/src/server-api/conversations.api.ts`'s `createConversation(firstMessage, deploymentId, ...)` requires both arguments (`CreateConversationDto.firstMessage`/`deploymentId` are non-optional, enforced by `apps/chat-api/src/conversations/conversation.service.ts:121-188`, which always creates the new conversation at the user's bucket root — `folderId = bucket`, no folder/path parameter exists on the create path at all).
- `ConversationRoute` (`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`) is the "no conversation selected" composer screen. It already implements exactly the create-and-navigate flow (`handleCreateConversation`) a `createConversation` overlay method needs, and it already calls `overlay?.notifyConversationLoaded()` on mount (so `READY_TO_INTERACT` isn't blocked by an empty composer).
- `apps/chat/src/server-api/api-error.ts` already has the `isConversationNotFoundError` (`response.status === 404`) pattern this design generalizes to a small status→error-code map.

None of the old app's mechanics apply directly: there was no `parentPath`-scoped conversation storage then either from what the current backend supports, and the old "local" conversation relied on a Redux draft slice this app has no equivalent of. The design below is new, built from the primitives above, not a port.

## Goals / Non-Goals

**Goals:**
- Add `getConversations`, `getSelectedConversations`, `selectConversation`, `createConversation`, `createLocalConversation`, `deleteConversation`, `renameConversation` to `ChatOverlay`/`ChatOverlayManager`, backed by a new app-side bridge that composes existing context methods — no new backend endpoints, no new REST permission logic.
- Give these seven methods an explicit, in-band error signal for invalid ids/values/forbidden actions, instead of the silent-timeout failure mode the old implementation was criticized for.
- Keep `CONVERSATIONS_UPDATED`/`SELECTED_CONVERSATION_LOADED` firing through the exact same, already-shipped mechanisms (`ConversationsContext`'s list-changed effect, `ConversationRoute`/`ConversationPage`'s `notifyConversationLoaded()` calls) rather than adding a second event-emission path.
- Make `createConversation`'s "no `firstMessage`" path and `createLocalConversation()` provably the same operation.

**Non-Goals:**
- Reproducing the old Redux app's "invisible draft conversation, persisted lazily on first assistant reply" storage semantics. The current backend cannot create a conversation without a first message (`IsMessageOrAttachmentsPresent`), and building that capability is a new product feature, not protocol parity — out of scope here.
- Any backend/OpenAPI change. Every new behavior is reachable through REST calls a signed-in user's own UI actions already make.
- A `parentPath`/folder-scoped conversation creation feature. The backend has no such concept for conversations today (unlike files); adding one is out of scope.
- Playback conversations, import/export, custom message buttons, UI-section feature toggles — unchanged Non-Goals from the previous change.

## Decisions

### 1. `OverlayConversation` is a new, hand-written projection — not a `ConversationListItemDto` re-export

`libs/chat-shared/src/types/overlay/overlay-protocol.ts` gains:

```ts
export interface OverlayConversation {
  id: string;
  title: string;
  updatedAt: number;
  isPinned: boolean;
  isReadonly: boolean;
  sharedWithMe: boolean;
  publishedWithMe: boolean;
}
```

This mirrors `ConversationListItemDto` field-for-field (same names/types) because that DTO is already a clean, host-agnostic projection with no leaked storage details — but it is declared independently in `chat-shared`, matching the old projection's role without importing `@epam/chat-api-client` into a hand-authored lib (forbidden by AGENTS.md library isolation). The old projection's `bucket`/`parentPath` fields are dropped: this app exposes no folder concept for conversations (Decision 3), so there is nothing meaningful to put in them.

**Alternatives considered:**
- *Export `ConversationListItemDto` itself through `chat-overlay`.* Rejected — `libs/chat-overlay` and `libs/chat-shared` must never import `@epam/chat-api-client` per the generated-client exception boundary; only `apps/chat/src/server-api/**` may.
- *Keep `bucket`/`parentPath` for old-API shape parity.* Rejected — fields with no real value in the new model are dead API surface a host could reasonably rely on.

### 2. Explicit error payload for these seven methods only, not a protocol-wide change

New shared type:

```ts
export interface OverlayConversationError {
  /** `NOT_FOUND` for an unknown/inaccessible id, `FORBIDDEN` for a read-only/shared-without-write-access conversation, `INVALID_ARGUMENT` for a rejected value (e.g. blank rename). */
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_ARGUMENT';
  message: string;
}
```

`DeleteConversationResponse`, `RenameConversationResponse`, `SelectConversationResponse`, `CreateConversationResponse` each carry an optional `error?: OverlayConversationError`; success fields (`conversation`) are present only when `error` is absent. The app derives `code` from the same HTTP-status pattern `isConversationNotFoundError` already established (404 → `NOT_FOUND`, 403 → `FORBIDDEN`), plus app-side pre-validation (blank/whitespace `newName` → `INVALID_ARGUMENT` before any request is sent).

**Alternatives considered:**
- *Reuse the existing silent-timeout-only failure mode (old behavior).* Rejected — the proposal's own review of the old implementation flags "logged and sent no response, causing host-side timeout" as the thing to avoid; a caller of `deleteConversation('bad-id')` deserves a fast, explicit answer, not a 10-second hang.
- *Add a protocol-wide error envelope for every v1 request too.* Rejected as scope creep — v1's five chat methods already shipped and are working; changing their response shape now is an unrelated, unnecessary breaking change to a capability this proposal doesn't otherwise touch.

### 3. `createConversation` drops `parentPath`; `local` is replaced by omitting `firstMessage`

New signature: `createConversation(options?: { deploymentId?: string; firstMessage?: string }): Promise<CreateConversationResponse>`.

- `firstMessage` present (non-blank) → **persist immediately**: resolve `deploymentId` (given, else `DeploymentsContext.selectedItemId`), call the same `apiCreateConversation` + `saveConversation` pair `ConversationRoute.handleCreateConversation` already uses, navigate to the new conversation's route, and resolve with its `OverlayConversation` projection built directly from the create response (a freshly created conversation always has `isPinned: false`, `isReadonly: false`, `sharedWithMe: false`, `publishedWithMe: false`, so no extra fetch is needed to answer the request). `ConversationsContext.refreshConversations()` is invoked so the list-changed effect emits `CONVERSATIONS_UPDATED`; `ConversationPage` mounting for the new id emits `SELECTED_CONVERSATION_LOADED` through its already-existing call.
- `firstMessage` absent/blank → **open the composer, persist nothing**: navigate to `ROUTES.Root` (optionally passing `deploymentId` as router state so the composer pre-selects it, falling back to the composer's own default-deployment resolution otherwise), and resolve with `{ conversation: null }`. Nothing is created until the user (or, once `ConversationPage` mounts after a real send, a subsequent overlay `sendMessage`) actually sends a message — this *is* the "local, invisible until first message" behavior, implemented with the composer route the app already has instead of inventing a parallel draft-storage concept.
- `createLocalConversation()` is defined as `createConversation()` called with no options — i.e., the answer to "is `local: true` equivalent to `createLocalConversation()`" is yes, by construction: both take the omitted-`firstMessage` branch above.
- `parentPath` has no replacement field. This app creates every conversation at the user's bucket root (Context); a host passing the old shape's `parentPath` gets a compile-time error (removed from the type), not a silently-ignored runtime no-op — an explicit break is preferable to an option a caller could easily miss is being dropped.

**Alternatives considered:**
- *Add backend support for message-less conversation creation (Non-Goals option 1).* Rejected for this change — loosening `IsMessageOrAttachmentsPresent` and giving conversations a valid zero-message state affects conversation naming, list display, and every other consumer of "a conversation always has ≥1 message"; too large and risky a change to bundle into overlay method parity.
- *Keep `local?: boolean` as a field alongside `firstMessage` for old-shape closeness.* Rejected — with `firstMessage` already the deciding signal, a separate `local` flag that must agree with it (or be ignored when it doesn't) is dead/confusing API surface; presence/absence of `firstMessage` is unambiguous.
- *Reject `createConversation()` with no `firstMessage` outright (require it always).* Rejected — that would leave `createLocalConversation()` with nothing distinct to do, contradicting the proposal's explicit goal of shipping both methods.

### 4. A second bridge slot on `OverlayContext`: the conversation-list bridge

`OverlayContext` gains `registerConversationListBridge(bridge: ConversationListBridge | null)`, structurally parallel to the existing `registerActiveConversationBridge`. A new hook (e.g. `apps/chat/src/hooks/conversation/useConversationListBridge.ts`) is mounted once, inside `App` — below `ConversationsProvider`/`DeploymentsProvider`, where both contexts are reachable — and registers on mount/dependency-change, unregisters on unmount, exactly like the existing active-conversation bridge's registration effect.

```ts
interface ConversationListBridge {
  getConversations: () => OverlayConversation[];
  createConversation: (options: { deploymentId?: string; firstMessage?: string }) => Promise<CreateConversationResponse>;
  deleteConversation: (id: string) => Promise<DeleteConversationResponse>;
  renameConversation: (id: string, newName: string) => Promise<RenameConversationResponse>;
  selectConversation: (id: string) => Promise<SelectConversationResponse>;
}
```

Its methods are thin adapters over `useConversations()` (`deleteConversation`/`renameConversation` already throw on failure with the API error attached — this bridge catches that and maps it via Decision 2's status→code table) and `useNavigate()`/`useDeployments()` for `createConversation`/`selectConversation`.

`getSelectedConversations()` is answered inside `OverlayContext` itself, not the list bridge: `OverlayContext` already tracks whether an active-conversation bridge is registered (Decision 5 below adds a matching conversation id to that registration). `GET_SELECTED_CONVERSATIONS` returns the one conversation matching that id from `getConversations()`'s current snapshot (falling back to a minimal projection built from the active bridge's own data if the id isn't in the snapshot yet — e.g. immediately after a create, before `refreshConversations()` resolves), or `[]` if no conversation is currently displayed (composer route active, or nothing mounted).

Request routing in `OverlayContext`'s existing `message` handler extends the existing pattern: the seven new `OverlayRequestType` members join a new `CONVERSATION_LIST_REQUEST_TYPES` set (parallel to `ACTIVE_CONVERSATION_REQUEST_TYPES`), executed against the conversation-list bridge (or, for `GET_SELECTED_CONVERSATIONS`/`SELECT_CONVERSATION`, resolved as described above), reusing the exact same trusted-origin check and the same "queue behind `expiresAt` if no bridge is registered yet" fallback already implemented for active-conversation requests (`queuePendingBridgeRequest`/`isRequestExpired`) — because `ConversationsProvider` mounts asynchronously relative to the handshake in principle, even though in practice it is available within one render pass of `READY`.

**Alternatives considered:**
- *Give `ConversationsContext`/`DeploymentsContext` direct knowledge of the overlay protocol (call `postToHost` from inside them).* Rejected — same reasoning the original design used for `ActiveConversationBridge`: keeps overlay-protocol knowledge out of contexts that exist independent of overlay mode, and keeps `OverlayContext` the single owner of the `message` listener and response wire-up.
- *Have the conversation-list bridge call `server-api/conversations.api.ts` directly instead of `ConversationsContext`'s methods.* Rejected for delete/rename — it would create a second, unsynchronized optimistic-update path onto the same list state `ConversationsContext` already manages (double state, risk of divergence). Used directly only for `createConversation`'s persist path, matching what `ConversationRoute` itself already does (there is no `ConversationsContext.createConversation` method to reuse — creation has always lived in the route component).

### 5. `selectConversation` and the persisted `createConversation` path wait for the *matching* active-conversation bridge registration, not just *any* registration

`registerActiveConversationBridge` gains a second parameter: `registerActiveConversationBridge(bridge: ActiveConversationBridge | null, conversationId: string | null)`. `useActiveConversationBridge` (called from `ConversationPage`) passes its own `conversationId` through unchanged — call sites need no new logic, just one more argument threaded from data they already have.

`OverlayContext` keeps a `currentConversationIdRef` updated on every registration call. `selectConversation(id)` and the persisted branch of `createConversation` both: navigate (`getConversationRoute(id)`), then wait for `currentConversationIdRef` to equal the target `id` (polling the existing pending-request queue's timeout/expiry mechanism — no new timer construct) before resolving with that conversation's `OverlayConversation` projection (looked up via the conversation-list bridge's `getConversations()`, refreshed if necessary). If the id never matches before `expiresAt`, the request is dropped exactly like today's active-conversation requests are — for an obviously-invalid id (fails the app's own existence/permission check as soon as the route attempts to load it) this degrades to the request's timeout, which is an accepted trade-off (see Risks) rather than a route-level try/catch this design does not have visibility into.

**Alternatives considered:**
- *Resolve `selectConversation`/`createConversation` as soon as `navigate()` is called, without waiting for the conversation to actually load.* Rejected — a host expecting `selectConversation(id)`'s promise to mean "the conversation is now showing" would get a false positive for an inaccessible id, contradicting the whole point of an explicit-outcome design (Decision 2).

## Risks / Trade-offs

- **[Risk] `selectConversation`/persisted-`createConversation` for an inaccessible id degrade to a timeout, not the explicit `NOT_FOUND` error Decision 2 promises for delete/rename.** Detecting "this id will never load" requires either a cheap existence check before navigating (extra round-trip) or route-level failure visibility `OverlayContext` doesn't have today. → Mitigation: document this one asymmetry clearly in `libs/chat-overlay/README.md` and the `chat-overlay-protocol` spec; a future change can add a pre-navigation existence check (e.g. via `getConversations()`'s own snapshot, or a lightweight metadata call) if this proves a real pain point.
- **[Risk] `createConversation()`'s "local" (no-`firstMessage`) branch silently discards the caller's `deploymentId` if `ConversationRoute` doesn't already support pre-selecting a deployment via router state.** → Mitigation: confirm during `apply` whether `ConversationRoute`/`DeploymentsContext` already support this (`setSelectedItemId` is available); if not, add the minimal state-passing plumbing as part of this change rather than silently dropping the option.
- **[Trade-off] `getConversations()` returns whatever `ConversationsContext.conversations` currently holds — no forced refresh, no pagination.** A host calling it immediately after mount, before the initial `listConversations()` resolves, gets `[]`. → Mitigation: document that hosts should treat `CONVERSATIONS_UPDATED` as the signal to re-call `getConversations()` rather than polling it; matches the prompt's own suggested simplest semantics and avoids introducing a second fetch/pagination path this change doesn't need.
- **[Trade-off] No new feature-flag/role gate.** Authorization for delete/rename/create is entirely the existing per-conversation backend permission check (the same one the regular UI relies on); the overlay surface adds no new privilege a signed-in user didn't already have through the normal UI. → Documented explicitly so a future reviewer doesn't assume a gate exists that doesn't.

## Migration Plan

1. Land the `chat-overlay-protocol` type/enum additions (new request types, `OverlayConversation`, `OverlayConversationError`, response types) with unit tests for any new type guards — no behavior change to the app or library yet.
2. Land the seven `ChatOverlay`/`ChatOverlayManager` methods in `libs/chat-overlay`, unit-tested against a faked iframe — still no app-side handling, so calling them against today's `apps/chat` build times out exactly like calling an unknown method would (safe, inert until step 3 ships).
3. Land the app-side conversation-list bridge and `OverlayContext` routing/error-mapping changes, then the new sandbox case exercising all seven methods end-to-end against a real dev instance.
4. Rollback at any point is a plain revert — no backend/env/config flag is introduced or changed by this migration, so there is nothing to toggle off in production.

## Open Questions

- Whether `ConversationRoute`/`NewConversationComposer` already accept a pre-selected `deploymentId` via router state, or whether this change must add that plumbing (Risks) — confirm during `apply`.
- Exact placement of the new `useConversationListBridge` mount point (inside `App` vs. a new thin wrapper component) — either is fine structurally; pick whichever keeps `apps/chat/src/app/app.tsx` least cluttered, confirmed during `apply`.

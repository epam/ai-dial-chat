## Context

The conversation timeline currently supports two message roles: `MessageRole.User` and `MessageRole.Assistant` (defined in `libs/chat-shared/src/models/chat.ts`). All messages are either user inputs or AI responses; there is no in-band system/status message type.

Model selection lives in `DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`). `selectedItemId` holds the currently active deployment ID. When the user picks a different model in the input bar's dropdown, `setSelectedItemId` is called — but the conversation `messages` array is never touched as a side-effect.

`ConversationView` (`apps/chat/src/pages/Conversation/Conversation.tsx`) reads the conversation's `messages` array and passes each entry to `MessageBubble` (in `libs/conversation-messages`). `MessageBubble` routes to `UserMessageBubble` or `AssistantMessageBubble` based on `role`. Neither bubble currently shows a deployment icon — icons are selector-only (input bar).

`DeploymentIcon` (`libs/conversation-input/src/components/Input/DeploymentIcon.tsx`) already knows how to render a model icon with an image-load fallback; icon URL resolution uses `resolveDeploymentIconUrl` passed as a prop from `apps/chat`.

The `Conversation` page manages `messages` as local React state initialised from the loaded conversation. The backend exposes `POST /api/v1/conversations/:id/messages` (or equivalent) for appending messages; regular user/assistant messages are already persisted through this endpoint after every exchange.

**Figma reference:** [DIAL Chat — Chat, node 613:8730](https://www.figma.com/design/WJEnj2fH07plvGmpXsswle/DIAL-Chat--Chat?node-id=613-8730) — the `section-message` component used as the status message.

## Goals / Non-Goals

**Goals:**

- Automatically insert a status message into the conversation timeline when the active deployment changes during an open conversation.
- Persist the status message to the backend immediately so it survives page reload and appears in all future reopens of the conversation.
- Render the status message as a full-width info banner (per Figma node 613:8730): info-circle icon + bold "Model switched." + regular "The model has been switched from `<prev>` to `<new>`."
- Update the input-bar icon to reflect the new deployment immediately (already happens via `DeploymentsContext`; no extra work needed).
- Show the deployment icon in the header of every `AssistantMessageBubble`, reflecting the deployment that generated that specific response.
- Exclude status messages from the AI streaming payload so they are never sent to DIAL Core.

**Non-Goals:**

- Status messages for other conversation events (temperature change, system-prompt change, addon change) — only model/deployment changes are in scope.
- An undo or revert flow triggered from the status message.
- Displaying status messages in conversation list previews or search results.
- Forwarding `deploymentId` to DIAL Core message routing (the field is stored locally; wiring it to DIAL Core is a separate concern).

## Decisions

### 1. Extend `MessageRole` with a `Status` variant

**Decision:** Add `Status = 'status'` to the `MessageRole` enum in `libs/chat-shared/src/models/chat.ts`.

**Why:** The enum is the canonical discriminator for message rendering. Adding `Status` keeps the routing logic in `MessageBubble` consistent with the existing pattern and makes TypeScript exhaustive-check-friendly. An alternative — using `custom_content.type` on an `Assistant` role message — would contaminate the assistant message shape and require callers to special-case role-agnostic filtering.

**Trade-off:** Any code that filters messages before sending to the AI backend must explicitly exclude `MessageRole.Status`. This is low-risk: the streaming utility already references `MessageRole.User` and `MessageRole.Assistant` explicitly.

### 2. `StatusMessageCustomContent` shape

**Decision:** Add a `StatusMessageCustomContent` interface:

```typescript
export interface StatusMessageCustomContent {
  event_type: 'model_changed';
  previous_deployment_id: string | null;
  new_deployment_id: string;
}
```

Stored on `Message.custom_content` (typed as `MessageCustomContent | StatusMessageCustomContent`). The `event_type` discriminator makes it forward-compatible with future status event types (temperature changed, addon toggled, etc.).

**Why:** Using `custom_content` for status metadata follows the existing extension pattern (`stages`, `attachments`, `configuration_value` all live there). No new top-level fields are added to `Message`.

### 3. `deploymentId` field on `Message`

**Decision:** Add `deploymentId?: string` to the `Message` interface in `libs/chat-shared/src/models/chat.ts`. Populated on every assistant message in `createMessagePair()` using the currently selected deployment ID. Also set on status messages to `new_deployment_id` (redundant but consistent).

**Why:** Storing the deployment ID directly on each assistant message decouples icon rendering from reconstructing model-change history. The renderer can look up `message.deploymentId` in the `deploymentLookup` map directly, without scanning backward through the message list to find the last status message. This is also the only way to correctly attribute the icon when a conversation is loaded with its full history — the lookup happens by message, not by timeline position.

**Alternative considered:** Derive the active deployment per message by scanning the message list for status messages. Rejected — O(n²) scanning, fragile on reload (status messages might be missing from older conversations), and complicates rendering logic.

### 4. Backend DTO extension

**Decision:** Extend `CreateMessageDto` in `apps/chat-api/src/conversations/dto/create-message.dto.ts` with two optional fields:

```typescript
@ApiPropertyOptional()
@IsOptional()
@IsString()
@IsIn(['model_changed'])
eventType?: string;

@ApiPropertyOptional()
@IsOptional()
@IsString()
@MaxLength(500)
deploymentId?: string;
```

The `ConversationService` persists both fields on the message record. The message read path returns them as-is; no special backend logic is needed.

**Why:** `deploymentId` on assistant messages and `eventType` on status messages are the minimum fields needed. `eventType` uses `@IsIn` rather than a full enum validator to stay forward-compatible without a schema migration on every new event type.

**Scope:** The backend stores these fields but does not act on them — no DIAL Core routing change is involved. Regenerating the API client after the DTO change makes the fields available in `@epam/chat-api-client`.

### 5. Hook to watch deployment selection and persist the status message

**Decision:** New `useModelChangeEffect(conversationId: string | undefined, addMessage: (msg: Message) => void): void` hook in `apps/chat/src/hooks/useModelChangeEffect.ts`.

The hook reads `selectedItemId` from `DeploymentsContext`. A `useRef` holds the previous value. On change (and only when `conversationId` is defined):
1. Calls `createModelChangedMessage(previous, selectedItemId)` to build the status message.
2. Calls `addMessage(msg)` to append it to local React state immediately (optimistic update).
3. Calls `postMessage(conversationId, msg)` from `apps/chat/src/server-api/conversations.api.ts` to persist it to the backend. Errors are caught and logged; the message remains in local state even if the persist fails (optimistic — no rollback in this slice).

**Guards:** Effect skips when `conversationId` is undefined, when `prevIdRef.current === selectedItemId` (initial mount), or when `selectedItemId` is null after the change.

```typescript
export function useModelChangeEffect(
  conversationId: string | undefined,
  addMessage: (msg: Message) => void,
) {
  const { selectedItemId } = useDeployments();
  const prevIdRef = useRef<string | null>(selectedItemId);

  useEffect(() => {
    if (!conversationId) return;
    if (prevIdRef.current === selectedItemId) return;

    const previous = prevIdRef.current;
    prevIdRef.current = selectedItemId;

    if (selectedItemId === null) return;

    const msg = createModelChangedMessage(previous, selectedItemId);
    addMessage(msg);
    postMessage(conversationId, msg).catch((err) =>
      console.error('Failed to persist model-change status message', err),
    );
  }, [conversationId, selectedItemId, addMessage]);
}
```

### 6. `createModelChangedMessage()` factory

**Decision:** Add to `apps/chat/src/utils/message-factory.ts`:

```typescript
export function createModelChangedMessage(
  previousDeploymentId: string | null,
  newDeploymentId: string,
): Message {
  return {
    id: crypto.randomUUID(),
    role: MessageRole.Status,
    content: '',
    timestamp: new Date().toISOString(),
    deploymentId: newDeploymentId,
    custom_content: {
      event_type: 'model_changed',
      previous_deployment_id: previousDeploymentId,
      new_deployment_id: newDeploymentId,
    } satisfies StatusMessageCustomContent,
  };
}
```

Also update `createMessagePair()` in the same file to accept `deploymentId: string | undefined` as a new parameter and set it on the assistant message; update all call sites in `Conversation.tsx` to pass `selectedItemId ?? undefined`.

### 7. `StatusMessageBubble` visual design (Figma node 613:8730)

**Figma:** [DIAL Chat — Chat, node 613:8730](https://www.figma.com/design/WJEnj2fH07plvGmpXsswle/DIAL-Chat--Chat?node-id=613-8730) — `section-message` component.

**Decision:** New `StatusMessageBubble` component in `libs/conversation-messages/src/components/MessageBubble/StatusMessageBubble.tsx`.

**Props:**
```typescript
interface StatusMessageBubbleProps {
  eventType: 'model_changed';
  previousDeploymentName: string | null;
  newDeploymentName: string;
}
```

**Visual spec (from Figma):**

The component is a full-width info banner — it is **not** a centred muted row. Structure:

```
┌─────────────────────────────────────────────────────────────┐  bg: var(--background/info)
│  ℹ  [bold] Model switched.  [regular] The model has been    │  border: 1px var(--stroke/info)
│                switched from GPT to Imagen.                 │  border-radius: var(--radius-1)
└─────────────────────────────────────────────────────────────┘  padding: var(--spacing-03) = 12px
```

- **Container:** `flex items-center gap-[var(--spacing-03,12px)] p-[var(--spacing-03,12px)] rounded-[var(--radius-1,4px)] border border-[var(--stroke/info)] bg-[var(--background/info)] overflow-hidden w-full`
- **Icon:** `IconInfoCircleFilled` from `@tabler/icons-react`, size 20, `shrink-0`, color inherits from `text-[color:var(--text&icon/primary)]`
- **Text wrapper:** `flex items-center gap-[var(--spacing-01,4px)] flex-1 min-w-0 text-sm leading-5 text-[color:var(--text&icon/primary)]`
- **Bold prefix:** `<span className="font-semibold shrink-0">{t('conversation.statusMessage.modelChangedTitle')}</span>` → `"Model switched."`
- **Regular description:** `<span className="font-normal flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{t('conversation.statusMessage.modelChangedBody', { from: previousDeploymentName ?? '…', to: newDeploymentName })}</span>` → `"The model has been switched from GPT to Imagen."`

No `MessageActions`, no rating, no copy button.

**Typography (from Figma):**
- Both text nodes: `font-family: var(--typeface/main, 'Inter')`, size 14px (`text-sm`), line height 20px (`leading-5`)
- Title: `font-weight: 600` (`font-semibold`)
- Body: `font-weight: 400` (`font-normal`)

**Note:** The status message uses `IconInfoCircleFilled` (a generic info icon), **not** the deployment icon. The deployment icon appears only in `AssistantMessageBubble` (see Decision 8).

**Library isolation note:** `libs/conversation-messages` must not import from `libs/conversation-input`. `IconInfoCircleFilled` comes from `@tabler/icons-react`, which is already a dependency of the lib.

### 8. Deployment icon in `AssistantMessageBubble`

**Decision:** Add a small deployment icon to the header area of `AssistantMessageBubble`. The icon is passed via new optional props `deploymentIconUrl?: string` and `deploymentDisplayName?: string`. When both are absent the header renders as today (no change for callers that don't pass them).

**Rendering:** A 16 × 16 icon placed to the left of the message content (or in a dedicated `<header>` row above the text). Inline `<img>` with `IconRobot` / `IconApps` fallback, identical pattern to the existing `DeploymentIcon` behaviour.

**How the icon is resolved:** `MessageBubble` receives `deploymentLookup` and reads `deploymentLookup[message.deploymentId]` to get `iconUrl` and `displayName`, then passes them to `AssistantMessageBubble`. When `message.deploymentId` is absent or not found in the lookup (e.g., older messages persisted before this feature shipped), the icon is simply omitted — no fallback icon is shown on legacy messages to avoid misattribution.

### 9. `MessageBubble` routing update

**Decision:** Two changes in `MessageBubble.tsx`:

1. Add the `Status` branch (routes to `StatusMessageBubble`).
2. Pass `deploymentIconUrl` and `deploymentDisplayName` to `AssistantMessageBubble` when `message.deploymentId` resolves in `deploymentLookup`.

`deploymentLookup?: Record<string, { iconUrl?: string; displayName: string }>` is added to `MessageBubbleProps` and populated by `ConversationView`.

### 10. Deployment lookup map in `ConversationView`

**Decision:** In `apps/chat/src/pages/Conversation/Conversation.tsx`, build the `deploymentLookup` map once from `DeploymentsContext.items` using `useMemo`:

```typescript
const deploymentLookup = useMemo(
  () =>
    Object.fromEntries(
      items.map((d) => [
        d.id,
        {
          displayName: d.display_name ?? d.id,
          iconUrl: d.icon_url ? resolveDeploymentIconUrl(d.icon_url) : undefined,
        },
      ]),
    ),
  [items],
);
```

### 11. Excluding status messages from AI streaming

**Decision:** In the streaming payload builder, add:

```typescript
const payloadMessages = messages.filter(
  (m) => m.role !== MessageRole.Status,
);
```

**Why:** Status messages have `content: ''` and a non-standard role — they must never be sent to DIAL Core. One-line defensive guard.

### 12. `postMessage` helper in `conversations.api.ts`

**Decision:** Add `postMessage(conversationId: string, message: Message): Promise<void>` to `apps/chat/src/server-api/conversations.api.ts`. It calls the existing generated client method for creating a conversation message, threading `message.id`, `message.role`, `message.content`, `message.deploymentId`, and `(message.custom_content as StatusMessageCustomContent)?.event_type`.

**Why:** Keeps the server-api abstraction layer intact — the hook calls `postMessage`, not the generated client directly.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Status messages inadvertently sent to AI backend | Explicit `filter(m => m.role !== MessageRole.Status)` in streaming payload builder; covered by a test |
| Library isolation: `conversation-messages` needs deployment icon in `AssistantMessageBubble` without importing `conversation-input` | Inline 5-line image-with-fallback pattern; comment explains why. `IconInfoCircleFilled` in `StatusMessageBubble` is from `@tabler/icons-react`, already a lib dependency — no isolation concern |
| `deploymentLookup` map passed deeply through the message list renderer | Accepted for this slice; if the prop chain grows, a `MessageContext` can carry it in a follow-up |
| Persist call fails silently (optimistic update with no rollback) | Error is logged; status message remains in local state; considered acceptable for a UI-annotation feature |
| `MessageRole.Status` triggers exhaustive-switch warnings in existing switch statements | Fix any TypeScript exhaustive-switch errors that emerge (`never` assertion or explicit `default` case) |
| Older assistant messages (no `deploymentId`) show no icon | Intentional — omitting the icon avoids misattribution; documented as expected behaviour |
| Backend `CreateMessageDto` changes require client regeneration | Covered by a task step; regeneration is already part of the project workflow |
| `previousDeploymentName` may be null for the very first model change (no prior deployment recorded) | Render `"…"` as the `from` value in the description when null; acceptable for the first change |

## Open Questions

1. **Should a status message fire when the model changes before the first user turn** (i.e., `conversationId` not yet defined)? Currently the effect only fires once a conversation exists. A pre-send model switch is not recorded.
2. **Should an undo action appear on the status message** ("Switch back to `<previous model>`")? Deferred — requires `setSelectedItemId` to be callable from a read-only message context.
3. **How should `deploymentId` be populated for assistant messages in streamed responses** — does the streaming hook already receive the deployment ID, or must it be passed explicitly into `startStream`?

# Design: add-like-dislike-api

## Overview

Wire up the DIAL Core rating endpoint (`POST /v1/{modelId}/rate`) end-to-end:
backend BFF domain → typed frontend helper → active-state UI on the assistant message action bar.

The like/dislike icon buttons (`IconThumbUp` / `IconThumbDown`) and their i18n keys already exist in `MessageActions` and `en.json`. This change adds: (1) a BFF endpoint to proxy the rating call, (2) an `activeRating` prop so the UI knows which button is currently active, and (3) toggle wiring from `Conversation.tsx` down through `ConversationView`.

---

## 1. Shared type extension — `libs/chat-shared`

**File:** `libs/chat-shared/src/models/chat.ts`

Add an optional field to `Message`:

```ts
/** User-submitted rating for this message. Only meaningful for assistant messages. */
rating?: 'like' | 'dislike';
```

No other shared-type changes needed.

---

## 2. Backend — `apps/chat-api/src/rate/`

Follow the same domain layout as `apps/chat-api/src/models/`:

```
apps/chat-api/src/rate/
├── dto/
│   └── rate-message.dto.ts
├── rate.controller.ts
├── rate.service.ts
├── rate.module.ts
└── tests/
    ├── rate.controller.spec.ts
    └── rate.service.spec.ts
```

### DTO — `dto/rate-message.dto.ts`

```ts
export class RateMessageDto {
  @IsString() @IsNotEmpty()  conversationId: string;
  @IsString() @IsNotEmpty()  responseId: string;
  @IsString() @IsNotEmpty()  modelId: string;
  @IsIn(['like', 'dislike']) rate: 'like' | 'dislike';
  @IsString() @IsOptional()  comment?: string;
}
```

### Service — `rate.service.ts`

- Extends `AppService` (inherits `this.client` and `this.baseUrl`).
- Method: `async rateMessage(dto: RateMessageDto, accessToken: string): Promise<void>`
- Calls `POST ${this.baseUrl}/v1/${encodeURIComponent(dto.modelId)}/rate` with:
  ```json
  {
    "rate": "<like|dislike>",
    "modelId": "<modelId>",
    "conversationId": "<conversationId>",
    "responseId": "<responseId>",
    "comment": "<comment if present>"
  }
  ```
  Headers: `Authorization: Bearer <accessToken>` (use `getBearerAuthHeaders`).
- On non-2xx: throw the appropriate NestJS HTTP exception via the shared `handleDialError` utility.

### Controller — `rate.controller.ts`

```ts
@ApiTags('rate')
@Controller({ path: 'rate', version: '1' })
export class RateController {
  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async rateMessage(@Body() dto: RateMessageDto, @Req() req: Request): Promise<void> {
    const { at } = req.user as SessionUser;
    return this.rateService.rateMessage(dto, at);
  }
}
```

Returns `204 No Content` on success. Errors propagate as typed NestJS HTTP exceptions.

### Module — `rate.module.ts`

Standard `@Module({ controllers: [RateController], providers: [RateService] })`.

### Registration

Add `RateModule` to `AppModule` imports in `apps/chat-api/src/app/app.module.ts`.

---

## 3. Frontend API helper — `apps/chat/src/server-api/rate.api.ts`

Add endpoint constant to `base.ts`:

```ts
RATE = '/api/v1/rate',
```

New file `rate.api.ts`:

```ts
import { post } from './base.js';
import { ApiEndpoints } from './base.js';

export interface RateMessageRequest {
  conversationId: string;
  responseId: string;
  modelId: string;
  rate: 'like' | 'dislike';
  comment?: string;
}

export const rateMessage = (body: RateMessageRequest): Promise<void> =>
  post<void>(ApiEndpoints.RATE, body);
```

---

## 4. UI — `libs/conversation-messages`

### `MessageActionsProps` — add `activeRating`

**File:** `libs/conversation-messages/src/models/MessageActions.ts`

```ts
/** Currently active rating for this message, if any. */
activeRating?: 'like' | 'dislike';
```

Update `onLike` and `onDislike` JSDoc: callbacks fire whether toggling on or off — the parent decides the new state.

### `MessageActions` — active state + toggle

**File:** `libs/conversation-messages/src/components/Message/MessageActions.tsx`

- Accept `activeRating` prop.
- Wrap both thumbs buttons so clicking the currently-active one calls `onLike()`/`onDislike()` anyway — the parent computes the toggle.
- Apply a highlight class when active: add `isActive` by comparing `activeRating` to `'like'` or `'dislike'`.
  Use the `DialGhostIconButton` `className` prop with a Tailwind class (`text-accent-primary` or `text-[--uikit-accent-primary]`) to tint the icon when active.

---

## 5. Wiring — `apps/chat`

### `buildMessageActions.ts`

Add `onRate?: (messageId: string, rating: 'like' | 'dislike' | null) => void` to `MessageActionHandlers`.

For assistant messages, wire:
```ts
onLike: () => handlers.onRate?.(msg.id, msg.rating === 'like' ? null : 'like'),
onDislike: () => handlers.onRate?.(msg.id, msg.rating === 'dislike' ? null : 'dislike'),
activeRating: msg.rating,
```

### `ConversationView.tsx`

Add `onRateMessage?: (messageId: string, rating: 'like' | 'dislike' | null) => void` to `Props`.
Pass it into `buildMessageActions` as `handlers.onRate`.

### `Conversation.tsx`

Add `handleRateMessage` callback:

```ts
const handleRateMessage = useCallback(
  async (messageId: string, rating: 'like' | 'dislike' | null) => {
    if (!conversation) return;
    const msg = conversation.messages.find((m) => m.id === messageId);
    if (!msg) return;

    // Optimistic update
    setConversation((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === messageId ? { ...m, rating: rating ?? undefined } : m,
        ),
      };
    });

    if (rating !== null) {
      try {
        await rateMessage({
          conversationId: conversation.id,
          responseId: messageId,
          modelId: conversation.model.id,
          rate: rating,
        });
      } catch {
        // Revert optimistic update on failure
        setConversation((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === messageId ? { ...m, rating: msg.rating } : m,
            ),
          };
        });
      }
    }
  },
  [conversation],
);
```

Pass `onRateMessage={handleRateMessage}` to `<ConversationView>`.

---

## 6. Tests

| Layer | File | Coverage |
|---|---|---|
| Backend unit | `rate/tests/rate.service.spec.ts` | rateMessage forwards correct body + headers; non-2xx throws |
| Backend integration | `rate/tests/rate.controller.spec.ts` | POST /api/v1/rate returns 204; invalid body returns 400 |
| Frontend unit | `server-api/tests/rate.api.spec.ts` | `rateMessage` calls post with correct URL/body |
| UI unit | `MessageActions` spec | active state on like/dislike; toggle clears rating |
| App integration | `buildMessageActions` spec | onLike wires toggle; onDislike wires toggle |

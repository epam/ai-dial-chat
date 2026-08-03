# Design: add-like-dislike-api

## Overview

Wire up the DIAL Core rating endpoint (`POST /v1/{modelId}/rate`) end-to-end:
backend BFF domain → generated OpenAPI client → thin frontend wrapper → active-state UI on the assistant message action bar.

The like/dislike icon buttons (`IconThumbUp` / `IconThumbDown`) and their i18n keys already exist in `MessageActions` and `en.json`. This change adds: (1) a BFF endpoint to proxy the rating call, (2) an `activeRating` prop so the UI knows which button is currently active, and (3) toggle wiring from `Conversation.tsx` down through `ConversationView`.

---

## 1. Shared type extension — `libs/chat-shared`

**File:** `libs/chat-shared/src/models/chat.ts`

Add an optional field to `Message`:

Use the numeric shared enum:

```ts
/** User-submitted rating for this message. Only meaningful for assistant messages. */
rating?: MessageRating; // Like = 1, Dislike = -1
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
  @IsIn([1, -1]) rate: MessageRating;
  @IsString() @IsOptional()  comment?: string;
}
```

### Service — `rate.service.ts`

- Extends `AppService` (inherits `this.client` and `this.baseUrl`).
- Method: `async rateMessage(dto: RateMessageDto, accessToken: string): Promise<void>`
- Calls `POST ${this.baseUrl}/v1/${encodeURIComponent(dto.modelId)}/rate` with:
  ```json
  {
    "rate": 1,
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

## 3. OpenAPI and generated client — `libs/chat-api-client`

The BFF endpoint is part of the public frontend contract. After adding the backend
controller and DTO:

- Add the `rate` tag in `apps/chat-api/src/openapi/openapi.config.ts`.
- Run `npm run openapi` so `libs/chat-api-client/openapi.json` contains `/api/v1/rate`
  and `libs/chat-api-client/src/generated/src/apis/RateApi.ts`.
- Run `npm run openapi:check`, `npm exec nx build chat-api-client -- --skip-nx-cache`,
  and `npm exec nx lint chat-api-client`.

Expected generated client:

```ts
class RateApi {
  rateMessage({ rateMessageDto }: { rateMessageDto: RateMessageDto }): Promise<void>;
}
```

---

## 4. Frontend API wrapper — `apps/chat/src/server-api/rate.api.ts`

Expose a thin wrapper over the generated client. Do not add a new `ApiEndpoints.RATE`
entry or call `post()` from `base.ts`.

```ts
import type { RateMessageDto } from '@epam/chat-api-client';
import { rateApi } from './api-client';

export const rateMessage = (body: RateMessageDto): Promise<void> =>
  rateApi.rateMessage({ rateMessageDto: body });
```

---

## 5. UI — `libs/conversation-messages`

### `MessageActionsProps` — add `activeRating`

**File:** `libs/conversation-messages/src/models/MessageActions.ts`

```ts
/** Currently active rating for this message, if any. */
activeRating?: MessageRating;
```

Update `onLike` and `onDislike` JSDoc: callbacks fire whether toggling on or off — the parent decides the new state.

### `MessageActions` — active state + toggle

**File:** `libs/conversation-messages/src/components/Message/MessageActions.tsx`

- Accept `activeRating` prop.
- Wrap both thumbs buttons so clicking the currently-active one calls `onLike()`/`onDislike()` anyway — the parent computes the toggle.
- Apply a highlight class when active: add `isActive` by comparing `activeRating` to `MessageRating.Like` or `MessageRating.Dislike`.
  Use the `GhostIconButton` `className` prop with a Tailwind class (`text-accent-primary` or `text-[--uikit-accent-primary]`) to tint the icon when active.

---

## 6. Wiring — `apps/chat`

### `buildMessageActions.ts`

Add `onRate?: (messageId: string, rating: MessageRating | null) => void` to `MessageActionHandlers`.

For assistant messages, wire:
```ts
onLike: () => handlers.onRate?.(msg.id, msg.rating === MessageRating.Like ? null : MessageRating.Like),
onDislike: () => handlers.onRate?.(msg.id, msg.rating === MessageRating.Dislike ? null : MessageRating.Dislike),
activeRating: msg.rating,
```

### `ConversationView.tsx`

Add `onRateMessage?: (messageId: string, rating: MessageRating | null) => void` to `Props`.
Pass it into `buildMessageActions` as `handlers.onRate`.

### `Conversation.tsx`

Add `handleRateMessage` callback:

```ts
const handleRateMessage = useCallback(
  async (messageId: string, rating: MessageRating | null) => {
    if (!conversationId || !conversation) return;
    const msg = conversation.messages.find((m) => m.id === messageId);
    if (!msg) return;

    const previousRating = msg.rating;
    const conversationPath = conversationId.substring(conversationId.indexOf('/') + 1);
    const updatedConversation = {
      ...conversation,
      messages: conversation.messages.map((m) =>
        m.id === messageId ? { ...m, rating: rating ?? undefined } : m,
      ),
    };

    setConversation(updatedConversation);

    if (rating !== null) {
      try {
        await rateMessage({
          conversationId: conversation.id,
          responseId: messageId,
          modelId: conversation.model.id,
          rate: rating,
        });
        await saveConversation(conversationPath, updatedConversation);
      } catch {
        // Revert optimistic update on failure
        setConversation((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === messageId ? { ...m, rating: previousRating } : m,
            ),
          };
        });
      }
    } else {
      await saveConversation(conversationPath, updatedConversation).catch(() => {
        setConversation((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === messageId ? { ...m, rating: previousRating } : m,
                ),
              }
            : prev,
        );
      });
    }
  },
  [conversation, conversationId],
);
```

Pass `onRateMessage={handleRateMessage}` to `<ConversationView>`.

---

## 7. Tests

| Layer | File | Coverage |
|---|---|---|
| Backend unit | `rate/tests/rate.service.spec.ts` | rateMessage forwards correct body + headers; non-2xx throws |
| Backend integration | `rate/tests/rate.controller.spec.ts` | POST /api/v1/rate returns 204; invalid body returns 400 |
| Generated client | `libs/chat-api-client` build/lint + `npm run openapi:check` | `RateApi.rateMessage` exists and is strongly typed |
| Frontend unit | `server-api/tests/rate.api.spec.ts` | `rateMessage` delegates to generated `RateApi` with the correct body |
| UI unit | `MessageActions` spec | active state on like/dislike; toggle clears rating |
| App integration | `buildMessageActions` spec | onLike wires toggle; onDislike wires toggle |

## Why

Users currently have no way to signal whether an AI response was helpful or not. Adding thumbs-up / thumbs-down rating buttons on assistant messages closes this feedback loop by forwarding ratings to the DIAL Core rating endpoint (`POST /v1/{modelId}/rate`), which existing DIAL infrastructure already supports.

## What Changes

- **New backend domain** `apps/chat-api/src/rate/` — `POST /api/v1/rate` endpoint that validates the request, forwards it to the DIAL Core rating API with the user's access token, and returns 204 on success.
- **Generated frontend API integration** — Swagger/OpenAPI generation adds `RateApi` to `@epam/chat-api-client`; `apps/chat/src/server-api/rate.api.ts` is a thin wrapper over the generated client.
- **Extended `MessageActions`** in `libs/conversation-messages` — assistant message actions now include thumbs-up and thumbs-down icon buttons; the active rating is highlighted; clicking the same rating again deselects it (toggle).
- **New i18n keys** in `apps/chat/src/i18n/locales/en.json` for aria-labels and tooltips.
- **Extended `Message` type** in `libs/chat-shared` — optional numeric `rating?: MessageRating` field to persist the current rating in conversation state.

## Capabilities

### New Capabilities

- `message-rating`: BFF endpoint `POST /api/v1/rate` that proxies rating calls to DIAL Core; generated `RateApi` client wrapper; thumbs-up/thumbs-down UI on assistant message actions; rating state stored in the `Message` type.

### Modified Capabilities

- `conversation-messages-display`: Assistant message bubble's action row gains two new icon buttons (like / dislike); `onRate` callback prop added to `MessageBubble` and `ConversationView`.

## Impact

- `apps/chat-api/src/rate/` — new NestJS domain (controller, service, module, DTO)
- `apps/chat-api/src/app/app.module.ts` — register `RateModule`
- `apps/chat-api/src/openapi/openapi.config.ts` — add `rate` tag
- `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated/` — regenerate generated client with `RateApi`
- `apps/chat/src/server-api/api-client.ts` — expose generated `rateApi` singleton
- `libs/chat-shared/src/models/chat.ts` — add `rating` field to `Message`
- `libs/conversation-messages/src/` — `MessageBubble` props extended; new like/dislike buttons in assistant actions
- `apps/chat/src/server-api/rate.api.ts` — new wrapper over generated `RateApi`
- `apps/chat/src/pages/Conversation/Conversation.tsx` — wire `onRate` handler
- `apps/chat/src/i18n/locales/en.json` — new keys: `actions.like`, `actions.dislike`

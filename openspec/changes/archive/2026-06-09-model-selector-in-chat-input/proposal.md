## Why

The conversation input currently sends every message to a hardcoded model (`anthropic.claude-v3-sonnet`), ignoring the unified catalog that already loads available models and applications. Users need a visible, accessible selector inside the input to choose which deployment drives their conversation before they send the first message.

## What Changes

- Extend `ConversationInputProps` and `InputProps` with typed model-selector props (`catalogItems`, `selectedCatalogItemId`, `onSelectedCatalogItemChange`, and four label strings).
- Add a `DialDropdownIcon`/`DialIconDropdown` trigger inside the `Input` component that opens a menu of catalog items, positioned according to the Figma layouts.
- Wire `apps/chat` app-level components (`ConversationRoute`, `ConversationView`) to read from `useCatalog()` and pass selector data into `ConversationInput`.
- Update `CreateConversationDto` to accept a required `catalogItemId` field and remove the hardcoded model from `ConversationService.createConversation`.
- Regenerate `@epam/chat-api-client` after the DTO change.
- Add i18n keys for all selector strings (`catalog.selector.*`).
- Add/update tests for the lib component, app-level wiring, and backend contract.

## Capabilities

### New Capabilities

- `catalog-model-selector`: UI dropdown inside the conversation input that lets the user pick a model or application from the catalog before sending; covers component API, icon/label rendering, loading/error/empty states, accessibility, and send-blocking when no item is selected.
- `conversation-deployment-selection`: Backend and frontend contract change that carries the user-selected `catalogItemId` from the UI through `CreateConversationDto` to `ConversationService`; removes the hardcoded model; covers DTO validation, Swagger metadata, and client regeneration.

### Modified Capabilities

- `conversations-api`: `CreateConversationDto` gains a required `catalogItemId` field with `@IsString`, `@MinLength(1)`, and `@MaxLength(256)` — this is a **BREAKING** change to the POST body shape. Scenarios for 400 on missing/invalid `catalogItemId` are added; the 201 response shape is otherwise unchanged.
- `unified-catalog`: `CatalogContext.selectedItemId` is now consumed by the input selector and sent with conversation creation; the context's `setSelectedItemId` is updated when the user changes the dropdown selection. No changes to the server-side spec.

## Impact

- **`libs/conversation-input`** — `ConversationInput.tsx`, `Input.tsx`, `ConversationInput.ts`, `Input.ts`; new props, new UI element, new tests.
- **`apps/chat/src/components/ConversationView/ConversationView.tsx`** and related pages — pass catalog selector props; call `useCatalog()`.
- **`apps/chat-api/src/conversations/dto/create-conversation.dto.ts`** — add `catalogItemId`.
- **`apps/chat-api/src/conversations/conversation.service.ts`** — remove hardcoded model; use `catalogItemId` from DTO.
- **`@epam/chat-api-client`** — regenerated after DTO change (`npm run openapi` + build).
- **`apps/chat/src/server-api/conversations.api.ts`** — updated to pass `catalogItemId`.
- **`apps/chat/src/i18n/locales/en.json`** — new `catalog.selector.*` keys.
- **`apps/chat/src/context/CatalogContext.tsx`** — no structural changes; `setSelectedItemId` is now consumed by the selector.
- No changes to DIAL Core APIs, `ModelsContext`, or the catalog server-side endpoint.

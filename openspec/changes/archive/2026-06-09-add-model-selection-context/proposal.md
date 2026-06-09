## Why

Users currently have no way to choose which AI model powers a conversation before creating it. All conversations use the server-side default, which removes control over cost, capability, and latency trade-offs. Adding model selection at the initial chat input gives users explicit control from the very first message, matching the Figma design for the initial chat input (node 33:4536) and the full-page menu layout with open model dropdown (node 27:4520).

## What Changes

- **New `ModelsContext`** (`apps/chat/src/context/ModelsContext.tsx`) loads the available model list once on app startup and exposes `models`, `selectedModelId`, `setSelectedModelId`, `isLoading`, and `error` through the tree. Follows the `ThemeContext` pattern exactly: `createContext<T | undefined>(undefined)`, `useMemo` on value, provider-guard hook.
- **New `useModels()` hook** in the same file — throws a clear error when used outside `ModelsProvider`.
- **`ModelsProvider` added to `apps/chat/src/main.tsx`** wrapping the authenticated app shell after `UserProvider`.
- **New `ModelSelectorButton` component** (`apps/chat/src/components/ModelSelector/ModelSelectorButton.tsx`) renders the model icon + chevron button and its dropdown list, as shown in Figma's `.chat-input-agent-select` element. Tests in `components/ModelSelector/tests/`.
- **`ConversationInput` lib extended with `rightControls?: ReactNode`** in `libs/conversation-input/src/models/ConversationInput.ts` and rendered inside the `right_controls` area of the input bar. This is the minimal lib change required to keep model-specific logic out of the library while matching the Figma layout.
- **`ConversationRoute` updated** (`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`) to consume `useModels()`, pass `<ModelSelectorButton>` as `rightControls`, and forward `selectedModelId` in `handleSend`.
- **`conversations.api.ts` updated** (`apps/chat/src/server-api/conversations.api.ts`) to accept an optional `modelId` parameter and pass it to the generated client.
- **Backend `CreateConversationDto` extended** with optional `modelId?: string` (`apps/chat-api/src/conversations/dto/create-conversation.dto.ts`). Inspection of the DTO confirms `modelId` is absent — this is the minimum backend change required to carry model identity to the conversation record. The field is optional to remain backward-compatible.
- **Generated client regenerated** after the DTO change (`npm exec nx build chat-api-client --skip-nx-cache`).
- **New i18n keys** added to `apps/chat/src/i18n/locales/en.json` under the `models` domain.

## Capabilities

### New Capabilities

- `model-selection-context`: Covers the full lifecycle — loading models at startup, exposing them through React Context, presenting a model selector in the initial chat input, and passing the selected model id to conversation creation.

### Modified Capabilities

_None — no existing spec files have requirement-level changes._

## Impact

| Area | Change |
|---|---|
| `apps/chat/src/context/ModelsContext.tsx` | New file |
| `apps/chat/src/main.tsx` | Add `ModelsProvider` |
| `apps/chat/src/components/ModelSelector/` | New `ModelSelectorButton` component |
| `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` | Consume `useModels`, pass `rightControls`, forward `modelId` |
| `apps/chat/src/server-api/conversations.api.ts` | Thread `modelId` parameter |
| `apps/chat/src/i18n/locales/en.json` | New `models.*` i18n keys |
| `libs/conversation-input/src/models/ConversationInput.ts` | Add `rightControls?: ReactNode` to `ConversationInputProps` |
| `libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx` | Render `rightControls` in input bar |
| `apps/chat-api/src/conversations/dto/create-conversation.dto.ts` | Add optional `modelId?: string` |
| `libs/chat-api-client/` | Regenerated after DTO change |

**Scope note:** The `libs/conversation-input` change (adding `rightControls`) is additive and backward-compatible — all existing usages pass no `rightControls` and are unaffected.

**i18n:** New user-visible strings are introduced (model selector aria-label, loading state, error state, empty state). All go through `react-i18next` under the `models` domain key.

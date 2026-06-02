## 1. Inspect and orient

- [x] 1.1 Read `apps/chat/src/context/ThemeContext.tsx` and `apps/chat/src/context/auth/UserContext.tsx` end-to-end to confirm the provider pattern (createContext, useMemo value, guard hook) before writing `ModelsContext`
- [x] 1.2 Read `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` end-to-end to understand the current `handleSend` flow and how `ConversationInput` is used
- [x] 1.3 Read `libs/conversation-input/src/models/ConversationInput.ts` and `libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx` to confirm the props interface and the location of the `right_controls` render area
- [x] 1.4 Read `apps/chat/src/server-api/models.ts` and `apps/chat/src/server-api/conversations.api.ts` to confirm the existing `getModels()` and `createConversation()` signatures
- [x] 1.5 Read `apps/chat-api/src/conversations/dto/create-conversation.dto.ts` to confirm `modelId` is absent before adding it
- [x] 1.6 Read `apps/chat/src/main.tsx` to confirm the current provider nesting order before inserting `ModelsProvider`

## 2. Add model context and hook

- [x] 2.1 Create `apps/chat/src/context/ModelsContext.tsx` with `ModelsContextType`, `ModelsContext`, `ModelsProvider`, and `useModels()` following the `ThemeContext` pattern — `createContext<ModelsContextType | undefined>(undefined)`, `useMemo` on context value, guard hook that throws when used outside provider
- [x] 2.2 In `ModelsProvider`, load models on mount via `getModels()` from `apps/chat/src/server-api/models.ts` using a `useEffect` with a cancelled flag; set `models`, `selectedModelId` (default to `models[0]?.id ?? null`), `isLoading`, and `error` state
- [x] 2.3 Export `ModelsContextType`, `ModelsContext`, `ModelsProvider`, and `useModels` from `apps/chat/src/context/ModelsContext.tsx`

## 3. Wire provider into app startup

- [x] 3.1 Import `ModelsProvider` in `apps/chat/src/main.tsx` and wrap the authenticated app shell with it, nested inside `UserProvider` and after `ThemeProvider` per the ordering documented in `design.md`

## 4. Extend `ConversationInput` with a `rightControls` slot

- [ ] 4.1 Add `rightControls?: ReactNode` to `ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts`; add `import type { ReactNode } from 'react'` if not already present
- [ ] 4.2 Render `{rightControls}` inside the `right_controls` container in `libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx`; existing behaviour is unchanged when prop is omitted
- [ ] 4.3 Update the public exports in `libs/conversation-input/src/index.ts` if `ConversationInputProps` is not already re-exported

## 5. Build the `ModelSelectorButton` component

- [ ] 5.1 Create `apps/chat/src/components/ModelSelector/ModelSelectorButton.tsx` with `ModelSelectorButtonProps` interface (`models`, `selectedModelId`, `onSelect`, `isLoading`, `error`) and `export const ModelSelectorButton: FC<ModelSelectorButtonProps>`
- [ ] 5.2 Implement the trigger `<button>` with `aria-haspopup="listbox"`, `aria-expanded`, and `aria-label={t('models.selector.label')}`; use `IconRobot` from `@tabler/icons-react` as the placeholder model icon and `IconChevronDown`/`IconChevronUp` for the chevron; apply the `rgba(125,164,255,0.36)` background when open using `clsx`
- [ ] 5.3 Implement the dropdown `<ul role="listbox">` rendered when open; each `<li role="option" aria-selected={...}>` shows the 18 × 18 icon and `model.display_name ?? model.id` label; close on outside click using a `useEffect` + `document.addEventListener('mousedown', ...)`
- [ ] 5.4 Implement keyboard navigation: `↓`/`↑` move focus between options, `Enter`/`Space` selects, `Escape` closes and returns focus to the trigger button; manage a `focusedIndex` local state
- [ ] 5.5 Implement loading state: trigger button has `disabled` and `aria-busy="true"` when `isLoading` is true
- [ ] 5.6 Implement error state: trigger button has `disabled` and `aria-label={t('models.selector.errorLabel')}` when `error` is non-null
- [ ] 5.7 Implement empty state: trigger button has `disabled` and `aria-label={t('models.selector.emptyLabel')}` when `models` is an empty array and `isLoading` is false

## 6. Wire model selector into `ConversationRoute`

- [ ] 6.1 Update `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` to call `useModels()` and destructure `models`, `selectedModelId`, `setSelectedModelId`, `isLoading`, `error`
- [ ] 6.2 Pass `rightControls={<ModelSelectorButton models={models} selectedModelId={selectedModelId} onSelect={setSelectedModelId} isLoading={isLoading} error={error} />}` to `<ConversationInput>`
- [ ] 6.3 Update `handleSend` to call `apiCreateConversation(message, selectedModelId ?? undefined)` so the selected model id is forwarded

## 7. Extend conversation creation to accept `modelId`

- [ ] 7.1 Add optional `modelId?: string` with `@IsOptional()`, `@IsString()`, and `@MaxLength(500)` decorators to `CreateConversationDto` in `apps/chat-api/src/conversations/dto/create-conversation.dto.ts`; add `@ApiPropertyOptional` for Swagger
- [ ] 7.2 Update `ConversationService.createConversation()` in `apps/chat-api/src/conversations/conversation.service.ts` to accept and persist `modelId` on the created conversation record (field stored, not yet forwarded to DIAL Core)
- [ ] 7.3 Update `ConversationController.createConversation()` to pass `dto.modelId` to the service call
- [ ] 7.4 Regenerate the API client: `npm exec nx build chat-api-client --skip-nx-cache`
- [ ] 7.5 Update `createConversation()` in `apps/chat/src/server-api/conversations.api.ts` to accept `modelId?: string` and include it in `createConversationDto`

## 8. Add i18n keys

- [ ] 8.1 Add the following keys to `apps/chat/src/i18n/locales/en.json` under a `"models"` top-level object:
  ```json
  "models": {
    "selector": {
      "label": "Select model",
      "openLabel": "Close model selector",
      "emptyLabel": "No models available",
      "errorLabel": "Failed to load models",
      "listLabel": "Available models",
      "optionLabel": "Select {{modelId}}"
    }
  }
  ```

## 9. Add tests

- [ ] 9.1 Create `apps/chat/src/context/tests/ModelsContext.spec.tsx`; test: provider loads models on mount, sets default `selectedModelId` to first model, exposes updated `selectedModelId` after `setSelectedModelId` call, sets `error` on fetch failure, `useModels` throws when used outside provider
- [ ] 9.2 Create `apps/chat/src/components/ModelSelector/tests/ModelSelectorButton.spec.tsx`; test: renders trigger button with aria attributes, opens dropdown on click, selects model on option click and calls `onSelect`, closes on Escape and returns focus to trigger, renders disabled when `isLoading`, renders disabled when `error` is non-null, renders disabled when `models` is empty
- [ ] 9.3 Create `apps/chat/src/pages/ConversationRoute/tests/ConversationRoute.spec.tsx` (or update existing); test: `createConversation` is called with `modelId` matching the selected model when form is submitted, `createConversation` is called without `modelId` when `selectedModelId` is null
- [ ] 9.4 Add or update backend unit tests in `apps/chat-api/src/conversations/conversation.controller.spec.ts` and `conversation.service.spec.ts`: `POST /api/v1/conversations` with valid `modelId` succeeds (201), without `modelId` succeeds (201), with `modelId` longer than 500 chars returns 400

## 10. Final verification

- [ ] 10.1 Run `npm exec nx lint conversation-input` — no lint errors in the lib after `rightControls` addition
- [ ] 10.2 Run `npm exec nx build conversation-input` — lib builds cleanly
- [ ] 10.3 Run `npm exec nx lint chat-api-client` — generated client passes lint after regeneration
- [ ] 10.4 Run `npm exec nx build chat-api-client` — generated client builds cleanly
- [ ] 10.5 Run `npm exec nx lint chat-api` — no lint errors in backend after DTO change
- [ ] 10.6 Run `npm exec nx test chat-api` — all backend tests pass
- [ ] 10.7 Run `npm exec nx build chat-api` — backend compiles cleanly
- [ ] 10.8 Run `npm exec nx lint chat` — no lint errors in frontend after all changes
- [ ] 10.9 Run `npm exec nx test chat` — all frontend tests pass
- [ ] 10.10 Run `npm exec nx build chat` — frontend compiles cleanly

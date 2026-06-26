## 1. Shared Types (libs/chat-shared)

- [x] 1.1 Create `libs/chat-shared/src/models/deployment-features.ts` exporting `ResponseFormat` enum (`Markdown = 'markdown'`, `PlainText = 'plain_text'`) and `DeploymentFeatures` interface (`systemPrompt: boolean`, `temperature: boolean`, `responseFormat?: boolean`)
- [x] 1.2 Re-export `DeploymentFeatures` and `ResponseFormat` from `libs/chat-shared/src/index.ts`

## 2. Backend — DeploymentItemDto & Mapping (apps/chat-api)

- [x] 2.1 Add `DeploymentFeaturesDto` class in `apps/chat-api/src/deployments/dto/deployment-item.dto.ts` with `@ApiProperty` decorators for `systemPrompt` and `temperature`
- [x] 2.2 Add `@ApiPropertyOptional({ type: DeploymentFeaturesDto }) features?: DeploymentFeaturesDto` to `DeploymentItemDto`
- [x] 2.3 Update the deployment mapping logic in `DeploymentsService` to read `features` from the DIAL Core payload and assign it to `DeploymentItemDto.features` when present
- [x] 2.4 Verify `npm exec nx run chat-api:build` passes with no type errors

## 3. conversation-input lib — ChatSettingsConfig prop and modal

- [x] 3.1 Add `ExtraMenuItem` interface and `extraMenuItems?: ExtraMenuItem[]` prop to `AddAttachmentButtonProps` in `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx`; append items to the menu list
- [x] 3.2 Export `ChatSettingsValues` and `ChatSettingsConfig` interfaces from `libs/conversation-input/src/models/Input.ts` (`ChatSettingsValues` includes `responseFormat?: ResponseFormat`, `systemPrompt?: string`, `temperature?: number`; `ChatSettingsConfig` includes `features`, `responseFormat`, `systemPrompt`, `temperature`, `onSave`, plus all label props and `backLabel`)
- [x] 3.3 Add `chatSettings?: ChatSettingsConfig` to `AddAttachmentButtonProps` and pass it through `Input` → `ConversationInput` → app
- [x] 3.4 Create `libs/conversation-input/src/components/ChatSettingsModal/ChatSettingsModal.tsx` — `DialPopup` modal with `responseFormat` radio group (gated by `features.responseFormat`), system prompt textarea (gated by `features.systemPrompt`), and temperature slider (gated by `features.temperature`)
- [x] 3.5 Create `libs/conversation-input/src/components/ChatSettingsBottomSheet/ChatSettingsBottomSheet.tsx` — stacked bottom sheet with same field set and gating rules; accepts `onBack` callback for navigation
- [x] 3.6 Wire `ChatSettingsModal` (desktop) and `ChatSettingsBottomSheet` (mobile) into `AddAttachmentButton`; open on "Chat settings" item click
- [x] 3.7 Verify `npm exec nx run conversation-input:build` passes with no type errors

## 4. Wire "Chat settings" entry into the + dropdown (apps/chat)

- [x] 4.1 In the app-level component that renders `ConversationInput` (e.g., `ConversationView.tsx`), build the `chatSettings` object with the current conversation's `prompt`, `temperature`, `responseFormat`, `features`, and translated label props
- [x] 4.2 Pass `chatSettings` to `ConversationInput`
- [x] 4.3 On `ChatSettingsModal` `onSave`, dispatch the update to conversation state (`prompt`, `temperature`, and/or `responseFormat` fields)
- [x] 4.4 Add i18n keys for all modal label props to `apps/chat/src/i18n/locales/en.json`

## 5. Verification

- [x] 5.1 Run `npm exec nx run chat-api:lint` and `npm exec nx run chat-api:build` — no errors
- [x] 5.2 Run `npm exec nx run conversation-input:lint` and `npm exec nx run conversation-input:build` — no errors
- [x] 5.3 Run `npm exec nx run chat:lint` and `npm exec nx run chat:build` — no errors
- [ ] 5.4 Start the dev server and confirm "Chat settings" item is always present in the `+` dropdown for all deployments
- [ ] 5.5 Confirm the modal opens, pre-fills current values, saves correctly, and cancels without side effects

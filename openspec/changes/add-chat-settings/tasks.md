## 1. Shared Types (libs/chat-shared)

- [x] 1.1 Create `libs/chat-shared/src/models/deployment-features.ts` exporting the `DeploymentFeatures` interface (`systemPrompt: boolean`, `temperature: boolean`)
- [x] 1.2 Re-export `DeploymentFeatures` from `libs/chat-shared/src/index.ts`

## 2. Backend — DeploymentItemDto & Mapping (apps/chat-api)

- [x] 2.1 Add `DeploymentFeaturesDto` class in `apps/chat-api/src/deployments/dto/deployment-item.dto.ts` with `@ApiProperty` decorators for `systemPrompt` and `temperature`
- [x] 2.2 Add `@ApiPropertyOptional({ type: DeploymentFeaturesDto }) features?: DeploymentFeaturesDto` to `DeploymentItemDto`
- [x] 2.3 Update the deployment mapping logic in `DeploymentsService` to read `features` from the DIAL Core payload and assign it to `DeploymentItemDto.features` when present
- [x] 2.4 Verify `npm exec nx run chat-api:build` passes with no type errors

## 3. conversation-input lib — extraMenuItems prop threading

- [x] 3.1 Add `extraMenuItems?: DropdownMenuItem[]` prop to `AddAttachmentButtonProps` in `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx` and append items to the menu list
- [x] 3.2 Add `extraMenuItems?: DropdownMenuItem[]` to `InputProps` in `libs/conversation-input/src/models/Input.ts` and pass it through to `AddAttachmentButton` in `Input.tsx`
- [x] 3.3 Add `extraMenuItems?: DropdownMenuItem[]` to `ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts` and pass it through to `Input` in `ConversationInput.tsx`
- [x] 3.4 Verify `npm exec nx run conversation-input:build` passes with no type errors

## 4. ChatSettingsModal component (apps/chat)

- [x] 4.1 Create `apps/chat/src/components/ChatSettingsModal/ChatSettingsModal.tsx` with the modal UI: system prompt textarea (shown when `features.systemPrompt`) and temperature input (shown when `features.temperature`), Save and Cancel actions, all labels as props
- [x] 4.2 Add i18n keys for "Chat settings" title, "System prompt" label, "Temperature" label, "Save", "Cancel" to `apps/chat/src/i18n/locales/en.json`

## 5. Wire "Chat settings" entry into the + dropdown (apps/chat)

- [x] 5.1 In the app-level component that renders `ConversationInput` (e.g., `ConversationView.tsx`), build the `extraMenuItems` array always including the "Chat settings" item (with settings icon and translated label)
- [x] 5.2 Pass `extraMenuItems` to `ConversationInput`
- [x] 5.3 On "Chat settings" item click, open `ChatSettingsModal` with the current conversation's `prompt` and `temperature` values
- [x] 5.4 On `ChatSettingsModal` `onSave`, dispatch the update to conversation state (`prompt` and/or `temperature` fields)

## 6. Verification

- [x] 6.1 Run `npm exec nx run chat-api:lint` and `npm exec nx run chat-api:build` — no errors
- [x] 6.2 Run `npm exec nx run conversation-input:lint` and `npm exec nx run conversation-input:build` — no errors
- [x] 6.3 Run `npm exec nx run chat:lint` and `npm exec nx run chat:build` — no errors (pre-existing typecheck failures in spec/AttachmentCard not from this change)
- [ ] 6.4 Start the dev server and confirm "Chat settings" item is always present in the `+` dropdown for all deployments
- [ ] 6.5 Confirm the modal opens, pre-fills current values, saves correctly, and cancels without side effects

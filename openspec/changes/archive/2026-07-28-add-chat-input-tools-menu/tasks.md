**Slicing strategy:** Vertical — each slice delivers one working path through the stack that can be independently verified before widening to the next concern.

## 1. Shared types and backend config

- [x] 1.1 Add `ToolMenuItem` interface to `libs/chat-shared/src/models/tool-menu-item.ts` with fields `id: string`, `label: string`, `icon: ReactNode`, `isSelected: boolean`. Export from the lib barrel (`libs/chat-shared/src/index.ts`). **Architecture guard:** verify the new file imports nothing from apps, server-api, generated clients, contexts, or env.
- [x] 1.2 Add `DEEP_RESEARCH_TOOL_ID` to `apps/chat-api/src/config/environment.config.ts` as an optional `@IsString()` field with `@IsOptional()`. No default value — absence means `null`.
- [x] 1.3 Add a `deepResearchToolId` config definition to `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` with `visibility: 'client'`, `envVar: 'DEEP_RESEARCH_TOOL_ID'`, `defaultValue: null`. Follow the `defaultDeploymentId` pattern.
- [x] 1.4 Add `deepResearchToolId: string | null` to `apps/chat-api/src/app-config/dto/client-config-response.dto.ts` (`ClientConfigDto`) with `@ApiPropertyOptional({ type: String, nullable: true })`.
- [x] 1.5 Add `deepResearchToolId: string | null` to the frontend `AppConfigState.config` type in `apps/chat/src/context/AppConfigContext.tsx`.
- [x] 1.6 Verify slice: `npm exec nx lint chat-api && npm exec nx test chat-api && npm exec nx lint @epam/ai-dial-chat-shared`.

## 2. Lib UI contract — tools menu in AddAttachmentButton

- [x] 2.1 Add `toolsMenuItems?: ToolMenuItem[]` and `onToolToggle?: (toolId: string) => void` props to `AddAttachmentButton` in `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx`. Also add `toolsMenuTitle?: string` label prop (default `"Tools"`).
- [x] 2.2 Implement desktop tools submenu rendering inside the existing `DialDropdown` items. When `toolsMenuItems` is non-empty, render a "Tools" item (`IconTool` icon, `aria-haspopup="menu"`, chevron `iconAfter` with `rtl:scale-x-[-1]`) that opens a nested submenu panel with tool toggle rows. Each row: icon + label + conditional `IconCheck` trailing icon. Clicking a row calls `onToolToggle(item.id)`.
- [x] 2.3 Implement mobile tools bottom sheet. When `toolsMenuItems` is non-empty, render a "Tools" item in the mobile bottom sheet that navigates to a stacked `ToolsBottomSheet` component. Rows match desktop: icon + label + trailing check. Back button returns to main menu. Follow the `ChatSettingsBottomSheet` stacking pattern.
- [x] 2.4 Ensure RTL correctness: submenu chevron uses `rtl:scale-x-[-1]`, all spacing uses logical classes (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`).
- [x] 2.5 Add `toolsMenuItems` and `onToolToggle` pass-through props to `InputProps` in `libs/conversation-input/src/models/Input.ts` and thread them through `Input.tsx` → `AddAttachmentButton`. Also add `toolsMenuTitle` label prop.
- [x] 2.6 **Architecture guard:** verify `libs/conversation-input/src/` does not contain any imports from `@epam/chat-api-client`, `apps/`, app contexts, server-api, env, feature flags, storage, analytics, routing, or generated clients.
- [x] 2.7 Verify slice: `npm exec nx lint @epam/ai-dial-conversation-input && npm exec nx test @epam/ai-dial-conversation-input`.

## 3. App-layer hook — useToolsMenu

- [x] 3.1 Create `apps/chat/src/hooks/conversation/useToolsMenu.ts`. The hook reads `useAppConfig().config.deepResearchToolId` and `useDeployments().selectedDeploymentConfiguration`. It extracts the matching boolean property, manages toggle state with `useState`, resets on `selectedDeploymentId` change via `useEffect`, and exposes: `toolsMenuItems: ToolMenuItem[]` (memoized), `onToolToggle: (id: string) => void` (useCallback), `toolConfigurationValue: Record<string, boolean>` (memoized). JSDoc explains why the hook exists.
- [x] 3.2 Add `IconTelescope` (from `@tabler/icons-react`) as the Deep Research tool icon, rendered with `aria-hidden`. Use `IconTool` for the top-level menu item (passed as `toolsMenuTitle` label).
- [x] 3.3 Handle edge cases: `deepResearchToolId` is `null` → return empty array; `selectedDeploymentConfiguration` is `null` → return empty array; property exists but is not boolean-typed → return empty array.
- [x] 3.4 Verify slice: `npm exec nx lint @epam/chat && npm exec nx test @epam/chat`.

## 4. Wire tools into conversation view and completion request

- [x] 4.1 In `apps/chat/src/components/ConversationView/ConversationView.tsx`, call `useToolsMenu()` and pass `toolsMenuItems`, `onToolToggle`, and i18n-resolved `toolsMenuTitle` as props to `ConversationInput` → `Input` → `AddAttachmentButton`.
- [x] 4.2 In `apps/chat/src/hooks/conversation/useConversationHandlers.ts`, accept `toolConfigurationValue: Record<string, boolean>` as a parameter (or obtain from `useToolsMenu` if the hook is composed there). Merge `toolConfigurationValue` into the `customContent` passed to `startStream` (spread after existing `configuration_value` / `form_value`). Ensure `handleSend` sends `{ configuration_value: { ...toolConfigurationValue } }` as part of `customContent`.
- [x] 4.3 In `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`, call `useToolsMenu()` and merge `toolConfigurationValue` into the `configurationValue` argument of `apiCreateConversation` for new conversation flows. Ensure `handleStarterSelect` merges starter config with tool config.
- [x] 4.4 Verify slice: `npm exec nx lint @epam/chat && npm exec nx test @epam/chat`.

## 5. Backend test verification

- [x] 5.1 Add/update a test in `apps/chat-api/src/conversations/conversation.service.spec.ts` (or appropriate test file) that asserts: when `customContent.configuration_value` contains `{ deep_research: true }`, the DIAL Core request body includes `custom_fields: { configuration: { deep_research: true } }`. This proves the existing mapping handles tool values correctly without backend code changes.
- [x] 5.2 Add a test in `apps/chat-api/src/app-config/` verifying that when `DEEP_RESEARCH_TOOL_ID` env var is set, `ClientConfigDto.deepResearchToolId` is the string value; when unset, it is `null`.
- [x] 5.3 Verify slice: `npm exec nx test chat-api`.

## 6. Frontend component and hook tests

- [x] 6.1 Add unit tests for `useToolsMenu` at `apps/chat/src/hooks/conversation/tests/useToolsMenu.spec.ts`. Cover: empty when config is null, empty when schema lacks property, single item when property matches, toggle state changes, reset on deployment change, memoization stability.
- [x] 6.2 Add component tests for tools submenu rendering in `libs/conversation-input/src/components/AddAttachmentButton/tests/AddAttachmentButton.tools.spec.tsx`. Cover: no Tools item when `toolsMenuItems` is empty, Tools item renders when array is non-empty, toggle callback fires on click, check icon visibility matches `isSelected`.
- [x] 6.3 Verify slice: `npm exec nx test @epam/ai-dial-conversation-input && npm exec nx test @epam/chat`.

## 7. i18n keys

- [x] 7.1 Add keys to `apps/chat/src/i18n/locales/en.json`: `"tools.menuTitle": "Tools"`, `"tools.deepResearchFallback": "Deep research"`.
- [x] 7.2 Pass translated labels from the app layer (via `useTranslation`) as props to `ConversationInput` / `AddAttachmentButton`. The lib never calls `useTranslation` directly.

## 8. RTL and accessibility verification

- [x] 8.1 Verify RTL: with `dir="rtl"` on `<html>`, confirm the Tools submenu panel opens to the inline-start side, chevron icons are mirrored, and all spacing uses logical properties. No physical `ml-*`/`mr-*`/`left-*`/`right-*` in new code.
- [x] 8.2 Verify accessibility: keyboard navigation through Tools submenu (Arrow keys, Enter/Space toggle, Escape closes), `aria-haspopup="menu"` on trigger, `aria-expanded` toggles, decorative icons have `aria-hidden="true"`, tool labels are the accessible names.

## 9. Final verification

- [x] 9.1 Run full affected check: `npm exec nx affected --target=lint --base=origin/development-1.0 && npm exec nx affected --target=test --base=origin/development-1.0 && npm exec nx affected --target=build --base=origin/development-1.0`.
- [x] 9.2 Run `npm run openapi && npm run openapi:check` to confirm the new `deepResearchToolId` field appears in `ClientConfigDto` OpenAPI spec and generated client builds cleanly.

## 10. Selected-tools chip row

- [x] 10.1 Create `libs/conversation-input/src/components/SelectedToolsChips/SelectedToolsChips.tsx` and `SelectedToolsChips.module.scss`. Desktop: one chip per selected tool (icon + label + close button). Mobile: single consolidated chip (first-tool icon or `IconTool` + count label). SCSS uses three-tier CSS var chains (`--ci-chip-*`, `--design-token`, `#hex`).
- [x] 10.2 Add `ToolsChipLabels` interface to `libs/conversation-input/src/models/Input.ts` and `toolsChipLabels?: ToolsChipLabels` prop to `InputProps`. Export `ToolsChipLabels` from the lib barrel.
- [x] 10.3 Wire chips into `Input.tsx` layout. Selecting a tool forces stacked layout (`hasSelectedTools` added to `isStackedLayout`). Chips row renders at `order-2 basis-full` (forces its own row in `flex-wrap`); `+` button moves to `order-3`; right actions move to `order-4` when chips are present.
- [x] 10.4 Add `toolsChipLabels?: ToolsChipLabels` to `ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts`; it auto-forwards to `Input` via the `{...inputProps}` spread in `ConversationInput.tsx`.
- [x] 10.5 Thread `toolsChipLabels` through `ConversationView` → `NewConversationComposer` → `Conversation` → `ConversationRoute`. Add i18n keys `tools.selectedCount_one`, `tools.selectedCount_other`, `tools.removeTool` and `ToolsI18nKeys.SelectedCount`/`RemoveTool` enum members. App layer constructs `toolsChipLabels` with `t()` calls.

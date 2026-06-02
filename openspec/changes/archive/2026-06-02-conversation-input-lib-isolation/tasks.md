## 1. Shared model — Add `DeploymentItem` to `libs/chat-shared`

- [x] 1.1 Create `libs/chat-shared/src/models/deployment.ts` exporting `DeploymentItem` interface with fields `id: string`, `displayName?: string`, `iconUrl?: string`
- [x] 1.2 Re-export `DeploymentItem` from `libs/chat-shared/src/index.ts`
- [x] 1.3 Verify: `pnpm nx lint chat-shared` passes; `pnpm nx build chat-shared -- --skip-nx-cache` passes

## 2. Lib models — Replace `DeploymentItemDto` with `DeploymentItem`

- [x] 2.1 In `libs/conversation-input/src/models/Input.ts`:
  - Replace `import { DeploymentItemDto } from '@epam/chat-api-client'` with `import { DeploymentItem } from '@epam/ai-dial-chat-shared'` (path alias `@epam/ai-dial-chat-shared/*`)
  - Change `deployments?: DeploymentItemDto[]` to `deployments?: DeploymentItem[]`
  - Make `resolveDeploymentIconUrl` unconditionally required: `resolveDeploymentIconUrl: (iconUrl: string) => string | undefined`
  - Update JSDoc on both props accordingly
- [x] 2.2 In `libs/conversation-input/src/models/ConversationInput.ts`:
  - Apply the same import swap and type changes for `deployments` and `resolveDeploymentIconUrl`
- [x] 2.3 Verify: `pnpm nx lint conversation-input` passes

## 3. Lib hook — Update `useModelSelector` item type

- [x] 3.1 In `libs/conversation-input/src/hooks/useModelSelector.tsx`:
  - Replace the `DeploymentItemDto` import/reference with `DeploymentItem` from `@epam/ai-dial-chat-shared`
  - Ensure `resolveDeploymentIconUrl` type in `UseModelSelectorOptions` matches the updated signature (`(iconUrl: string) => string | undefined`, required)
  - Confirm icon resolution for both the selector trigger and menu items still uses the passed resolver (no import of `resolveIconUrl`)
- [x] 3.2 Verify: `pnpm nx lint conversation-input` passes; `pnpm nx build conversation-input -- --skip-nx-cache` passes

## 4. Lib component — Remove `resolveIconUrl` import from `ModelSelectorBottomSheet`

- [x] 4.1 In `libs/conversation-input/src/components/ModelSelectorBottomSheet/ModelSelectorBottomSheet.tsx`:
  - Remove the `import { resolveIconUrl } from '../../utils/resolveIconUrl.js'` import
  - Update `ModelSelectorBottomSheetProps.deployments` type from `DeploymentItemDto[]` to `DeploymentItem[]`
  - Added `resolveDeploymentIconUrl` as a required prop; component calls it instead of the removed import
- [x] 4.2 Verify: `pnpm nx lint conversation-input` passes

## 5. Lib component — Update `Input.tsx` to make resolver required and remove default

- [x] 5.1 In `libs/conversation-input/src/components/Input/Input.tsx`:
  - Remove the default value `resolveIconUrl` from the `resolveDeploymentIconUrl` prop destructuring
  - Ensure `resolveDeploymentIconUrl` is forwarded to `useModelSelector` as before
  - Ensure the updated `ModelSelectorBottomSheet` receives what it needs (pre-resolved icons or the resolver, per the approach chosen in step 4)
- [x] 5.2 Verify: `pnpm nx build conversation-input -- --skip-nx-cache` has no TypeScript errors

## 6. Lib utility — Strip `/api` URL construction from `resolveIconUrl.ts`

- [x] 6.1 In `libs/conversation-input/src/utils/resolveIconUrl.ts`:
  - Remove `dialFileIdToDownloadUrl` function entirely
  - Remove the `if (lower.startsWith('files/'))` branch from `resolveIconUrl`
  - Remove the `//TO-DO: need to move from conversation-input` comment
  - Kept the name `resolveIconUrl` (still used for safe-URL checks within the lib)
- [x] 6.2 Verify: `pnpm nx lint conversation-input` passes

## 7. Lib utility — Update tests for `resolveIconUrl`

- [x] 7.1 No dedicated test file for `resolveIconUrl` existed. Updated `Input.spec.tsx` model-selector tests to pass the now-required `resolveDeploymentIconUrl` prop. The `useModelSelector.spec.tsx` `files/bucket/icon.png` test validates the resolver is called with raw iconUrl — still correct, no change needed.
- [x] 7.2 Verify: `pnpm nx test conversation-input` passes — 97/97 tests pass

## 8. App — Update `ConversationRoute` to pass resolver and mapped items

- [x] 8.1 In `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`:
  - Added imports for `resolveCatalogIconUrl` and `DeploymentItem`
  - Added `deploymentItems` mapping (DTO fields are already camelCase, so it's a direct pick)
  - Pass `deployments={deploymentItems}` and `resolveDeploymentIconUrl={resolveCatalogIconUrl}` to `<ConversationInput>`
- [x] 8.2 Verify: `pnpm nx lint chat` passes

## 9. App — Update `ConversationView` to use `DeploymentItem` mapping

- [x] 9.1 In `apps/chat/src/components/ConversationView/ConversationView.tsx`:
  - Added `DeploymentItem` type import; added `deploymentItems` mapping
  - Pass `deployments={deploymentItems}` instead of `deployments={items}`
  - Confirmed `resolveDeploymentIconUrl={resolveCatalogIconUrl}` prop is present
- [x] 9.2 Verify: `pnpm nx lint chat` passes — 180/180 tests pass

## 10. Architecture guard — Scan hand-authored libs for host-owned integration knowledge

- [x] 10.1 Ran architecture guard grep on source files (excluding `dist/` and `chat-api-client/`) — zero matches
- [x] 10.2 No remaining violations
- [x] 10.3 Zero matches confirmed

## 11. Pre-resolve refactor — Remove resolver prop, use iconUrl directly

Switched to pre-resolve approach: app maps raw DTOs to `DeploymentItem` with resolved `iconUrl` before passing to lib. Lib uses `item.iconUrl` directly everywhere.

- [x] 11.1 Removed `resolveDeploymentIconUrl` from `InputProps`, `ConversationInputProps`, `UseModelSelectorOptions`
- [x] 11.2 Updated `useModelSelector.tsx` to use `selectedItem?.iconUrl` and `item.iconUrl` directly (no resolver call)
- [x] 11.3 Updated `ModelSelectorBottomSheet.tsx` to use `item.iconUrl` directly
- [x] 11.4 Deleted `libs/conversation-input/src/utils/resolveIconUrl.ts` (no remaining usages)
- [x] 11.5 Updated app callers (`ConversationRoute`, `ConversationView`) to pre-resolve `iconUrl` in `deploymentItems` mapping
- [x] 11.6 Updated `Input.spec.tsx` — removed `resolveDeploymentIconUrl={noopResolver}` from all test calls
- [x] 11.7 Updated `useModelSelector.spec.tsx` — removed `noopResolver`, removed resolver-specific tests, updated to pass pre-resolved iconUrl in fixture

## 12. Final verification

- [x] 12.1 `nx lint @epam/ai-dial-conversation-input` — pass (warnings are pre-existing)
- [x] 12.2 `nx test @epam/ai-dial-conversation-input` — 96/96 tests pass
- [x] 12.3 `nx lint @epam/chat` — pass
- [x] 12.4 `nx build @epam/chat` — pass
- [x] 12.5 Architecture guard: zero `/api/v1`, `chat-api-client`, `server-api` matches in hand-authored lib sources

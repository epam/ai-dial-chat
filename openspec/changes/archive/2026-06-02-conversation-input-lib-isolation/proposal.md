## Why

`libs/conversation-input` currently constructs the app-owned URL `/api/v1/files/download?...` inside `resolveIconUrl.ts` and imports that function directly in `ModelSelectorBottomSheet.tsx`. This couples the library to a backend route it must not know about, violates the module boundary rule enforced by `@nx/enforce-module-boundaries`, and makes the lib non-reusable outside `apps/chat`. The TODO comment in the file (`//TO-DO: need to move from conversation-input`) acknowledges this.

The `Input` component already accepts an optional `resolveDeploymentIconUrl` prop with the lib-internal resolver as the default, and `ConversationView` already passes `resolveCatalogIconUrl` (from `apps/chat/src/utils/icon-path.ts`) as the resolver. However, three problems remain:

1. The default prop value falls back to `resolveIconUrl`, so `ConversationRoute` — which does not pass the prop — still silently uses the lib's URL-constructing fallback.
2. `ModelSelectorBottomSheet.tsx` imports `resolveIconUrl` directly, bypassing the prop entirely.
3. `DeploymentItemDto` (a generated API client type) is imported by the lib as the canonical deployments item shape, coupling lib props to the generated client's DTO structure.

## What Changes

- Remove `dialFileIdToDownloadUrl` and all `/api` URL construction from `libs/conversation-input/src/utils/resolveIconUrl.ts`; keep only the safe-URL guard (absolute, root-relative, data:).
- Make `resolveDeploymentIconUrl` a **required** prop on `InputProps` and `ConversationInputProps` (remove the default); update `ModelSelectorBottomSheet` to accept and use the prop instead of the direct import.
- Update `ConversationRoute` to pass `resolveCatalogIconUrl` alongside `ConversationView`.
- Introduce a narrow `DeploymentItem` UI model in `libs/chat-shared` (or inline in `conversation-input`) so the lib does not import `DeploymentItemDto` from the generated client.
- Add an architecture guard (grep) task confirming no hand-authored lib sources contain `/api`, `@epam/chat-api-client`, or `server-api` references.

## Capabilities

### Modified Capabilities

- `conversation-input/icon-resolution`: Icon URL resolution moves fully to app-owned `resolveCatalogIconUrl` in `apps/chat/src/utils/icon-path.ts`. The lib's `resolveIconUrl` utility loses the `files/` branch and the `/api` URL builder; it becomes a safe-URL guard only. `ModelSelectorBottomSheet` and `useModelSelector` receive the resolver through props/options, not through a direct import.
- `conversation-input/deployment-props`: `InputProps.deployments` changes type from generated `DeploymentItemDto[]` to a narrow host-agnostic `DeploymentItem` interface (`id`, `displayName`, `iconUrl`); `useModelSelector` uses the same narrow type. The app-level callers map `DeploymentItemDto` to `DeploymentItem` before passing.
- `chat/icon-resolution`: `apps/chat/src/utils/icon-path.ts` becomes the single authoritative place for DIAL icon URL resolution; `resolveCatalogIconUrl` is passed into both `ConversationView` and `ConversationRoute`.

## Impact

- **`libs/conversation-input/src/utils/resolveIconUrl.ts`** — remove `dialFileIdToDownloadUrl` and the `files/` branch; update tests.
- **`libs/conversation-input/src/models/Input.ts`** — `resolveDeploymentIconUrl` becomes required; `deployments` type changes from `DeploymentItemDto[]` to `DeploymentItem[]`.
- **`libs/conversation-input/src/models/ConversationInput.ts`** — same required-prop and type changes.
- **`libs/conversation-input/src/hooks/useModelSelector.tsx`** — `resolveDeploymentIconUrl` already required in options; update the `deployments` item type.
- **`libs/conversation-input/src/components/ModelSelectorBottomSheet/ModelSelectorBottomSheet.tsx`** — accept `resolveDeploymentIconUrl` as a prop instead of importing `resolveIconUrl`; update the item type.
- **`libs/conversation-input/src/components/Input/Input.tsx`** — remove the default `resolveIconUrl` fallback; forward the now-required resolver down to `ModelSelectorBottomSheet`.
- **`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`** — pass `resolveDeploymentIconUrl={resolveCatalogIconUrl}` and map `DeploymentItemDto` to `DeploymentItem` before passing `deployments`.
- **`apps/chat/src/components/ConversationView/ConversationView.tsx`** — map `DeploymentItemDto` to `DeploymentItem` (already passes the resolver).
- **`libs/chat-shared/src/` or `libs/conversation-input/src/models/`** — add `DeploymentItem` narrow UI model.
- No changes to `libs/chat-api-client`, backend endpoints, or OpenAPI generated files.

## Non-Goals

- Changing `libs/chat-api-client` or backend endpoints.
- Hand-editing any OpenAPI generated file.
- Introducing `deploymentsItems` view-model state into `DeploymentsContext` (out of scope for this slice; the app callers map inline before passing props).
- Changing the DIAL Core file download endpoint or BFF route.
- Removing the theme-relative icon resolution path from `resolveCatalogIconUrl`.

## Open Questions

1. **DeploymentItem location** — Should the narrow UI model live in `libs/chat-shared` (reusable by future libs) or be an exported type from `libs/conversation-input/src/models/`? `chat-shared` is the cleaner option if other libs may consume deployments, but it adds a cross-lib dependency step. _Recommendation: put it in `libs/chat-shared` to keep `conversation-input` and any future consumers aligned._
2. **Resolver signature** — Should `resolveDeploymentIconUrl` remain `(iconUrl: string) => string | undefined` or widen to `(item: DeploymentItem) => string | undefined` so the app can use the full item when resolving (e.g., falling back to `displayName` for theme icons)? _Recommendation: keep the narrow `(iconUrl: string) => string | undefined` for now; the app can close over the full item in a wrapper if needed._
3. **ModelSelectorBottomSheet prop threading** — The resolver currently does not reach `ModelSelectorBottomSheet` through props. Should it be threaded through `InputProps → Input → ModelSelectorBottomSheet`, or should `useModelSelector` pre-resolve all icons so the bottom sheet receives ready-to-use URLs? _Recommendation: pre-resolve in `useModelSelector` and pass resolved icon nodes/URLs down; the bottom sheet then needs no resolver at all._

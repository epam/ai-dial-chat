## Context

`libs/conversation-input` violates the library isolation rule in two places:

1. **`resolveIconUrl.ts`** calls `dialFileIdToDownloadUrl` which constructs `/api/v1/files/download?bucket=...&path=...` — an app-owned BFF route — inside a hand-authored lib.
2. **`ModelSelectorBottomSheet.tsx`** imports `resolveIconUrl` directly from `../../utils/resolveIconUrl.js` instead of receiving the resolver through props.
3. **`InputProps.deployments`** is typed as `DeploymentItemDto[]` — a generated client DTO — inside a hand-authored lib.

The app-side resolver `resolveCatalogIconUrl` (at `apps/chat/src/utils/icon-path.ts`) already handles all three icon formats (absolute URLs, DIAL file IDs, theme-relative names). `ConversationView` passes it correctly. `ConversationRoute` does not.

## Goals / Non-Goals

**Goals:**

- Remove the `/api/v1/files/download` URL construction from `libs/conversation-input`.
- Make `resolveDeploymentIconUrl` a required prop throughout the lib; eliminate the unsafe default.
- Thread the resolver into `ModelSelectorBottomSheet` by pre-resolving icons in `useModelSelector` (bottom sheet receives finished `ReactNode` icons, not raw `iconUrl` strings).
- Replace `DeploymentItemDto` with a narrow `DeploymentItem` host-agnostic interface in `libs/chat-shared`.
- Pass `resolveCatalogIconUrl` and map `DeploymentItemDto → DeploymentItem` in `ConversationRoute`.

**Non-Goals:**

- Changing `libs/chat-api-client`, backend endpoints, or OpenAPI generated files.
- Introducing `deploymentsItems` view-model state into `DeploymentsContext`.
- Changing the BFF download endpoint or theme icon endpoint.
- Altering the visual appearance of the model selector.

## Decisions

### 1. `DeploymentItem` lives in `libs/chat-shared`

**Decision:** Add `DeploymentItem` interface to `libs/chat-shared/src/models/deployment.ts`:

```ts
export interface DeploymentItem {
  id: string;
  displayName?: string;
  iconUrl?: string;
}
```

**Rationale:** `libs/chat-shared` is the designated home for shared TypeScript interfaces. Placing `DeploymentItem` there keeps `conversation-input` free of any generated-client dependency and makes the shape reusable by future libs.

**Alternative considered:** Inline the type in `libs/conversation-input/src/models/Input.ts`. Rejected because it would duplicate the type if other libs need it and doesn't follow the established pattern of putting shared types in `chat-shared`.

---

### 2. Icons pre-resolved in `useModelSelector`; `ModelSelectorBottomSheet` receives `ReactNode`

**Decision:** `useModelSelector` resolves all icon URLs (via the `resolveDeploymentIconUrl` option it already receives) and builds `ReactNode` icons before returning. `ModelSelectorBottomSheet` props carry the resolved icon nodes and never call any resolver itself. Remove the `resolveIconUrl` import from `ModelSelectorBottomSheet.tsx`.

**Rationale:** Keeps the resolver logic in one place (the hook) and removes the need to thread another prop through the component tree. `useModelSelector` already builds icon nodes for the desktop dropdown; applying the same pattern to the bottom-sheet items is the minimal, consistent fix.

**Alternative considered:** Thread `resolveDeploymentIconUrl` from `InputProps` → `Input` → `ModelSelectorBottomSheet` as a new prop. Rejected because it widens the props surface and still leaves icon-building scattered across two components.

---

### 3. `resolveDeploymentIconUrl` becomes required in `InputProps` / `ConversationInputProps`

**Decision:** Remove the `?` optional marker and the default value (`resolveIconUrl`) from `InputProps.resolveDeploymentIconUrl`. App callers must pass the prop explicitly.

**Rationale:** The optional-with-default pattern silently let `ConversationRoute` skip the prop and fall back to the lib's URL-constructing resolver. Making it required forces every caller to provide an app-owned resolver at compile time, which TypeScript enforces without additional runtime checks.

**Consequence:** `ConversationRoute` must be updated to pass `resolveCatalogIconUrl` (already available in the app).

---

### 4. `resolveIconUrl` utility retains only the safe-URL guard

**Decision:** Strip `dialFileIdToDownloadUrl` and the `files/` branch from `resolveIconUrl`. The remaining logic checks whether a URL is absolute, root-relative (`/`), or `data:`, and returns it or `undefined`. Rename or inline if the remaining function is trivial enough.

**Rationale:** A safe-URL guard has no host knowledge. Moving `dialFileIdToDownloadUrl` out removes the violation. The guard may still be used internally within the lib (e.g., for attachment previews) without violating isolation.

---

### 5. App callers map `DeploymentItemDto → DeploymentItem` inline

**Decision:** In `ConversationView` and `ConversationRoute`, map `items` from `useDeployments()` to `DeploymentItem[]` before passing the `deployments` prop:

```ts
const deploymentItems: DeploymentItem[] = items.map(({ id, display_name, icon_url }) => ({
  id,
  displayName: display_name,
  iconUrl: icon_url,
}));
```

This mapping stays at the app edge; the lib never sees the generated DTO.

**Rationale:** No new context or hook is introduced. The mapping is a one-liner per call site and keeps the change minimal. A `deploymentsItems` context-level view model would be cleaner at scale, but is out of scope for this isolation fix.

---

## Component / Hook API Changes

### `libs/chat-shared/src/models/deployment.ts` (new file)

```ts
export interface DeploymentItem {
  id: string;
  displayName?: string;
  iconUrl?: string;
}
```

### `libs/conversation-input/src/models/Input.ts` (changed props)

| Prop | Before | After |
|---|---|---|
| `deployments` | `DeploymentItemDto[] \| undefined` | `DeploymentItem[] \| undefined` |
| `resolveDeploymentIconUrl` | `((iconUrl: string) => string \| undefined) \| undefined` (optional, default `resolveIconUrl`) | `(iconUrl: string) => string \| undefined` (**required** when `deployments` is passed) — or always required |

> **Note on conditionality:** Because TypeScript cannot easily express "required when sibling prop is defined," make `resolveDeploymentIconUrl` unconditionally required. App callers already supply it; the added explicitness prevents future regressions.

### `libs/conversation-input/src/components/ModelSelectorBottomSheet/ModelSelectorBottomSheet.tsx` (changed props)

Remove `resolveIconUrl` import. Accept `deploymentIcons: Map<string, ReactNode>` (or pre-resolved icon nodes alongside the items) produced by `useModelSelector`. The exact shape should match what the hook already builds for the desktop menu items.

### `apps/chat/src/utils/icon-path.ts` (no changes)

`resolveCatalogIconUrl` is the app-owned resolver. No changes needed.

### `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` (new prop)

Add `resolveDeploymentIconUrl={resolveCatalogIconUrl}` and the `DeploymentItemDto → DeploymentItem` mapping.

### `apps/chat/src/components/ConversationView/ConversationView.tsx` (type change)

Add the `DeploymentItemDto → DeploymentItem` mapping (already passes the resolver).

## Risks / Trade-offs

- **Required prop is a breaking change for any external consumer of `ConversationInput`** — Acceptable risk because the lib is an internal workspace package, not published to npm, and all current call sites are in `apps/chat`.
- **`resolveIconUrl` partial removal** — If other code in the lib calls `resolveIconUrl` for non-deployment scenarios (e.g., attachment previews), stripping the `files/` branch may affect those paths. Audit all call sites before removing.
- **`DeploymentItem` vs future schema drift** — Adding `display_name` / `icon_url` field names from the generated DTO as camelCase `displayName` / `iconUrl` in the UI model means the mapping is stable as long as the DTO fields do not rename. Document the mapping in the task.

## Migration Plan

1. Add `DeploymentItem` to `libs/chat-shared`.
2. Update `conversation-input` models, hook, and components (remove `resolveIconUrl` import from `ModelSelectorBottomSheet`, make resolver required).
3. Strip the `/api` branch from `resolveIconUrl.ts`; update its tests.
4. Update app callers (`ConversationRoute`, `ConversationView`) to map DTOs and pass the resolver.
5. Run architecture guard: `grep -r '/api\|chat-api-client\|server-api' libs/ --include='*.ts' --include='*.tsx' --exclude-dir='chat-api-client'`.
6. Run lint + typecheck + tests for affected projects.

**Rollback:** Revert all changes. No state, no endpoints, no generated files are modified.

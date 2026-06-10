## Context

`ConversationService.createConversation` currently hard-codes `model: { id: 'anthropic.claude-v3-sonnet' }` (line ~50 in `apps/chat-api/src/conversations/conversation.service.ts`). `CreateConversationDto` has no field for the desired deployment. The frontend `ConversationRoute` and `ConversationView` call `apiCreateConversation(message, attachments)` without any model selection. A `CatalogContext` already exists on `feat/catalog` with `items`, `selectedItemId`, and `setSelectedItemId` — it is mounted in `apps/chat/src/main.tsx` and is ready to be consumed.

The `libs/conversation-input` library already has an attachment menu using `DialDropdown` and `DialGhostIconButton`. The model selector extends this input with a second interactive element: a `DialDropdownIcon` trigger for picking the active deployment. The library is app-agnostic and must not import React context or i18n hooks.

Figma reference nodes define the target layout and must be treated as the source of truth:

- Closed input state: https://www.figma.com/design/WJEnj2fH07plvGmpXsswle/DIAL-Chat--Chat?node-id=27-1476&t=uxgXjAa2KtXTxRPP-0
- Open model selector state: https://www.figma.com/design/WJEnj2fH07plvGmpXsswle/DIAL-Chat--Chat?node-id=27-4520&t=uxgXjAa2KtXTxRPP-0

Due to Figma MCP quota limits, the design is based on the user-provided screenshots and general DIAL Chat design patterns; implementors must verify spacing, icon size, and placement against those nodes before merging.

## Goals / Non-Goals

**Goals:**
- Add a `DialDropdownIcon` model-selector into the `Input` component that renders catalog items as menu options.
- Wire `apps/chat` app-level components to read from `useCatalog()` and pass typed selector props to `ConversationInput`.
- Add `catalogItemId` to `CreateConversationDto` and remove the hardcoded model from `ConversationService`.
- Regenerate `@epam/chat-api-client` and update the `conversations.api.ts` wrapper.
- Block send when no catalog item is selected.

**Non-Goals:**
- Redesigning the overall chat input layout beyond the selector element.
- Replacing `CatalogContext` with `ModelsContext` or merging the two.
- Fetching catalog data inside `libs/conversation-input`.
- Changing DIAL Core APIs or the `GET /api/v1/catalog` endpoint.
- Implementing marketplace / "add model" behavior.
- Streaming-while-selecting or changing the deployment of an in-progress conversation.

## Decisions

### 1. Component API — props over context in the lib

**Decision:** `ConversationInputProps` and `InputProps` receive typed selector props (`catalogItems`, `selectedCatalogItemId`, `onSelectedCatalogItemChange`, and four label strings) rather than consuming `CatalogContext` directly.

**Rationale:** `libs/conversation-input` is app-agnostic. Pulling in a context would couple it to `apps/chat` and break reuse. Prop-passing also makes unit tests trivial — no provider wrapping needed.

**Alternative considered:** Re-export the context from the lib. Rejected because it would force the lib to know about `CatalogItemDto` and the context shape, creating a hard dependency on the app layer.

---

### 2. Selector trigger — `DialDropdownIcon` with `iconUrl` or tabler fallback

**Decision:** Use `DialDropdownIcon` (the correct export — `DialIconDropdown` does not exist in the installed package). The trigger `icon` prop renders an `<img>` when `selectedItem.iconUrl` is defined, otherwise falls back to `<IconRobot size={18} />` from `@tabler/icons-react`.

**Rationale:** `DialDropdownIcon` accepts `icon: ReactNode`, giving full control over the trigger graphic. The `iconUrl` from `CatalogItemDto` is served by DIAL Core — using it makes the selector visually match the deployment's branding.

**Alternative considered:** Always use a static tabler icon. Rejected because the Figma design expects deployment-specific icons where available.

---

### 3. Send-blocking when no deployment is selected

**Decision:** When `selectedCatalogItemId` is `null` or `undefined`, the send button is disabled and pressing Enter does not fire `onSend`. The input shows the `modelSelectorLoadingLabel` while `isLoading === true` and `modelSelectorErrorLabel` while `error !== null`.

**Rationale:** Sending to an unknown deployment would result in a backend 400. Blocking in the UI surfaces the issue immediately.

**Alternative considered:** Allow send and let the backend return 400. Rejected — silent failures are a worse UX than a disabled button with a clear reason.

---

### 4. Conversation creation contract naming — `catalogItemId`

**Decision:** The new `CreateConversationDto` field is named `catalogItemId` (not `deploymentId` or `modelId`).

**Rationale:** The value is exactly `CatalogItemDto.id` — the identifier the frontend already holds from `CatalogContext.selectedItemId`. Using `catalogItemId` makes the contract self-documenting: callers know exactly which id to supply without needing to know the internal DIAL Core terminology. The backend maps it to `conversation.model.id` and `assistantModelId` transparently. Validation includes a character allowlist (`@Matches(/^[\w.\-:@/]+$/)`) to reject ids with embedded whitespace or other unsafe characters before they reach DIAL Core.

**Alternative considered:** `deploymentId` — matches DIAL Core terminology but is ambiguous at the API boundary (not all callers know which deployments are available; they know which catalog items they have). Rejected in favour of the more explicit source-of-truth name.

---

### 5. App-level wiring — `useCatalog()` in pages, not in `ConversationInput`

**Decision:** `ConversationRoute` and `ConversationView` each call `useCatalog()` and pass the result into `ConversationInput` as props. `ConversationView` additionally reads `conversation.model.id` as the currently active deployment for follow-up messages.

**Rationale:** Pages already own send/stop/stream orchestration. Adding catalog selection at the same level keeps the data flow explicit and colocates the "which deployment is active" logic next to "which conversation are we in".

---

### 6. Figma mapping and selector placement

**Decision:** The `DialDropdownIcon` trigger sits in the right-side action group of the input toolbar, matching the Figma layout. The `+` add menu remains the leftmost control. The toolbar order is:

`[AddMenu] [Textarea] [OptionalToolsDropdown] [ModelSelector] [Microphone/Send/Stop]`

The model selector trigger is compact and icon-only with a caret. The selected catalog item name is exposed through the trigger accessible label and shown in the dropdown menu, not rendered as visible toolbar text. Loading, error, and empty states must not expand the toolbar with long visible text; they should use a disabled trigger/menu item and accessible labels/tooltips as appropriate.

**Note:** Exact spacing (gap, icon size, padding) MUST be verified against the Figma nodes `27:1476` and `27:4520` before implementation is merged.

---

### 7. Selected-item disappears after catalog reload

**Decision:** When `CatalogContext` reloads (re-fetch on mount only in this slice), if the previously `selectedItemId` is no longer present in the new `items` list, the context falls back to `items[0]?.id ?? null`. No migration of in-flight conversations is required — `conversation.model.id` persists independently in DIAL Core.

## Risks / Trade-offs

- **Figma node access blocked** → Implementors must manually verify spacing, icon sizes, and placement against `27:1476` / `27:4520` before merging. A snapshot of both nodes should be attached to the PR.
- **`catalogItemId` is a breaking change to `POST /api/v1/conversations`** → Any existing client that omits the field will get 400. The change is safe because the endpoint is only called from `apps/chat` (no third-party consumers at this stage), but the PR must update both the backend DTO and the frontend wrapper atomically.
- **Generated client regeneration** → `npm run openapi` must be run after the DTO change. The generated method signature will change; the `conversations.api.ts` wrapper must be updated in the same commit. If `openapi:check` fails in CI, the change is blocked until the client is regenerated.
- **`assistantModelId` hardcode** → `ConversationService` also sets `assistantModelId: 'anthropic.claude-v3-sonnet'` today. The proposed change maps `catalogItemId` to both `model.id` and `assistantModelId` to keep the persisted shape consistent.

## Migration Plan

1. Add `catalogItemId` to `CreateConversationDto` and remove hardcoded model in `ConversationService` — backend slice.
2. Run `npm run openapi` + `npm run openapi:check` + build/lint the generated client.
3. Update `conversations.api.ts` to pass `catalogItemId`.
4. Extend `InputProps` / `ConversationInputProps` with selector props — lib slice.
5. Add `DialDropdownIcon` in `Input.tsx`; unit test coverage.
6. Update `ConversationRoute` and `ConversationView` to call `useCatalog()` and forward props.
7. Add i18n keys for selector strings.
8. Run full lint + test matrix.

**Rollback:** Revert to prior `CreateConversationDto` (remove `catalogItemId`), restore the hardcoded model in `ConversationService`, re-run `npm run openapi`, and revert the lib and app changes. No database or persistent state is affected; in-memory conversation storage and DIAL Core store the model at creation time.

## Open Questions

1. **Figma node access** — Can the Figma MCP quota be increased so design details for nodes `27:1476` and `27:4520` can be verified programmatically, or should the implementor manually document the spacing/sizes?
2. **Catalog reload on focus** — Should `CatalogContext` re-fetch when the window regains focus (stale-while-revalidate pattern)? Out of scope for this slice but worth noting for a follow-up.
3. **Disabled state during streaming** — The design blocks selection changes during streaming by disabling the dropdown when `isStreaming === true`. Confirm this is the desired UX (vs. allowing selection for the *next* message).

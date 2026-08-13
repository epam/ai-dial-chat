## Why

Prompts now exist as a first-class catalog entity (editor, favorites, sharing — see `2026-08-10-split-prompt-service` and the Catalog Prompts tab), but a saved prompt is only reachable through the Catalog page. There is no way to pull a favorited prompt into the chat composer without leaving the conversation, which is the primary place users would want to reuse one. This change adds a "Prompts" entry to the Input's Add menu so a favorite (or any browsable) prompt can be inserted into the chat textarea in one flow, including resolving `{{parameter}}` placeholders.

## What Changes

- Add a "Prompts" item (icon `IconPrompt`) to the Input's Add (`+`) menu, positioned above "Settings", visible only when `OverlayFeature.Prompts` is enabled.
- Hovering/tapping "Prompts" opens a second-level panel: "My Collection" header, the user's favorite prompts (icon, name, filled star, description on hover), and a "Browse" button. An empty-favorites state shows "Star a prompt to pin it here" instead of the list.
- "Browse" opens a "Use prompt" modal — the existing Catalog picker shell restricted to the Prompts type only (mirrors the current model/agent picker modal).
- Selecting a prompt (from the favorites panel directly, or from a card in the "Use prompt" modal):
  - If the prompt's content contains no `{{param}}` tokens, its content is inserted into the chat textarea immediately.
  - If it has `{{param}}` tokens, a new "Prompt parameters" popup opens first, requiring a value for every parameter (via `Textarea` fields) and rendering the full prompt content read-only (reusing the Catalog's prompt content renderer) side-by-side. Opened from the modal, the popup has a back chevron returning to the modal; opened directly from the favorites panel, it has none. Submitting substitutes the entered values into the `{{param}}` tokens and inserts the result into the textarea; Cancel closes without inserting anything.
- `Input` gains a generic way to receive resolved text from an app-owned overlay (mirroring the existing `modelPickerOverlay` injection convention) so `libs/conversation-input` stays domain-agnostic about prompts.
- `CatalogView`'s selector-mode entity-type filter becomes configurable so the same component serves both the existing Model/Agent picker and the new Prompts-only picker.

## Capabilities

### New Capabilities

- `prompt-input-attachment`: Discovering, selecting, and inserting a (parameterized or plain) prompt into the chat composer from the Input's Add menu, including the favorites panel, the Prompts-only browse modal, and the parameter-resolution popup.

### Modified Capabilities

- (none — no existing spec's requirements change; `CatalogView`'s type-filter becomming configurable is an implementation detail of reuse, not a behavior change for its existing Model/Agent picker consumers)

## Impact

- `libs/conversation-input`: `Input`, `AddAttachmentButton` gain new props for the Prompts submenu overlay injection and for receiving resolved prompt text; no new domain knowledge of prompts is added to the lib.
- New `libs/prompts` (host-agnostic UI): favorites/browse panel content, "Prompt parameters" popup, and the `{{param}}` parsing/substitution utility.
- `apps/chat`: new hook (parallel to `useDeploymentSelectorOverlay`) wiring `PromptsContext` + `FavoriteApplicationsContext` + `mapPromptToCatalogItem` into the new lib components; `CatalogView.tsx` gains a configurable visible-type filter for selector mode; new i18n keys in `translation-keys.ts` / `en.json`.
- No backend changes — prompt content already includes the full body in the existing list payload.

## Context

Prompts are already a full catalog entity (`CatalogEntityType.Prompt`): `apps/chat/src/context/PromptsContext.tsx` prefetches personal/shared/public prompts (each DTO already carries the full `content` body — no detail fetch needed), `FavoriteApplicationsContext.tsx` tracks favorite ids, and `apps/chat/src/utils/map-prompt-to-catalog-item.ts` maps a `PromptResponseDto` into a `CatalogItem`. `CatalogView.tsx` already has a `handleUseInChat` path for prompts that resolves content and hands it to the composer via router state (`navigate(ROUTES.Root, { state: { promptContent } })`), consumed one-shot by `ConversationRoute.tsx` (`routePromptContent` → `setInputMessage`).

The model/deployment picker is the closest existing analog for everything this change needs on the UI side:

- `apps/chat/src/components/DeploymentSelector/useDeploymentSelectorOverlay.tsx` builds a favorites-filtered `CatalogItem[]` and returns `{ renderOverlay(onClose), catalogModal }`; `renderOverlay` is injected into `Input` via the `modelPickerOverlay?: (onClose) => ReactNode` prop (see `ModelSelectorControl.tsx`).
- `DeploymentSelectorOverlay.tsx` → `DeploymentSelectorPanel.tsx` render the favorites list + "Browse" button — the direct analog of the "My Collection" second-level Prompts panel.
- `CatalogModal.tsx` wraps `CatalogView` in a `Popup` (`PopupSize.Lg`) with `isSelectorMode` — the analog of the "Use prompt" modal, gated today by a hardcoded `PICKER_VISIBLE_TYPES = {Model, Agent}`.
- `libs/catalog/src/components/Details/TabsContent/Content.tsx` (`ContentTab`) already renders a catalog item's body as read-only markdown **and already highlights `{{placeholder}}` tokens** — this is exactly the renderer needed for the "Details" column of the parameters popup, but it is an internal (non-exported) component of `libs/catalog` today.

## Goals / Non-Goals

**Goals:**
- Add a "Prompts" entry to the Input's Add menu, gated by `OverlayFeature.Prompts`, showing a favorites-only second-level panel with a "Browse" escape hatch to a Prompts-only Catalog modal.
- Resolve `{{param}}` tokens (double-brace only) via a new popup when present, then insert the final text into the active composer's textarea.
- Do this by extending existing injection points (`modelPickerOverlay`-style prop, `message`/`messageRevision` controlled-input pattern, `CatalogView`'s selector mode) rather than duplicating them.
- Keep `libs/conversation-input` and the new prompts UI lib free of app-owned integration details (server-api, routing, contexts), per AGENTS.md library isolation.

**Non-Goals:**
- No backend changes. No prompt versioning (prompts stay unversioned; the favorites row shows name only, no version subtext).
- No change to how prompts are created/edited/shared (PromptEditor, sharing) — out of scope.
- Not building a generic "insert arbitrary text into Input" public API beyond what this feature needs; reusing the existing controlled `message`/`messageRevision` props is sufficient.

## Decisions

### 1. New `libs/prompts` for prompt-specific picker/parameter UI, with the shared markdown+placeholder renderer promoted to `libs/chat-shared`

`libs/prompts` (type: ui) gets:
- `FavoritePromptsPanel` — the "My Collection" header, favorite rows (icon/name/star/tooltip), empty state, and "Browse" button. Pure props in (`CatalogItem[]`, callbacks), no domain knowledge.
- `PromptParametersPopup` — header (title, close, optional back chevron via `onBack?`), the prompt summary card, the two-column Parameters/Details body, and Cancel/Submit footer.
- `extractPromptParams(content: string): string[]` and `resolvePromptParams(content, values): string` — pure `{{param}}` extraction/substitution utilities.

**Existing regex to reuse, not reinvent:** `libs/catalog/src/utils/prompt-variables.ts` already defines the exact token grammar this feature needs — `PROMPT_VARIABLE_PATTERN = /\{\{([^{}]+)\}\}/g` (double-brace, non-empty, no nested braces) — as a rehype plugin (`rehypePromptVariables`) that wraps `{{name}}` runs in a `<span>` for markdown highlighting. It is not currently usable for plain extraction/substitution (it operates on hast text nodes, not raw strings), but the token grammar must stay identical between "highlight it in the Details column" and "extract/substitute it in the Parameters column" — two independent regexes for the same token would drift.

**Token-grammar duplication risk and resolution:** the `{{param}}` regex needs to be usable in two shapes — raw-string extraction/substitution (`extractPromptParams`/`resolvePromptParams`, needed by `libs/prompts` and by the app's selection flow) and hast-node highlighting (`rehypePromptVariables`, needed for the Details column's rendered markdown). `libs/catalog/src/utils/prompt-variables.ts` only had the second shape. Resolution: move `PROMPT_VARIABLE_PATTERN` (renamed to a neutral `PROMPT_PARAM_PATTERN`) into `libs/chat-shared` as the single source of truth for the token grammar, and extract the pure rendering piece of `ContentTab` (markdown body + placeholder highlighting, no `CatalogItem`/`ItemDetailsStyles` coupling) into a new shared component in `libs/chat-shared` (`MarkdownWithPlaceholders`) that internally uses `rehypePromptVariables` built on the shared pattern. Concretely:
- `libs/chat-shared` exports `PROMPT_PARAM_PATTERN`, `extractPromptParams`, `resolvePromptParams` (built directly on the shared regex), `rehypePromptVariables`/`PROMPT_VARIABLE_CLASS_NAME`, and `MarkdownWithPlaceholders`.
- `libs/catalog`'s `prompt-variables.ts` and `ContentTab` are refactored to import the moved pieces from `chat-shared` instead of owning them (behavior-preserving; `PROMPT_VARIABLE_CLASS_NAME` and existing Catalog snapshot/behavioral tests are unchanged).
- `libs/prompts`'s `extractPromptParams`/`resolvePromptParams` consume the same `chat-shared` exports directly.

**Revised — `ContentTab`, `AppIdentity`, `CatalogEntityType`, and `DeploymentSize` are reused directly from `libs/catalog`, not reimplemented via `MarkdownWithPlaceholders` alone:** the initial implementation rendered the Details column with bare `MarkdownWithPlaceholders` and a bespoke icon+"Prompt"-label card for the prompt summary. This produced two defects: the `{{param}}` highlight span rendered with no color (the color rule lives in `ContentTab`'s own `.module.scss`, scoped to a class only `ContentTab` applies), and the summary card duplicated `AppIdentity`'s icon/type/name layout instead of reusing it. Checking `@nx/enforce-module-boundaries`'s actual configuration (`eslint.config.mjs`) showed the assumption above was wrong: its one `depConstraints` entry is `{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }` — any lib may depend on any lib; there is no rule confining `type:ui` libs to `chat-shared` only. So instead of duplicating `ContentTab`/`AppIdentity`, `libs/catalog`'s `index.ts` now also exports `ContentTab`, `ContentTabProps`, `AppIdentity`, `AppIdentityProps`, `AppIdentityColors/Styles/Typography`, and `DeploymentSize` (all previously internal-only), and `libs/prompts` takes `@epam/ai-dial-catalog` as a peer dependency. `PromptParametersPopup`'s summary card now renders `<AppIdentity type={CatalogEntityType.Prompt} .../>` and its Details column renders `<ContentTab content={content} description={description} />` — identical to how the Catalog's own Details tab renders a prompt, including working placeholder highlighting and the description-then-divider-then-body layout.

*Alternative considered:* build the parameters popup inside `libs/catalog` itself (it already owns `CatalogEntityType.Prompt`, `promptContent`, and `ContentTab`, so no cross-lib import problem exists there). Rejected because the user explicitly asked for a new `libs/prompts`, and the favorites-panel/parameters-popup are conceptually about *composing a prompt into a message*, not about *browsing/managing catalog entities* — `libs/catalog` gains an awkward, one-off "insert into chat" concern otherwise.

### 2. `Input`/`AddAttachmentButton` get a `promptsMenuOverlay`-style injection, no new "insert text" prop

`AddAttachmentButton` gains a prop parallel to `chatSettings`/`toolsMenuItems` but shaped like `modelPickerOverlay`, since the Prompts panel is a rich, app-rendered overlay (header + list + star + tooltip + Browse button), not a flat togglable-row list like `toolsMenuItems`:

```ts
/** When provided, adds a "Prompts" item (IconPrompt) above "Chat settings"; renders the app-owned overlay content on desktop (nested Dropdown submenu via renderSubMenu) and mobile (bottom sheet). */
promptsMenuOverlay?: (onClose: () => void) => ReactNode;
promptsMenuTitle?: string; // "Prompts", i18n default
```

**Superseded 2026-08-13 — desktop now uses a real nested submenu via `renderSubMenu`, the originally-intended shape:** the original plan was a nested popover anchored to the "Prompts" row (the same "second level opens beside/inside the first, both stay open" shape `AddAttachmentButton`'s existing "Tools" item uses via `DropdownItem.children`). The first attempt at that hit a hard ui-kit limitation at the time: every nested `children` item was unconditionally rendered inside a fixed `h-[40px] truncate` `<button>` (confirmed by reading the ui-kit's `Dropdown` submenu renderer — there was no `PlainText`/rich-content branch at the nested level, unlike the top-level items list), so the Favorites panel's header/list/star buttons/Browse button got clipped, and it was worked around with a menu-replacing overlay Dropdown plus its own `onBack` callback (see git history for that interim shape). `@epam/ai-dial-ui-kit` 0.13.0-dev+ removes the limitation: `DropdownItem` now accepts a per-item `renderSubMenu?: () => ReactNode` that "fully replaces the submenu panel content" while keeping the item's normal submenu-trigger wiring (caret, hover/keyboard open, positioning, chrome) — exactly the "rich content inside a real nested submenu" shape that was missing before.

The "Prompts" `DropdownItem` in `AddAttachmentButton` now sets `renderSubMenu: () => promptsMenuOverlay(onClose)` instead of an `onClick` that swapped a second top-level Dropdown in for the main one. This means the main "+" menu and the Prompts submenu are both part of the same `Dropdown`'s item tree and stay open side by side — closing the submenu (Escape, or moving back to the "Prompts" row) never closes or hides the main menu, matching how the "Tools" submenu already behaves, so no back affordance is needed in the panel itself. `promptsMenuOverlay`'s signature drops the `onBack` parameter it briefly needed (mobile never used it — `BottomSheetShell` already owns back-navigation there), and `FavoritePromptsPanel` drops its `onBack` prop and back-chevron header row entirely rather than keeping it optional. The single `onClose` callback still exists so that completing a selection (or opening the "Use prompt" modal) can collapse the whole `+` menu (`isDesktopMenuOpen=false`), which also closes the nested submenu since it lives inside the same Dropdown.

**Implementation quirk — `renderSubMenu` alone does not make an item submenu-capable:** reading the ui-kit's bundled `Dropdown` render code shows the caret, hover/keyboard-open wiring, and floating submenu panel are only attached to an item when `item.children` is a non-empty array (`item.children?.length`); `renderSubMenu` only overrides what gets rendered *inside* that panel once the gate already passed (`item.renderSubMenu ? item.renderSubMenu() : item.children.map(...)`) — it is not itself the gate. Passing `renderSubMenu` with no `children` therefore renders a plain, non-interactive button: no chevron, no hover-open, nothing happens on click. The "Prompts" item works around this by also passing a one-element placeholder `children` array (`[{ key: 'prompts-panel', label: '' }]`) purely to satisfy the length check — it is never rendered, since `renderSubMenu` takes over the panel content entirely.

Mobile is unaffected by this change: it never gets a new `PromptsBottomSheet`, reusing the existing generic `BottomSheetShell` (already used by `ModelSelectorControl` for `modelPickerOverlay`), which already provides the exact back-navigation shell needed (`onBack` returns to the main Add sheet) — avoiding a second bespoke shell alongside `ToolsBottomSheet`'s. Mobile calls `promptsMenuOverlay` with only `onClose`, since `BottomSheetShell`'s own back arrow already covers it.

No new "insert resolved text" prop is added to `Input`. `Input` is already externally controlled via `message`/`messageRevision` (see `useMessageState.ts` and `ConversationView`'s `inputContent`/`inputContentRevision` passthrough to `ConversationInput`). The host (`ConversationView`/`NewConversationComposer`, both of which already own an `inputMessage`/revision-counter state for the exact same reason `routePromptContent` exists today) sets that state directly when the parameters popup (or a param-less favorite) resolves — no router round-trip needed, since selection happens in-place inside the already-mounted composer, unlike the Catalog page's cross-route hand-off.

*Alternative considered:* a dedicated `onInsertPrompt: (text: string) => void` prop on `Input` that internally calls `setMessage`. Rejected — it would duplicate the app's own existing revision-counter plumbing for no benefit, and `Input` already has a documented external-control channel (`messageProp` + `messageRevision`) that both host composers already wire up.

### 3. `CatalogView` selector-mode type filter becomes a prop

```ts
// CatalogView.tsx
visibleTypes?: Set<CatalogEntityType>; // defaults to PICKER_VISIBLE_TYPES (Model, Agent)
```

`CatalogModal.tsx` gets a sibling `PromptCatalogModal` (or a `visibleTypes` prop threaded through the existing `CatalogModal`) that passes `visibleTypes={new Set([CatalogEntityType.Prompt])}` and a `titles.pageTitle`/modal header of "Use prompt" instead of the model-picker's title. Everything else (favorites strip inside the modal — "My collection" — search/filter/sort/cards) is unchanged `Catalog`/`CatalogView` behavior, satisfying "same shell as Catalog" for free.

*Alternative considered:* a new `PromptCatalogView` duplicating `CatalogView`'s data-assembly. Rejected — `catalogItems`/`favorites`/`onUseInChat`/`onToggleFavorite` logic for prompts already exists verbatim in `CatalogView`; only the *visible-types* gate differs between the two picker use cases.

### 4. Selection → parameter resolution flow lives in a new app-level hook mirroring `useDeploymentSelectorOverlay`

New `apps/chat/src/components/PromptSelector/usePromptSelectorOverlay.ts` (naming mirrors `DeploymentSelector`):
- Builds `favoritePromptItems` from `usePrompts()` (personal + sharedWithMe + publicPrompts) filtered by `useFavoriteApplications().favoriteIds`, mapped via the existing `mapPromptToCatalogItem`.
- Exposes `renderOverlay(onClose)` → `<FavoritePromptsPanel .../>` (passed as `promptsMenuOverlay`), and `promptCatalogModal` → the Prompts-only modal from Decision 3.
- Owns the "does this prompt have params?" branch: on select, runs `extractPromptParams(content)`; if empty, calls `onInsertText(content)` immediately; if non-empty, opens `PromptParametersPopup` (with `onBack` wired only when the selection came from the modal path) and calls `onInsertText(resolvePromptParams(content, values))` on submit.
- `onInsertText` is supplied by the composer (`ConversationView`/`NewConversationComposer`) the same way `onSelect`/`setSelectedItemId` is supplied to the deployment selector today — i.e. it's a small callback prop threaded down from wherever `inputMessage`/`inputContentRevision` state already lives, not a new context.

### 5. Design tokens for the parameter-popup's prompt summary card

Reuse the existing var names already used across `libs/catalog` for the same visual pairing (`--bg-layer-sunken` background / `--stroke-tertiary` border, e.g. `Toolbar.module.scss`, `card-props.ts`), not new ad-hoc var names. The 72px height / 8px icon-to-text gap / 16px section gap are literal Tailwind values (`h-[72px]`, `gap-2`, `gap-4`), not tokens.

## Risks / Trade-offs

- [Risk] Refactoring `ContentTab` to delegate to a new `chat-shared` component touches an existing, already-shipped Catalog surface. → Mitigation: pure extraction, no behavior change; covered by `ContentTab`'s existing tests before/after.
- [Risk] `AddAttachmentButton` picks up a second `renderOverlay`-style prop (`promptsMenuOverlay` alongside `modelPickerOverlay` on `Input`), growing prop surface. → Mitigation: it follows the exact existing convention (same shape, same desktop/mobile split), so no new pattern is introduced, only one more instance of it.
- [Risk] `{{param}}` extraction/substitution must not mistake single-brace JSON-looking content (`{name}` in the sample payload) for a parameter, and must not drift from the highlighting regex already shipped in `libs/catalog`. → Mitigation: reuse the existing `PROMPT_VARIABLE_PATTERN` (`/\{\{([^{}]+)\}\}/g`) verbatim by relocating it to `chat-shared` rather than writing a second regex; covered by a unit test using the exact sample payload from this change's proposal discussion.
- [Trade-off] Favorites for the Add-menu panel are computed from all three already-prefetched prompt sources (personal/shared/public) client-side, same as `CatalogView` does — acceptable since `PromptsProvider` already loads all three on app mount for the Catalog page; no new network cost is introduced.

## Open Questions

- None outstanding. (Resolved: mobile bottom-sheet stacking reuses `BottomSheetShell` directly rather than a new `PromptsBottomSheet` — see Decision 2. The desktop nested-popover approach was initially replaced with a menu-replacing overlay plus its own `onBack`, pending a ui-kit update that would allow both levels to stay open simultaneously — that update shipped in `@epam/ai-dial-ui-kit` 0.13.0-dev+ (`renderSubMenu`), and Decision 2 now implements the originally-intended nested submenu directly.)
- Resolved: CatalogView's `visibleTypes` selector-mode filter (Decision 3 / task group 4) is implemented and the Prompts-only "Use prompt" browse modal is wired up.

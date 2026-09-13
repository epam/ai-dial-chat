# Design: use-skills-in-chat

## Context

Skills already have full catalog lifecycle support (authoring, favorites via `skills.installed` + `PATCH /api/v1/user-config/skills`, sharing, archive import) and the prompt feature already solved the "attach a catalog entity to the chat composer from the Add menu" problem end-to-end (`2026-08-14-attach-prompt-to-chat-input`, now `openspec/specs/prompt-input-attachment`): a menu item with a nested overlay panel, a favorites list, a type-restricted catalog browse modal, and an app-level `usePromptSelectorOverlay` hook that keeps `libs/conversation-input` domain-agnostic. The wire contract for actually sending a skill with a completion is now understood (user-confirmed): the user message carries the skill's resource path in `custom_content.skills` — the same extra-payload channel attachments and stages already use — while DIAL Core's *interpretation* of that payload is a separate upstream change. This change therefore builds the selection UX **and** the send-time/history wiring, all gated behind the kill switch. Part 2 of the effort (originally deferred as "send-time semantics") is folded into this change at the maintainer's request: the selected skill renders inline *inside* the input (replacing the part-1 chip row), a `/`-prefix command dropdown opens the same favorites panel from the keyboard, and the conversation history re-displays the skill with the same tooltip.

Existing anchor points (verified in code):

- `AddAttachmentButton` (`libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx`) hardcodes one overlay submenu channel: `promptsMenuOverlay` + `promptsMenuTitle` + `promptsBackLabel`, keyed on `promptsMenuOverlay != null` for the desktop Dropdown's controlled-open state and for the mobile stacked `BottomSheetShell`.
- `FavoritePromptsPanel` (`libs/prompts`) is the panel rendered inside that overlay: "My Collection" header, favorites list, empty hint, Browse footer.
- `usePromptSelectorOverlay` (`apps/chat/src/components/PromptSelector/`) owns the flow: `PromptsContext` + `FavoriteApplicationsContext` → `FavoritePromptItem[]`, browse modal state, selection.
- `PromptCatalogModal` wraps the app's `CatalogView` (selector mode, `visibleTypes` restricted) in a ui-kit `Popup`.
- `Header` (`libs/catalog/src/components/Details/Header/Header.tsx`) decides the primary action via `shouldShowPrimaryAction` (default: Model/Agent/Prompt) and defaults `isDownloadPrimary` to `true` for `CatalogEntityType.Skill` — today a skill's header primary is Download, and there is no "Use in chat".
- `useCatalogItemActions` (`apps/chat/src/hooks/useCatalogItemActions/`) already resolves skill details (manifest + file listing, see `skill-details-panel` spec) — reusable verbatim by the un-deferred chat-route details side panel (D5).
- ui-kit 0.14 ships `InteractiveTooltip` (2.0, exported from the package index): a hover/focus-anchored panel that stays open while the pointer moves onto it, carries no ARIA `role` so it can hold focusable content, and renders nothing on touch-only devices. (`SelectOption.interactiveTooltip` anchors the same primitive to Select options; the favorites panel anchors it to its own rows.)
- Core's skill listing metadata (`ResourceItemMetadata` — both `listSkillMetadata` and `getSharedResources`) carries no `description`: a skill's description is authored in its `SKILL.md` frontmatter and is readable only by downloading and parsing that file, the pipeline the details panel's skill branch already runs. Decision (user-confirmed): resolve descriptions lazily per skill (D4).
- Feature flags: env var → `EnvironmentVariables` (class-validator) → `CONFIG_DEFINITIONS` registry entry → `FeatureKey` enum → frontend `useFeatureFlag(key)` reading the client-config `features` map. `RESPONSES_API_ENABLED` is the reference boolean flag; unlike it, this one must be `visibility: 'client'` because it gates UI.

## Goals / Non-Goals

**Goals**

1. Full skill-selection UX behind `SKILL_USAGE_ENABLED`: catalog "Use in chat" on skill details, Skills Add-menu item with favorites panel (rows carrying an interactive tooltip with a "View details" action, D4), "Use skill" browse modal, a single selected skill rendered inline inside the conversation input as the new `ChatSkill` element (D10/D11), the `/`-prefix command dropdown (D12), and the chat-route skill details side panel the tooltip's "View details" opens (D5).
2. Generalize the prompt-specific overlay plumbing in `libs/conversation-input` so Prompts and Skills share one mechanism, with Prompts' behavior unchanged.
3. New `libs/skills` library holding the host-agnostic skill-selection UI; app-owned wiring stays in `apps/chat`.
4. Document the deferred "default model supports skills" condition everywhere the button's visibility is specified.
5. Send-time and history wiring (part 2, folded in): user messages carry `custom_content.skills` with the selected skill's path, the selection clears on send, edit restores it, regenerate/continue forward it verbatim, and the conversation history renders the skill with the same `ChatSkill` element, tooltip, and details action (D13–D15).

**Non-Goals**

- DIAL Core's interpretation of `custom_content.skills` (the backend behavior that activates a skill during a completion) — upstream Core change; this repo only constructs, persists, and re-displays the payload.
- Any new backend skill-usage API, model-capability endpoint, or OpenAPI changes.
- Role-based rollout (`SKILL_USAGE_ENABLED_ROLES`).
- Changes to `OverlayFeature`/`ENABLED_UI_FEATURES` (different mechanism; see D1).
- Migrating the input to a `contenteditable` composer (the true inline-node flow-around) — rejected as out of scale for this change; see D12's alternative.

## Decisions

### D1. Flag plumbing: client-visible `features.skillUsageEnabled`, not an `OverlayFeature`

`SKILL_USAGE_ENABLED` follows the `RESPONSES_API_ENABLED` path exactly — boolean `@Transform` in `EnvironmentVariables` (reading the raw source value so the literal `"false"` parses to `false`), registry entry `features.skillUsageEnabled` (`type: 'feature'`, `valueType: 'boolean'`, `defaultValue: false`, `critical: false`, `envVar: 'SKILL_USAGE_ENABLED'`), `FeatureKey.SkillUsageEnabled` enum member — with one deliberate difference: `visibility: 'client'`, because the flag gates frontend UI (catalog button, Add-menu item) that must not render when the flag is off. The frontend reads it with the existing `useFeatureFlag('skillUsageEnabled')` (fails closed while config loads, matching every other client flag).

*Alternative considered:* adding an `OverlayFeature.SkillUsage` entry to `ENABLED_UI_FEATURES`. Rejected — that mechanism is a compiled baseline intended for overlay hosts to swap feature sets; the requested flag is a deployment env var in the `RESPONSES_API_ENABLED` family. The existing `OverlayFeature.Skills` (catalog Skills tab) is untouched — hiding the tab already hides every entry point described here except none (all new entry points are additionally gated on the new flag).

### D2. Generalize the Add-menu overlay channel in `libs/conversation-input`

The prompt-specific prop triplet is replaced by a data-driven list:

```ts
interface MenuOverlayConfig {
  key: string;                      // 'prompts' | 'skills' | …
  title: string;                    // menu-item label + mobile sheet title
  icon: ReactNode;                  // menu-item icon (IconPrompt / IconBlocks)
  renderOverlay: (onClose: () => void) => ReactNode;
  backLabel?: string;               // mobile sheet back aria-label
}
```

`AddAttachmentButton` (and `Input`/`ConversationInput`, which forward the props today) accept `menuOverlays?: MenuOverlayConfig[]`, rendered between the "Tools" item and "Chat settings", in array order. The desktop nested-submenu mechanics (placeholder `children` to pass the ui-kit's submenu gate + `renderSubMenu` override, controlled Dropdown open state) and the mobile stacked `BottomSheetShell` move into a per-config loop; the controlled-open state becomes a `Record<key, boolean>` (or single open key) instead of `isPromptsSheetOpen`/`isDesktopMenuOpen` keyed on prompts alone. The app's prompts wiring builds its config from `usePromptSelectorOverlay`'s existing `renderOverlay` — `PromptSelectorOverlay` and the modal/parameters popups are untouched, so prompt behavior and tests carry over with only prop-shape changes at the call sites.

*Alternative considered:* adding a parallel `skillsMenuOverlay` triplet. Rejected — it duplicates the exact plumbing the user asked to refactor, and a third entity type would triple it again.

The `+` button's "render nothing when the menu is empty" rule now counts `menuOverlays` entries as menu content — this is the `chat-input-tools-menu` delta (its "tools are the only content" enumeration gains the skills overlay).

### D3. New `libs/skills` (`@epam/ai-dial-skills`), peers on `libs/catalog` like `libs/prompts` does

The lib is `type: ui`, publishable-shaped, with peer deps on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and `@epam/ai-dial-catalog` (the peer-consumption pattern `libs/prompts` already uses; module-boundary enforcement permits ui→ui/publishable) — the catalog peer is consumed by `SkillDetailsSidePanel` (D5) and `FavoriteSkillsPanel`'s interactive-tooltip rows depend on nothing from it. It contains:

- `FavoriteSkillsPanel` — "My Collection" header, favorite-skill rows, empty hint ("Star a skill to pin it here"), separator, Browse footer. Modeled on `FavoritePromptsPanel` (including the leave-animation pattern), with two skill-specific differences: selection adds the skill to the input instead of inserting text, and each row carries an interactive tooltip (D4) instead of `FavoritePromptsPanel`'s plain string-only one.
- `FavoriteSkillItem` model — `{ id, name, description }` (id is the `skills/{bucket}/{path}` resource URL, identical to `CatalogItem.id` for a skill).

The "Use skill" browse modal stays an **app** component (`SkillCatalogModal`, mirroring `PromptCatalogModal`), because it wraps `CatalogView`, which is an app component; only the lib-agnostic pieces live in `libs/skills`.

### D4. Interactive tooltip on favorite-skill rows, built on the ui-kit's `InteractiveTooltip`

The Add-menu keeps the existing kit `Dropdown` mechanism and `FavoriteSkillsPanel`'s custom rows exactly as built — the rows are **not** reworked onto the kit `Select`. Each favorite-skill row is instead wrapped in the kit's exported `InteractiveTooltip` (2.0, `asChild` so the row itself stays the trigger), replacing the plain string-only `Tooltip` path `FavoritePromptsPanel` uses.

Tooltip content, top to bottom:

- The skill's **description** paragraph — a spinner in its place while the fetch is in flight (see the lazy-resolution decision below), and the paragraph simply omitted for a skill whose `SKILL.md` manifest carries no description or whose fetch failed.
- A **"View details"** button below it: kit `Button` with `variant={ButtonVariant.Primary}` + `appearance={ButtonAppearance.Link}`, `iconBefore` an `IconEye` (kit icon-size constant, `stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden` — the button's accessible name comes from its label), label from the new `skillSelector.viewDetailsLabel` key (D9). Click opens the chat-route skill details side panel (D5) and closes the Add menu/tooltip.

Panel mechanics: `contentClassName="max-w-[550px]"` (the kit default is 320px; 550 is the desktop cap and needs no breakpoint since the panel renders nothing on touch-only anyway), kit-default `TooltipPlacement.Right` placement (flips automatically in RTL), focus reachable from the row (Tab), and nothing rendered on touch-only devices — where the row still selects the skill on tap, "View details" is desktop-only, and the row's accessible name never depends on the tooltip. The open state is the kit's own **uncontrolled** behavior. The kit portals every `InteractiveTooltip` panel through floating-ui into `document.getElementById('interactive-tooltip-portal')` — a `FloatingPortal` resolved by id mounts only when that element exists — so the app hosts the container at its root (`<div id="interactive-tooltip-portal" />` in `apps/chat/src/main.tsx`); without it the panel silently renders nothing (this was observed as "tooltip never shows" for rows and chip alike, while `onOpenChange` still fired and ran the lazy fetch). The container serves every `InteractiveTooltip` in the app, including the prompts panel's migrated rows. The original implementation worked around two upstream defects with a panel-controlled open state and a 300 ms grace-close/cancel; the upgraded ui-kit fixed both (`onOpenChange` now augments the internal open state instead of replacing its setter, and hover closes through `safePolygon()` so the panel stays open while the pointer crosses onto it — `useSubMenuFloating` got the same fix so the parent Add-menu submenu no longer unmounts the panel), so the workaround was dropped from both `FavoriteSkillsPanel` and `FavoritePromptsPanel` (see Follow-ups item 1).

**Lazy description resolution (user-confirmed: "lazy fetch now, Core later").** Core's listing metadata carries no `description`, so the description is fetched on demand, per skill:

- The **app** (`useSkillSelectorOverlay`) owns a per-session in-memory cache — `Map<skillId, description | null>` — and the fetch; the lib stays data-agnostic.
- `FavoriteSkillsPanel` reports a row's **first open** (hover or focus) to the host through the `onItemTooltipOpen(item.id)` callback, wired from the tooltip's `onOpenChange` — it fires on every open, and the host dedupes via the cache; the host fetches only when the id is not already in the cache (in-flight or resolved).
- The fetch is one round-trip through the **existing** skill-file download endpoint wrappers (`apps/chat/src/server-api/skills.api.ts`) + `parseSkillManifest` — the same pipeline `useCatalogItemActions`'s skill branch runs for the details panel; extract/share rather than duplicate.
- Failure resolves to `null` (no description, no re-fetch this session, no notification) — matching the details panel's silent-degradation rule for manifest parse failures.
- **Deferred condition (planned upstream change, user-confirmed):** DIAL Core will add `description` to `ResourceItemMetadata`; when it ships, the listing populates the tooltip directly, the per-skill `SKILL.md` downloads disappear (resolving the N+1 pattern — one download per hovered skill per session), and the lazy fetch is dropped along with its cleanup: the first-open callback, the per-session cache, the in-flight state, and the `isDescriptionLoading` spinner branch.

*Alternative considered:* reworking the favorites list onto the kit 2.0 `Select`, whose `SelectOption.interactiveTooltip` anchors the same primitive per option (with `rightControl` for the favorite toggle). Rejected (user decision) — the Dropdown + custom rows are already built and behavior-complete; wrapping them in `InteractiveTooltip` is the smaller, non-breaking change.

### D5. Skill details side panel on the chat route, composed from the exported `DetailsPanel`

`DetailsPanel` (the component `libs/catalog/src/components/Details/DetailsPanel.tsx`; only its `DetailsPanelProps` type is exported today) becomes a public export of `@epam/ai-dial-catalog`'s index. `libs/skills` then adds a thin `SkillDetailsSidePanel` wrapper — the right-anchored chat-route panel the tooltip's "View details" opens — that composes `DetailsPanel` directly and does **not** wrap the whole `CatalogView`, which would drag in tab persistence, sort/filter, and page chrome the side panel must not have. `DetailsPanel`'s content-first tabs already work for `CatalogEntityType.Skill`.

Host/lib split:

- The **app** owns the panel's open state and the "View details" click (which also closes the Add menu/tooltip), builds the `CatalogItem` via the existing `mapSkillToCatalogItem` (`skill.url` is already the CatalogItem id), and supplies the details fetch by reusing `useCatalogItemActions`'s existing skill branch (`onFetchDetails` → `downloadSkillFile` + `listSkillFiles` + `parseSkillManifest`) — extracted and shared, not duplicated.
- The **lib** wrapper wires favorite toggle (existing `ToggleIconButton` behavior) and close handling, and forwards the host-supplied `CatalogItem`, details fetch, and labels.

The side-panel header's **"Use in chat"** (the same primary action the catalog page's skill details already get from D7) selects the skill into the input — same path as clicking the row itself — and closes the panel. The `@epam/ai-dial-catalog` peer dep for `libs/skills` (D3) is what makes this composition legal without the lib importing the app.

### D6. The selected skill renders as a generic chip in `libs/conversation-input`

`Input` gains a generic, domain-agnostic chip row (`selectedEntities`-style prop: `{ id, label, icon?, onRemove }[]`) rendered where the tool chips render, above the textarea. The chip uses the accent-active control color (`text-control-accent-active` token family) with a remove (×) control; `aria-label`/keyboard behavior follow the tool-chip a11y pattern. The app maps the selected skill to this shape from `useSkillSelectorOverlay`; `libs/conversation-input` never learns what a skill is.

Selection is **single** (user-confirmed): the input holds at most one selected skill, and selecting another replaces the chip. The lib prop stays an array so the mechanism remains generic, with the app passing zero or one entry and owning the single-selection rule.

*Alternative considered:* a skills-specific prop pair on `Input`. Rejected — same domain-leak argument as D2; the generic row is also the natural home for part two's per-message state.

**Superseded within this change (part 2):** D6's `selectedEntities` chip row — rendered in the input's action row, outside the text area — is replaced by D11's `inlineStartSlot` mechanism, which renders the selected skill *inside* the text area so the user keeps typing in the same field and the text flows around it. The `SelectedEntityChips` component, the `selectedEntities`/`selectedEntityChipLabels` props, and their tests are removed in the same change; the single-selection rule and the domain-agnostic-lib argument carry over unchanged (the slot is generic, the app passes `<ChatSkill />`).

### D7. Catalog "Use in chat" for skills: host-gated, Download demoted only when the primary action shows

`Header`'s defaults change in one way: `isDownloadPrimary`'s Skill default becomes `item.type === Skill && !shouldShowPrimaryAction`. Flag off → primary action absent for skills → Download stays primary, byte-identical behavior. Flag on → the app's `CatalogView` includes `CatalogEntityType.Skill` in its `isPrimaryActionVisible` rule, "Use in chat" takes the primary slot, and Download returns to the Manage menu. The lib stays flag-agnostic (visibility is entirely host-driven through existing props). **Deferred condition:** the button should eventually show only when the default model supports skills; no backend signal exists yet, so the app rule is unconditional inside the flag, and the deferral is recorded in the `catalog-use-in-chat` delta and in `apps/chat`'s wiring as a code comment.

Click behavior mirrors the prompt branch: navigate to `ROUTES.Root` with one-shot router state (`{ skillId }` — an id, not a body, so no size concern), consumed and cleared by `ConversationRoute` on mount, which seeds `useSkillSelectorOverlay`'s selected skill (single selection). Deployment selection is untouched.

### D8. App wiring: `useSkillSelectorOverlay` mirrors `usePromptSelectorOverlay`

One hook owns the flow: favorites (`useSkills` → `skills`/`sharedWithMe`/`publicSkills` intersected with `favoriteIds` via `FavoriteEntityType.Skill`), the overlay render function (handed to D2's config), browse-modal open state, and the selected skill (single selection, exposed for D6's chip). Flag-off → the hook returns `renderOverlay: undefined` / no chip, exactly the stub-free gating pattern `usePromptSelectorOverlay` uses (`undefined` overlay removes the whole menu row). No new context: skill data and favorites already have owners (`SkillsContext`, `FavoriteApplicationsContext`).

### D9. i18n: `SkillSelectorI18nKeys` namespace, reusing shared keys where values match

New `skillSelector.*` keys: `addMenuLabel` ("Skills"), `emptyHint` ("Star a skill to pin it here"), `modalTitle` ("Use skill"), `viewDetailsLabel` ("View details" — verified absent from `en.json`, so a feature-scoped key is correct even though the string is short). "My Collection", "Browse", "Back", "Remove from favorites" are reused from the namespaces that already carry those exact values (`promptSelector.myCollectionLabel` or a shared `FavoritesI18nKeys`/`ButtonsI18nKeys` entry — resolve per the duplicate-translation-value rule by grepping `en.json` during implementation; prefer promoting to a shared key over adding a same-value `skillSelector.*` copy). All keys go through the string enum in `apps/chat/src/constants/translation-keys.ts`.

### D10. `ChatSkill` inline component in `libs/skills`, sharing one tooltip content with the menu rows

`ChatSkill` is the single visual form of a "used skill": a kit `GhostButton` whose label is `/{skill name}` (e.g. `/my-skill`), wrapped in the kit's `InteractiveTooltip` (`asChild`, so the button itself stays the trigger; uncontrolled open on hover/focus, `contentClassName="max-w-[550px]"`, **Top placement** (design-confirmed) flipping with direction — the rows keep their Right placement; `Button`/`GhostButton` accept `size`, but `ElementSize.Small` is a fixed 24px with tiny typography, not the chip's 26px/16px label, so the chip keeps its class overrides). Activating the button has **no action of its own** — click/focus merely opens the tooltip; the only interactive behavior lives in the tooltip's "View details" button, which invokes the host's `onViewDetails(path)` callback and opens the same catalog skill details side panel D5 builds (identical to the menu rows' behavior). The tooltip is uncontrolled and the kit exposes no imperative close, so the "View details" click **remounts** the tooltip (a generation counter as its `key`) — the fresh instance starts closed, mirroring the rows whose tooltip unmounts with the Add menu on the same click; reopening takes a fresh hover/focus.

Props: skill metadata — `name`, `description?`, `isDescriptionLoading?` (spinner while a lazy fetch is in flight), `path` (the skill's resource URL, i.e. the same id form as `FavoriteSkillItem.id`/`CatalogItem.id`) — plus `onViewDetails(path)`, an optional first-open notification `onTooltipOpen(path)` (wired from `InteractiveTooltip`'s `onOpenChange`, the same hook the menu rows use — the host's lazy description fetch keys off it wherever the component renders), and `labels` (`viewDetailsLabel`, English default "View details"). Colors/typography follow the lib styling rules as `*Colors`/`*ClassName` props. The chip's metrics (design-confirmed): the kit button's defaults (`h-[40px] px-4`, small-paragraph semibold label) are overridden to auto height with zero vertical padding and 8px horizontal padding, and a `dial-body-paragraph-text` label (16px/26px/400, overridable via `labelClassName`) — so the chip's total height is exactly its label line (26px with the default label) and its text aligns with the input's first text line (D11). The component carries no remove control; removal is the input's Backspace-at-start gesture (D11).

The tooltip's inner content is **extracted from `FavoriteSkillsPanel` into a shared component** (`SkillInfoTooltipContent`): the description paragraph (spinner in its place while loading, omitted when absent) above the "View details" `Button` (`variant Primary`, `appearance Link`, `className="h-[24px] self-start"` — the height override caps the kit Standard button's 40px to the design's 24px while keeping its 14px/24px semibold label class `dial-small-paragraph-semi-text`, which is the design spec; `self-start` keeps it at the content's start edge instead of stretching across the panel; the kit's `ElementSize.Small` is not used because it swaps the label to 12px tiny typography; `iconBefore` `IconEye` with kit icon stroke, `aria-hidden`). The menu rows, `ChatSkill` in the input, and `ChatSkill` in history all render this one component — identical panel and identical i18n by construction, per the user's "reuse something, at least i18n, maybe more".

*Alternative considered:* leaving the tooltip markup inline in `FavoriteSkillsPanel` and re-implementing it in `ChatSkill`. Rejected — the user explicitly asked for reuse; two copies of the panel would drift at the first design change.

### D11. Inline rendering inside the input: generic `inlineStartSlot` on `Input`, flow-around via a measured first-line indent

`Input` (and `ConversationInput`/`EditMessageInput`, which forward to it) gains a domain-agnostic prop:

```ts
/** Host-supplied content rendered inside the text area at its inline-start; typed text starts after it on the first line and wraps at full width below. */
inlineStartSlot?: ReactNode;
```

The slot's content is laid out **on the first text line, inside the text area**: `Input` renders it in an absolutely-positioned wrapper at the text area's inline-start edge (top-aligned to the first line) and measures the wrapper's width with a `ResizeObserver`, exposing it as a CSS custom property (`--ci-first-line-indent`, the slot's width plus a small caret gap) that the textarea consumes as `text-indent` while the slot is present. The result is the Claude/other-chat-agents composer behavior: the caret starts after the `/skill-name` element, typing continues on the same line, and wrapped lines (and every line after an explicit Enter — a textarea is one paragraph block, so `text-indent` applies only to its first line) use the input's full width. All positioning uses logical properties (`inset-inline-start`, `text-indent` is direction-relative by definition), so RTL mirrors automatically. With no slot the textarea is byte-identical to today.

The app maps the selected skill to `<ChatSkill … />` and passes it in the slot; `libs/conversation-input` never learns what a skill is (same domain-leak argument as D2/D6). The part-1 `selectedEntities`/`selectedEntityChipLabels` props and the `SelectedEntityChips` component are removed in the same change — the selected skill was their only consumer, and the action-row placement they produce is exactly what part 2 replaces.

The chip carries **no remove control of its own** (design-confirmed, resolving the recorded assumption below). Removal is a text-field gesture: `Input` gains `onInlineStartRemove?`, invoked when Backspace is pressed with the caret collapsed at position 0 while the slot is present — at position 0 a Backspace has nothing to delete backwards, so redirecting it costs no text-editing behavior; it is the standard chip-removal gesture of chat composers. While a slot is present the placeholder is suppressed (the slot itself says what the input holds); the chip adds no vertical padding of its own, so its label line aligns with the first text line exactly with no extra block padding on the text area.

*Alternatives considered:* (a) a flex-row gutter — slot in a fixed start column, textarea in the remaining width. Rejected: wrapped lines never flow under the element, which is the behavior the user asked for ("it should flow around"). (b) Migrating the composer to a `contenteditable`/ProseMirror field with true inline nodes (what claude.ai does). Rejected — out of scale and risk for this change; the indent approach reaches the same visible behavior on a native textarea. If `text-indent` proves unreliable in a target browser during verification, the gutter layout is the documented fallback (one-line switch in the same stylesheet).

### D12. Slash `/` command dropdown: lib-owned generic trigger, host-owned content

The `/` menu has two halves, split along the same host/lib line as everything else in this change:

- **`libs/conversation-input` owns the generic trigger mechanism.** `Input` gains an optional `commandMenu` config — `{ triggerPrefix: '/', renderMenu: (ctx: { query: string; close: () => void }) => ReactNode }` — and a small internal state machine:
  - **Opens** when the message value transitions to `triggerPrefix` at position 0 while previously empty (the user typed `/` into an empty input), and no `commandMenu` dismissal is latched (below).
  - **Stays open** while the message continues to match `^\/[^\s/]*$` (a `/` plus a whitespace-free, slash-free query); every keystroke updates `ctx.query`.
  - **Closes** when the message stops matching (the `/` deleted, or a space/second slash typed), on Escape, or on outside click.
  - **Dismissal latch:** an Escape/outside-click close while the message still matches sets a latch — subsequent keystrokes do not reopen the menu. The latch resets the moment the message stops matching; typing `/` into the empty input again reopens. (User requirement: "If user closes it, it should also disappear and reappear if he delete and reenter '/'".")
  - Rendering: the kit `Dropdown` with controlled `open`, `renderOverlay` host content, placement **top-start** (opens above the input by default; Floating UI placement strings flip with direction), anchored to the text area, `outsidePressIgnoreRef` pointing at the textarea so clicking back into the input does not count as an outside press, `matchReferenceWidth={false}` so the overlay sizes to its content instead of stretching to the text area's width, and the menu region labeled for assistive tech (host label). The mechanism is entity-agnostic — nothing in `libs/conversation-input` knows about skills; it is the same pattern as `menuOverlays` (D2), applied to a text-triggered menu instead of a button-triggered one.
- **The host owns the content.** The app hands `FavoriteSkillsPanel` (a second render path through the *same* component the Add-menu uses — the user's "content is identical to the Skills submenu": "My Collection" header, favorite rows with star toggles, separator, Browse footer) to `renderMenu`, with a new optional `searchQuery` prop on the panel: when set, rows are filtered case-insensitively by name-substring against the query and each row's name renders through the kit `Highlight` component (per the search-results-highlight rule; the query threads down as an explicit prop). A query matching nothing renders a "No matching skills" hint (`skillSelector.noMatchingSkillsLabel`, with an `aria-live` status per the dynamic-feedback a11y rule) in place of the list; header and Browse remain. Selection from the menu **consumes** the slash text — the whole `/query` string is removed from the input (never sent), the skill is selected (replacing any prior selection, D6's single-selection rule), the menu closes, and focus returns to the text area (a mouse selection moves focus to the row, which unmounts with the menu). Browse consumes the slash text too and opens the "Use skill" modal. The panel is fixed at **280px** wide (design-confirmed, replacing the earlier content-driven `min-w-[240px]`; the `Dropdown` overlay runs with `matchReferenceWidth={false}` so it sizes to that panel rather than matching the text area's width — the kit default stretches the popup across the whole input), and while the menu is open with an empty query the config's optional `emptyQueryHint` (skills label "Type to filter") renders inside the text area immediately after the `/`, in the placeholder style — an `aria-hidden` overlay anchored at the first line's text start (`--ci-first-line-indent`), whose leading invisible mirror of the trigger prefix occupies exactly the prefix's rendered width so the hint needs no width measurement; it disappears with the first query keystroke. The hint shares the text area's overlay wrapper with the inline-start slot (D11), and that wrapper's presence is decided by configuration only — a slot is present, a hint is configured — never by live menu state: toggling an ancestor of the text area on menu open or on the hint's appear/disappear remounts it and throws away focus and the caret mid-typing (observed during verification: focus came back but the caret reset to position 0); with the wrapper stable the caret stays exactly where the user typed, which in this flow is the end of the text.

The Add-menu "Skills" item stays as built — the two entry points coexist, exactly like prompts (menu) and `/`-typed text would in other chat agents.

*Alternative considered:* app-side detection via `onChange` with the dropdown anchored by an exposed ref. Rejected — the textarea value state lives inside `Input` (`useMessageState`), so the app would re-derive internal state from events and race the lib's own value handling; and the dismissal/reopen latch is pure input-mechanics, not skills knowledge, so it belongs in the lib.

### D13. Send-time wiring: `custom_content.skills`, per-message semantics, selection clears on send

`MessageCustomContent` (`libs/chat-shared/src/models/chat.ts`) gains:

```ts
/** Skill resource paths (`skills/{bucket}/{path}`) used with this user message. */
skills?: string[];
```

— the same wire channel `attachments`/`stages` already use, so no request-shape, endpoint, or OpenAPI change is involved: the field rides the existing message `custom_content` wherever messages already flow. The array form future-proofs the wire shape even though the UI selects a single skill (the array holds zero or one entry today).

Semantics are **per-message, like attachments** (user-confirmed): sending a message with a selected skill writes the skill's path into that user message's `custom_content.skills` and clears the selection — the next message starts without a skill. The construction happens where the app already builds the outgoing user message (`apps/chat` conversation send path); `useSkillSelectorOverlay` exposes the selected skill's `path` for it, and the `+`-menu/`/`-menu/modal/catalog entry points keep feeding the same single-selection state.

*Alternative considered:* conversation-level persistence (the skill sticks to every following message until removed). Rejected by the user — per-message matches attachments and keeps the payload honest about what was actually used for each turn.

### D14. Persistence, regenerate/continue, and edit restore

- **Persistence:** conversations are saved through the existing conversation endpoints with their messages verbatim — a `custom_content.skills`-carrying user message persists with no additional work; verified during implementation rather than assumed (the save path already round-trips `custom_content.attachments`).
- **Regenerate / continue-after-reload:** these flows already forward the last user message's `custom_content` (e.g. `Conversation.tsx` passes `lastMsg.custom_content` into `startStream`), so the skills field rides along unchanged — no code change expected, covered by tests.
- **Edit:** entering edit mode on a user message that carries skills seeds the selected skill into the edit input (via the same `inlineStartSlot`/`ChatSkill` path — `EditMessageInput` forwards the slot and `onInlineStartRemove`), and re-sending the edited message carries the message's (possibly unchanged, possibly cleared via the Backspace-at-start gesture) skills forward. The edit send path threads the skills through the same `custom_content` construction as D13.

### D15. History rendering and path→metadata resolution

A user message that arrives with `custom_content.skills` renders one `ChatSkill` element per entry (today: zero or one) at the inline-start of the bubble content. Mechanism: `UserMessageBubble` (via `MessageBubble`) gains an optional `beforeContent` slot — a generic ReactNode slot like the existing `afterContent`, keeping `libs/conversation-messages` entity-agnostic; `ConversationMessageItem` passes the `ChatSkill` list. Hovering the element shows the identical interactive tooltip (D10), and "View details" opens the same chat-route skill details side panel (D5) — the user's requirement that history behaves like the menu.

**Metadata resolution from the path** (the user's "we need to load skill metadata via that pass"): the message carries only paths, so the app resolves display data per path — name from the loaded skill listing (`SkillsContext`'s `skills`/`sharedWithMe`/`publicSkills`, matched on URL — the same `allSkills` pool `useSkillSelectorOverlay` already builds); if the path is absent from the listing (a skill the viewer cannot access, e.g. someone else's shared conversation), the fallback name is the last non-empty path segment; the description comes from the existing per-session lazy fetch (D4's `fetchSkillDescription` cache — history shares the cache, so a skill already hovered in the menu does not refetch, and a fetch failure degrades silently to a description-less tooltip, matching D4's rules).

*Alternative considered:* persisting resolved metadata (name/description) into `custom_content.skills` alongside the path. Rejected — the wire carries only the path (user-confirmed contract); duplicating metadata would bloat the payload and desynchronize from the listing on rename.

### D16. i18n additions for part 2

New keys under the existing `skillSelector` namespace: `noMatchingSkillsLabel` ("No matching skills" — slash-menu filtered-out state; verify absence from `en.json` first per the duplicate-value rule) and `emptyQueryHint` ("Type to filter" — the slash menu's empty-query hint rendered in the text area; verified absent from `en.json`). `viewDetailsLabel` and the panel labels are reused from part 1 unchanged — the whole point of the D10 extraction. The × control's label plumbing (`removeSkillLabel` on the hook's labels, reusing the shared `Remove {name}` key) is removed together with the × itself: removal is the input's Backspace gesture and carries no accessible name of its own.

## Risks / Trade-offs

- [Removing `promptsMenuOverlay` from `Input`/`ConversationInput` breaks app call sites] → `libs/conversation-input` is consumed only via path alias inside this repo; all call sites migrate in the same change and existing Prompt tests are updated (not deleted) to the new prop shape.
- [The selected skill is view state; navigating new-chat → conversation view remounts the component] → Part 1 accepts this (same as tool toggles pre-fix): the "Use in chat" hand-off explicitly seeds via router state so the primary catalog→chat path is covered; full persistence is part two's contract.
- [Flag default `false` means the feature ships dark] → Intended — the backend contract doesn't exist; operators enable per deployment when part two lands.
- [The interactive tooltip renders nothing on touch-only devices] → Accepted — "View details" is desktop-only there; the row itself still selects the skill, and the details side panel stays reachable from the catalog page. The row's accessible name never depends on the tooltip.
- [First tooltip open cannot show the description — it is still being fetched] → Accepted — the first open shows a spinner in the description's place (user-requested after initial implementation); the description renders in place once the fetch resolves, without reopening (per-session cache).
- [Lazy fetch adds one `SKILL.md` download per hovered skill per session] → Bounded — one round-trip per skill, cached for the session, only on first tooltip open; dropped entirely once Core's listing carries `description` (deferred condition in D4). History shares the same cache (D15), so re-displaying a conversation adds no new fetches for already-resolved skills.
- [`text-indent` on a textarea is the flow-around mechanism — an unusual use of the property] → Bounded risk — a textarea renders as a single paragraph block, so `text-indent` shifts only its first line, which is exactly the needed behavior; if verification finds a target-browser caret/rendering defect, the documented fallback is the flex-row gutter (D11), a one-line stylesheet switch with no API change.
- [Removing `selectedEntities`/`SelectedEntityChips` breaks app call sites] → `libs/conversation-input` is consumed only via path alias inside this repo; all call sites (`NewConversationComposer`, `ConversationView`, edit flow) migrate to `inlineStartSlot` in the same change, and the part-1 chip tests were never written (they sit in the still-open test section, amended in the same change).
- [The slash-menu state machine has textual edge cases (IME composition, paste of `/xyz`, mid-text `/`)] → The open condition requires the value to have transitioned from empty to `/`-prefixed through keystrokes the lib observes; IME composition is already guarded elsewhere in `Input` (`isComposing` checks) and is covered in the same handler; a pasted `/xyz` never transitions from empty via an observed keystroke and therefore does not open the menu — acceptable (opening on paste was never requested).
- [`custom_content.skills` is written before the backend interprets it] → Intended — the flag defaults off, so the payload only ships where an operator enables it expecting a Core build that consumes the field; the field itself is additive and ignored by Cores that don't know it (the same forward-compat `custom_content` already relies on).

## Migration Plan

1. Land the flag plumbing (env, registry, enum, docs) — inert with default `false`.
2. Land the conversation-input refactor with Prompts migrated — zero behavior change, flag-independent.
3. Land `libs/skills` + app wiring + catalog button — all gated on the flag; enabling `SKILL_USAGE_ENABLED` is the only rollout step. Rollback = flag off (or revert); no data migrations, no API changes.
4. Land the interactive tooltip + lazy description fetch (D4) and the `DetailsPanel` export + `SkillDetailsSidePanel` (D5) — gated on the same flag, no API changes (the lazy fetch uses the existing skill-file download endpoint).
5. Land part 2 in the same gated stream: the `ChatSkill` component + shared tooltip content (D10), the `inlineStartSlot` flow-around mechanism replacing the chip row (D11), the slash command dropdown (D12), the `custom_content.skills` send/edit/regenerate wiring (D13/D14), and the history rendering with path→metadata resolution (D15). Steps within 5 are ordered so each is independently verifiable: D10 has no call-site change; D11 swaps the chip row for the slot at the existing call sites; D12–D15 wire the payload and display. Rollback for all of it remains the flag — a Core that ignores `custom_content.skills` simply receives a field it discards.

## Open Questions

- **Model-supports-skills signal** (deferred): when the backend defines how a deployment advertises skill support, the catalog button's visibility rule and possibly the input menu's gate gain that condition — the specs mark this explicitly as a deferred condition rather than leaving it implicit.
- **Chip/footer visual details**: chip metrics are design-confirmed (26px total height — its 16px/26px label line plus 8px horizontal padding, no vertical padding — D10/D11); footer and remaining sizing details follow the prompts panel's established metrics unless further design material arrives.
- **Slash-menu filtering scope**: filtering matches the skill *name* only (substring, case-insensitive). If search should also match description text or path segments, that is a one-line extension of the filter predicate — deferred until asked for.
- **Core's interpretation of `custom_content.skills`** (upstream): this repo fixes only the field and its population; how Core activates the skill during a completion is a separate DIAL Core change. Nothing here blocks on it (the field is additive and ignored by Cores that don't consume it).

Resolved during planning: selection is **single**, not a set (D6, user-confirmed); the interactive hover tooltip and the chat-route skill details side panel are **un-deferred into this change** (D4/D5) now that ui-kit 0.14 ships `InteractiveTooltip` — the favorites panel keeps the Dropdown + custom rows (no `Select` rework, user-confirmed), and skill descriptions are **lazy-fetched** from `SKILL.md` per session because Core's listing carries no `description` (user-confirmed). Part 2 planning (user-confirmed): the send channel is **`custom_content.skills`** carrying resource paths (not a new `custom_data` field — the message's existing extra-payload channel); the slash dropdown **filters as the user types and consumes the `/query` text on selection**; the selection **clears on send** (per-message semantics, like attachments), with edit restoring the message's skill. Part 2 is folded into this change rather than a separate part-two change (user decision), extending its proposal/design/tasks/specs in place. Resolved during implementation (design update, user-confirmed): the `ChatSkill` chip carries **no × remove control** — removal is the input's Backspace-at-position-0 gesture (`onInlineStartRemove`); the chip is styled at 16px/26px regular; the placeholder is suppressed while a skill is selected; and the chip's label aligns with the first text line. Later design revision (user-confirmed): the chip's total height is **26px** — its label line plus 8px horizontal padding, with no vertical padding and no extra block padding on the text area; the slash dropdown is fixed at **280px**; selecting from the slash dropdown **returns focus to the text area**; and while the slash menu is open with an empty query, a **"Type to filter"** hint renders in the text area right after the `/` (`emptyQueryHint` on the command-menu config).

## Follow-ups (planned upstream changes, user-confirmed)

Two upstream changes are planned; each lands with a named cleanup in this repo:

1. **ui-kit: Dropdown-native interactive tooltips.** Shipped — the upgraded kit (0.14.0-dev.46) supports `interactiveTooltip` on `DropdownItem` natively and fixed both defects found while building this change: `InteractiveTooltip`'s `onOpenChange`-without-`open` trap (the callback now augments the internal open state instead of replacing its setter), and the submenu/hover close with no safe-polygon (`useHover` and `useSubMenuFloating` both close through `safePolygon()` now). **Cleanup done:** the panel-controlled open state and the 300 ms grace-close/cancel handlers were dropped from both `FavoriteSkillsPanel` and `FavoritePromptsPanel` in favor of the kit's native uncontrolled behavior (the favorites rows are custom components inside `renderSubMenu`, not `Dropdown.items`, so they use the uncontrolled `InteractiveTooltip` directly rather than `DropdownItem.interactiveTooltip`). `FavoritePromptsPanel` received the same cleanup — it was migrated onto `InteractiveTooltip` inside this change (task 5.7), so its workaround went with it.
2. **DIAL Core: `description` in the skill listing.** `ResourceItemMetadata` will gain `description`, making the listing the direct source for the tooltip and eliminating the lazy fetch's N+1 request pattern (one `SKILL.md` download per hovered skill per session). **Cleanup when it ships:** drop `fetchSkillDescription` and its wiring — the `onItemTooltipOpen` callback, the per-session description cache, the in-flight/pending state in `useSkillSelectorOverlay`, and the `isDescriptionLoading` spinner branch in `libs/skills` (shrink `buildFavoriteSkillItem` accordingly, since the listing populates `FavoriteSkillItem.description` directly).

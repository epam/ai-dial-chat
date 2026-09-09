# Design: use-skills-in-chat

## Context

Skills already have full catalog lifecycle support (authoring, favorites via `skills.installed` + `PATCH /api/v1/user-config/skills`, sharing, archive import) and the prompt feature already solved the "attach a catalog entity to the chat composer from the Add menu" problem end-to-end (`2026-08-14-attach-prompt-to-chat-input`, now `openspec/specs/prompt-input-attachment`): a menu item with a nested overlay panel, a favorites list, a type-restricted catalog browse modal, and an app-level `usePromptSelectorOverlay` hook that keeps `libs/conversation-input` domain-agnostic. The backend contract for actually sending skills with completions is not designed yet — this change deliberately builds only the selection/display UX, gated behind a kill switch, with the send-time semantics deferred to part two.

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

1. Full skill-selection UX behind `SKILL_USAGE_ENABLED`: catalog "Use in chat" on skill details, Skills Add-menu item with favorites panel (rows carrying an interactive tooltip with a "View details" action, D4), "Use skill" browse modal, a single selected-skill chip in the input, and the chat-route skill details side panel the tooltip's "View details" opens (D5).
2. Generalize the prompt-specific overlay plumbing in `libs/conversation-input` so Prompts and Skills share one mechanism, with Prompts' behavior unchanged.
3. New `libs/skills` library holding the host-agnostic skill-selection UI; app-owned wiring stays in `apps/chat`.
4. Document the deferred "default model supports skills" condition everywhere the button's visibility is specified.

**Non-Goals**

- Send-time semantics of selected skills (completion payload, `custom_content`, persistence in conversation history, regenerate/edit restore) — part two.
- Any backend skill-usage API, model-capability endpoint, or OpenAPI changes.
- Role-based rollout (`SKILL_USAGE_ENABLED_ROLES`).
- Changes to `OverlayFeature`/`ENABLED_UI_FEATURES` (different mechanism; see D1).

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

Panel mechanics: `contentClassName="max-w-[550px]"` (the kit default is 320px; 550 is the desktop cap and needs no breakpoint since the panel renders nothing on touch-only anyway), kit-default `TooltipPlacement.Right` placement (flips automatically in RTL), focus reachable from the row (Tab), and nothing rendered on touch-only devices — where the row still selects the skill on tap, "View details" is desktop-only, and the row's accessible name never depends on the tooltip. The open state is **panel-controlled** (`open` passed, `onOpenChange` omitted): the kit's `InteractiveTooltip` replaces its internal open-state setter with the callback when `onOpenChange` is passed without `open`, leaving the panel forever closed (upstream defect), and its uncontrolled hover closes the instant the pointer leaves the row-or-panel pair. The panels therefore drive the open state themselves — leaving either side only schedules a close after a 300 ms grace period, and hover or focus re-entering either side cancels it — in both `FavoriteSkillsPanel` and the migrated `FavoritePromptsPanel`. This workaround is dropped when the ui-kit ships Dropdown-native interactive tooltips (see Follow-ups).

**Lazy description resolution (user-confirmed: "lazy fetch now, Core later").** Core's listing metadata carries no `description`, so the description is fetched on demand, per skill:

- The **app** (`useSkillSelectorOverlay`) owns a per-session in-memory cache — `Map<skillId, description | null>` — and the fetch; the lib stays data-agnostic.
- `FavoriteSkillsPanel` reports a row's **first open** (hover or focus) to the host through a new callback (e.g. `onItemHover(item.id)`), detected by a null-rendering mount-signal child inside the tooltip content — the kit renders its content only while open, and mounting is the only reliable open event given the `onOpenChange` defect above; the host fetches only when the id is not already in the cache (in-flight or resolved).
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

### D7. Catalog "Use in chat" for skills: host-gated, Download demoted only when the primary action shows

`Header`'s defaults change in one way: `isDownloadPrimary`'s Skill default becomes `item.type === Skill && !shouldShowPrimaryAction`. Flag off → primary action absent for skills → Download stays primary, byte-identical behavior. Flag on → the app's `CatalogView` includes `CatalogEntityType.Skill` in its `isPrimaryActionVisible` rule, "Use in chat" takes the primary slot, and Download returns to the Manage menu. The lib stays flag-agnostic (visibility is entirely host-driven through existing props). **Deferred condition:** the button should eventually show only when the default model supports skills; no backend signal exists yet, so the app rule is unconditional inside the flag, and the deferral is recorded in the `catalog-use-in-chat` delta and in `apps/chat`'s wiring as a code comment.

Click behavior mirrors the prompt branch: navigate to `ROUTES.Root` with one-shot router state (`{ skillId }` — an id, not a body, so no size concern), consumed and cleared by `ConversationRoute` on mount, which seeds `useSkillSelectorOverlay`'s selected skill (single selection). Deployment selection is untouched.

### D8. App wiring: `useSkillSelectorOverlay` mirrors `usePromptSelectorOverlay`

One hook owns the flow: favorites (`useSkills` → `skills`/`sharedWithMe`/`publicSkills` intersected with `favoriteIds` via `FavoriteEntityType.Skill`), the overlay render function (handed to D2's config), browse-modal open state, and the selected skill (single selection, exposed for D6's chip). Flag-off → the hook returns `renderOverlay: undefined` / no chip, exactly the stub-free gating pattern `usePromptSelectorOverlay` uses (`undefined` overlay removes the whole menu row). No new context: skill data and favorites already have owners (`SkillsContext`, `FavoriteApplicationsContext`).

### D9. i18n: `SkillSelectorI18nKeys` namespace, reusing shared keys where values match

New `skillSelector.*` keys: `addMenuLabel` ("Skills"), `emptyHint` ("Star a skill to pin it here"), `modalTitle` ("Use skill"), `viewDetailsLabel` ("View details" — verified absent from `en.json`, so a feature-scoped key is correct even though the string is short). "My Collection", "Browse", "Back", "Remove from favorites" are reused from the namespaces that already carry those exact values (`promptSelector.myCollectionLabel` or a shared `FavoritesI18nKeys`/`ButtonsI18nKeys` entry — resolve per the duplicate-translation-value rule by grepping `en.json` during implementation; prefer promoting to a shared key over adding a same-value `skillSelector.*` copy). All keys go through the string enum in `apps/chat/src/constants/translation-keys.ts`.

## Risks / Trade-offs

- [Removing `promptsMenuOverlay` from `Input`/`ConversationInput` breaks app call sites] → `libs/conversation-input` is consumed only via path alias inside this repo; all call sites migrate in the same change and existing Prompt tests are updated (not deleted) to the new prop shape.
- [The selected skill is view state; navigating new-chat → conversation view remounts the component] → Part 1 accepts this (same as tool toggles pre-fix): the "Use in chat" hand-off explicitly seeds via router state so the primary catalog→chat path is covered; full persistence is part two's contract.
- [Flag default `false` means the feature ships dark] → Intended — the backend contract doesn't exist; operators enable per deployment when part two lands.
- [The interactive tooltip renders nothing on touch-only devices] → Accepted — "View details" is desktop-only there; the row itself still selects the skill, and the details side panel stays reachable from the catalog page. The row's accessible name never depends on the tooltip.
- [First tooltip open cannot show the description — it is still being fetched] → Accepted — the first open shows a spinner in the description's place (user-requested after initial implementation); the description renders in place once the fetch resolves, without reopening (per-session cache).
- [Lazy fetch adds one `SKILL.md` download per hovered skill per session] → Bounded — one round-trip per skill, cached for the session, only on first tooltip open; dropped entirely once Core's listing carries `description` (deferred condition in D4).

## Migration Plan

1. Land the flag plumbing (env, registry, enum, docs) — inert with default `false`.
2. Land the conversation-input refactor with Prompts migrated — zero behavior change, flag-independent.
3. Land `libs/skills` + app wiring + catalog button — all gated on the flag; enabling `SKILL_USAGE_ENABLED` is the only rollout step. Rollback = flag off (or revert); no data migrations, no API changes.
4. Land the interactive tooltip + lazy description fetch (D4) and the `DetailsPanel` export + `SkillDetailsSidePanel` (D5) — gated on the same flag, no API changes (the lazy fetch uses the existing skill-file download endpoint).

## Open Questions

- **Model-supports-skills signal** (deferred): when the backend defines how a deployment advertises skill support, the catalog button's visibility rule and possibly the input menu's gate gain that condition — the specs mark this explicitly as a deferred condition rather than leaving it implicit.
- **Chip/footer visual details**: no Figma attached; the spec fixes behavior and color token (`text-control-accent-active`) but exact paddings/sizes follow the prompts panel's established metrics unless design material arrives.

Resolved during planning: selection is **single**, not a set (D6, user-confirmed); the interactive hover tooltip and the chat-route skill details side panel are **un-deferred into this change** (D4/D5) now that ui-kit 0.14 ships `InteractiveTooltip` — the favorites panel keeps the Dropdown + custom rows (no `Select` rework, user-confirmed), and skill descriptions are **lazy-fetched** from `SKILL.md` per session because Core's listing carries no `description` (user-confirmed).

## Follow-ups (planned upstream changes, user-confirmed)

Two upstream changes are planned; each lands with a named cleanup in this repo:

1. **ui-kit: Dropdown-native interactive tooltips.** The kit's `Dropdown` will support interactive tooltips on its rows natively. The work should also fix the two defects found while building this change: `InteractiveTooltip`'s `onOpenChange`-without-`open` trap (passing the callback without `open` replaces the internal open-state setter, so the panel can never open), and `useSubMenuFloating`'s 80 ms close with no safe-polygon (which can unmount a body-portaled tooltip panel while the pointer is crossing onto it). **Cleanup when it ships:** drop the panel-controlled open state and the 300 ms grace-close/cancel handlers from both `FavoriteSkillsPanel` and `FavoritePromptsPanel` in favor of the kit's native behavior.
2. **DIAL Core: `description` in the skill listing.** `ResourceItemMetadata` will gain `description`, making the listing the direct source for the tooltip and eliminating the lazy fetch's N+1 request pattern (one `SKILL.md` download per hovered skill per session). **Cleanup when it ships:** drop `fetchSkillDescription` and its wiring — the `onItemTooltipOpen` callback, the per-session description cache, the in-flight/pending state in `useSkillSelectorOverlay`, and the `isDescriptionLoading` spinner branch in `libs/skills` — the listing populates `FavoriteSkillItem.description` directly.

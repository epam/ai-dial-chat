# Design: skills-listing-description-and-support-gating

## Context

The archived `2026-09-11-use-skills-in-chat` change shipped the skill-selection UI with two recorded deferred conditions, both now unblocked upstream:

1. **Description in the listing** — DIAL Core PR [#1970](https://github.com/epam/ai-dial-core/pull/1970) (issue #1966) adds an `attributes: Map<String, Object>` map to complex resource item metadata (`ComplexResourceItemMetadata extends ResourceItemMetadata`, `@JsonInclude(NON_NULL)`), populated from the resource marker's manifest-derived metadata (name/description/version). It appears on skill metadata listings, including recursive children. The frontend currently compensates with a lazy per-skill `SKILL.md` download on first tooltip open (`fetchSkillDescription` in `libs/chat-hooks/src/catalog/useSkillItemDetails.ts`, driven through `useSkillSelectorOverlay`'s first-open callback, per-session `Map<skillId, description|null>` cache, `pendingDescriptionIds` in-flight state, and an `isDescriptionLoading` spinner branch).
2. **Deployment skills-support flag** — DIAL Core PR [#1976](https://github.com/epam/ai-dial-core/pull/1976) (issue #1975) adds `skillsSupported` / `skills_supported` (boolean, default `false`) to `Features`, exposed on model/application/toolset listings and the deployment features payload, "so DIAL clients can detect whether a deployment accepts custom skills via `messages[*].custom_content.skills[*]`".

Consumers of the skill hooks today: `ConversationView` (ongoing conversation), `NewConversationComposer` (new-conversation composer, also embedded in AppsEditor preview), and `AppPreviewChat` (preview composer + preview ongoing input, whose deployment is the app itself). Each host already resolves a "current deployment" object with `features` on it (listing-based `DeploymentItemDto`).

## Goals / Non-Goals

**Goals**

- Skill descriptions reach the favorites tooltips and the `ChatSkill` chip from the already-loaded listing — zero extra requests.
- Catalog skill cards and the details panel's Content summary show the listing description (previously hardcoded `''`).
- Delete the lazy description machinery entirely (the archived design's Follow-up 2 cleanup list).
- Plumb `skillsSupported` from Core through chat-api DTOs into the generated client and the frontend.
- Hide the input-surface skill entry points when the current deployment does not support skills.
- Render the `ChatSkill` chip in an error state (error-colored label + explanatory tooltip) and disable send while a selected skill is unsupported.

**Non-Goals**

- No change to the send-time payload, persistence, or history rendering of skills (`skill-message-payload` untouched).
- No change to the skill details panel's manifest + file-listing resolution — the details fetch stays even though the listing now carries a description, because the panel shows the full manifest and the file tree, not just the description. The panel's Content summary simply gains the listing description as its pre-fetch value, and its stale "no description in skill metadata" comments are corrected (see D1).
- No change to favorites behavior, sharing, or the catalog's tab layout — the catalog's skill cards gain the listing description as a value (`mapSkillToCatalogItem`), but skills stay content-first with no About tab.
- No new endpoints — only additive DTO fields on existing responses.

## Decisions

### D1. Description mapping: `attributes.description` → `SkillMetadataItemDto.description`

`mapToSkillMetadataItem` (`apps/chat-api/src/skills/utils/skill-metadata.util.ts`) reads `attributes` defensively off the raw `DialMetadataBase` (`'attributes' in item` — the installed `@epam/ai-dial-typescript-sdk`'s `MetadataBase` may not declare the field until it catches up with Core #1970), and maps `description: typeof attributes?.description === 'string' ? attributes.description : undefined` onto `SkillMetadataItemDto` (new optional `@ApiProperty` field). Folders never carry it; items without `attributes` or with a non-string `description` map to `undefined`. Nothing throws on absence — the field is optional everywhere downstream, so older Cores and the shared-with-me path (whose `getSharedResources` coverage for `attributes` is unverified) degrade to "no description", which the UI already renders gracefully.

The nesting is confirmed against a live Core `listSkillMetadata` response: items carry the description at `attributes.description` (alongside `attributes.name`); no top-level `description` field exists on the item. Folders in the same response carry no `attributes` at all.

**Catalog consumption**: `mapSkillToCatalogItem` (`libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts`) replaces its hardcoded `description: ''` (set because skill metadata previously carried none) with `description: skill.description ?? ''`. The catalog grid card and the details panel's Content summary (`promptContent?.description ?? item.description` — ordering unchanged) now show the listing description immediately, before the manifest details fetch lands; once the fetch resolves, the manifest's own `description` frontmatter stays authoritative (same value in practice — Core derives the listing attributes from the manifest). No About tab is restored for skills: `CatalogEntityType.Skill` stays in `CONTENT_FIRST_ENTITY_TYPES`. The archived decision's rationale ("an About tab derived from a description that only exists after the fetch settles would appear mid-interaction") no longer applies — the description now exists at item construction — but the tab stays omitted because it would only repeat the summary line the Content tab already leads with. The stale comments claiming "a skill has no description at all in its metadata" (`map-skill-to-catalog-item.ts`, `libs/catalog` `DetailsPanel`'s `CONTENT_FIRST_ENTITY_TYPES` block) are corrected in the same change; the details fetch itself is untouched.

*Alternative considered*: expose the whole `attributes` map on the DTO. Rejected — only `description` has a consumer today; a `Record<string, unknown>` blob invites untyped reads. If more attributes are needed later they get their own typed fields.

### D2. `skillsSupported` plumbing follows the established `responsesApi`/`chatCompletion` pattern

- **Listing**: `mapToDeploymentItem` maps `features.skillsSupported` from the raw list entry's `features.skills_supported`, read defensively exactly like `responsesApi`/`chatCompletion` (absent/non-boolean → `undefined`). Additive metadata only — no cache-key or filtering change.
- **Details**: `mapDeploymentFeatures` gains `skillsSupported: getBoolean(raw, 'skills_supported')`; `DeploymentFeaturesDetailsDto` gains the field.
- `DeploymentFeaturesDto` (listing) gains `skillsSupported?: boolean`.
- After the DTO edits: `npm run openapi` + `npm run openapi:check`, then build/lint `chat-api-client`. The frontend reads the flag off the listing-based `DeploymentItemDto.features` — the same source `folderAttachments` already uses — not the details endpoint, so no extra request is needed for the gate.

### D3. Absent flag means "not supported" (`=== true`, not truthy-or-absent)

Core's own default for `skills_supported` is `false`, so the frontend gate is `selectedDeployment?.features?.skillsSupported === true`. This means deployments whose operators have not set the flag lose the skill entry points after this ships — which is the requested behavior ("show skill selection only if chosen model supports them"), but it is a rollout-visible change and is recorded as a risk below.

### D4. The support signal enters the overlay hook as a host-supplied boolean

The app wrapper `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx` gains a parameter `isSkillsSupported: boolean` (host-computed), because each surface resolves "current deployment" differently:

- `ConversationView` — the listing item for the active deployment (`selectedDeployment?.features?.skillsSupported === true`, the same object `folderAttachments` is read from).
- `NewConversationComposer` — its `selectedDeployment` prop.
- `AppPreviewChat` — the app deployment itself (`appDeployment`), since the preview's model is fixed to the app.

The lib hook (`libs/skills`) receives the boolean as a plain parameter — no deployment types, no `DeploymentItemDto` import, keeping the lib domain-agnostic. Internally the effective gate becomes `isEnabled && isSkillsSupported` for the menu-overlay and command-menu configs; `selectedSkillElement` renders regardless (a selected skill must stay visible — in the error state — so the user can see and remove it).

### D5. Error state: `ChatSkill` gains `isUnsupported`, message-only tooltip

`ChatSkill` (and the shared tooltip content component) gain an unsupported variant:

- `isUnsupported?: boolean` prop; when true the `/{name}` label additionally carries an error text class (`unsupportedLabelClassName?: string`, default `'text-error'` — a color utility as a defaulted prop, per the lib styling rules), so the whole chip reads as an error.
- The tooltip content in this state is the unsupported message paragraph only — no description, no spinner, and no "View details" button (the message tells the user what to do; the details panel is still reachable from the Catalog). The message text arrives as a label prop with an English default (`labels.unsupportedTooltipLabel`), threaded from the app's new i18n key.
- The chip keeps its metrics, Top placement, uncontrolled tooltip, and lack of a remove control — removal stays the Backspace-at-position-0 gesture.

The unsupported condition is computed in the hook: `isUnsupported = selectedSkill != null && !isSkillsSupported` — it covers both the "pressed Use in chat on an unsupported model" arrival and the "switched models after selecting" transition, and it clears itself when the user switches back to a supporting deployment.

*Alternative considered*: hide the chip when unsupported. Rejected — a silently vanishing selection is indistinguishable from a bug, and the user explicitly asked for a visible error state.

### D6. Send is blocked through the existing `isSendDisabled` prop

The hook's result exposes `isSkillUnsupported` (the same boolean driving the chip's error state). Each host folds it into the `isSendDisabled` value it already passes to the input (`ConversationView` and `NewConversationComposer` already pass `isSendDisabled={isDisabledSendEnabled}`; `AppPreviewChat` wires the same props through its composers). `Input`'s existing `canSend` computation (`hasSendableContent && !hasBlockedAttachments && !isSendDisabled && !isVoiceActive`) then disables both the send button and the send gesture — the inline-start slot keeps the send button mounted (the slot counts as sendable content), it is merely disabled. No change to `libs/conversation-input` is needed; the lib stays skill-agnostic.

### D7. Entry points hidden when unsupported; catalog "Use in chat" stays visible

- Hidden when `!isSkillsSupported` (in addition to the existing `skillUsageEnabled` flag): the Add-menu "Skills" item (the `menuOverlays` entry is omitted), the slash `/` dropdown (the `commandMenu` config is omitted), and consequently the "Use skill" browse modal (reachable only through those two).
- The Catalog page's "Use in chat" on a Skill **stays visible** within the feature flag. The recorded deferred condition ("render only when the default model supports skills") is resolved as error-state-on-attach instead of hide-the-button: pressing it with an unsupported model navigates to `/`, attaches the skill, and the chip renders in the error state with send disabled — the exact behavior requested. Hiding the button would also require the catalog to know the chat route's live selection, which it does not reliably (the route may not be mounted).
- The `ChatSkill` chip's tooltip (error state) and the skill details side panel remain reachable when a skill is selected.

*Assumption recorded for review*: this reading treats "show skill selection only if chosen model supports them" as the input-surface entry points, and the error state as the unsupported-model outcome for the catalog path. If the catalog button should also hide, the `catalog-use-in-chat` delta's visibility clause changes and the error state's "pressed Use in chat" scenario narrows to model switches after selection.

### D8. Lazy-description cleanup follows the archived design's Follow-up 2 list

Delete: `fetchSkillDescription` (and `fetchSkillManifestDescription` if it has no other consumer) from `libs/chat-hooks/src/catalog/useSkillItemDetails.ts`; the wrapper's `handleFetchSkillDescription`; the lib hook's `onFetchSkillDescription` param, per-session `skillDescriptions` cache, `pendingDescriptionIds` state, `handleItemTooltipOpen`, and the `isDescriptionLoading` plumbing; `FavoriteSkillItem.isDescriptionLoading`; the spinner branch in the shared tooltip content and `ChatSkill`. `SkillListingEntry` and `FavoriteSkillItem` take `description` straight from the listing entry (`buildFavoriteSkillItem` shrinks to a mapping function with no cache/pending inputs). `onItemTooltipOpen` disappears from `FavoriteSkillsPanel`/`ChatSkill` props. The tooltip opens showing the listing description, or — for a skill with none — the "View details" button alone, with no fetch ever.

### D9. One new i18n key

`skillSelector.unsupportedTooltipLabel` — English: "Selected model does not support skills. Remove the skill or select different model to proceed." Grep `en.json` first per the duplicate-value rule; this is a feature-specific sentence, so a `skillSelector.*` key is correct. Added to `SkillSelectorI18nKeys` and every locale file in the same change.

## Risks / Trade-offs

- [Deployments without `skills_supported` configured lose the skill UI on upgrade] → Intended gating, but call it out in release notes; operators must set `features.skills_supported: true` on deployments that accept skills. The `skillUsageEnabled` client flag remains the master switch.
- [Core builds without #1970/#1976 yield no descriptions and no support flags] → The UI already renders "no description" gracefully, and the gate degrades to "hidden"; no fetch fallback is kept (the lazy path is deleted by design).
- [Old chat-api + new frontend (or vice versa) mismatch] → Both fields are optional and defensively read end-to-end; the gate degrades to "hidden" and the description to "absent" — no crashes in mixed versions.
- [User confusion when the skill UI disappears after switching models] → Mitigated by the error-state chip making the cause visible for an already-selected skill; for entry points, the model picker already communicates which model is active.
- [`getBoolean`-style defensive reads keep the flag `undefined` when Core omits it] → The `=== true` gate (D3) makes `undefined` behave as unsupported — a deliberate, documented choice.

## Migration Plan

Purely additive API surface (two optional DTO fields) + frontend gating. No data migration. Rollback = revert the change; the lazy-description path is not resurrected on rollback (it is deleted, so rollback restores it from git as a whole).

Implementation order (each slice independently verifiable):

1. chat-api DTO + mapper changes, OpenAPI regen, backend tests.
2. Catalog description mapping (D1's catalog paragraph) — `mapSkillToCatalogItem` + comment corrections + mapper spec.
3. Frontend description cleanup (D8) — listing description flows to tooltips/chip.
4. `skillsSupported` frontend gate + error state + send disable (D4–D7), i18n key.
5. Docs: `libs/skills` README (props changes), `docs/architecture.md` only if a described mechanism changes (no new lib/app — not expected).

## Open Questions

- None blocking. D7's catalog-button assumption is recorded above for the user to confirm at review.

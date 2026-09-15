# Proposal: skills-listing-description-and-support-gating

## Why

DIAL Core has shipped the two upstream signals the `2026-09-11-use-skills-in-chat` change recorded as deferred conditions: the skill listing now carries each skill's `description` (Core PR #1970 — `attributes` on skill item metadata), and deployments now advertise whether they work with skills (`skillsSupported` / `skills_supported`, Core PR #1976). Until now the frontend fetched each skill's `SKILL.md` on first tooltip open to recover the description (an N+1 download pattern), and the skill-selection UI rendered regardless of whether the chosen model can actually accept skills — sending to a non-supporting deployment fails upstream with a 400.

## What Changes

- **Skill description from the listing**: `GET /api/v1/skills` and `GET /api/v1/skills/catalog` items gain an optional `description` sourced from DIAL Core's new item-metadata `attributes` (nested at `attributes.description` — confirmed against a live Core listing response). The lazy per-skill `SKILL.md` fetch and its machinery (first-open callback, per-session cache, in-flight state, spinner branch) are removed; the listing populates tooltips and the `ChatSkill` chip directly.
- **Catalog skill cards gain descriptions**: `mapSkillToCatalogItem` maps the listing description onto `CatalogItem.description` (previously hardcoded `''`); the details panel's Content summary shows it before the manifest fetch lands. No About tab is added — skills stay content-first.
- **Deployment skills-supported flag**: `DeploymentItemDto.features` and `DeploymentFeaturesDetailsDto` gain `skillsSupported`, forwarded defensively from Core's `skills_supported`; the generated client is regenerated. The frontend treats an absent flag as `false` (Core's own default).
- **Skill selection gated on model support**: the input-surface entry points (Add-menu "Skills" item, slash `/` dropdown, "Use skill" browse modal) render only when the currently selected deployment's `features.skillsSupported` is `true`, in addition to the existing `skillUsageEnabled` flag.
- **ChatSkill error state**: when a skill is selected and the current deployment does not support skills (pressed "Use in chat" from the catalog, or the model switched after selection), the whole `ChatSkill` chip renders in the error color and its tooltip explains that the selected model does not support skills — remove the skill or select a different model to proceed. Sending is disabled while this state holds.
- **Catalog "Use in chat" on skills stays visible** within the feature flag (the recorded deferred condition is resolved as error-state-on-attach rather than hide-the-button), because the error state covers the unsupported case explicitly.

Not changed: the skill details panel's manifest + file-listing fetch, the send-time payload, conversation-history rendering of skills, favorites behavior.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `skills-bff-api` — skill item metadata gains `description` from Core's `attributes` (both the bucket listing and the aggregate catalog listing).
- `deployments-api` — `DeploymentItemDto.features` gains `skillsSupported`, mapped defensively from Core's list-entry `features.skills_supported`.
- `deployment-details-api` — `DeploymentFeaturesDetailsDto` gains `skillsSupported`, mapped in `mapDeploymentFeatures`.
- `skill-input-attachment` — description now comes from the listing (lazy fetch dropped); entry points gain the model-support gate; `ChatSkill` gains an unsupported/error variant with its own tooltip content; send is disabled while the selected skill is unsupported; one new i18n key; the "no new backend endpoints" requirement is amended for the additive DTO field.
- `skill-catalog-item-mapping` — `mapSkillToCatalogItem` maps the listing `description` onto `CatalogItem.description` instead of the hardcoded `''`.
- `skill-details-panel` — the Content-summary requirement's rationale is updated (the description now exists on the listing item pre-fetch; the manifest stays authoritative once fetched; still no About tab).
- `catalog-use-in-chat` — the "Use in chat on a Skill" requirement's deferred model-support condition is resolved: the button stays flag-gated, and an unsupported selected model yields the error-state chip instead of a hidden button.

## Impact

- `apps/chat-api/src/skills` — `SkillMetadataItemDto` + `mapToSkillMetadataItem` (description from `attributes`); Swagger/OpenAPI regen (`npm run openapi`, `openapi:check`).
- `apps/chat-api/src/deployments` — `deployment-mapper.util.ts` (`mapToDeploymentItem`, `mapDeploymentFeatures`), `deployment-details.dto.ts`, `DeploymentFeaturesDto`; OpenAPI regen; `libs/chat-api-client` regenerated.
- `libs/chat-hooks/src/catalog/useSkillItemDetails.ts` — delete `fetchSkillDescription` (details fetch stays).
- `libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts` + its spec — `description: skill.description ?? ''`.
- `libs/catalog/src/components/Details/DetailsPanel.tsx` — stale `CONTENT_FIRST_ENTITY_TYPES` comment corrected (behavior unchanged).
- `libs/skills` — `useSkillSelectorOverlay` (drop description cache/pending/first-open callback; add support-aware state), `ChatSkill` (error variant + unsupported tooltip), `FavoriteSkillItem`/`SkillListingEntry` models (description from listing), README updates.
- `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx` — drop `handleFetchSkillDescription`; supply the unsupported tooltip label and the support gate input.
- `apps/chat` input hosts (`ConversationView`, `NewConversationComposer`, `AppPreviewChat`) — compute `isSkillsSupported` from the selected deployment's listing features; pass `isSendDisabled` when the selected skill is unsupported.
- i18n — one new `skillSelector.*` key (unsupported-model tooltip), all locales.
- Dependencies on upstream: requires a DIAL Core build that includes PRs #1970 and #1976.

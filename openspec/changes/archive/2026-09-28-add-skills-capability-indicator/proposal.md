# Proposal

## Why

The Catalog details panel has no way to tell whether an agent, application, or model
supports skills, so users must trial-and-error attach a skill in chat to find out
(GitHub issue #9102). The backend already reports this via `skillsSupported` on
`DeploymentFeaturesDetailsDto`/`DeploymentFeaturesDto`
(`libs/chat-api-client/src/generated/src/models/index.ts:2694,2767`), populated from
DIAL Core's `skills_supported` field in
`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts:205`. Today that flag is
only consumed to gate the skill-selector overlay in chat (e.g.
`apps/chat/src/components/ConversationView/ConversationView.tsx:319,343`); it is never
surfaced in the Catalog details panel's existing Capabilities section
(`libs/catalog/src/components/Details/TabsContent/Overview.tsx`, fed by
`mapModelDetails`/`mapAgentDetails` in
`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`).

## What Changes

- Add `hasSkills?: boolean` to the `DeploymentCapabilities` superset
  (`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts:405-419`) and map it in
  `mapFeaturesToCapabilities` (same file, ~line 427) from `features.skillsSupported`.
- Add `hasSkills?: boolean` to `ModelCapabilities` and `AgentCapabilities`
  (`libs/chat-hooks/src/catalog/entity-details.ts`). `ToolsetCapabilities` is
  intentionally left unchanged — toolsets are out of scope, and their Capabilities
  section is spec'd to never render at all
  (`openspec/specs/catalog-item-details-fetch/spec.md:554-557`).
- In `mapModelDetails` and `mapAgentDetails`
  (`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`), append a new row
  `{ label: 'Skills', value: c.hasSkills }` to the end of each entity's existing
  Capabilities `specs` array, following the same plain-string-literal, boolean
  Yes/No row pattern already used by `'Tools'`, `'Parallel tool calls'`, and
  `'Configuration schema'`. No new UI component; the existing `Overview`/`TableView`
  renderer already turns a boolean spec into a Yes/No row.
- Amend the existing spec requirement in `catalog-item-details-fetch` that currently
  enumerates an exhaustive, closed list of rendered Capabilities rows ("Tools,
  Parallel tool calls, Reasoning efforts (model only), and Configuration schema
  (application only)") to include the new Skills row, and add scenarios covering it.

Not in scope:
- No backend or API changes — `skillsSupported` is already returned end-to-end.
- No changes to `ToolsetCapabilities` or the toolset Overview tab.
- No i18n — the existing Capabilities row labels in this section are plain,
  untranslated string literals (confirmed in
  `openspec/specs/catalog-item-details-fetch/spec.md:529-532`), and `'Skills'`
  follows that same established pattern rather than introducing translation for
  just one row in an otherwise-untranslated section.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-item-details-fetch`: the "Input/Output modalities render as friendly
  labels, and internal-only capability flags are hidden" requirement
  (`openspec/specs/catalog-item-details-fetch/spec.md:496-527`) currently states an
  exhaustive list of rendered Capabilities rows for models and applications; that
  list gains a `Skills` row, backed by a new `hasSkills` flag that is mapped (unlike
  the seven flags the same requirement deliberately keeps hidden).

## Impact

- `libs/chat-hooks/src/catalog/entity-details.ts` — two type additions
  (`ModelCapabilities.hasSkills`, `AgentCapabilities.hasSkills`).
- `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` — one field added to
  `DeploymentCapabilities`, one mapping line in `mapFeaturesToCapabilities`, one row
  push each in `mapModelDetails` and `mapAgentDetails`.
- `openspec/specs/catalog-item-details-fetch/spec.md` — requirement text and
  scenarios updated to reflect the new row.
- No changes to `libs/catalog` (the rendering lib), `apps/chat-api`, or
  `libs/chat-api-client` — all consumed fields and rendering primitives already
  exist.
- Rollback: revert the two type additions and three mapping lines; the amended spec
  requirement reverts with it. Fully backward compatible — an older client ignoring
  the new `hasSkills` field, or a backend response omitting `skillsSupported`,
  behaves exactly as before (the row is simply omitted, matching how every other
  optional Capabilities row already degrades).

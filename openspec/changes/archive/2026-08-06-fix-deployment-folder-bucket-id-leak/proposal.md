## Why

GitHub issue [#7962](https://github.com/epam/ai-dial-chat/issues/7962): in the deployment-selector overlay (the compact "Application details" popover reached from the conversation input, not the full Catalog view), a shared Quick App shows the raw internal DIAL bucket ID (e.g. `8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW...`) as its folder/path label instead of a readable, localized value. This leaks an internal storage identifier to end users.

Root cause: `mapDeploymentToCatalogItem` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) resolves the `folder` field via `resolveDeploymentFolder(deployment, t)` — which correctly strips the `applications/` prefix, decodes segments, and substitutes localized labels for Personal/Shared/Public roots — only when an i18next `TFunction` is supplied. When `t` is omitted, it falls back to `deployment.applicationFolder?.split('/') ?? []`, a raw, undecoded split with no prefix-stripping or bucket-segment removal. `useDeploymentSelectorOverlay.tsx` calls `mapDeploymentToCatalogItem` at two call sites without passing `t`, hitting this unsafe fallback.

## What Changes

- Make the `t: TFunction` parameter of `mapDeploymentToCatalogItem` required (remove the optional raw-split fallback branch) so a raw, un-decoded bucket path can never reach the UI. **BREAKING** (internal utility signature only — no external API/contract change).
- Update both call sites in `apps/chat/src/components/DeploymentSelector/useDeploymentSelectorOverlay.tsx` to obtain `t` via `useTranslation()` and pass it through, so the existing correct `resolveDeploymentFolder` logic (prefix-stripping, decoding, localized Personal/Shared/Public root labels) always runs.
- No changes to `mapToolsetToCatalogItem` / `resolveToolsetFolder` — confirmed already safe: `resolveToolsetFolder` unconditionally drops the raw bucket/public segment via `.slice(1)` on every return path regardless of whether `t` is passed, so toolsets have no equivalent leak.

## Capabilities

### New Capabilities

- `deployment-catalog-item-mapping`: the frontend mapping from a `DeploymentItemDto` to a catalog-display `CatalogItem`, including the requirement that the derived `folder` path is always resolved through localized, decoded, bucket-free segments — never a raw un-decoded split of `applicationFolder`.

### Modified Capabilities

_None — no existing spec in `openspec/specs/` documents this frontend mapping contract; `deployments-application-folder` covers the backend-computed source field, not this frontend consumption logic._

## Impact

- `apps/chat/src/utils/map-deployment-to-catalog-item.ts` — `mapDeploymentToCatalogItem` signature change (drop optional fallback, require `t`).
- `apps/chat/src/components/DeploymentSelector/useDeploymentSelectorOverlay.tsx` — both call sites updated to pass `t`.
- Any existing unit tests for `mapDeploymentToCatalogItem` that call it without `t` need updating.
- No backend, API, or DTO changes.

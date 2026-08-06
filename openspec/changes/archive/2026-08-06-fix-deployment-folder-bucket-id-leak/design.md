## Context

`mapDeploymentToCatalogItem` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) is the single mapping function from the backend `DeploymentItemDto` to the frontend `CatalogItem` shape consumed by both the full Catalog view and the compact deployment-selector overlay. It has two `folder`-resolution code paths gated on whether an i18next `TFunction` is passed:

- `t` provided → `resolveDeploymentFolder(deployment, t)`: strips the `applications/` prefix, decodes percent-encoded segments, and replaces the bucket/root segment with a localized `Personal`/`Shared`/`Public` label.
- `t` omitted → `deployment.applicationFolder?.split('/') ?? []`: a raw split with none of the above, so for a shared app whose `applicationFolder` looks like `applications/<bucket-id>/appdata/quick-apps/...`, the literal bucket ID surfaces as a folder segment.

`useDeploymentSelectorOverlay.tsx` is the only caller that omits `t` (both of its two call sites), which is the exact path GitHub issue #7962 reproduces through.

## Goals / Non-Goals

**Goals:**
- Guarantee a raw, un-decoded `applicationFolder` value can never reach `CatalogItem.folder` from any call site, present or future.
- Preserve existing behavior for callers that already pass `t` (`CatalogView.tsx`) — no visible change there.

**Non-Goals:**
- Reworking `resolveDeploymentFolder`'s localization/decoding logic itself (already correct).
- Touching `mapToolsetToCatalogItem` / `resolveToolsetFolder` — verified safe already, since that function unconditionally drops the raw bucket/public segment via `.slice(1)` regardless of `t`.
- Any backend/DTO change — `applicationFolder`'s shape and derivation (`deployments-application-folder` spec) is unchanged.

## Decisions

**Make `t: TFunction` a required parameter of `mapDeploymentToCatalogItem`, deleting the raw-split fallback branch entirely**, rather than teaching the fallback branch to also strip/decode segments.

Rationale: a second, parallel "safe-ish" fallback implementation is exactly how this bug was introduced — two code paths computing the same derived value invite drift. `t` is always available synchronously via `useTranslation()` in every actual call site (both are React hooks/components), so there is no real caller for whom `t` is unavailable. Removing the optional path is a compile-time guarantee (TypeScript will error at any call site that forgets to pass `t`) rather than a runtime convention that can regress silently.

Alternative considered: keep `t` optional but make the fallback call `resolveDeploymentFolder` with a no-op identity `TFunction`-shaped stub (i.e., `(key) => key`) instead of raw-splitting. Rejected — it still permits an un-decoded/un-prefixed bucket path to leak whenever a translated label isn't substituted for the root segment (the actual field being leaked isn't the label, it's `segments` itself, which the raw path never strips the first element from). Requiring `t` and reusing the one correct implementation is simpler and removes the bug class instead of patching one instance of it.

## Risks / Trade-offs

[Existing unit tests for `mapDeploymentToCatalogItem` that call it without `t`] → will fail to typecheck once `t` is required; update them to pass a test `TFunction` (e.g. from `i18next` test setup or a simple `(key: string) => key` cast) as part of this change.

[Any other future/undiscovered caller of `mapDeploymentToCatalogItem` omitting `t`] → becomes a TypeScript compile error immediately, not a runtime leak — this is the point of the decision, not a residual risk.

## Migration Plan

1. Update `mapDeploymentToCatalogItem` signature: require `t: TFunction`, remove the `t != null ? ... : ...` ternary for `folder`, call `resolveDeploymentFolder(deployment, t)` directly.
2. Update both call sites in `useDeploymentSelectorOverlay.tsx` to obtain `t` via `useTranslation()` and pass it to `mapDeploymentToCatalogItem`.
3. Update `CatalogView.tsx`'s existing call (already passes `t`) — no change needed, verify it still typechecks.
4. Fix/update any unit tests exercising the old optional-`t` fallback.
5. Run `nx affected` build/lint/test for `apps/chat` to confirm no other call sites broke.

No backend deploy, feature flag, or data migration involved — this is a pure frontend, non-persisted display-mapping fix.

## Context

The catalog detail panel has a non-functional Share button. PR #7710 delivered the frontend shell (SharePopover UI, `shareOverlay` render-prop, `useShareLink` hook) with a mock `getShareLink` seam that simulates a network call. This change wires the seam to a real backend endpoint and documents the full architecture from UI through to DIAL Core.

Current state: `apps/chat/src/utils/share-link.ts` resolves a hardcoded URL after a 400 ms delay. No backend endpoint exists yet.

## Goals / Non-Goals

**Goals:**
- Replace the mock seam with a real `POST /api/v1/share` endpoint.
- Move `SharePopover` and `QrPlaceholder` from `apps/chat/src/components/SharePopover/` into a new `libs/share` library; refactor to receive all share data via props (no internal hook calls).
- Keep the `shareOverlay` render-prop contract in `libs/catalog` unchanged.
- Support "Can view" / "Can edit" access levels for Agent, Application, Skill, Toolset.
- Hide Share for Guardrail and MCP.
- Model is view-only (static label, no dropdown).

**Non-Goals:**
- Share-link revocation or management UI.
- Per-user sharing (the link is organization-wide).
- Push access-level changes to DIAL Core on dropdown change (the level is sent once when the link is created; changing access regenerates via another POST).

## Decisions

### 1. SharePopover moves to `libs/share` (`@epam/ai-dial-share`) as a pure UI lib

`SharePopover` and `QrPlaceholder` are reusable, host-agnostic UI. Moving them to `libs/share` enforces the boundary: the lib cannot import `useShareLink`, the server-api wrapper, or any app context. All runtime data flows in through props.

`SharePopoverProps`:
```ts
interface SharePopoverProps {
  url: string | undefined;
  isLoading: boolean;
  error: Error | null;
  access: ShareLinkAccess;
  canEditAccess: boolean;           // false for Model
  onAccessChange: (a: ShareLinkAccess) => void;
  onClose: () => void;
  labels?: SharePopoverLabels;      // includes a pre-formatted expiryNote
}
```

Share types (`ShareLinkAccess`, `SharePopoverView`, `ShareLinkData`) are co-located in the lib and exported from its `index.ts`. `apps/chat/src/types/share.ts` is deleted; consumers import from `@epam/ai-dial-share`.

The lib may import: `@epam/ai-dial-chat-shared` (for `useCodeCopy`, `mergeClasses`), `@epam/ai-dial-ui-kit`, `@epam/ai-dial-catalog` (for `CatalogEntityType`). It must NOT import app hooks, server-api wrappers, generated API clients, or i18n config.

**App adapter — `SharePopoverContainer`** (`apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx`):
- Accepts `item: CatalogItem` and `onClose: () => void`.
- Calls `useShareLink(item.id)` internally.
- Derives `canEditAccess` from `item.type` against `EDITABLE_ACCESS_TYPES`.
- Renders `<SharePopover ... />` from `@epam/ai-dial-share` with all flat props.

`CatalogView`'s `shareOverlay` then renders `<SharePopoverContainer item={item} onClose={onClose} />`.

**Alternative considered:** Keep `SharePopover` in `apps/chat` and skip the lib entirely. Rejected because the component is self-contained UI that could serve other future host apps (e.g., the file manager), and the lib boundary prevents accidental hook coupling creeping back in.

### 2. Render-prop (`shareOverlay`) isolates `libs/catalog` from app concerns

`libs/catalog` must not know the share URL, API client, or i18n keys. The `shareOverlay?: (item, onClose) => ReactNode` prop on `CatalogProps`/`DetailsPanelProps`/`Header` keeps the lib host-agnostic. `CatalogView` in `apps/chat` injects `<SharePopover>` as the overlay — already implemented in the PR.

**Alternative considered:** Emit an `onShare` event and open the popover from the app above. Rejected because it requires the app to position/anchor the popover relative to the Share button, coupling the app to catalog header layout details.

### 2. `getShareLink` as a single swappable seam

`apps/chat/src/utils/share-link.ts` exports `getShareLink(itemId, access)` — one function the hook calls. Replacing the mock body with a generated-client call requires zero changes to the hook or the UI.

### 3. Backend: new `share` NestJS domain

A new `apps/chat-api/src/share/` domain following the single-folder-per-domain convention:
```
share/
  share.controller.ts   POST /api/v1/share
  share.service.ts      delegates to DialClientService
  share.module.ts
  tests/
    share.controller.spec.ts
    share.service.spec.ts
  dto/
    create-share-link.dto.ts   (request body)
    share-link-response.dto.ts (response)
```

Controller follows the `theme.controller.ts` reference: `@ApiTags`, `@Controller({ path: 'share', version: '1' })`, thin handler, full `@ApiResponse` coverage. See `apps/chat-api/AGENTS.md` for full NestJS conventions.

### 4. DIAL Core integration via `DialClientService`

`ShareService` injects `DialClientService` and calls the DIAL Core share API via `@epam/ai-dial-typescript-sdk`. If the SDK does not expose a share endpoint, fall back to a raw `fetch` call against `DIAL_CORE_URL` and document the gap in code comments.

### 5. Authorization

The share endpoint requires an authenticated session. The existing `SessionGuard` (applied globally, with `@Public()` opt-out) covers this automatically — no extra guard is needed. The DIAL Core token from the session is forwarded in the SDK client call.

### 6. Generated API client regeneration

After the NestJS endpoint is added, run `npm run openapi && npm run openapi:check` to regenerate `libs/chat-api-client` and verify the SDK method appears. The frontend seam (`getShareLink`) then calls the generated method through the `apps/chat/src/server-api/share.api.ts` wrapper.

### 8. Access level representation

`ShareLinkAccess` is a string enum (`view` | `edit`) defined in `@epam/ai-dial-share` (`libs/share`) and exported from its `index.ts`. `apps/chat-api` DTOs use `@IsEnum` against the same string values; the enum is not imported from the lib into the backend — the DTO defines the allowed strings directly to avoid a cross-boundary import. DIAL Core may use different values — map them in `ShareService`, not in the DTO or the UI.

## Risks / Trade-offs

- **DIAL Core share API shape unknown** → The service is built against a placeholder; once the real DIAL Core endpoint contract is confirmed, only `share.service.ts` needs updating. The seam design limits blast radius.
- **Access-level change on each POST** → Changing "Can view" to "Can edit" generates a new link (same entity, different access parameter). If DIAL Core does not support PATCH for access updates, the old link continues to work until it expires. Documented as a known limitation; no extra UI warning needed for MVP.
- **No link revocation** → Out of scope per Non-Goals. The expiry window (default 3 days) bounds exposure.

## Migration Plan

1. Merge the PR #7710 frontend shell (mock seam) — no backend changes needed for this step.
2. Implement `share` NestJS domain → regenerate API client → update `getShareLink` seam to call the generated client.
3. Smoke-test Share button end-to-end in dev environment.
4. No data migration needed; no existing share records.
5. Rollback: remove the `share` domain and revert `getShareLink` to the mock — the UI degrades to loading state, no crash.

## Open Questions

- What is the exact DIAL Core endpoint path and request/response schema for share-link creation? (Needed for `ShareService` implementation.)
- Does DIAL Core differentiate between "view" and "edit" access at the API level, or is access enforced only client-side?
- Should the expiry duration be configurable via an env variable, or is the DIAL Core default sufficient?

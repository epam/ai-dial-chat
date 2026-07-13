## Why

The catalog's detail panel has a Share button with no functional behavior. Users need a way to generate and copy a shareable link — or a QR code — for catalog deployments (agents, applications, skills, toolsets), with control over whether the link grants view-only or edit access.

## What Changes

- New `libs/share` library (`@epam/ai-dial-share`) containing the `SharePopover` and `QrPlaceholder` UI components, share types (`ShareLinkAccess`, `SharePopoverView`, `ShareLinkData`), and all popover-internal view logic. The lib is host-agnostic: it receives share data and callbacks as props.
- Access-level control ("Can view" / "Can edit") shown for editable entity types (Agent, Application, Skill, Toolset); Model is view-only (static label); Share button hidden for Guardrail and MCP, and hidden entirely for items the current user doesn't own (`isMyApp` is not `true`).
- `shareOverlay` render-prop added to `CatalogProps`, `DetailsPanelProps`, and `Header` (in `libs/catalog`) — the host app injects the popover without the lib knowing the implementation.
- New `SharePopoverContainer` in `apps/chat` that calls `useShareLink` and passes resolved data into the lib's `SharePopover`; wired via `CatalogView`'s `shareOverlay`.
- New `useShareLink` hook and `getShareLink` seam in `apps/chat` that today returns a mock; the seam is designed to be swapped for a real `POST /api/v1/share` call.
- Backend `POST /api/v1/share` endpoint in `apps/chat-api` that creates a share link via DIAL Core and returns the URL, access level, and expiry.
- New i18n keys under `share.*` in `apps/chat/src/i18n/locales/en.json`.
- `useCodeCopy` exported from `libs/chat-shared` for use inside the lib.
- `access` is an array (`ShareLinkAccess[]` / `ShareAccess[]`), not a single value, because edit access implies view access: "Can edit" is `[View, Edit]`, "Can view" is `[View]`. `ShareService` requests the union of both levels' DIAL Core permissions when both are present.
- New `GET /api/v1/share/invitations/:invitationId` endpoint and `/catalog/shared/:invitationId` frontend route close a gap where opening a generated share link had no handler at all (it 404'd). The share URL now points at this route instead of DIAL Core's raw `invitationLink` path; opening it silently accepts the invitation via DIAL Core (the step that actually grants access) and redirects into `/catalog` with the shared item's details panel open (`initialDetailsItemId` on `libs/catalog`'s `Catalog`).

## Capabilities

### New Capabilities

- `catalog-item-sharing`: `@epam/ai-dial-share` (`libs/share`) lib with `SharePopover` / `QrPlaceholder` UI (link copy, QR placeholder, access selector, keyboard/focus behavior); `SharePopoverContainer` and `useShareLink` hook in `apps/chat`; `shareOverlay` prop contract in `libs/catalog`; `SharedInvitationPage` and the accept-invitation redirect flow.
- `share-link-api`: Backend `POST /api/v1/share` NestJS endpoint that proxies the DIAL Core share API, returning `{ url, expiresInDays, access }`; `GET /api/v1/share/invitations/:invitationId` that accepts an invitation and returns `{ itemId }`.

### Modified Capabilities

- `unified-catalog`: `CatalogProps` and `DetailsPanelProps` gain the optional `shareOverlay` render-prop; `CatalogProps` also gains the optional `initialDetailsItemId` prop for deep-linking into a specific item's details panel; no requirement changes to existing catalog behaviors.

## Impact

- **libs/share** (`@epam/ai-dial-share`, new): `SharePopover`, `QrPlaceholder`, share types (`ShareLinkAccess`, `SharePopoverView`, `ShareLinkData`); depends on `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-kit`.
- **libs/catalog**: `CatalogProps`, `DetailsPanelProps`, `Header` — new optional `shareOverlay` prop; `CatalogProps` — new optional `initialDetailsItemId` prop (both non-breaking).
- **libs/chat-shared**: exports `useCodeCopy`.
- **apps/chat**: new `SharePopoverContainer` component, `useShareLink` hook, `getShareLink` seam, i18n keys; `CatalogView` wires `shareOverlay` and reads `?itemId=` for `initialDetailsItemId`; share types removed from app in favour of lib exports; new `SharedInvitationPage` at `ROUTES.SharedInvitation` (`/catalog/shared/:invitationId`).
- **apps/chat-api**: new `share` domain (`share.controller.ts`, `share.service.ts`, `share.module.ts`, DTOs including `GetInvitationDto`/`AcceptInvitationResponseDto`); DIAL Core HTTP calls for link generation and invitation acceptance.
- **Generated API client** (`libs/chat-api-client`): regenerated after adding each endpoint.

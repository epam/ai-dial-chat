# Design

## Context

`AppEditorIframe` builds `iframeUrl` in a `useMemo` with `URLSearchParams` (`authProvider`, `id`, `theme`, `applicationCredentials`) and separately derives `displayName = schema.displayName ?? ''` inside `handleMessage` to match `${displayName}/readyToInteract|readyToSave|loggedOut|updatedApplicationSuccess`. `AppsEditorQuery` in `apps/chat/src/types/apps-editor.ts` holds chat's own route params (`Schema`, `AppId`). See proposal.md for motivation.

## Goals / Non-Goals

**Goals:** pass `applicationName`; one source for the name used in the URL and the message prefix; named keys for iframe params.

**Non-Goals:** protocol changes; QuickApps-side work; changing the iframe `title`.

## Decisions

1. **Value is `schema.displayName`, omitted when empty.** An empty param would be indistinguishable from "unset" for the consumer, and the prefix would degenerate to `/readyToInteract` anyway. `URLSearchParams` handles encoding (`Quick app 2.0` becomes `Quick+app+2.0` and decodes correctly via `searchParams.get`).
2. **Shared source.** Compute `applicationName = schema.displayName ?? ''` once at component level and use it for both the iframe URL and the message-prefix matching, replacing the in-handler `displayName`. A helper function was rejected as over-engineering; sharing code with QuickApps is impossible across repos.
3. **Separate enum `AppsEditorIframeQuery`, not an extension of `AppsEditorQuery`.** `AppsEditorQuery` is the normative `/apps-editor` route contract ("Apps-editor query param contract" in `app-editor-flow`), read via `useSearchParams`; mixing in outbound iframe keys would blur it. Members: `AuthProvider = 'authProvider'`, `Id = 'id'`, `Theme = 'theme'`, `ApplicationCredentials = 'applicationCredentials'`, `ApplicationName = 'applicationName'`.
4. **Memo deps.** `iframeUrl` deps gain `schema.displayName`; a change reloads the iframe and the existing `[iframeUrl]` effect re-gates readiness (existing behavior, now covered by a test).

## Risks / Trade-offs

- [Display name differs from what QuickApps previously got from env] -> chat already requires the postMessage prefix to equal `displayName`, so a mismatching env was already broken; the new source is authoritative.
- [Older QuickApps ignores the param] -> harmless; it keeps using its env until upgraded.
- [Newer QuickApps with older chat gets no param] -> avoided by the rollout order below.

## Migration Plan

Deploy chat first, then QuickApps (the sibling change that drops `CUSTOM_CLIENT_VARIABLES.applicationName`). Rollback: revert the chat commit; if QuickApps already relies on the param, roll QuickApps back first.

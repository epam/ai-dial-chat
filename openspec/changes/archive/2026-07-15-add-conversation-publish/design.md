## Context

`apps/chat-api/src/publish/` already proxies DIAL Core's Publication API (`createPublication`/`getPublications`) for catalog entities (Toolset, Application) at `POST /api/v1/catalog/{entityType}/{entityId}/publish`. `entityId` there is a catalog resource id shaped `{name}__{version}`, and the service derives the publication's display name and version from that suffix (`splitEntityNameAndVersion`). Conversations have no such id shape — a conversation's DIAL Core resource path is `conversations/{bucket}/{path...}`, with no embedded version, and it can be renamed (its title, not its path, changes on rename — the path used for publication history stays stable unless the conversation resource itself is moved).

Conversations already have their own NestJS domain (`apps/chat-api/src/conversations/`, `ConversationController` at `@Controller({ path: 'conversations', version: '1' })`) whose existing path-taking endpoints (`GET`, `PUT`, `PATCH`, `duplicate`, `DELETE`) all take the conversation path as a **query parameter** (`ConversationPathDto { path: string }`), not a URL path segment — because a conversation path contains `/` and NestJS route params don't cleanly capture arbitrary slash-containing segments the way the catalog controller's single already-percent-encoded `entityId` segment does. This design follows that existing convention rather than the catalog controller's segment-based shape.

On the frontend, `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` already tracks one `pendingShareConversationPath: string | null` per popover-style flow (Share) and renders `ShareConversationPopoverContainer` conditionally. The catalog publish UI lives in `libs/catalog` (`DetailsPanel`, `PublishPanel`, `PublishFooter`, `usePublishFlow`, `derivePublishState`) and is coupled to `CatalogItem` (which always has `.version`).

## Goals / Non-Goals

**Goals:**
- Let a user publish an owned, writable conversation to an Organization/public folder, reusing the same DIAL Core Publication API integration pattern already proven for catalog entities.
- Reuse the catalog publish lib components (folder tree, history list, callouts, footer) for conversations without duplicating them, by widening their props to a resource-summary shape that covers both "versioned catalog item" and "title-only conversation".
- Keep the standalone conversation publish panel visually and behaviorally consistent with the catalog `DetailsPanel` publish sub-view, except for the header (Close instead of Back) since there is no details view underneath it.

**Non-Goals:**
- Version/republish semantics for conversations beyond "publish once per folder" (no update-in-place flow). Documented as a follow-up.
- A per-publication access-rules editor (`rules` stays `[]`, matching catalog publish).
- Publishing from the open chat view's own header menu (row menu in the conversation panel only, per proposal's out-of-scope).
- Changing catalog publish's own request/response shapes for Toolset/Application — this change is additive to that surface.

## Decisions

### D1: Dedicated `apps/chat-api/src/conversations/` publish endpoints, not an `entityType: conversation` addition to `PublishController`

Adds `POST /api/v1/conversations/publish` and `GET /api/v1/conversations/publish-history`, both taking `path` as a query parameter (`ConversationPublishDto extends ConversationPathDto`), registered on the existing `ConversationController` (or a sibling `ConversationPublishController` in the same domain folder if the controller would otherwise grow too large — decided at implementation time by file size, not a spec-level concern).

Rejected alternative (Option A from the initial ask — extending `PublishController`'s `entityType` enum with `conversation` and accepting `entityId` shaped as the full `conversations/{bucket}/{path}` resource path): rejected because (a) `PublishController`'s route prefix is `catalog`, and a conversation is not a catalog entity — routing it through `/api/v1/catalog/conversation/...` would be a confusing URL for a resource the catalog domain doesn't otherwise own or list; (b) `entityId` there is a single URL path **segment** relying on the generated client's automatic encoding of one opaque string, whereas every existing conversation endpoint already establishes the query-param convention for exactly this reason (conversation paths are multi-segment and the generated OpenAPI client's segment-encoding for catalog ids isn't exercised elsewhere for multi-segment paths); (c) `splitEntityNameAndVersion` and the whole `{name}__{version}` recovery logic in `publish.service.ts` has no equivalent for conversations and would need a conditional branch, defeating the reuse the option was meant to provide anyway.

Shared logic between the two controllers (the `public/{folderPath}/` target-folder construction, `encodeDialResourcePath` folder-segment encoding, `PUBLIC_URL_PREFIX`, `stripPublicTargetFolder`) is extracted from `publish.service.ts` into `apps/chat-api/src/publish/publish-target.util.ts` (pure functions, no DI) and imported by both `PublishService` (catalog) and the new `ConversationPublishService`, rather than duplicated.

Request/response shape for the new conversation endpoints intentionally mirrors the catalog ones but drops `version`:

```
POST /api/v1/conversations/publish?path=<conversation-path>
{ "folderPath": "Organization/Data Science" }
```

Core call:
```json
{
  "name": "<conversation title>",
  "targetFolder": "public/Organization/Data Science/",
  "resources": [{
    "action": "ADD",
    "sourceUrl": "conversations/{bucket}/{path}",
    "targetUrl": "conversations/public/Organization/Data Science/{conversationName}"
  }],
  "displayAuthor": "<display name>",
  "rules": []
}
```
`{conversationName}` is the resource's own last path segment (same `getResourceTypePrefix`/`getResourceName` helpers, generalized), not the conversation's (mutable) title — this keeps `targetUrl` stable across renames, matching how a catalog entity's `targetUrl` uses its resource name rather than a display label.

`name` sent to Core is the conversation's current title (read via `ConversationService.getConversationMetadata`/`getConversation`, whichever is cheaper — decided at implementation time), not `{name}__{version}` since conversations have no version.

Response:
```json
{
  "path": "conversations/{bucket}/{path}",
  "folderPath": "Organization/Data Science",
  "publishedAt": "2026-07-15T10:00:00.000Z",
  "publishedBy": "Test User"
}
```
(`PublishConversationResultDto` — no `version`, no `entityType`/`entityId` pair since there's exactly one resource kind.)

### D2: Publish history is keyed by the conversation's resource path, not a separate publication id; folder-scoped "already published" replaces version-based "replace"

`GET /api/v1/conversations/publish-history?path=...` calls Core's `getPublications({ body: { url: path } })` the same way `PublishService.getPublishHistory` does, filtered to `resources[].sourceUrl === path`, mapped to `PublishHistoryEntryDto`-equivalent entries without a `version` field, ordered by `publishedAt` descending — reusing the same known caveat already logged as an open issue against `catalog-publish-api` (task 6.8: `getPublications`'s `url` field is documented by Core as a list **scope**, not a resource filter, so this call's real-world behavior against a live Core instance is unverified for catalog entities and will carry the same open question here, not a new one introduced by this change).

Because a conversation path is stable identity (renaming changes title, not path; only a move/duplicate changes path, and a duplicated conversation is a distinct resource with its own empty history) and there is no version dimension, "publish again to a folder that already has this conversation" has no natural "update version N" framing. This design treats it as **already published** — the submit action is disabled with a distinct callout (not the catalog `ReplaceWarning`'s "will replace" wording) when history for the selected folder is non-empty, since the deferred republish/versioning semantics from the proposal's out-of-scope section mean there is no supported "publish again to the same folder" action for v1.

### D3: Lib-level generalization — `PublishResourceSummary` replaces the `CatalogItem`-only shape in `PublishPanel`/`PublishFooter`

`libs/catalog/src/models/publish.ts` gains:
```ts
export interface PublishResourceSummary {
  /** Display title/name shown in the summary row. */
  title: string;
  /** Icon URL, if any (catalog items only; conversations pass none). */
  iconUrl?: string;
  /** Version, when the resource is versioned (catalog items only). */
  version?: string;
}
```
`PublishPanelProps.item: CatalogItem` becomes `resource: PublishResourceSummary` (or a thin adapter is provided so `CatalogItem` callers build `{ title: item.name, iconUrl: item.iconUrl, version: item.version }` — decided at implementation time by which reads cleaner in `DetailsPanel`). The summary row renders `EntityHeader` only when `iconUrl`/version-pill data is present; a title-only conversation renders a simpler row (title + conversation icon) instead of `EntityHeader`'s version pill.

`PublishFooterProps.version: string` becomes `version?: string`; when `version` is `undefined` (the conversation case), the submit label is always the fixed `publishDefaultLabel` regardless of `hasExistingVersionInFolder` — but per D2, the host disables submit instead of relying on the footer to decide between "Publish"/"Update" wording, since there is no update path for conversations.

`derivePublishState`'s `hasExistingVersionInFolder: boolean` input is renamed to `hasExistingPublicationInFolder: boolean` (a same-meaning rename, since "version" no longer universally applies) with no change to its return contract; catalog callers pass the same boolean they already compute, just renamed at the call site.

This is the only change to `catalog-publish-flow`'s existing requirements — a prop/type generalization with no observed behavior change for Toolset/Application publish, verified by keeping `libs/catalog`'s existing publish tests green.

### D4: Standalone panel shell is a new lib component, not a reuse of `DetailsPanel`

`DetailsPanel` is catalog-item-shaped end-to-end (tabs, credentials, share/unshare, favorite star) and its publish sub-view's header conditionally hides Back/Close based on `isPublishOpen`. Retrofitting a "no details behind me" mode into `DetailsPanel` itself would add a second header-branching axis for a component that already branches on `isPublishOpen`. Instead, a new `libs/catalog/src/components/PublishPanel/StandalonePublishPanel.tsx` (naming TBD at implementation time) owns just the slide-in shell (backdrop, `role="dialog"`, `desktop:w-[540px]` sizing, Escape-to-close, Close-disabled-while-submitting) and renders the same `PublishPanel` body + `PublishFooter` footer `DetailsPanel` already uses — sharing the body/footer components (per D3) but not the shell itself. This avoids coupling the catalog details shell to a "no back" mode it doesn't otherwise need, at the cost of a small amount of duplicated shell markup (backdrop + panel positioning classes) between `DetailsPanel` and the new component; the shared body/footer components are where the actual publish logic lives, so this duplication is presentational only.

### D5: App-level container follows the `ShareConversationPopoverContainer` pattern, using a renamed shared folder hook

`apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx` takes `{ conversationPath: string; conversationTitle: string; onClose: () => void }`, mirroring `ShareConversationPopoverContainer`'s `{ conversationPath, onClose }` shape plus the title (needed for the summary row and the Core `name` field is server-derived, not sent by the client — the client only needs the title for display, matching `ConversationPanelView`'s existing in-memory `panelItem.title`).

`useCatalogPublishFolders` (folder-tree loading against the Organization/public bucket) has no catalog-specific logic in it already — it lists `public` files generically. It is renamed to `usePublishFolders` and moved to `apps/chat/src/hooks/publish/usePublishFolders.ts` (folder used by both catalog and conversation publish containers), with `apps/chat/src/hooks/catalog/useCatalogPublishFolders.ts` becoming a thin re-export or removed once both call sites are migrated — a mechanical rename, not a behavior change.

`ConversationPanelView` adds `pendingPublishConversationPath: string | null` state alongside the existing `pendingShareConversationPath`, and a `getActions` entry gated identically to `share`'s existing `isReadonlyItem` check.

## Risks / Trade-offs

[Duplicated shell markup between `DetailsPanel` and the new standalone panel component (D4)] → Both pull backdrop/panel positioning classes from the same Tailwind utility set already used by `DetailsPanel`; if a third standalone-panel use case appears later, extract a shared `SlideInPanelShell` at that point rather than speculatively now.

[`getPublications`'s `url` field may not actually filter by resource, per the existing open issue against `catalog-publish-api`] → This change inherits, not introduces, that risk. If catalog publish history turns out broken against live Core, the same fix (whatever it is) applies to the conversation history endpoint's identical call shape.

[Conversation path used as `sourceUrl`/history key changes if the conversation is later moved to a different folder within the user's own bucket] → Out of scope for v1: this design treats "move" as equivalent to duplicate+delete for publication-identity purposes, and does not attempt to re-associate old publish history with a moved path. Documented as a known limitation, not solved here.

[Two near-identical NestJS services (`PublishService`, `ConversationPublishService`) instead of one generalized service] → Accepted per D1's rejection of the `entityType: conversation` extension; the shared pure-function utility module (`publish-target.util.ts`) keeps the actual Core-request-shape logic in one place, so the duplication is limited to controller/service scaffolding, not business logic.

## Migration Plan

Additive only — no existing endpoint, DTO, or lib prop is removed in a breaking way (D3's prop renames are internal to `libs/catalog`, whose only consumer is `apps/chat`, updated in the same change). No feature flag: the new row-menu action and endpoints ship together behind normal PR review; rollback is a plain revert since nothing persists conversation-publish state outside DIAL Core itself (same non-persistence property as catalog publish).

## Open Questions

- Exact naming for the new standalone panel component and whether `ConversationPublishController` should be a new file or added to the existing `ConversationController` (decided by controller file size at implementation time, not a spec concern).
- Whether `name` sent to Core should re-fetch the conversation's current title server-side at publish time (favoring freshness) or accept a `title` field from the client request body (favoring one fewer Core round-trip) — resolved in `conversation-publish-api`'s spec as: **server re-fetches**, to avoid trusting a client-supplied display title for a value Core stores and other users will see.

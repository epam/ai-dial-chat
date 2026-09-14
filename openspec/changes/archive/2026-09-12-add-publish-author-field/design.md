## Context

The catalog's **Hosted by** row is rendered from a deployment's `owner`, which DIAL Core derives from the `displayAuthor` recorded on the publication that created the published copy. Both publish paths in this repo already send `displayAuthor` — and both hardcode it to the session's display name:

- `apps/chat-api/src/publish/publish.controller.ts:76` passes `getUserDisplayName(claims)` into `PublishService.publish`, which sets `displayAuthor: author` on the `createPublication` body (`publish.service.ts:131`).
- `apps/chat-api/src/conversations/conversation-publish.controller.ts:86` does the same into `ConversationPublishService.publish` (`conversation-publish.service.ts:117`).

Nothing in the UI can influence that value. The publish panel (`libs/publish-panel`) renders a resource summary, a destination-folder tree with callout, and the access-rules editor; there is no author control, and no field for one in the create/edit toolset flows either. So the only correction available today is an administrator hand-editing `displayAuthor` on the live publication in the admin panel's JSON editor.

Constraints that shape the design:

- **Library isolation** (AGENTS.md §Library isolation). `libs/publish-panel` and `libs/catalog` must not read session claims, i18n, or app context. The publisher's display name is host knowledge and has to arrive as a prop.
- **One shared panel, two hosts.** `PublishPanel` is rendered by `libs/catalog`'s `DetailsPanel` (catalog entities) and, via `StandalonePublishPanel`, by `apps/chat`'s `PublishConversationPanelContainer` (conversations). Both are in scope.
- **`usePublishFlow` owns publish-flow state.** Folder selection, rules, submit status, and reset all live there; the author belongs in the same place.
- **Generated client.** Both request DTOs change, so `npm run openapi` / `npm run openapi:check` and a `chat-api-client` rebuild are part of the change.

## Goals / Non-Goals

**Goals:**

- Let the publisher set the displayed author at publish time, in both the catalog and conversation publish flows.
- Pre-fill the field with the publisher's own display name so the common case stays one click.
- Keep every existing caller working: an omitted or empty `author` behaves exactly as today.
- Keep host knowledge (session claims, i18n, endpoint paths) out of `libs/publish-panel` and `libs/catalog`.

**Non-Goals:**

- Editing the author of an already-published entity. That still requires a new publication (or an administrator), and this change does not add an edit-in-place path.
- An author field on the toolset/application create or edit forms. The issue's table lists those steps as lacking the field, but the value they would set is the publication's, not the resource's — publish time is where it belongs.
- Changing the author on unpublish. A removal request's `displayAuthor` identifies the requester of that removal; it is not the published entity's author.
- Validating the author against a directory of real users or teams. The field is free-form display text by design — naming `DIAL Team` is the motivating use case.
- Any DIAL Core change. `displayAuthor` is already part of Core's `createPublication` contract.

## Decisions

### D1. The author is optional, with the server-side fallback kept intact

`PublishCatalogEntityDto.author` and `PublishConversationDto.author` are both `@IsOptional()`. Each controller resolves the effective value as `author?.trim() || getUserDisplayName(claims)` and passes that single string to the service, so the service signature and the `displayAuthor: author` line stay exactly as they are.

*Why:* the fallback already exists and is correct; making the field required would break every client that does not send it (including the generated client before regeneration) for no gain. The frontend omits the field entirely when the trimmed value is empty, which keeps the wire contract honest about "I did not choose an author" rather than sending an empty string that Core would store verbatim.

*Alternative considered — required field, client-side validation.* Guarantees a non-blank **Hosted by**, but the fallback path still has to exist for non-UI callers, so it buys a second enforcement point rather than a simpler contract. Rejected.

### D2. `author` / `onAuthorChange` are required controlled props on `PublishPanel`, mirroring `rules` / `onRulesChange`

`PublishPanelProps` and `StandalonePublishPanelProps` each gain:

```ts
/** Current display author for the publication. */
author: string;
/** Called with the next author value on every edit. */
onAuthorChange: (author: string) => void;
```

*Why:* every other panel input is already a required controlled prop driven by `usePublishFlow`, and an optional pair would force a `renderAuthorField ? ... : null` branch and a second source of truth. Making them required is a compile-time break that the two in-repo call sites fix in the same change; it is flagged **BREAKING** in the proposal for external consumers of `@epam/ai-dial-publish-panel`.

*Alternative considered — the panel owns the author state internally, exposed only through a `defaultAuthor` prop.* Would keep the prop surface smaller, but `handleSubmit` lives in the hook, so the value would have to be lifted at submit time anyway. Rejected.

### D3. `onPublish` gains a fourth positional argument

```ts
onPublish: (
  item: TItem,
  folderPath: string[],
  rules: PublicationRule[],
  author: string,
) => Promise<void>;
```

and the same fourth argument is added to `CatalogProps.onPublish` / `ItemDetailsProps.onPublish` in `libs/catalog`.

*Why:* it matches the existing positional style the `rules` argument already established, and both in-repo implementations (`useCatalogPublishing.handlePublish`, `PublishConversationPanelContainer`'s inline `onPublish`) are updated in this change.

*Alternative considered — collapse the trailing arguments into an options object (`{ rules, author }`).* Cleaner long-term and forward-compatible, but it is a larger break for the same consumers and churns the spec text for `rules` that was settled recently. Rejected; revisit if a third publish-time field appears.

### D4. The host supplies the prefill through `defaultAuthor`; the hook re-syncs only while the field is untouched

`UsePublishFlowOptions` gains `defaultAuthor?: string` (default `''`). `usePublishFlow` seeds `author` from it, and keeps an internal "user has edited" flag: while that flag is false, a later change to `defaultAuthor` replaces the field's value; once the user types, `defaultAuthor` is ignored. `reset()` restores `author` to the current `defaultAuthor` and clears the edited flag.

*Why:* `useUserProfile` reads from `UserContext`, so the display name can arrive after the panel first renders (and changes when a different user's session loads). Seeding with `useState(defaultAuthor)` alone would leave the field permanently blank in that case; unconditionally syncing would wipe what the user typed. The edited flag is the minimal correct rule.

`apps/chat` resolves the value: `CatalogView` and `PublishConversationPanelContainer` both call `useUserProfile()` and pass `displayName` down — as `publishDefaultAuthor` on `<Catalog>` (forwarded to `DetailsPanel`, then into `usePublishFlow`) and as `defaultAuthor` on `usePublishFlow` respectively. No lib reads `UserContext`, OIDC claims, or i18n, satisfying AGENTS.md §Library isolation. `useUserProfile`'s `displayName` falls back to the email and then to `''`, which is exactly the "no prefill, server decides" case D1 already covers.

### D5. The field sits directly below the destination folder, above the access rules

Inside `PublishPanel`'s destination-folder block, after `PublishFoldersTree` and its callout, before the `PublishAccessRules` wrapper. Rendered with ui-kit 2.0 `Input` (`labelProps={{ label: authorLabel }}`, `placeholder`, `caption` for the hint, `maxLength={200}`, `disabled={isSubmitting}`), matching how `PublishAccessRuleEditor` already uses `Input`.

*Why:* this reproduces DIAL Chat 1.0's placement ("directly under the destination folder"), and keeps the visual grouping the panel already has — identity of the publication first, then who may see it.

### D6. Validation is a length cap and a control-character reject, not an allowlist

`author?: string` with `@IsOptional()`, `@IsString()`, `@MaxLength(200)`, and `@Matches(/^[^\p{Cc}]*$/u)`. The frontend caps input at 200 characters natively and trims before sending.

*Why:* `@MaxLength(200)` matches the precedent set by `PublishRuleDto.source`/`targets`. The value never becomes a path, URL, or resource id — it is display text forwarded to Core — so the `@Matches` allowlist that `apps/chat-api/AGENTS.md` requires for path/URL strings does not apply in its usual form; the control-character reject is the residual protection, since the value can reach a log line through Core's own error text.

### D7. Sending an author does not change who Core records as the publication's actor

Core stores both `author` (the authenticated identity, derived from the bearer token) and `displayAuthor` (the free-text label). `PublishResultDto.publishedBy` already prefers `publication.author` over `displayAuthor` (`publish.service.ts:187`), so publish history and the returned result keep reporting the real publisher even when a different display author was submitted. Nothing about authorization changes: Core still enforces target-folder write access against the caller's own token.

### D8. Backward compatibility of the generated client

Both DTOs gain an optional field, so the regenerated `@epam/ai-dial-chat-api-client` stays source-compatible: `publishCatalogEntityDto` and `publishConversationDto` object literals without `author` still type-check. `apps/chat/src/server-api/conversation-publish.api.ts`'s `publishConversation` gains a fourth positional `author: string` parameter, which is an internal wrapper with a single call site.

## Risks / Trade-offs

- **A publisher can attribute a toolset to a team they do not represent.** → The field is display text only; Core still records the authenticated `author` alongside it, publish history reports that real identity (D7), and every publication goes through administrator approval before it reaches the catalog. Impersonation is visible to the approver.
- **Required `author` / `onAuthorChange` props break external consumers of `@epam/ai-dial-publish-panel` and `@epam/ai-dial-catalog`.** → Flagged **BREAKING** in the proposal and in both READMEs; the compile error is immediate and the fix is passing the two values `usePublishFlow` now returns.
- **`defaultAuthor` arriving late could overwrite what the user typed.** → The edited flag in D4 makes the sync one-way and one-shot; covered by a dedicated hook test.
- **Silent truncation at 200 characters.** → `maxLength` on the input stops further typing rather than discarding a submitted value, and 200 is far beyond any realistic team or person name. No inline error is added for it.
- **New strings drift out of translation.** → Keys are added to `PublishI18nKeys` and `en.json` in the same change; the lib props keep English defaults so a missing override degrades to readable text rather than a raw key.
- **The panel grows a fourth section and gets taller on mobile.** → The panel body already scrolls (`StandalonePublishPanel`'s scrollable content area); the field is a single-row input with no new breakpoint behaviour.

## Migration Plan

No data migration. The change is additive on both endpoints and deploys as a single unit:

1. Backend DTO + controller fallback, verified independently — old request bodies keep working before any frontend ships.
2. `npm run openapi` / `npm run openapi:check`, rebuild `libs/chat-api-client`.
3. Library prop and hook changes, then the two host call sites.
4. i18n keys, READMEs, `npm run validate:docs`.

Rollback is a straight revert: publications created with a custom `displayAuthor` keep it (Core owns that record), and reverting only removes the ability to set a new one.

## Open Questions

- Should the field be hidden when the host cannot supply a `defaultAuthor` at all (an anonymous or claims-less session)? Current answer: no — the field renders empty and the server falls back to `'Unknown Author'` via `getUserDisplayName`, which is today's behaviour.
- Should previously used author values be offered as suggestions (a datalist of the user's own past `displayAuthor` values)? Out of scope here; it would need a new read path over the user's publications.

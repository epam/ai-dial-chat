# Design

## Context

See `proposal.md` for motivation. Current state that shapes the approach:

- The builder's Metadata column is `MetadataForm` from `libs/builder-form`, fed by `useMetadataForm` (`DeploymentCreationFormValues`, shared with toolsets and other editors) and mounted by `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx` in the `metadata` slot of `BuilderFormContainer`/`EditorLayout`. Unsaved-changes tracking there is `metadata.isDirty || isSetupDirty || isSetupEditorDirty`.
- How each app definition persists differs: a definition may provide `create` and `update` (schema and custom apps call `updateApplication`); the Quick App definition has no `update`, and `ApplicationFormEditor.persist` hands its metadata to the definition's setup component instead. The host therefore has no uniform write path for metadata across definitions, and Access must not depend on any of them.
- chat-api `PATCH /api/v1/applications/:applicationName` is a read-modify-write: `mergedBody = { ...stored, ... }`, so stored fields the DTO does not touch (including `resource_dependencies`) are echoed back. It always rebuilds `displayName` and `description` from the body (`name` is required) and fully replaces locales.
- Core returns `resource_dependencies` only from its single-application read; the deployments list that feeds the editor does not carry it.
- Core is read-only for us. Facts used here are in the proposal.

## Goals / Non-Goals

**Goals:** a faithful, lossless editor of the user-authorable subset of `resource_dependencies` that works the same for every app definition; logic in libs, apps only adapt; everything not yet answered by design lives behind the host (labels, option list, notice text, visibility), so answers change data passed in, not code.

**Non-Goals:** approval state, the user consent document, `required`, custom paths. Reconciling concurrent writers of other app kinds: whatever an embedded editor or another definition writes is out of scope here.

## Decisions

### D1. Where the code lives (thick libs, thin apps)

| Piece | Home | Why |
|---|---|---|
| `AccessField`, `AccessModal`, `AccessEntry`/option types | `libs/builder-form` | Pure UI; Core words and URL grammar stay out. |
| `AccessLevel` enum (`Read`, `ReadWrite`) | `libs/chat-shared` | One enum for both libs (`builder-form` re-exports it, `chat-hooks` uses it), so the host needs no mapping between two copies. It is a UI concept, not the Core `READ`/`WRITE` pair. |
| Mapping stored list <-> UI entries, partition into editable/preserved, order-preserving merge, deterministic `link_id`, `write` rule per type, `useApplicationAccess` (state, dirty, reset, request value), `useApplicationAccessSync` (load, retry, save and classification of a refusal, with the loader and saver injected, returning an outcome and no UI), and in `src/catalog` the optional `beforeEmbeddedSave` / `afterSave` steps of the Save-panel adapters and `createReusingCreateIn` / `useCreatedResourceMemory` (reuse of a resource an earlier attempt created) | `libs/chat-hooks`, new domain folder `src/application-access/` with `models.ts`, `types.ts` | Pure over DIAL Core data, uses only generated-client types (allowed by AGENTS.md). No routing, i18n or storage. |
| Labels via `t()`, the option list (which types are enabled), notice text, toasts, passing the generated-client calls as loader and saver, the `ResourceSaveError` for the panel, wiring | `apps/chat` | Host policy and copy. `useApplicationAccessEditor` is a thin wrapper over `useApplicationAccessSync`. |
| DTO fields, read endpoint, Core calls, 403 mapping | `apps/chat-api` | Backend edge. |

`apps/chat` will not hold the mapping, the type rules, or any URL string.

### D2. Composition: a sibling of `MetadataForm`, not a field inside it

The host renders `<MetadataForm />` and `<AccessField />` together in the `metadata` slot. Alternatives: (a) a new `MetadataField.Access` inside `DeploymentCreationForm`, rejected because the form's values type is shared by toolsets and others and would grow a field most editors never use; (b) a `renderAfter` slot on `MetadataForm`, rejected as an extra API for one consumer. A sibling needs no change to the existing components and is opted into per definition.

### D3. State ownership

The access draft lives in `useApplicationAccess` (chat-hooks), instantiated in `ApplicationFormEditor` only when the definition enables Access. It exposes `entries`, `preservedChips`, `setEntries`, `isDirty`, `reset`, `toRequestValue()` (undefined while untouched). `isDirty` is a normalised, order-preserving deep comparison of the current list against the loaded baseline (access compared as a set, `url` byte-exact), not a flag set on first edit. `ApplicationFormEditor` ORs `access.isDirty` into its existing dirty flag so `builder-unsaved-changes-guard` covers it. No new context.

### D4. Entry identity and `link_id`

One configured entry per content type (the modal disables used types), so a new entry's `link_id` is deterministic: `access-<type>` (for example `access-files`). Stable across edits, unique by construction, no randomness in tests. If a preserved entry already uses that id, a numeric suffix is added. A loaded entry keeps its stored `link_id`. Rejected: random ids, `nanoid`.

### D5. Representable vs preserved, and order

Loading partitions the stored list. An entry is editable only when `target.url` is exactly `<type>/{current-user}/` for a type in the host-supplied option list, `required` is falsy, `access` (as a set) equals `{READ}` or `{READ, WRITE}`, and no earlier entry already claimed the type. Everything else is preserved opaque and shown as a read-only chip. Core compares declarations order-sensitively and treats a changed order as a changed list, so the merge keeps every entry at its original index: an edited entry is replaced in place, a removed one is dropped, a new one is appended last, a preserved one never moves. An unchanged draft therefore normalises to the baseline and `toRequestValue()` returns undefined. Rejected: `[...preserved, ...configured]`, which silently reorders a mixed list and triggers a 403 or an approval drop with no real change.

### D6. Saving: one host step for every definition, and the read path

Access is saved by its own host step, independent of how the definition persists the rest, so it works the same for the Quick App, schema and custom definitions and for any future one:

1. `ApplicationFormEditor.persist` runs the definition's own create / update / setup save exactly as today and waits for its success.
2. If `access.isDirty`, it then calls a server-api wrapper that PATCHes the application with the display fields built from the current metadata values by the shared `toApplicationMetadataFields` helper (`name` is required and display fields are fully replaced, so the step sends the same values the form holds, as the definitions' own updates do) plus `resourceDependencies` from `access.toRequestValue()`. The wrapper takes the ready fields and knows no form type.
3. On success the access baseline is reset. On a Core refusal for user-authored dependencies (`applicationResourceDependenciesNotAllowed`) the step is non-blocking: the form keeps the draft, a warning is shown and the rest of the save carries on without the new list. On any other failure the form keeps the draft and the error is shown; the definition's save is not rolled back, so a failed Access step is a partial success by design. After a create, the step runs against the created id (including after `switchToCreatedApp`), so a Core refusal never blocks creating the application itself.

In the plain save (`persist`) the step runs after the definition's own save, as above. In the Save panel, which is how a Quick App saves a new application and edits its own, the panel orchestrates save, then move, then publish or a direct write into an organisation unit, and only then reports back. A step run after that report would miss every copy those later stages make (the publication's review copy, the organisation-unit copy) and, for a new version, would patch a resource whose identity differs from the form's. So in the panel the step runs inside the save phase the host controls: before the embedded save (the embedded save goes through the update endpoint's read-modify-write, which keeps the stored list, so a refusal aborts before anything is written to the application, and a new version still receives the list through the commit), after the create in the create adapter, and after `update` or `createVersion` in the host adapter, always before publish, move or the organisation-unit write. A new version then receives the new list through the commit, and a published or organisation-unit copy carries it. A failure other than the user-authored-dependencies refusal is reported like the embedded save does (it shows its own error and aborts the panel's save), so the author sees one error and the panel does not report success. The user-authored-dependencies refusal does not abort: the panel continues (publish, move, commit, organisation-unit write) without the new list and the host shows a warning. `handleSavePanelSaved` runs no Access step. After a refusal in the create adapter the application already exists: the editor switches to edit mode for it when the panel closes, and an open panel retried in the same folder reuses it; a retry in a different folder creates another application, which is accepted. Rejected: extending a definition's own write path or an embedded editor's protocol (per-definition work, an external dependency), and embedding the field in each definition's `update` (repeats the work per kind).

Read path: a new endpoint `GET /api/v1/applications/:applicationName/resource-dependencies` returns `{ resourceDependencies }` from Core's single-application read, authorised by the caller's own access to the application (Core enforces it with the user token), uncached so the editor always sees the live list and nothing needs invalidating. The editor calls it once when an existing application opens. Rejected: adding the field to the deployments list DTO (Core's list does not carry it) and caching it (an extra invalidation rule for a call made once per editor open).

### D7. Core 403 for user-authored dependencies

`throwApplicationSaveError` (`apps/chat-api/src/applications/utils/application-save-error.ts`) already maps one coded 403. A second branch recognises Core's message for a refused dependency change and throws a `403` with `ApplicationErrorCode.ResourceDependenciesNotAllowed` and a fixed message. The match is on a normalised substring of Core's text (`allowuserauthoreddependencies`), pinned by a unit test. In `apps/chat` the Access step maps `getApiErrorDetails(error).code` to the translation key `appsEditor.access.adminOnlyError`; there is no existing frontend precedent for `ApplicationErrorCode`, so the mapping lives next to the Access save step. Trade-off: coupled to Core wording (read-only for us); an unrecognised 403 falls back to the generic message.

### D8. Option list and per-option rights

`apps/chat` passes `contentOptions` as `{ id, label, allowedAccess }[]`; the rule "no write on applications/toolsets" is written once in `chat-hooks` (allowed rights per type) and the app derives `allowedAccess` from it. Adding a content type later means a member in the `chat-hooks` enum, its allowed rights, and a label key in the app.

### D9. Visibility and notice (defaults pending design)

Section always visible for a definition with Access enabled; the blue notice uses the kit `Notification` as a section message with the info variant (variant confirmed through the kit MCP before coding). The notice says the access works only after the application is published and an administrator approves it, and, in edit mode for an application that has entries, that saving changes can remove an earlier approval (Core drops it for any non-display change by a non-administrator, not only for Access). Both texts are label props. The section is the kit's `FormSection` with a `NeutralButton` as its action, as in the Add-ons rows of the same builder, and the chips are kit `Tag`s (`TagAppearance.Bordered`) typed with `dial-tiny-text` in the secondary text colour, as in the mockup. Accepted deviation: the secondary colour (`#57647a`) on the chip backgrounds gives 4.8 to 5.8:1, which passes WCAG AA but not the 7:1 AAA target of `.claude/rules/a11y.md`; the product owner chose to follow the mockup, and design should be told. The kit `Tag` takes a plain string, so the mockup's bold content name cannot be drawn. The description sentence "Shown to users before they install" is the designer's wording; chat has no UI for the consent document, so it stays an open question.

### D10. Lazy loading

The editor page is already a lazy route chunk, and `AccessField` renders `AccessModal` itself, so no extra lazy wrapper is added: the modal stays out of the entry chunk because the route is lazy. The rule from `.claude/rules/bundle-performance.md` that matters here is that nothing in `app.tsx`, `AppRoot.tsx` or a provider imports the Access components; the check in task 4.7 is that they are absent from the entry chunk.

## Risks / Trade-offs

- **Nothing works until the app is published and approved** -> the notice states it; no indicator in this change.
- **Core default (flag off) refuses every non-admin change, whoever owns the bucket** (Core decides on the caller not being an administrator) -> the refusal is non-blocking: the save completes without the new list, a warning says the access was not saved, and the draft is kept; removing a chip from an administrator-authored list is refused the same way. Consequence: a published copy then carries the list it had before. Accepted: the section stays visible to everyone for now.
- **Partial success** (definition saved, Access refused or failed) -> explicit in D6, draft kept, a warning for the user-authored-dependencies refusal and an error for anything else.
- **A write race** if another writer saves the same application at the same time -> the Access step reads fresh stored state in the read-modify-write; ordering after the definition's save is the only guarantee we give.
- **Coupling to Core's 403 text** -> D7 fallback and a pinned test.
- **Conversations access is sensitive** -> included by product choice; stronger wording is open question 2.

## Migration Plan

Additive and optional end to end: new optional DTO field, a new read endpoint, new optional UI. Deploy chat-api first, then the frontend. Rollback: revert the frontend (the section disappears) or both; applications keep their stored `resource_dependencies`, and later non-admin writes preserve them because an omitted field keeps the stored list.

## Open Questions

Deferrable without changing specs or task breakdown: exact notice wording and info variant, approval-state indicator (a follow-up change), which other app kinds enable Access, what `projects/{current-user}/` covers, whether the description sentence about users before they install is kept.

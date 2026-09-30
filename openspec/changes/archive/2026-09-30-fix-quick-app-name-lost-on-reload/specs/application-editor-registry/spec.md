## ADDED Requirements

Note: `application-editor-registry` is not yet an archived capability — it is currently drafted
by the (fully implemented, not-yet-archived) `unify-entity-editor-layout` change. This delta adds
a requirement to that same capability, refining its "Shared page lifecycle" requirement's
"Metadata state. Held via `useMetadataForm` ... seeded from the deployment in edit mode" bullet
for the one strategy where the current implementation does not actually do that. It does not
conflict with anything `unify-entity-editor-layout` states elsewhere and should be reconciled
into that capability's spec (not kept as a second, competing file) once both changes are
archived.

---

### Requirement: Metadata-first create preserves the submitted name across the in-place switch to edit mode

For a kind using `ApplicationCreateStrategy.MetadataFirst` (currently only `QuickApp`),
`ApplicationFormEditor`'s Metadata form (`useMetadataForm`, seeded via its `reseedKey` option)
SHALL NOT reset to the kind's empty `defaultMetadata`, or to any other value the user did not
themselves enter, at any point after a successful `create` call switches the page into edit mode
in place. The already-submitted values SHALL remain authoritative for the Metadata form for the
rest of that editor session, including across any subsequent deployments-list refresh — whether
that refresh resolves before or after the switch, and regardless of what `displayName` the
resolved deployment carries. In particular, the Metadata form SHALL NOT be reseeded from the
newly created application's own resolved deployment within the same session: doing so was found,
during review, to reopen a race with `switchToCreatedApp`'s fire-and-forget deployments-list
refetch (which does not mark the form busy/inert), where an edit typed after Create but before
that refetch resolves could otherwise be silently overwritten the moment it did resolve.

This requirement has no dependency on any particular reseed-key implementation; it constrains
observable behavior only. (The reference implementation satisfies it with a boolean state,
`wasCreatedThisSession`, set once by the in-place switch, which freezes the reseed key at
`undefined` from that point on — the same value it already held throughout create mode — rather
than ever adopting the resolved deployment's id as the reseed key for the rest of the session.)

This requirement governs only the metadata-first create→edit switch. It does NOT change how
Metadata seeds when a kind's edit mode is entered any other way (see "Edit mode seeds Metadata
once from the resolved deployment" below), including a page reload immediately after creating —
that case has no in-place switch to protect and still needs the reseed to recover the persisted
name at all.

#### Scenario: The name stays visible immediately after Create, before the deployment resolves

- **WHEN** a user types a name, clicks Create for a Quick App, and `createApplication` resolves
  with a new id, but the deployments list has not yet been refetched to include it
- **THEN** the Metadata form's Name field still shows the submitted name (it is never reset to
  empty) even though the page has already switched to edit mode in place

#### Scenario: The resolved deployment never overwrites the submitted values within the same session
- **WHEN** the deployments list is subsequently refetched and now includes the newly created
  application (matching the id added to the URL), even with a `displayName` that differs from
  what was submitted (e.g. a value the user changed in the window between Create and that
  refetch resolving)
- **THEN** the Metadata form's Name field is unchanged from what the user last set it to — the
  resolved deployment's `displayName` is never applied

#### Scenario: A later, unrelated deployments-list update does not re-seed the form
- **WHEN** the deployments list is refetched again (e.g. a background refresh) any further time
  after the in-place switch
- **THEN** the Metadata form's current values are unchanged — no in-progress edit made after the
  switch is ever overwritten

### Requirement: Edit mode seeds Metadata once from the resolved deployment

Outside the metadata-first in-place switch covered above — most importantly, a fresh
`ApplicationFormEditor` mount opened directly in edit mode, such as a page reload performed
immediately after creating an application — the Metadata form SHALL be seeded from
`useEditedApplication`'s resolved deployment (`deploymentToMetadata`) the first time it resolves,
so the persisted name (and other Metadata fields) become visible without requiring any further
user action. Because `useEditedApplication` keeps the first matched deployment for a given id
sticky across later deployments-list updates, this reseed happens at most once per mount; a
later, unrelated deployments-list refresh does not re-trigger it.

#### Scenario: A page reload right after creation shows the persisted name
- **WHEN** a user creates a Quick App and immediately reloads the page (a fresh
  `ApplicationFormEditor` mount, with no `wasCreatedThisSession`/in-memory state, opening directly
  in edit mode for the new `appId`)
- **THEN** once `useEditedApplication` resolves the matching deployment from the (now correctly
  invalidated, per `applications-write-api`) deployments list, the Metadata form's Name field
  shows the submitted name — never the kind's empty default

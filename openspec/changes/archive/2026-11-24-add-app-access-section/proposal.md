# Proposal

## Why

An app author cannot say which of the user's DIAL resources (files, prompts, skills, conversations, applications, toolsets) the app is allowed to reach on the user's behalf. DIAL Core already supports this as `resource_dependencies` on an application, and an administrator can already approve it through the Admin Consent API, but the builder has no way to author it. Designers added an **Access** section under Metadata (Configure button, modal with `content + access` cards, chips below the section) to close the gap, starting with Quick Apps.

## What Changes

- New **Access** section directly under the Metadata fields in the builder: title, short description, `Configure` button, and a chip per configured entry (`Files: Read`, `Prompts: Read&Write`), each removable.
- `Configure` opens a modal. Each card is `Select content` + `Select access` + delete. When the last card is filled, an empty card appears below it (the same trailing-empty-card pattern used by the Conversation Starters list). `Cancel` discards, `Save` applies the whole draft.
- Content options: Files, Projects, Skills, Prompts, Conversations, Applications, Toolsets (Projects and Files are the examples in the designer's mockups). Access options are `Read` and `Read&Write`; Applications and Toolsets offer only `Read` because Core rejects `write` on them.
- A blue info notice under the section: the access takes effect only after an administrator approves it (same notice style as the publish panel's section messages).
- Entries the simple editor cannot represent (an admin's `files/public/policies/`, `required: true`, several entries for one type) are preserved untouched on save and shown as read-only chips.
- Access is saved by one host step that runs after each definition's own save, so it works the same for every app definition; chat-api accepts an optional `resourceDependencies` on create and update, adds a read endpoint for the stored list, and passes the list to DIAL Core; a Core `403` (user-authored dependencies disabled) is mapped to a typed error and shown on save.
- Enabled for Quick Apps first; other app definitions opt in through one flag on the editor definition.

## Capabilities

### New Capabilities
- `app-access-section`: the Access section, its modal, the chip summary, the approval notice, the mapping between UI entries and `resource_dependencies`, and how preserved entries and Core errors behave.

### Modified Capabilities
- `builder-form`: public surface gains the Access components and types; the host-isolation rules apply to them.
- `applications-write-api`: create and update accept an optional `resourceDependencies` list; omitting it keeps the stored list; Core `403` for this field has its own error code.

## Alternatives Considered

| Option | Verdict |
|---|---|
| `resource_dependencies` on the application (chosen) | The only Core field with typed targets and `read`/`write`; enforced through the per-request key; listed in the user consent document; approvable through the Admin Consent API. |
| `features.consentRequired` | A boolean; carries no content type or rights. |
| A free-form entry in `application_properties` | Core does not enforce it, so the section would be a label with no effect. |
| `external_services` | OAuth to third-party systems, not DIAL resources. |

## Facts From DIAL Core (read-only for this repo)

- Entry shape `{ kind: "dial.resourceLink", link_id, target: { url }, access: ["READ","WRITE"], required }`; target is `<type>/{current-user}/` for the caller's own bucket.
- `write` is rejected (400) on `applications` and `toolsets`; up to 100 entries; `link_id` unique per application.
- `applications.allowUserAuthoredDependencies` is a static Core setting (default `false`) with no API to read it. While it is off, a non-admin write that changes the list is answered `403`; an empty or unchanged list and an omitted field are accepted.
- Nothing is granted until the application is published and an administrator approves the saved list (`POST /v1/admin-consent/{id}`). An administrator does this through the Admin Consent API; an unpublished application in a user's bucket cannot be approved. Core drops the approval when a non-administrator saves any change beyond the display fields (name, version, icon, description, keywords), not only a change to the list.

## Non-goals

- No Core changes, and no probing of Core with tokens.
- No approve/revoke UI in chat (administrators approve through Core's Admin Consent API) and no rendering of the user consent document.
- No `required` switch, no custom paths or fixed buckets authored by the user.
- No approval-state indicator beyond the static info notice (asked of design).

## Open Questions (do not block slices A-C)

1. Does design want an approval-state indicator (approved, pending, stale) for the author?
2. Exact wording of the info notice (it must say the access works only after the app is published and approved), of the edit-mode warning that saving can drop an existing approval, and a stronger warning for Conversations.
3. Whether the section is hidden or disabled when Core is known to refuse user-authored dependencies. Current default: always visible, `403` shown on save.
4. Whether other app kinds (custom, schema apps) get the section, and which content types each shows.
5. Whether the description sentence "Shown to users before they install" stays (chat has no UI for the consent document).
6. What `projects/{current-user}/` covers (own projects only or shared ones); it may call for a stronger warning, like Conversations.

## Impact

- **Libs (thick):** `libs/builder-form` gets `AccessField`, `AccessModal` and types, driven by props (`contentOptions` with per-option allowed access, `value`, `onChange`, `*Labels`, `*Colors`). `libs/chat-hooks` gets the pure mapping between UI entries and `resource_dependencies`, generated `link_id`, and preserved-entry handling. Host and Core knowledge stays out of `builder-form`; `chat-hooks` uses only the generated client's types, as AGENTS.md allows.
- **Apps (thin):** `apps/chat` fills labels with `t()`, passes the option list, builds the save payload, shows the `403` error; `apps/chat-api` extends the create/update DTOs and the error mapping.
- **API contract:** an additive optional field plus one new read endpoint `GET /api/v1/applications/:applicationName/resource-dependencies` (authorized by the caller's own access to the application, uncached); `npm run openapi` and a client rebuild.
- **i18n:** new strings (section title and description, Configure, modal title and placeholders, seven content names, two access names, notice, error). New keys in `en.json`.
- **RTL and a11y:** logical Tailwind classes, kit `LiveRegion` for add/remove feedback, keyboard reachable modal; chips removable by keyboard.
- **Scope-creep flags:** touches shared libs `builder-form` and `chat-hooks`, and the generated client. No global providers, no new context.
- **Rollback:** fully additive and optional. Reverting hides the section; stored `resource_dependencies` stay in Core and are preserved by later non-admin writes because an omitted field keeps the stored list.
- **Closest models:** `libs/builder-form/src/components/DeploymentLocalesField` (summary row plus popup), the existing popup-with-rows pattern in `DeploymentLocalesField` (the trailing blank card is specified in the spec), `libs/publish-panel/src/components/PublishAccessRules` (section message).

## Acceptance Criteria

- An author can add, change and remove Access entries from the builder for a Quick App, and the saved application carries the matching `resource_dependencies`.
- Entries not creatable in the modal survive a save unchanged.
- `write` is never offered or sent for Applications and Toolsets.
- A user without rights to change the list sees a clear error instead of a lost edit.
- All new strings are translated keys, the UI mirrors in RTL, and `npm run validate:docs` and `npm run validate:specs` pass.

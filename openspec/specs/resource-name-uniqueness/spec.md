# Spec: resource-name-uniqueness

## Purpose

Prevents a user from creating two toolsets or agents that are indistinguishable in the
catalog. Defines when two entities are duplicates (folder, displayed name, displayed
version, per catalog tab, own bucket) so every write path rejects them the same way,
independently of the storage path.

## Requirements

### Requirement: Duplicate key and scope

Two entities SHALL be duplicates when all of the following hold:

- both are owned by the caller (`isMy`: the owner bucket in the resource id is the
  caller's bucket);
- both are in the same Personal folder (the path between the bucket and the last
  segment of the resource id; the bucket root is its own folder);
- both belong to at least one common catalog tab, as defined below;
- their displayed names are equal after trimming, case-sensitively, where the displayed
  name of a stored entity is resolved by one deterministic rule: a plain string as it is;
  a locale map by its `en` entry, otherwise its first entry; and the candidate's name is
  the `name` the caller submits (the primary-locale value, whatever `primaryLocale` the
  body declares); and
- their displayed versions are equal as stored strings. An absent version SHALL be treated
  as the platform default version used at creation.

The comparison SHALL use displayed name and displayed version, never the storage path, so a
path that no longer matches the visible name neither causes nor hides a duplicate. Entries
the catalog hides (ids carrying the folder marker file) take no part in the comparison.
Folder segments SHALL be compared after decoding, so a folder name containing spaces or
reserved characters matches regardless of how an id encodes it.

Entities that are public, organisation-level, or shared with the caller but owned by
another bucket SHALL NOT take part in the comparison. Folders SHALL separate namespaces:
the same name and version in two different folders is not a duplicate.

#### Scenario: Same name and version in different folders

- **WHEN** an own agent `X` version `1.0.0` exists in folder `Design` and the caller creates an agent `X` version `1.0.0` in folder `Research`
- **THEN** the create is accepted

#### Scenario: Same name and version as a published copy

- **WHEN** the only entity named `X` version `1.0.0` is a public copy owned by another bucket
- **THEN** creating an own `X` version `1.0.0` in the same folder is accepted

#### Scenario: Localized stored name

- **WHEN** an own toolset is stored with the display name map `{ "en": "Search", "de": "Suche" }`, version `1.0.0`, and the caller creates a toolset `Search` version `1.0.0` in the same folder
- **THEN** the create is rejected as a duplicate

#### Scenario: Locale map without an `en` entry

- **WHEN** an own agent is stored with the display name map `{ "de": "Suche" }`, version `1.0.0`, and the caller creates an agent `Suche` version `1.0.0` in the same folder
- **THEN** the create is rejected as a duplicate (the first entry is used)

#### Scenario: Folder with reserved characters

- **WHEN** an own agent `X` version `1.0.0` exists in folder `Team A/Q&A` and the caller creates an agent `X` version `1.0.0` with `folderPath` `Team A/Q&A`
- **THEN** the create is rejected as a duplicate

#### Scenario: Different version

- **WHEN** an own toolset `X` version `1.0.0` exists in a folder and the caller creates a toolset `X` version `1.1.0` there
- **THEN** the create is accepted

### Requirement: Catalog tab membership defines what competes

An entity SHALL be compared only with entities in a tab it also belongs to. Membership
SHALL follow the deployment classification already used by the catalog:

| Entity | Tabs |
| --- | --- |
| Toolset resource | Toolsets |
| Application whose `interfaces` include `mcp` and neither `chat` nor `custom_ui` | Toolsets |
| Application whose `interfaces` include `mcp` and (`chat` or `custom_ui`) | Agents and Toolsets |
| Application with `chat` or `custom_ui`, without `mcp` | Agents |
| Application with no recognised interface | Agents |

A toolset being created or updated SHALL be compared with the Toolsets tab. An application
being created SHALL be compared with the Agents tab, because its `interfaces` are derived
by DIAL Core from its type and are not known before the write. An application being
updated, forked or moved SHALL be compared with every tab its `interfaces` place it in; the
`interfaces` come from the fresh deployments list entry whose id matches the application
(a stored application body carries none). When no such entry exists, the application
SHALL be treated as an agent only.

The backend cannot observe the catalog's `isToolsetTabEnabled` option; it SHALL always
classify as if the Toolsets tab is enabled. This is a deliberate approximation: with the
tab switched off an MCP-only application is shown under Agents, yet the rule still
guards the Toolsets tab, which can only make the check stricter, never looser.

#### Scenario: Toolset against an MCP-capable agent

- **WHEN** an own application with `interfaces` `chat` and `mcp` named `X` version `1.0.0` exists in a folder and the caller creates a toolset `X` version `1.0.0` in that folder
- **THEN** the create is rejected as a duplicate whose conflicting kind is agent

#### Scenario: Toolset against a chat-only agent

- **WHEN** an own application with `interfaces` `chat` only named `X` version `1.0.0` exists in a folder and the caller creates a toolset `X` version `1.0.0` there
- **THEN** the create is accepted

#### Scenario: Agent against an agent

- **WHEN** an own agent `X` version `1.0.0` exists in a folder and the caller creates another agent `X` version `1.0.0` there
- **THEN** the create is rejected as a duplicate whose conflicting kind is agent

#### Scenario: Application missing from the list is treated as an agent

- **WHEN** an application is renamed and its id is absent from the fresh deployments list
- **THEN** it is compared with the Agents tab only

#### Scenario: Reverse case is not checked

- **WHEN** an own toolset `X` version `1.0.0` exists and the caller creates an application `X` version `1.0.0` whose type schema declares MCP
- **THEN** the application is compared only with the Agents tab and the create is accepted

### Requirement: Rejection is a 409 with a machine-readable code

A duplicate SHALL be rejected with HTTP `409` before any DIAL Core write, with a JSON error
body whose `code` is `name-taken-agent` when the conflicting entity is an agent and
`name-taken-toolset` when it is a toolset, in addition to the framework's `statusCode` and
`message`. Example:

```json
{
  "statusCode": 409,
  "message": "An agent with this name and version already exists in this folder",
  "code": "name-taken-agent"
}
```

The two codes SHALL be members of one string enum that appears in the OpenAPI schema of the
error response, so the generated client exposes it and `apps/chat` compares against the
generated enum rather than string literals. The code SHALL be distinct from the
exhausted-candidates conflict, which keeps its existing messages
(`Toolset version already exists`, `Application name already taken`) and carries no
`code`. No caches SHALL be invalidated and no resource SHALL be written when the
duplicate check rejects.

#### Scenario: Rejected before writing

- **WHEN** a create is rejected as a duplicate
- **THEN** no request is sent to DIAL Core's write endpoint for that entity and the response has `code` `name-taken-agent` or `name-taken-toolset`

#### Scenario: Exhausted candidates keep the existing conflict

- **WHEN** a create-only write passes the duplicate check but all 20 candidate paths respond 412
- **THEN** the response is the existing `409` without a `code`

### Requirement: Updating an entity never conflicts with itself

An update, rename or move SHALL exclude the entity being written (matched by resource id)
from the comparison, and SHALL run the comparison only when its displayed name, displayed
version or folder changes and only for an entity the caller owns; an entity shared with
the caller by another bucket's owner is not compared. A fork leaves its source in place
beside the new copy, so the source SHALL take part in the comparison.

A create SHALL be compared only when it is create-only (`createOnly`); a create without it
keeps its unconditional-write semantics and is neither compared nor given the
next-free-path fallback.

#### Scenario: Saving without identity changes

- **WHEN** the caller edits only the description of agent `X` version `1.0.0`
- **THEN** no duplicate check is performed and the save is accepted

#### Scenario: Rename into an existing identity

- **WHEN** the caller renames own agent `A` version `1.0.0` to `B` and an own agent `B` version `1.0.0` exists in the same folder
- **THEN** the update is rejected as a duplicate

#### Scenario: Entity shared by another owner

- **WHEN** the caller saves a rename of a toolset or application owned by another user and shared with write access
- **THEN** no duplicate comparison is made

#### Scenario: Fork onto the source identity

- **WHEN** the caller forks own agent `A` version `1.0.0` to version `1.0.0` in the same folder
- **THEN** the fork is rejected as a duplicate of the source

#### Scenario: Create without create-only

- **WHEN** a create arrives without `createOnly` and an own entity already has the same name and version
- **THEN** no duplicate comparison is made and the write keeps its unconditional semantics

### Requirement: The comparison reads current data

The check SHALL read the caller's current own-bucket toolsets and deployments without
serving a result cached before the request, so a duplicate created moments earlier is
seen. A failure to read either source SHALL fail the write with the same status mapping as
that read (it SHALL NOT silently skip the check). Concurrent writes that both pass the
check are not serialised, but a create-only write that meets a taken path (`412`) SHALL run
the check again on fresh lists before trying the next candidate path, so a racing create
with the same identity gets the coded `409` instead of a silent duplicate at the next path.

#### Scenario: Fresh read

- **WHEN** an agent was created 5 seconds ago and a second create with the same identity arrives
- **THEN** the second create is rejected as a duplicate

#### Scenario: Racing create with the same identity

- **WHEN** two create-only writes with the same name, version and folder both pass the first check and the second receives `412`
- **THEN** the second runs the check again, sees the first entity and responds with the coded `409`, and nothing is written at the next free path

#### Scenario: Listing fails

- **WHEN** reading the caller's deployments fails with 503
- **THEN** the write fails with the status that read maps to and nothing is written

### Requirement: The Save panel shows the conflict inline

The Save panel renders a failed write inline only for a `ResourceSaveError` it is given,
and otherwise shows the backend `message` or, for a failed new-version write answered
with `409`, its generic "version already exists" text. The save adapters `apps/chat`
gives the panel SHALL therefore be wrapped so that a `409` carrying `code`
`name-taken-agent` or `name-taken-toolset` becomes a `ResourceSaveError` with the message
below, for create, new-version (create-only and fork) and in-place saves alike, so the
panel stays open and every field value is kept. The wrapper and the mapping from the
duplicate codes to the kind of conflicting entity live in the shared hooks library
(`libs/chat-hooks`); the app supplies the translated message for each kind, so no
endpoint, route or i18n knowledge enters the library. A `409` without these codes keeps today's
rendering. The message SHALL name the conflicting kind and SHALL use the following i18n
keys (enum members added in `apps/chat/src/constants/translation-keys.ts`, strings in
`apps/chat/src/i18n/locales/en.json`):

| Key | English |
| --- | --- |
| `appsEditor.error.nameConflictAgent` | An agent with this name and version already exists in this folder. |
| `appsEditor.error.nameConflictToolset` | A toolset with this name and version already exists in this folder. |

The in-editor inline Name error SHALL show the same message in both create mode and edit
mode (today the application editor handles `409` only in create mode). The messages need no new layout and no new directional styling; they SHALL be
rendered through the existing error text surface so screen readers announce them as the
existing conflict messages already are. No feature flag applies.

#### Scenario: Toolset blocked by an agent

- **WHEN** the Save panel's create of a toolset is answered with `409` and `code` `name-taken-agent`
- **THEN** the panel stays open, shows "An agent with this name and version already exists in this folder." and the form keeps its values

#### Scenario: Rename blocked by another agent

- **WHEN** an agent rename is answered with `409` and `code` `name-taken-agent`
- **THEN** the editor shows the agent message on the Name field

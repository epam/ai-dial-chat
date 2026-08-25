## MODIFIED Requirements

### Requirement: `/skill-editor?id=...` route switches the page to edit mode

A non-empty `id` SHALL switch the page to edit mode. A full `skills/{ownerBucket}/{path}` id SHALL be parsed and used directly, enabling personal and writable shared skills to load from their real owner bucket. A legacy bucket-relative id SHALL continue to resolve against the current user's bucket. A public-bucket or malformed id SHALL be treated as an invalid load target and SHALL never be passed to `downloadSkill` or `updateSkill`.

#### Scenario: Full personal resource URL enters edit mode

- **WHEN** the user navigates to `/skill-editor?id=skills%2Fmy-bucket%2Fteam-a%2Fdocs-helper`
- **THEN** the page loads `downloadSkill('my-bucket', 'team-a/docs-helper')`

#### Scenario: Writable shared skill preserves its owner bucket

- **WHEN** the catalog navigates to `/skill-editor?id=skills%2Fowner-bucket%2Fteam-a%2Fdocs-helper`
- **THEN** load and save use `owner-bucket` and `team-a/docs-helper`

#### Scenario: Whole-skill ZIP is incompatible with the Core installation

- **WHEN** the canonical whole-skill download returns `400` as a grouping folder, or returns an archive without a usable ETag/root manifest
- **THEN** the editor loads `SKILL.md`, recursive file metadata, and every supporting file through the granular skill-file endpoints
- **AND** it derives supporting-file paths relative to `{skillPath}/files`, preserves the resource ETag for update, and never sends the technical `files` prefix back as part of a file path

#### Scenario: Development StrictMode does not abort an active ZIP stream

- **WHEN** React performs its development-only effect setup → cleanup → setup cycle
- **THEN** the discarded setup finishes before opening the HTTP stream and the active setup issues exactly one whole-skill download
- **AND** effect cleanup prevents stale state updates without aborting an already-open binary response through the Vite development proxy

#### Scenario: Public resource URL is rejected

- **WHEN** the route id begins `skills/public/`
- **THEN** no public mutation request is issued

#### Scenario: id absent stays in create mode

- **WHEN** the route has no `id`
- **THEN** the existing create flow is unchanged

#### Scenario: Successful save refreshes the catalog before navigation

- **WHEN** a personal skill is created or an editable skill is updated successfully
- **THEN** the editor awaits the aggregate skill-list refetch before navigating to the return URL
- **AND** the destination catalog renders the updated skill snapshot without requiring a page reload

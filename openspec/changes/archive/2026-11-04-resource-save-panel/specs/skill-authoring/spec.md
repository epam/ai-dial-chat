## MODIFIED Requirements

### Requirement: Create-time atomicity via createSkill; no preflight
Before calling `createSkill` in create mode, the `SkillEditor` page SHALL NOT perform a `listSkills` preflight check. Create SHALL open the Save panel (see the `resource-save-panel` capability); on the panel's Save the page SHALL call `createSkill(bucket, path, skillManifest, filePaths, files)` directly, where `path` is the chosen Personal folder followed by the normalized name. The BFF's `createSkill` sends `If-None-Match: '*'` to DIAL Core (its verified real create-only mechanism — read directly from DIAL Core's `EtagHeader` source, not inferred from an incomplete generated SDK type) and translates an upstream `412` collision to `409 Conflict`, which the page treats as the sole "a skill with this name already exists" case.

#### Scenario: Create proceeds directly to createSkill
- **WHEN** a user submits the create form and confirms the Save panel with Personal `team-a`
- **THEN** the page calls `createSkill(bucket, 'team-a/<normalized name>', skillManifest, filePaths, files)` immediately, with no preceding `listSkills` call

#### Scenario: Create collision surfaces as a naming conflict
- **WHEN** `createSkill` rejects with `409 Conflict`
- **THEN** the Save panel shows "A skill with this name already exists", stays open, and the form keeps its field values

#### Scenario: Successful create navigates on 201
- **WHEN** `createSkill` resolves successfully
- **THEN** the skills listing is refetched, the panel shows the Created notification, and the page navigates to `ROUTES.Catalog` with `itemId=skills/<bucket>/<path>`

## ADDED Requirements

### Requirement: `parseSkillManifest` splits a manifest into frontmatter and body

`apps/chat/src/utils/skill-manifest.ts` SHALL export `parseSkillManifest(raw: string): SkillManifest`, where `SkillManifest` is `{ name?: string; description?: string; about?: SkillAboutDetails; body: string }`.

The split SHALL be a leading-fence scan, not a YAML parse of the whole file:

- When `raw` does not begin with a line consisting solely of `---` (leading whitespace and a leading BOM tolerated), the entire text SHALL be returned as `body` with `about`, `name`, and `description` all `undefined`.
- When it does, the text between the opening fence line and the next line consisting solely of `---` SHALL be parsed as YAML, and everything after that closing line SHALL be `body`, with any single leading blank line removed.
- When no closing fence exists, the entire text SHALL be returned as `body` — an unterminated fence is not frontmatter.

`body` SHALL never be `undefined`: a manifest that is nothing but frontmatter yields an empty-string body.

Parsing SHALL use the `yaml` package. `yaml` SHALL be listed in the root `package.json` `dependencies` (it is currently a `devDependencies` entry at `2.8.3`).

#### Scenario: Manifest with frontmatter

- **WHEN** `raw` is `---\nname: Research\ndescription: Finds sources\n---\n\n# Instructions\nDo the thing.`
- **THEN** `name` is `'Research'`, `description` is `'Finds sources'`, and `body` is `'# Instructions\nDo the thing.'`

#### Scenario: Manifest with no frontmatter

- **WHEN** `raw` starts with `# Instructions` rather than a `---` line
- **THEN** `body` is the whole of `raw` and `about`, `name`, and `description` are all `undefined`

#### Scenario: Unterminated fence

- **WHEN** `raw` opens with `---` but contains no later line consisting solely of `---`
- **THEN** `body` is the whole of `raw` and no frontmatter field is populated

#### Scenario: Frontmatter-only manifest

- **WHEN** `raw` is `---\nname: Research\n---\n`
- **THEN** `body` is `''` and `name` is `'Research'`

---

### Requirement: Recognised frontmatter keys and their accepted spellings

Frontmatter keys SHALL be resolved onto `SkillAboutDetails` through an explicit alias table. Each field accepts a `snake_case`, `kebab-case`, and `camelCase` spelling:

| Field                       | Accepted keys                                                |
| --------------------------- | ------------------------------------------------------------ |
| `about.whenToUse`           | `when_to_use`, `when-to-use`, `whenToUse`                    |
| `about.allowedTools`        | `allowed_tools`, `allowed-tools`, `allowedTools`             |
| `about.bundledResources`    | `bundled_resources`, `bundled-resources`, `bundledResources` |
| `about.skillPrompt`         | `skill_prompt`, `skill-prompt`, `skillPrompt`                |
| `name`                      | `name`                                                        |
| `description`               | `description`                                                 |

Key matching SHALL be exact — no case-insensitive or fuzzy fallback. Keys not in the table SHALL be ignored without error and without appearing anywhere in the UI.

Values SHALL be type-checked after parsing:

- A string field whose parsed value is not a string SHALL be dropped.
- A list field SHALL accept an array, retaining only its string entries; a bare string SHALL be promoted to a one-element array; any other parsed type SHALL be dropped.
- A field that resolves to an empty string, or a list that resolves to zero entries, SHALL be omitted rather than stored as empty.

`about` SHALL be `undefined` when no recognised `about.*` field resolved, so a caller can test one value rather than four.

#### Scenario: Kebab-case keys

- **WHEN** the frontmatter contains `allowed-tools: [search, fetch]` and `when-to-use: For research tasks`
- **THEN** `about.allowedTools` is `['search', 'fetch']` and `about.whenToUse` is `'For research tasks'`

#### Scenario: Block-sequence list

- **WHEN** the frontmatter contains `allowed_tools:` followed by `  - search` and `  - fetch`
- **THEN** `about.allowedTools` is `['search', 'fetch']`

#### Scenario: Scalar promoted to a list

- **WHEN** the frontmatter contains `allowed_tools: search`
- **THEN** `about.allowedTools` is `['search']`

#### Scenario: Wrong-typed value dropped

- **WHEN** the frontmatter contains `description:` followed by a nested mapping
- **THEN** `description` is `undefined` and the rest of the frontmatter still resolves

#### Scenario: Unrecognised keys ignored

- **WHEN** the frontmatter contains `license: Apache-2.0` and `version: 3`
- **THEN** neither value appears in the parse result and no error is raised

#### Scenario: No recognised about fields

- **WHEN** the frontmatter carries only `name` and `description`
- **THEN** `about` is `undefined`

---

### Requirement: A malformed manifest degrades to body-only, never to a failure

A `yaml` parse throw SHALL be caught inside `parseSkillManifest` and downgraded to the no-frontmatter result: the **entire** `raw` string — fence included — becomes `body`, and no frontmatter field is populated. `parseSkillManifest` SHALL NOT throw for any string input.

Parse failure is strictly weaker than fetch failure. A manifest that downloaded successfully but failed to parse SHALL still produce a `promptContent`, so the Content tab renders. It SHALL NOT cause `onFetchDetails` to resolve `undefined`, and it SHALL NOT surface a user-visible notification — the body is intact and no information was lost.

#### Scenario: Malformed YAML in the fence

- **WHEN** the frontmatter contains unbalanced quotes that make `yaml.parse` throw
- **THEN** `parseSkillManifest` returns the whole input as `body` with no frontmatter fields, and does not throw

#### Scenario: Parse failure still renders Content

- **WHEN** a skill's `SKILL.md` downloads successfully but its frontmatter is malformed
- **THEN** the details panel's Content tab renders the manifest text and no notification is shown

---

### Requirement: The size guard runs before the parse

`readSkillManifest` (`apps/chat/src/utils/map-skill-to-catalog-item.ts`) SHALL keep its existing behaviour unchanged: it checks the declared `content-length` and the decoded byte length against `SKILL_MANIFEST_MAX_BYTES` and returns `null` for an oversized body, before any decoding.

`parseSkillManifest` SHALL run only on a string that guard already accepted. An oversized manifest SHALL never reach the YAML parser.

#### Scenario: Oversized manifest is never parsed

- **WHEN** a skill's `SKILL.md` exceeds `SKILL_MANIFEST_MAX_BYTES`
- **THEN** `readSkillManifest` returns `null`, `parseSkillManifest` is not called, and the panel behaves as it does today for an unreadable manifest
